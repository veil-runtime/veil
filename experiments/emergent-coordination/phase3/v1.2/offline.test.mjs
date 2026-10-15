import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { runModelTrial } from '../v1/host.mjs';
import { runPhase3Trial as runV11Trial } from '../v1/driver.mjs';
import { settledTokenBudget } from '../../phase2/budget.mjs';
import { AGGREGATE_CEILING, CALL_LIMIT, FROZEN_MODEL, PER_TRIAL_CEILING,
  PHASE3_VERSION, phase3Matrix, runPhase3Comparison, sourceHashes, verifyMatchedMatrix } from './run.mjs';
import { phase3Matrix as v11Matrix } from '../v1.1/run.mjs';

const root = resolve(new URL('../../../../', import.meta.url).pathname);
const sha = value => createHash('sha256').update(value).digest('hex');
const reply = action => ({ ok: true, outputText: JSON.stringify(action),
  metadata: { requestedModel: 'offline-mock', inputTokens: 20, outputTokens: 5 } });
const waitAdapter = { async reason() { return reply({ type: 'wait' }); } };
const protocolRule = 'A message may be addressed to another participant or `all`. A participant may not address a message to itself.';

function stripDirectory(value) {
  if (Array.isArray(value)) return value.map(stripDirectory);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'peerCapabilities')
    .map(([key, child]) => [key, stripDirectory(child)]));
}

async function captureContexts(runTrial, directoryVisibility) {
  const contexts = [];
  const trial = await runTrial({ model: 'offline-mock', maxTokens: AGGREGATE_CEILING,
    callLimit: CALL_LIMIT, outputTokenLimit: 512,
    config: { seed: 25, hostCondition: 'distributed', fault: 'primary-failure',
      openChoice: false, directoryVisibility, activationLimit: 18 },
    adapter: { async reason(text) { contexts.push(JSON.parse(text)); return reply({ type: 'wait' }); } },
  });
  return { contexts, trial };
}

test('v1.2 inherits the exact v1.1 matrix, model settings, budgets, and 18-call limit', () => {
  assert.deepEqual(phase3Matrix, v11Matrix);
  assert.equal(verifyMatchedMatrix(), true);
  assert.equal(phase3Matrix.length, 24);
  assert.equal(new Set(phase3Matrix.map(row => row.seed)).size, 12);
  assert.ok(phase3Matrix.every(row => row.callLimit === CALL_LIMIT && row.activationLimit === 18));
  assert.equal(CALL_LIMIT, 18);
  assert.equal(CALL_LIMIT * phase3Matrix.length, 432);
  assert.equal(FROZEN_MODEL, 'gpt-4.1-mini');
  assert.equal(PER_TRIAL_CEILING, 450000);
  assert.equal(AGGREGATE_CEILING, 10800000);
  assert.equal(18 * (24000 + 512), 441216);
  assert.ok(441216 <= PER_TRIAL_CEILING);
  assert.equal(24 * PER_TRIAL_CEILING, AGGREGATE_CEILING);
});

test('participant-to-participant send is valid and queues only to its peer', async () => {
  const trial = await runModelTrial({ seed: 101, condition: 'distributed', fault: 'primary-failure',
    openChoice: false, directoryVisibility: false, activationLimit: 1,
    async decide({ audience }) {
      const to = ['p0', 'p1', 'p2'].find(id => id !== audience);
      return { action: { type: 'send', to, body: { text: 'Message to a peer' } } };
    } });
  assert.notEqual(trial.stop, 'protocol-abort');
  const queued = trial.trace.filter(event => event.type === 'message-queued');
  assert.equal(queued.length, 1);
  assert.notEqual(queued[0].from, queued[0].to);
});

test('broadcast is valid and queues to the two other participants', async () => {
  const trial = await runModelTrial({ seed: 102, condition: 'distributed', fault: 'primary-failure',
    openChoice: false, directoryVisibility: false, activationLimit: 1,
    async decide() { return { action: { type: 'send', to: 'all', body: { text: 'Broadcast' } } }; } });
  assert.notEqual(trial.stop, 'protocol-abort');
  const queued = trial.trace.filter(event => event.type === 'message-queued');
  assert.equal(queued.length, 2);
  assert.ok(queued.every(event => event.from !== event.to));
});

test('self-addressed messages and unknown recipients trigger immediate protocol abort', async () => {
  for (const [index, recipient] of ['self', 'not-a-participant'].entries()) {
    const trial = await runModelTrial({ seed: 103 + index, condition: 'distributed', fault: 'primary-failure',
      openChoice: false, directoryVisibility: false, activationLimit: 18,
      async decide({ audience }) { return { action: { type: 'send',
        to: recipient === 'self' ? audience : 'not-a-participant', body: { text: 'Invalid destination' } } }; } });
    assert.equal(trial.stop, 'protocol-abort');
    assert.deepEqual(trial.trace.filter(event => event.type === 'protocol-validation')
      .map(event => event.code), ['MESSAGE_INVALID_OR_LIMIT']);
    assert.equal(trial.trace.at(-1).type, 'trial-stop');
    assert.equal(trial.trace.at(-1).stop, 'protocol-abort');
    assert.equal(trial.trace.some(event => event.type === 'message-queued'), false);
  }
});

