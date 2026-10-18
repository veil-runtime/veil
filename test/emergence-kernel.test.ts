import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperatorRuntime } from '../src/runtime/operator-runtime.js';
import { FileJournal } from '../src/emergence/journal.js';
import { EmergenceKernel } from '../src/emergence/kernel.js';
import { createRepairDemo } from '../src/emergence/demo.js';
import type { ReasoningProvider } from '../src/emergence/types.js';

test('scoped workers cannot execute a discovered capability outside their grant', async () => {
  const name = `emergence.boundary.${Date.now()}.${Math.random()}`;
  let invoked = 0;
  new OperatorRuntime().use({
    manifest: { name, version: '1.0', capabilities: [name] },
    capabilities: [{ name, version: '1.0', risk: 'read', description: 'sentinel',
      async execute() { invoked += 1; return 'ok'; } }],
  });
  const provider: ReasoningProvider = {
    async decide() { return { kind: 'execute', capability: name, reason: 'try escalation' }; },
  };
  const journal = new FileJournal(await mkdtemp(join(tmpdir(), 'veil-boundary-')));
  const kernel = new EmergenceKernel({ journal, provider,
    workers: [{ id: 'owner', responsibility: 'No execution', capabilities: [] },
      { id: 'verifier', responsibility: 'Read only', capabilities: [name] }],
    budget: { maxDecisions: 2, maxJobs: 2, maxDelegations: 1, maxElapsedMs: 10_000, maxProposalBytes: 4096 },
  });
  const state = await kernel.start('attempt escalation', 'owner',
    { worker: 'verifier', capability: name, expected: 'ok' });
  assert.equal(state.status, 'failed');
  assert.equal(invoked, 0);
  assert.equal(state.jobs, 0);
});

test('bounded loop stops repeated proposals before an unbounded run', async () => {
  const name = `emergence.budget.${Date.now()}.${Math.random()}`;
  let invoked = 0;
  new OperatorRuntime().use({
    manifest: { name, version: '1.0', capabilities: [name] },
    capabilities: [{ name, version: '1.0', risk: 'read', description: 'repeatable read',
      async execute() { invoked += 1; return invoked; } }],
  });
  const kernel = new EmergenceKernel({
    journal: new FileJournal(await mkdtemp(join(tmpdir(), 'veil-budget-'))),
    provider: { async decide() { return { kind: 'execute', capability: name, reason: 'repeat' }; } },
    workers: [{ id: 'owner', responsibility: 'Repeat', capabilities: [name] }],
    budget: { maxDecisions: 3, maxJobs: 2, maxDelegations: 1, maxElapsedMs: 10_000, maxProposalBytes: 4096 },
  });
  const state = await kernel.start('repeat', 'owner',
    { worker: 'owner', capability: name, expected: 99 });
  assert.equal(state.status, 'failed');
  assert.equal(state.jobs, 2);
  assert.equal(invoked, 2);
  assert.match(String(state.events.at(-1)?.data.reason), /budget/i);
});

test('repair coordinates, pauses for approval, recovers and persists verification evidence', async () => {
  const { kernel, makeKernel, journal, names, source } = await createRepairDemo();
  let state = await kernel.start('Diagnose and fix failing addition test', 'coordinator',
    { worker: 'verifier', capability: names.test, expected: { passed: true } });
  assert.equal(state.status, 'awaiting-approval');
  assert.equal(state.jobs, 2);
  assert.equal((await journal.load(state.id)).status, 'awaiting-approval');
  assert.match(await (await import('node:fs/promises')).readFile(source, 'utf8'), /a-b/);
  const first = state.approvals[0];
  assert.equal(first.capability, names.patch);
  await assert.rejects(makeKernel().grantApproval(state.id, first.id, 'untrusted'), /Approval gate denied/);
  assert.equal((await journal.load(state.id)).status, 'awaiting-approval');
  state = await makeKernel().grantApproval(state.id, first.id, 'local-operator');
  assert.equal(state.status, 'awaiting-approval');
  assert.ok(state.events.some((event) => event.type === 'execution.failed' && event.data.capability === names.patch));
  const second = state.approvals.find((approval) => !approval.granted)!;
  state = await makeKernel().grantApproval(state.id, second.id, 'local-operator');
  assert.equal(state.status, 'verified');
  assert.equal(state.verified, true);
  assert.equal(state.delegations, 2);
  assert.equal(state.jobs, 5);
  assert.ok(state.events.some((event) => event.type === 'work.delegated' &&
    Array.isArray(event.data.availableCapabilities)));
  assert.ok(state.events.some((event) => event.type === 'verification.completed' &&
    typeof event.data.evidenceJobId === 'string'));
  assert.deepEqual((await journal.load(state.id)).events, state.events);
  assert.match(await (await import('node:fs/promises')).readFile(source, 'utf8'), /a\+b/);
});

test('restart after an unrecorded action outcome stops without replaying the write', async () => {
  const { kernel, makeKernel, journal, names, source } = await createRepairDemo();
  const state = await kernel.start('Fix addition', 'coordinator',
    { worker: 'verifier', capability: names.test, expected: { passed: true } });
  assert.equal(state.status, 'awaiting-approval');
  state.status = 'running';
  state.events.push({ sequence: state.events.length + 1, at: new Date().toISOString(),
    type: 'execution.started', worker: 'repair', data: { capability: names.patch } });
  await journal.save(state);
  const resumed = await makeKernel().run(state.id);
  assert.equal(resumed.status, 'failed');
  assert.match(String(resumed.events.at(-1)?.data.reason), /Uncertain execution/);
  assert.match(await (await import('node:fs/promises')).readFile(source, 'utf8'), /a-b/);
});
