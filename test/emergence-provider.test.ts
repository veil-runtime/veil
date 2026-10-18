import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OpenAICompatibleReasoningProvider } from '../src/emergence/providers.js';
import { EmergenceKernel } from '../src/emergence/kernel.js';
import { FileJournal } from '../src/emergence/journal.js';
import { OperatorRuntime } from '../src/runtime/operator-runtime.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReasoningContext } from '../src/emergence/types.js';

const context: ReasoningContext = {
  goal: 'Inspect unfamiliar item', task: 'Inspect unfamiliar item',
  worker: { id: 'reader', responsibility: 'Read item', capabilities: ['item.read'] },
  capabilities: [{ name: 'item.read', version: '1', description: 'Read item', risk: 'read', inputSchema: {} }],
  peers: [], history: [], memory: [],
  remaining: { maxDecisions: 3, maxJobs: 3, maxDelegations: 1, maxElapsedMs: 10_000,
    maxProposalBytes: 1024, maxInputTokens: 5000, maxOutputTokens: 100,
    maxCostMicros: 1000 },
};

test('model adapter requires opt-in and reserves budget before any transport call', async () => {
  let calls = 0;
  const options = { authorized: true as const, endpoint: 'https://example.invalid/v1/chat/completions',
    model: 'test-model', apiKey: 'test-key', maxOutputTokens: 100, timeoutMs: 1000,
    inputMicrosPerMillion: 1_000_000, outputMicrosPerMillion: 1_000_000,
    transport: async () => { calls += 1; return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ kind: 'execute', capability: 'item.read', reason: 'Inspect' }) } }],
      usage: { prompt_tokens: 40, completion_tokens: 15 },
    }), { status: 200 }); },
  };
  assert.throws(() => new OpenAICompatibleReasoningProvider({ ...options, authorized: false as true }),
    /Invalid model configuration/);
  const adapter = new OpenAICompatibleReasoningProvider(options);
  await assert.rejects(adapter.decide({ ...context, remaining: { ...context.remaining, maxCostMicros: 1 } }),
    /reservation exceeds/);
  assert.equal(calls, 0);
  const answer = await adapter.decide(context);
  assert.equal(answer.proposal.kind, 'execute');
  assert.deepEqual(answer.usage, { inputTokens: 40, outputTokens: 15, costMicros: 55 });
  assert.equal(calls, 1);
});

test('invalid model-selected input is rejected before Veil execution', async () => {
  const name = `emergence.schema.${Date.now()}.${Math.random()}`;
  let calls = 0;
  new OperatorRuntime().use({ manifest: { name, version: '1', capabilities: [name] },
    capabilities: [{ name, version: '1', risk: 'read', description: 'Read named item',
      inputSchema: { item: { type: 'string', required: true, description: 'Item' } },
      async execute() { calls += 1; return { ok: true }; } }],
  });
  const kernel = new EmergenceKernel({
    journal: new FileJournal(await mkdtemp(join(tmpdir(), 'veil-schema-'))),
    provider: { async decide() { return { kind: 'execute', capability: name,
      input: { item: 5 }, reason: 'Try malformed value' } as const; } },
    workers: [{ id: 'reader', responsibility: 'Read', capabilities: [name] }],
    budget: { maxDecisions: 2, maxJobs: 2, maxDelegations: 1, maxElapsedMs: 10_000,
      maxProposalBytes: 1024 },
  });
  const state = await kernel.start('Read item', 'reader',
    { worker: 'reader', capability: name, input: { item: 'valid' }, expected: { ok: true } });
  assert.equal(state.status, 'failed');
  assert.equal(state.jobs, 0);
  assert.equal(calls, 0);
});