test('v1.2 runner preserves immediate protocol-abort behavior', async () => {
  const trial = await (await import('./driver.mjs')).runPhase3Trial({ model: 'offline-mock',
    maxTokens: AGGREGATE_CEILING, callLimit: CALL_LIMIT,
    config: { seed: 30, hostCondition: 'distributed', fault: 'primary-failure',
      openChoice: false, directoryVisibility: false, activationLimit: 18 },
    adapter: { async reason(text) {
      const { audience } = JSON.parse(text);
      return reply({ type: 'send', to: audience, body: { text: 'Self-addressed' } });
    } },
  });
  assert.equal(trial.stop, 'protocol-abort');
  assert.equal(trial.evaluation.protocolValidationCounts.MESSAGE_INVALID_OR_LIMIT, 1);
  assert.equal(trial.trace.at(-1).type, 'trial-stop');
  assert.equal(trial.trace.at(-1).stop, 'protocol-abort');
});

test('actual v1.1 and v1.2 model contexts differ only by the shared recipient rule', async () => {
  const rule = `\n${protocolRule}\n`;
  const actualProtocol = await readFile(new URL('./action-protocol.md', import.meta.url), 'utf8');
  const baseProtocol = await readFile(new URL('../../phase2/protocol.md', import.meta.url), 'utf8');
  assert.equal(actualProtocol, baseProtocol + rule);

  for (const directoryVisibility of [false, true]) {
    const oldRun = await captureContexts(runV11Trial, directoryVisibility);
    const newRun = await captureContexts((options) =>
      import('./driver.mjs').then(module => module.runPhase3Trial(options)), directoryVisibility);
    assert.equal(oldRun.trial.stop, 'quiescent');
    assert.equal(newRun.trial.stop, 'quiescent');
    assert.equal(oldRun.contexts.length, newRun.contexts.length);
    for (let index = 0; index < oldRun.contexts.length; index++) {
      assert.equal(oldRun.contexts[index].protocol, baseProtocol);
      assert.equal(newRun.contexts[index].protocol, actualProtocol);
      const oldWithoutProtocol = { ...oldRun.contexts[index] };
      const newWithoutProtocol = { ...newRun.contexts[index] };
      delete oldWithoutProtocol.protocol;
      delete newWithoutProtocol.protocol;
      assert.deepEqual(newWithoutProtocol, oldWithoutProtocol);
    }
  }
});

test('only treatment has the static peer directory; no private state leaks through it', async () => {
  const control = await captureContexts((options) =>
    import('./driver.mjs').then(module => module.runPhase3Trial(options)), false);
  const treatment = await captureContexts((options) =>
    import('./driver.mjs').then(module => module.runPhase3Trial(options)), true);
  assert.equal(control.contexts.length, treatment.contexts.length);
  for (let index = 0; index < control.contexts.length; index++) {
    const left = control.contexts[index];
    const right = treatment.contexts[index];
    assert.equal(Object.hasOwn(left.observation, 'peerCapabilities'), false);
    assert.equal(Object.hasOwn(right.observation, 'peerCapabilities'), true);
    assert.deepEqual(stripDirectory(right), left);
    const directory = right.observation.peerCapabilities;
    assert.deepEqual(Object.keys(directory).sort(), ['p0', 'p1', 'p2']
      .filter(id => id !== right.audience).sort());
    for (const descriptors of Object.values(directory)) for (const descriptor of descriptors) {
      assert.deepEqual(Object.keys(descriptor).sort(),
        ['description', 'inputSchema', 'name', 'risk', 'version']);
    }
    const serialized = JSON.stringify(directory).toLowerCase();
    for (const forbidden of ['receipt', 'status', 'inbox', 'history', 'memory', 'result',
      'specimen-', 'scope', 'evaluator', 'progress']) {
      assert.equal(serialized.includes(forbidden), false, `directory leaked ${forbidden}`);
    }
  }
});

