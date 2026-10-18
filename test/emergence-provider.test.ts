import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proposalSchema } from '../src/emergence/proposal.js';
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
    maxCostMicros: 10000 },
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
  assert.equal(proposalSchema.parse(answer.proposal).kind, 'execute');
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

test('observed malformed delegation recovers through the advertised contract within budgets', async () => {
  const name = `emergence.contract.${Date.now()}.${Math.random()}`;
  let executions = 0;
  new OperatorRuntime().use({ manifest: { name, version: '1', capabilities: [name] },
    capabilities: [{ name, version: '1', risk: 'read', description: 'Inspect repair evidence',
      inputSchema: { item: { type: 'string', required: true, description: 'Target item' } },
      async execute() { executions += 1; return 'ok'; } }],
  });
  const outputs = [
    '{"kind":"delegate","worker":"repair","input":{}}',
    JSON.stringify({ kind: 'delegate', peer: 'repair', task: 'Inspect item', reason: 'Repair can inspect', evidence: '' }),
    JSON.stringify({ kind: 'execute', capability: name, input: { item: 'target' }, reason: 'Inspect' }),
    JSON.stringify({ kind: 'finish', reason: 'Inspection observed' }),
    JSON.stringify({ kind: 'finish', reason: 'Repair returned evidence' }),
  ];
  let calls = 0;
  const provider = new OpenAICompatibleReasoningProvider({ authorized: true,
    endpoint: 'https://example.invalid', model: 'offline', apiKey: 'fake', maxOutputTokens: 100,
    timeoutMs: 1000, inputMicrosPerMillion: 1_000_000, outputMicrosPerMillion: 1_000_000,
    transport: async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      const supplied = JSON.parse(body.messages[1].content);
      assert.equal(supplied.proposalContract.schema.oneOf?.length ?? supplied.proposalContract.schema.anyOf.length, 3);
      if (calls === 0) {
        assert.deepEqual(supplied.capabilities, []);
        assert.deepEqual(supplied.worker.capabilities, []);
        assert.equal(supplied.peers[0].id, 'repair');
        assert.equal(supplied.peers[0].capabilities[0].description, 'Inspect repair evidence');
        assert.equal(supplied.peers[0].capabilities[0].inputSchema.item.required, true);
      }
      if (calls === 1) {
        const rejection = supplied.history.find((event: { type: string }) => event.type === 'reasoning.rejected');
        assert.equal(rejection.data.category, 'malformed_proposal');
        assert.equal(rejection.data.recoverable, true);
        assert.ok(rejection.data.error.details.some((issue: { path: string[] }) => issue.path.includes('peer')));
        assert.equal(supplied.remaining.maxModelCalls, 3);
        assert.equal(supplied.remaining.maxCostMicros, 99_945);
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: outputs[calls++] } }],
        usage: { prompt_tokens: 40, completion_tokens: 15 } }));
    },
  });
  const kernel = new EmergenceKernel({ provider,
    journal: new FileJournal(await mkdtemp(join(tmpdir(), 'veil-contract-'))),
    workers: [{ id: 'owner', responsibility: 'Coordinate', capabilities: ['unregistered.capability'] },
      { id: 'repair', responsibility: 'Inspect repairs', capabilities: [name] }],
    budget: { maxDecisions: 5, maxModelCalls: 5, maxJobs: 3, maxDelegations: 1,
      maxElapsedMs: 10_000, maxProposalBytes: 2048, maxCostMicros: 100_000 },
  });
  const state = await kernel.start('Inspect repair', 'owner',
    { worker: 'repair', capability: name, input: { item: 'target' }, expected: 'ok' });
  assert.equal(state.status, 'verified');
  assert.equal(state.delegations, 1);
  assert.equal(state.modelCalls, 5);
  assert.equal(state.costMicros, 275);
  assert.equal(executions, 2);
});

test('malformed JSON consumes usage and recovery stops at the existing model call budget', async () => {
  const name = `emergence.bad-json.${Date.now()}.${Math.random()}`;
  new OperatorRuntime().use({ manifest: { name, version: '1', capabilities: [name] },
    capabilities: [{ name, version: '1', risk: 'read', description: 'Read', async execute() { return true; } }],
  });
  let calls = 0;
  const provider = new OpenAICompatibleReasoningProvider({ authorized: true,
    endpoint: 'https://example.invalid', model: 'offline', apiKey: 'fake', maxOutputTokens: 10,
    timeoutMs: 1000, inputMicrosPerMillion: 1_000_000, outputMicrosPerMillion: 1_000_000,
    transport: async () => { calls += 1; return new Response(JSON.stringify({
      choices: [{ message: { content: '{broken' } }], usage: { prompt_tokens: 20, completion_tokens: 5 },
    })); },
  });
  const kernel = new EmergenceKernel({ provider,
    journal: new FileJournal(await mkdtemp(join(tmpdir(), 'veil-bad-json-'))),
    workers: [{ id: 'reader', responsibility: 'Read', capabilities: [name] }],
    budget: { maxDecisions: 5, maxModelCalls: 2, maxJobs: 2, maxDelegations: 1,
      maxElapsedMs: 10_000, maxProposalBytes: 1024 },
  });
  const state = await kernel.start('Read', 'reader', { worker: 'reader', capability: name, expected: true });
  assert.equal(state.status, 'failed');
  assert.equal(calls, 2);
  assert.equal(state.jobs, 0);
  assert.equal(state.costMicros, 50);
  assert.equal(state.events.filter((event) => event.type === 'reasoning.rejected').length, 2);
});

