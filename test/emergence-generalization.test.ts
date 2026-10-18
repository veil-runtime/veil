import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperatorRuntime } from '../src/runtime/operator-runtime.js';
import { FileJournal } from '../src/emergence/journal.js';
import { EmergenceKernel } from '../src/emergence/kernel.js';
import { DeterministicReasoningProvider } from '../src/emergence/providers.js';
import type { ReasoningContext, Proposal } from '../src/emergence/types.js';

// One task-independent policy. Candidate values and their outcomes come only from Veil observations.
function decide(context: ReasoningContext): Proposal {
  const has = (description: string) => context.capabilities.find((capability) => capability.description === description);
  const inspect = has('Discover options');
  const attempt = has('Try option');
  const observation = context.history.find((event) => event.type === 'execution.completed' &&
    String(event.data.capability).includes('.inspect.'));
  if (!observation) {
    if (inspect) return { kind: 'execute', capability: inspect.name, reason: 'Discover available options' };
    const peer = context.peers.find((entry) => entry.capabilities.some((capability) => capability.description === 'Discover options'));
    if (peer) return { kind: 'delegate', peer: peer.id, task: context.task,
      evidence: 'Need option discovery', reason: 'Peer has discovery scope' };
    return { kind: 'finish', reason: 'No discovery path' };
  }
  const completed = context.history.some((event) => event.type === 'execution.completed' &&
    typeof event.data.result === 'object' && event.data.result !== null &&
    (event.data.result as { solved?: boolean }).solved === true);
  if (completed) return { kind: 'finish', reason: 'Observed successful option' };
  const candidates = (observation.data.result as { candidates: string[] }).candidates;
  const prior = context.history.filter((event) => event.type === 'reasoning.decision' &&
    (event.data.proposal as Proposal).kind === 'execute' &&
    String((event.data.proposal as { capability?: string }).capability).includes('.attempt.')).length;
  if (!attempt) {
    const peer = context.peers.find((entry) => entry.capabilities.some((capability) => capability.description === 'Try option'));
    if (peer) return { kind: 'delegate', peer: peer.id, task: context.task,
      evidence: JSON.stringify(observation.data.result), reason: 'Peer has option scope' };
    return { kind: 'finish', reason: 'No option scope' };
  }
  if (prior >= Math.max(2, candidates.length + 1)) return { kind: 'finish', reason: 'Candidate attempts exhausted' };
  return { kind: 'execute', capability: attempt.name,
    input: { candidate: candidates[Math.min(prior, candidates.length - 1)] },
    reason: 'Try next discovered option or retry last transient option' };
}

async function fixture(mode: 'stale' | 'transient' | 'delegation') {
  const suffix = `${mode}.${Date.now()}.${Math.random()}`;
  const names = { inspect: `general.inspect.${suffix}`, attempt: `general.attempt.${suffix}`,
    verify: `general.verify.${suffix}` };
  const candidates = mode === 'stale' ? ['expired', 'current'] :
    mode === 'transient' ? ['available'] : ['assigned'];
  let attempts = 0;
  let solved = false;
  new OperatorRuntime().use({
    manifest: { name: `general.${suffix}`, version: '1.0', capabilities: Object.values(names) },
    capabilities: [
      { name: names.inspect, version: '1.0', risk: 'read', description: 'Discover options',
        async execute() { return { candidates }; } },
      { name: names.attempt, version: '1.0', risk: 'read', description: 'Try option',
        inputSchema: { candidate: { type: 'string', required: true, description: 'Discovered option' } },
        async execute(input) {
          attempts += 1;
          const candidate = (input as { candidate: string }).candidate;
          if (mode === 'stale' && candidate === 'expired') throw new Error('Option expired');
          if (mode === 'transient' && attempts === 1) throw new Error('Temporary service failure');
          solved = candidate === candidates.at(-1);
          return { solved };
        } },
      { name: names.verify, version: '1.0', risk: 'read', description: 'Independent outcome check',
        async execute() { return { solved }; } },
    ],
  });
  const journal = new FileJournal(await mkdtemp(join(tmpdir(), 'veil-general-')));
  const workers = mode === 'delegation' ? [
    { id: 'owner', responsibility: 'Discover and coordinate', capabilities: [names.inspect] },
    { id: 'specialist', responsibility: 'Try scoped options', capabilities: [names.attempt] },
    { id: 'verifier', responsibility: 'Check result', capabilities: [names.verify] },
  ] : [
    { id: 'owner', responsibility: 'Solve goal', capabilities: [names.inspect, names.attempt] },
    { id: 'verifier', responsibility: 'Check result', capabilities: [names.verify] },
  ];
  const makeKernel = () => new EmergenceKernel({ journal,
    provider: new DeterministicReasoningProvider(decide), workers,
    budget: { maxDecisions: 12, maxJobs: 8, maxDelegations: 2, maxElapsedMs: 30_000,
      maxProposalBytes: 4096, maxModelCalls: 12, maxExecutionMs: 10_000 },
  });
  return { journal, makeKernel, names, getAttempts: () => attempts };
}

for (const mode of ['stale', 'transient', 'delegation'] as const) {
  test(`unseen ${mode} goal selects path and verifies independently`, async () => {
    const task = await fixture(mode);
    const state = await task.makeKernel().start(`Resolve ${mode} option goal`, 'owner',
      { worker: 'verifier', capability: task.names.verify, expected: { solved: true } });
    assert.equal(state.status, 'verified', JSON.stringify(state.events.at(-1)));
    assert.equal(task.getAttempts(), mode === 'delegation' ? 1 : 2);
    assert.equal(state.events.filter((event) => event.type === 'verification.completed').length, 1);
    assert.ok(state.memory.some((entry) => entry.kind === 'observation' && entry.source === 'veil'));
    assert.ok(state.memory.some((entry) => entry.kind === 'interpretation' && entry.source === 'model'));
    if (mode === 'delegation') assert.equal(state.delegations, 1);
    else assert.ok(state.events.some((event) => event.type === 'execution.failed'));
  });
}

test('resumed goal uses completed evidence without repeating an option attempt', async () => {
  const task = await fixture('stale');
  const first = await task.makeKernel().start('Resolve interrupted option goal', 'owner',
    { worker: 'verifier', capability: task.names.verify, expected: { solved: true } }, 2);
  assert.equal(first.status, 'running');
  assert.equal(task.getAttempts(), 1);
  assert.equal((await task.journal.load(first.id)).active?.worker, 'owner');
  const resumed = await task.makeKernel().run(first.id);
  assert.equal(resumed.status, 'verified');
  assert.equal(task.getAttempts(), 2);
  assert.equal(resumed.events.filter((event) => event.type === 'execution.failed').length, 1);
});