test('reservation ceilings stop before dispatch and preserve v1.1 guarantees', async () => {
  const heldTrial = await (await import('./driver.mjs')).runPhase3Trial({ model: 'offline-mock',
    budget: settledTokenBudget(PER_TRIAL_CEILING), callLimit: CALL_LIMIT, outputTokenLimit: 512,
    config: { seed: 104, hostCondition: 'distributed', fault: 'primary-failure',
      openChoice: false, directoryVisibility: false, activationLimit: 18 },
    adapter: waitAdapter,
  });
  assert.equal(heldTrial.stop, 'quiescent');
  assert.ok(heldTrial.modelCalls.length <= CALL_LIMIT);
  for (const call of heldTrial.modelCalls) {
    assert.equal(call.reservation, call.inputBoundTokens + 512);
    assert.ok(call.reservation <= 24512);
  }
  assert.ok(heldTrial.reservedTokens <= CALL_LIMIT * 24512);
  assert.ok(heldTrial.reservedTokens <= PER_TRIAL_CEILING);

  let calls = 0;
  const base = await import('node:os').then(os => os.tmpdir());
  const out = join(base, `veil-005-v1-2-budget-${process.pid}-${Date.now()}`);
  try {
    const summary = await runPhase3Comparison({ out, model: 'offline-mock',
      perTrialCeiling: 1, aggregateCeiling: 1,
      adapter: { async reason() { calls++; return reply({ type: 'wait' }); } } });
    assert.equal(calls, 0);
    assert.equal(summary.status, 'TRIAL CHECKPOINT');
    assert.equal(summary.trials[0].stop, 'budget-limit');
    assert.equal(summary.chargedExposureTokens, 0);
    assert.ok(summary.chargedExposureTokens <= 1);
    assert.ok(summary.trials[0].reservedTokens <= 1);
  } finally {
    await import('node:fs/promises').then(fs => fs.rm(out, { recursive: true, force: true }));
  }
});

test('v1.1 evidence inventory verifies every preserved checksum and terminal checkpoint', async () => {
  const inventoryPath = new URL('./preserved-evidence.json', import.meta.url);
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  assert.equal(inventory.preservation.startsWith('read-only'), true);
  assert.equal(inventory.verifiedSidecars, Object.keys(inventory.files).length);
  for (const [name, expected] of Object.entries(inventory.files)) {
    const target = join(root, inventory.sourceDirectory, name);
    const contents = await readFile(target);
    const sidecar = (await readFile(`${target}.sha256`, 'utf8')).trim();
    assert.equal(sha(contents), expected, `${name} inventory hash`);
    assert.equal(sidecar, expected, `${name} sidecar`);
  }
  assert.equal(inventory.checkpoint.status, 'PROTOCOL CHECKPOINT');
  assert.equal(inventory.checkpoint.attemptedTrials, 7);
  assert.equal(inventory.checkpoint.completedTrials, 6);
  assert.equal(inventory.checkpoint.completeMatchedPairs, 3);
  const checkpoint = JSON.parse(await readFile(join(root, inventory.sourceDirectory,
    inventory.checkpoint.file), 'utf8'));
  assert.equal(checkpoint.attemptedTrials, inventory.checkpoint.attemptedTrials);
  assert.equal(checkpoint.completedTrials, inventory.checkpoint.completedTrials);
  assert.equal(checkpoint.paired.completePairs, inventory.checkpoint.completeMatchedPairs);
});

test('v1.2 source hashes and frozen manifest verify', async () => {
  const hashes = await sourceHashes();
  for (const [file, expected] of Object.entries(hashes)) {
    assert.equal(sha(await readFile(join(root, file))), expected, `${file} source hash`);
  }
  const freeze = JSON.parse(await readFile(new URL('./freeze-manifest.json', import.meta.url), 'utf8'));
  assert.equal(freeze.experimentVersion, PHASE3_VERSION);
  for (const [file, expected] of Object.entries(freeze.sourceSha256)) {
    assert.equal(sha(await readFile(join(root, file))), expected, `${file} frozen hash`);
  }
  const freezeBytes = await readFile(new URL('./freeze-manifest.json', import.meta.url));
  assert.equal((await readFile(new URL('./freeze-manifest.json.sha256', import.meta.url), 'utf8')).trim(),
    sha(freezeBytes));
});

test('exclusive output directories are refused before any adapter dispatch', async () => {
  const base = await import('node:os').then(os => os.tmpdir());
  const out = join(base, `veil-005-v1-2-exclusive-${process.pid}-${Date.now()}`);
  let calls = 0;
  try {
    const first = await runPhase3Comparison({ out, model: 'offline-mock',
      perTrialCeiling: 1, aggregateCeiling: 1, adapter: waitAdapter });
    assert.equal(first.status, 'TRIAL CHECKPOINT');
    await assert.rejects(runPhase3Comparison({ out, model: 'offline-mock',
      adapter: { async reason() { calls++; return reply({ type: 'wait' }); } } }), { code: 'EEXIST' });
    assert.equal(calls, 0);
  } finally {
    await import('node:fs/promises').then(fs => fs.rm(out, { recursive: true, force: true }));
  }
});