test('proposal schema requires exact delegation fields and rejects extra authority fields', () => {
  assert.equal(proposalSchema.safeParse({ kind: 'delegate', worker: 'repair', input: {} }).success, false);
  for (const field of ['peer', 'task', 'evidence', 'reason']) {
    const value: Record<string, unknown> = { kind: 'delegate', peer: 'repair', task: 'Inspect', evidence: '', reason: 'Inspect' };
    delete value[field];
    assert.equal(proposalSchema.safeParse(value).success, false);
  }
  assert.equal(proposalSchema.safeParse({ kind: 'finish', reason: '  ' }).success, false);
  assert.equal(proposalSchema.safeParse({ kind: 'execute', capability: 'read', reason: 'Read', scopes: ['*'] }).success, false);
});

test('original failed live journal remains byte-identical historical evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const bytes = await readFile('docs/evidence/emergence-v0.3-first-trial/journal.json');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '40d093bdcbd7b933145d4fba40c75b2b4015fd043e57f9c7ac491b72b806deb5');
  const original = JSON.parse(bytes.toString());
  assert.equal(original.status, 'failed');
  assert.equal(original.modelCalls, 1);
  assert.equal(original.jobs, 0);
  assert.deepEqual(original.events[2].data.proposal, { kind: 'delegate', worker: 'repair', input: {} });
});

test('malformed proposal recovery cannot exceed decision, token, or cost budgets', async () => {
  const name = `emergence.limits.${Date.now()}.${Math.random()}`;
  new OperatorRuntime().use({ manifest: { name, version: '1', capabilities: [name] },
    capabilities: [{ name, version: '1', risk: 'read', description: 'Read', async execute() { return true; } }],
  });
  for (const limit of [{ maxDecisions: 1 }, { maxInputTokens: 1 }, { maxOutputTokens: 1 }, { maxCostMicros: 1 }]) {
    const kernel = new EmergenceKernel({
      journal: new FileJournal(await mkdtemp(join(tmpdir(), 'veil-limits-'))),
      provider: { async decide() { return {
        proposal: { kind: 'delegate', worker: 'repair', input: {} },
        usage: { inputTokens: 2, outputTokens: 2, costMicros: 2 },
      }; } },
      workers: [{ id: 'reader', responsibility: 'Read', capabilities: [name] }],
      budget: { maxDecisions: 5, maxJobs: 2, maxDelegations: 1,
        maxElapsedMs: 10_000, maxProposalBytes: 1024, ...limit },
    });
    const state = await kernel.start('Read', 'reader', { worker: 'reader', capability: name, expected: true });
    assert.equal(state.status, 'failed');
    assert.equal(state.modelCalls, 1);
    assert.equal(state.jobs, 0);
    assert.equal(state.costMicros, 2);
  }
});


test('endpoint credentials and non-HTTP loopback protocols are rejected', () => {
  for (const endpoint of ['https://secret@example.com/api', 'ftp://localhost/api']) {
    assert.throws(() => new OpenAICompatibleReasoningProvider({ authorized: true, endpoint,
      model: 'mock', apiKey: 'secret', maxOutputTokens: 10, timeoutMs: 100,
      inputMicrosPerMillion: 0, outputMicrosPerMillion: 0 }));
  }
});

test('host can durably bind a run before the first model call and cancel without calls', async () => {
  let calls = 0;
  const name = `deferred.check.${Date.now()}`;
  new OperatorRuntime().use({manifest: {name, version:'1', capabilities:[name]}, capabilities: [{name, version:'1', risk:'read', description:'Check', async execute(){return {passed:true};}}]});
  const kernel = new EmergenceKernel({journal: new FileJournal(await mkdtemp(join(tmpdir(),'veil-deferred-'))),
    provider: {async decide(){calls++; return {kind:'finish', reason:'Done'};}},
    workers:[{id:'worker', responsibility:'Inspect', capabilities:[name]}],
    budget:{maxDecisions:2,maxJobs:2,maxDelegations:1,maxElapsedMs:10000,maxProposalBytes:1000}});
  const state = await kernel.start('Inspect', 'worker', {worker:'worker',capability:name,expected:{passed:true}}, 0);
  assert.equal(state.status,'running'); assert.equal(calls,0);
  assert.equal((await kernel.cancel(state.id)).status,'failed');
  assert.equal((await kernel.run(state.id)).status,'failed'); assert.equal(calls,0);
});
