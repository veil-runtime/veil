import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLocalTrial } from '../src/emergence/trial.js';
import { OpenAICompatibleReasoningProvider } from '../src/emergence/providers.js';
import { seedTask, trialTasks } from '../src/emergence/trial-tasks.js';
import type { ReasoningContext } from '../src/emergence/types.js';

const solutions = {
  slug: 'export function slug(title) { return title.trim().toLowerCase().replace(/[\\s-]+/g, "-").replace(/^-+|-+$/g, ""); }\n',
  config: 'export function parseConfig(text) { return Object.fromEntries(text.split("\\n").filter(line => line.trim() && !line.trim().startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; })); }\n',
  invoice: 'export function invoiceTotalCents(items, discountCents = 0) { return Math.max(0, items.filter(item => item.active).reduce((sum, item) => sum + item.quantity * item.unitCents, 0) - discountCents); }\n',
};

for (const task of trialTasks) test(`isolated ${task.id} trial verifies an approved repair`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'veil-trial-test-'));
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  await seedTask(task, workspace);
  let contexts = 0;
  const result = await runLocalTrial({ workspace, goal: task.goal, allowedFiles: [task.file],
    verify: task.verify, journalDirectory: join(root, 'journal'),
    budget: { maxDecisions: 5, maxJobs: 4, maxDelegations: 1, maxModelCalls: 5,
      maxInputTokens: 100, maxOutputTokens: 100, maxCostMicros: 100,
      maxElapsedMs: 30_000, maxExecutionMs: 10_000, maxProposalBytes: 4096 },
    provider: { async decide(context: ReasoningContext) {
      contexts += 1;
      assert.ok(!JSON.stringify(context).includes('"expected"'));
      const find = (description: string) => context.capabilities.find((item) => item.description.startsWith(description))!.name;
      if (contexts === 1) return { kind: 'execute' as const, capability: find('List permitted'), reason: 'Discover files' };
      if (contexts === 2) return { kind: 'execute' as const, capability: find('Read one'),
        input: { path: task.file }, reason: 'Inspect source' };
      if (contexts === 3) return { kind: 'execute' as const, capability: find('Replace one'),
        input: { path: task.file, before: task.seed, after: solutions[task.id] }, reason: 'Repair source' };
      return { kind: 'finish' as const, reason: 'Request independent verification' };
    } }, approve: async () => 'local-trial-operator',
  });
  assert.equal(result.state.status, 'verified', result.report);
  assert.equal(result.independentSuccess, true);
  assert.equal(result.state.events.filter((event) => event.type === 'approval.granted').length, 1);
  assert.equal(await readFile(join(workspace, task.file), 'utf8'), solutions[task.id]);
});

test('write waits for exact approval and leaves workspace unchanged', async () => {
  const task = trialTasks[0]!;
  const root = await mkdtemp(join(tmpdir(), 'veil-trial-denied-'));
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  await seedTask(task, workspace);
  const result = await runLocalTrial({ workspace, goal: task.goal, allowedFiles: [task.file],
    verify: task.verify, journalDirectory: join(root, 'journal'),
    budget: { maxDecisions: 3, maxJobs: 3, maxDelegations: 1, maxElapsedMs: 30_000,
      maxProposalBytes: 4096 },
    provider: { async decide(context) { return { kind: 'execute',
      capability: context.capabilities.find((item) => item.risk === 'write')!.name,
      input: { path: task.file, before: task.seed, after: solutions.slug }, reason: 'Propose change' }; } },
  });
  assert.equal(result.state.status, 'awaiting-approval');
  assert.equal(result.state.jobs, 0);
  assert.equal(await readFile(join(workspace, task.file), 'utf8'), task.seed);
});

test('workspace with a file outside the allowlist is rejected before reasoning', async () => {
  const task = trialTasks[0]!;
  const root = await mkdtemp(join(tmpdir(), 'veil-trial-scope-'));
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  await seedTask(task, workspace);
  await writeFile(join(workspace, 'secret.txt'), 'unrelated');
  let calls = 0;
  await assert.rejects(runLocalTrial({ workspace, goal: task.goal, allowedFiles: [task.file],
    verify: task.verify, journalDirectory: join(root, 'journal'),
    budget: { maxDecisions: 2, maxJobs: 2, maxDelegations: 1, maxElapsedMs: 10_000,
      maxProposalBytes: 1024 }, provider: { async decide() { calls += 1;
      return { kind: 'finish', reason: 'Done' }; } },
  }), /Unexpected workspace file/);
  assert.equal(calls, 0);
});

test('acceptance check rejects source that attempts to exit before assertions', async () => {
  const task = trialTasks[0]!;
  const root = await mkdtemp(join(tmpdir(), 'veil-trial-spoof-'));
  await seedTask(task, root);
  await writeFile(join(root, task.file), 'export function slug(title) { process.exit(0); }\n');
  assert.equal(await task.verify(root), false);
});

test('live model adapter is blocked until network-isolated verifier preflight succeeds', async () => {
  const task = trialTasks[0]!;
  const root = await mkdtemp(join(tmpdir(), 'veil-trial-live-guard-'));
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  await seedTask(task, workspace);
  let calls = 0;
  const provider = new OpenAICompatibleReasoningProvider({ authorized: true,
    endpoint: 'https://example.invalid/v1/chat/completions', model: 'fake', apiKey: 'fake',
    maxOutputTokens: 100, timeoutMs: 1000, inputMicrosPerMillion: 1_000_000,
    outputMicrosPerMillion: 1_000_000, transport: async () => { calls += 1; throw new Error('unexpected call'); } });
  await assert.rejects(runLocalTrial({ workspace, goal: task.goal, allowedFiles: [task.file],
    verify: task.verify, journalDirectory: join(root, 'journal'), provider,
    budget: { maxDecisions: 2, maxJobs: 2, maxDelegations: 1, maxElapsedMs: 10_000,
      maxProposalBytes: 1024 },
  }), /network-isolated verifier/);
  assert.equal(calls, 0);
});
