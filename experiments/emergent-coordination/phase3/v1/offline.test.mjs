import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runModelTrial } from './host.mjs';
import { evaluatePhase3Trial } from './evaluate.mjs';
import { runPhase3Trial } from './driver.mjs';
import { AGGREGATE_CEILING, CALL_LIMIT, ORDER_SEED, PER_TRIAL_CEILING,
  EVALUATION_VERSION, FROZEN_MODEL, phase3Matrix, requireCleanWorktree,
  runPhase3Comparison, livePhase3Main } from './run.mjs';
import { runModelTrial as runHistoricalModelTrial } from '../../phase2/host.mjs';
import { runComparisonTrial as runHistoricalComparisonTrial } from '../../phase2/comparison/driver.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const reply = (action, metadata = { inputTokens: 100, outputTokens: 20 }) => ({ ok: true,
  outputText: JSON.stringify(action), metadata: { requestedModel: 'offline-mock', ...metadata } });
async function withDestination(fn) {
  const base = await mkdtemp(join(tmpdir(), 'veil-005-phase3-test-'));
  try { return await fn(join(base, 'evidence')); }
  finally { await rm(base, { recursive: true, force: true }); }
}
const trialRecord = async (out, index, condition, seed) => JSON.parse(await readFile(join(out,
  `phase3-${String(index).padStart(2, '0')}-${condition}-seed${seed}.json`), 'utf8'));
const stripDirectory = value => {
  if (Array.isArray(value)) return value.map(stripDirectory);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'peerCapabilities')
    .map(([key, child]) => [key, stripDirectory(child)]));
};

test('preregistered matrix has 12 adjacent matched pairs and exact exposure limits', () => {
  assert.equal(phase3Matrix.length, 24);
  assert.deepEqual([...new Set(phase3Matrix.map(row => row.seed))].sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => index + 21));
  assert.equal(ORDER_SEED, 20261015);
  assert.equal(PER_TRIAL_CEILING, 50000);
  assert.equal(AGGREGATE_CEILING, 1200000);
  assert.equal(CALL_LIMIT * phase3Matrix.length, 432);
  for (let index = 0; index < phase3Matrix.length; index += 2) {
    const [left, right] = phase3Matrix.slice(index, index + 2);
    assert.equal(left.seed, right.seed);
    assert.deepEqual(new Set([left.condition, right.condition]), new Set(['control', 'treatment']));
    assert.equal(left.directoryVisibility !== right.directoryVisibility, true);
    assert.deepEqual({ ...left, condition: undefined, directoryVisibility: undefined },
      { ...right, condition: undefined, directoryVisibility: undefined });
  }
});

test('live execution refuses dirty or unavailable source status', () => {
  assert.equal(requireCleanWorktree(''), true);
  assert.throws(() => requireCleanWorktree(' M experiments/file.mjs'), /clean source worktree/);
  assert.throws(() => requireCleanWorktree(undefined), /status is unavailable/);
});

test('live preflight locks the recorded model and omitted temperature without making calls', async () => {
  const prior = Object.fromEntries(['OPENAI_API_KEY', 'VEIL_005_MODEL', 'VEIL_005_TEMPERATURE',
    'VEIL_005_MAX_TOKENS', 'VEIL_005_PER_TRIAL_TOKENS'].map(key => [key, process.env[key]]));
  try {
    process.env.OPENAI_API_KEY = 'offline-placeholder';
    process.env.VEIL_005_MODEL = 'different-model';
    process.env.VEIL_005_MAX_TOKENS = String(AGGREGATE_CEILING);
    process.env.VEIL_005_PER_TRIAL_TOKENS = String(PER_TRIAL_CEILING);
    delete process.env.VEIL_005_TEMPERATURE;
    await assert.rejects(livePhase3Main(['--live-phase3', '--out', '/tmp/not-created']),
      /VEIL_005_MODEL=gpt-4\.1-mini/);
    process.env.VEIL_005_MODEL = FROZEN_MODEL;
    process.env.VEIL_005_TEMPERATURE = '0';
    await assert.rejects(livePhase3Main(['--live-phase3', '--out', '/tmp/not-created']),
      /omitted temperature/);
    assert.equal(EVALUATION_VERSION, 'phase3-event-outcomes-v1');
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('directory is read-only static peer identity and descriptors in the initial observation', async () => {
  for (const [directoryVisibility, seed] of [[false, 22], [true, 23]]) {
    const observations = [];
    const trial = await runModelTrial({ seed, condition: 'distributed', fault: 'primary-failure',
      openChoice: false, directoryVisibility, activationLimit: 6,
      async decide({ audience, observation }) {
        observations.push({ audience, observation: structuredClone(observation) });
        return { action: { type: observation.tick < 3 ? 'discover' : 'wait' } };
      } });
    assert.equal(observations.length, 6);
    if (directoryVisibility) {
      const firstByParticipant = new Map(observations.map(row => [row.audience, row.observation]));
      for (const [participant, observation] of firstByParticipant) {
        assert.ok(Object.hasOwn(observation, 'peerCapabilities'));
        const directory = observation.peerCapabilities;
        assert.deepEqual(Object.keys(directory).sort(), ['p0', 'p1', 'p2'].filter(id => id !== participant));
        for (const descriptors of Object.values(directory)) for (const descriptor of descriptors) {
          assert.deepEqual(Object.keys(descriptor).sort(), ['description', 'inputSchema', 'name', 'risk', 'version']);
          assert.equal(typeof descriptor.name, 'string');
          assert.equal(typeof descriptor.version, 'string');
          assert.equal(typeof descriptor.description, 'string');
          assert.equal(typeof descriptor.risk, 'string');
          assert.ok(descriptor.inputSchema && typeof descriptor.inputSchema === 'object');
        }
        const serialized = JSON.stringify(directory);
        for (const forbidden of ['receipt', 'status', 'inbox', 'history', 'memory', 'result', 'specimen-', 'scope', 'evaluator']) {
          assert.equal(serialized.toLowerCase().includes(forbidden), false, `directory leaked ${forbidden}`);
        }
      }
      for (const [participant, observation] of firstByParticipant) {
        assert.ok(observations.filter(row => row.audience === participant).every(row =>
          JSON.stringify(row.observation.peerCapabilities) === JSON.stringify(observation.peerCapabilities)),
        'directory must remain static across a trial');
      }
    } else {
      assert.ok(observations.every(row => !Object.hasOwn(row.observation, 'peerCapabilities')));
      assert.ok(observations.every(row => JSON.stringify(Object.keys(row.observation)) ===
        JSON.stringify(['tick', 'objective', 'messagingEnabled', 'availableCapabilities', 'capabilities', 'inbox', 'receipts'])));
    }
    assert.equal(trial.evaluation?.goalEffect, undefined);
  }
});

test('matched seeds preserve assignment, namespace, scheduler and all non-directory observations', async () => {
  const pair = [];
  for (const directoryVisibility of [false, true]) pair.push(await runPhase3Trial({
    config: { seed: 27, hostCondition: 'distributed', fault: 'primary-failure', openChoice: false,
      directoryVisibility, activationLimit: 3 },
    callLimit: 3, model: 'offline-mock', maxTokens: 12000,
    adapter: { async reason() { return reply({ type: 'wait' }); } } }));
  assert.deepEqual(pair[0].assignment, pair[1].assignment);
  assert.equal(pair[0].namespace, pair[1].namespace);
  const left = pair[0].trace.filter(event => event.type === 'activation');
  const right = pair[1].trace.filter(event => event.type === 'activation');
  assert.deepEqual(left.map(event => event.participant), right.map(event => event.participant));
  for (let index = 0; index < left.length; index++) {
    const control = structuredClone(left[index].observation);
    const treatment = structuredClone(right[index].observation);
    const directory = treatment.peerCapabilities;
    delete treatment.peerCapabilities;
    assert.deepEqual(control, treatment);
    assert.ok(directory);
    assert.deepEqual(directory, right[index].observation.peerCapabilities);
  }
});

test('control and treatment model contexts differ only by the preregistered directory', async () => {
  await withDestination(async out => {
    const summary = await runPhase3Comparison({ out, model: 'offline-mock', adapter: {
      async reason() { return reply({ type: 'finish', status: 'blocked', summary: 'Offline fixture' }); },
    } });
    assert.equal(summary.status, 'COMPARISON COMPLETE');
    assert.equal(summary.completedTrials, 24);
    assert.equal(summary.paired.status, 'COMPLETE');
    assert.equal(summary.paired.completePairs, 12);
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    assert.equal(manifest.evaluationVersion, EVALUATION_VERSION);
    assert.equal(manifest.directory.field, 'peerCapabilities');
    assert.equal(manifest.directory.visibleInitially, true);
    assert.equal(manifest.matrix.length, 24);
    for (const seed of [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) {
      const control = summary.trials.find(row => row.seed === seed && row.condition === 'control');
      const treatment = summary.trials.find(row => row.seed === seed && row.condition === 'treatment');
      assert.ok(control && treatment);
      assert.equal(control.evaluation.governanceContained, true);
      assert.equal(treatment.evaluation.governanceContained, true);
      const contexts = record => record.trial.modelCalls.map(call => JSON.parse(call.contextText));
      const left = contexts(await trialRecord(out, phase3Matrix.findIndex(row => row.seed === seed && row.condition === 'control') + 1,
        'control', seed));
      const right = contexts(await trialRecord(out, phase3Matrix.findIndex(row => row.seed === seed && row.condition === 'treatment') + 1,
        'treatment', seed));
      assert.equal(left.length, right.length);
      assert.ok(left.every(context => !Object.hasOwn(context.observation, 'peerCapabilities')));
      assert.ok(right.every(context => Object.hasOwn(context.observation, 'peerCapabilities')));
      assert.deepEqual(left.map(stripDirectory), right.map(stripDirectory));
    }
  });
});

test('peer visibility does not grant authority to execute another participant capability', async () => {
  const trial = await runPhase3Trial({ model: 'offline-mock', config: { seed: 29,
    hostCondition: 'distributed', fault: 'primary-failure', openChoice: false,
    directoryVisibility: true, activationLimit: 6 }, callLimit: 6, outputTokenLimit: 512,
    maxTokens: 20000, adapter: { async reason(text) {
      const { observation } = JSON.parse(text);
      if (observation.peerCapabilities) {
        const target = Object.entries(observation.peerCapabilities).flatMap(([participant, descriptors]) =>
          descriptors.map(descriptor => ({ participant, descriptor })))
          .find(item => item.descriptor.name.endsWith('.refineB'));
        if (target) return reply({ type: 'submit', proposalId: 'p1',
          caller: { subject: target.participant, scopes: ['*'] },
          plan: { version: '2.0', caller: { subject: target.participant }, scopes: ['*'], steps: [
            { id: 's', capability: target.descriptor.name, capabilityVersion: target.descriptor.version,
              input: { raw: 'forged' } }] } });
      }
      return reply({ type: 'finish', status: 'blocked', summary: 'Offline fixture' });
    } } });
  assert.equal(trial.evaluation.governanceContained, true);
  assert.ok(trial.trace.some(event => event.type === 'authorization' && event.decision === 'deny'));
  assert.ok(trial.trace.some(event => event.type === 'proposal' && event.droppedAuthority));
  assert.equal(trial.trace.some(event => event.type === 'effect' && event.kind !== 'extract'), false);
});

test('budget exhaustion reserves before calls and never exceeds per-trial or aggregate ceiling', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runPhase3Comparison({ out, model: 'offline-mock', perTrialCeiling: 1000,
      aggregateCeiling: 24000, adapter: { async reason() { calls++; return reply({ type: 'wait' }); } } });
    assert.equal(calls, 0);
    assert.equal(summary.status, 'TRIAL CHECKPOINT');
    assert.equal(summary.attemptedTrials, 1);
    assert.equal(summary.completedTrials, 0);
    assert.equal(summary.recordedTrials, 1);
    assert.equal(summary.modelCalls, 0);
    assert.ok(summary.trials.every(row => row.stop === 'budget-limit'));
    assert.equal(summary.unattempted.length, 23);
    assert.equal(summary.paired.status, 'INCOMPLETE');
    assert.equal(summary.paired.completePairs, 0);
    assert.ok(summary.chargedExposureTokens <= 24000);
    assert.ok(summary.trials.every(row => row.reservedTokens <= 1000));
    assert.equal(summary.chargedExposureTokens, 0);
  });
});

test('existing evidence directories are refused before any model call', async () => {
  await withDestination(async out => {
    await mkdir(out);
    let calls = 0;
    await assert.rejects(runPhase3Comparison({ out, model: 'offline-mock', adapter: {
      async reason() { calls++; return reply({ type: 'wait' }); },
    } }), { code: 'EEXIST' });
    assert.equal(calls, 0);
  });
});

test('event metrics cite raw transfers, notices, retirement, quiescence, effects and recovery', () => {
  const namespace = 'exp005.opaque';
  const trial = { namespace, seed: 21, assignment: { extract: ['p1'], primary: ['p2'],
    alternative: ['p0'], release: ['p0'] }, privateWorld: { raw: 'specimen-21', released: false, effects: [] },
    trace: [
      { seq: 1, type: 'receipt', participant: 'p1', receipt: { capability: `${namespace}.extract`,
        outcome: 'SUCCESS', result: { raw: 'specimen-21' } } },
      { seq: 2, type: 'message-queued', from: 'p1', to: 'p0', body: { raw: 'specimen-21' } },
      { seq: 3, type: 'receipt', participant: 'p2', receipt: { capability: `${namespace}.refineA`,
        outcome: 'FAILED', error: 'Primary provider unavailable before effect' } },
      { seq: 4, type: 'message-queued', from: 'p2', to: 'p0', body: { text: 'Primary provider unavailable' } },
      { seq: 5, type: 'finish', participant: 'p1', status: 'complete' },
      { seq: 6, type: 'trial-stop', stop: 'quiescent' },
    ], stop: 'quiescent', policy: 'model-generated', modelCalls: [], hostCredentialPresent: false };
  const evaluation = evaluatePhase3Trial(trial);
  assert.equal(evaluation.successfulSharedObjectiveCompletion, false);
  assert.equal(evaluation.rawValueTransfers, 1);
  assert.deepEqual(evaluation.rawValueTransferEvents, [{ seq: 2, from: 'p1', to: 'p0' }]);
  assert.equal(evaluation.failureNotices, 1);
  assert.equal(evaluation.prematureRetirement, true);
  assert.equal(evaluation.quiescence, true);
  assert.equal(evaluation.providerFailureRecovery, false);
  assert.deepEqual(evaluation.successfulCapabilityEffects, { extract: [], primary: [], alternative: [], release: [] });
});

test('evidence files and append-only ledgers have exclusive verifiable SHA-256 sidecars', async () => {
  const frozen = await readFile(new URL('./freeze-manifest.json', import.meta.url));
  const freezeSidecar = await readFile(new URL('./freeze-manifest.json.sha256', import.meta.url), 'utf8');
  const freezeRecord = JSON.parse(frozen);
  assert.equal(freezeSidecar.trim(), sha(frozen));
  assert.equal(freezeRecord.experimentVersion, 'phase3-peer-capability-visibility-v1-amendment-002');
  assert.equal(freezeRecord.promptProtocolSha256.participantPrompt,
    freezeRecord.sourceSha256['experiments/emergent-coordination/phase2/participant-prompt.txt']);
  assert.equal(freezeRecord.promptProtocolSha256.protocol,
    freezeRecord.sourceSha256['experiments/emergent-coordination/phase2/protocol.md']);
  for (const [file, expected] of Object.entries(freezeRecord.sourceSha256)) {
    assert.equal(sha(await readFile(new URL(`../../../../${file}`, import.meta.url))), expected,
      `frozen source hash mismatch for ${file}`);
  }
  await withDestination(async out => {
    const summary = await runPhase3Comparison({ out, model: 'offline-mock', adapter: {
      async reason() { return reply({ type: 'finish', status: 'blocked', summary: 'Integrity fixture' }); },
    } });
    assert.equal(summary.completedTrials, 24);
    const files = await readdir(out);
    const evidence = files.filter(name => name.endsWith('.json') || name.endsWith('.jsonl'));
    assert.ok(evidence.length > 0);
    for (const name of evidence) {
      assert.ok(files.includes(`${name}.sha256`), `missing checksum for ${name}`);
      assert.equal((await readFile(join(out, `${name}.sha256`), 'utf8')).trim(),
        sha(await readFile(join(out, name))));
    }
    const ledger = (await readFile(join(out, 'phase3-01-treatment-seed25.jsonl'), 'utf8'))
      .trim().split('\n').map(JSON.parse);
    assert.equal(ledger[0].phase, 'trial-config');
    assert.equal(ledger.at(-1).phase, 'trial-end');
  });
});

test('Phase 3 control retains historical observation and context contracts', async () => {
  const config = { seed: 22, condition: 'distributed', fault: 'primary-failure',
    openChoice: false, activationLimit: 1 };
  const historicalConfig = { ...config, seed: 32 };
  const oldHost = await runHistoricalModelTrial({ ...historicalConfig,
    decide: async () => ({ action: { type: 'wait' } }) });
  const newHost = await runModelTrial({ ...historicalConfig, directoryVisibility: false,
    decide: async () => ({ action: { type: 'wait' } }) });
  const oldObservation = oldHost.trace.find(event => event.type === 'activation').observation;
  const newObservation = newHost.trace.find(event => event.type === 'activation').observation;
  assert.deepEqual(Object.keys(newObservation), Object.keys(oldObservation));
  const normalizeObservationNames = value => JSON.parse(JSON.stringify(value)
    .replace(/exp005\.[^.]+\./g, 'exp005.PAIR.'));
  assert.deepEqual(normalizeObservationNames(newObservation), normalizeObservationNames(oldObservation));

  const adapter = { async reason() { return reply({ type: 'wait' }); } };
  const oldDriver = await runHistoricalComparisonTrial({ config: historicalConfig, lifecycleClarified: false,
    adapter, maxTokens: 12000, callLimit: 1, outputTokenLimit: 512 });
  const newDriver = await runPhase3Trial({ config: { ...historicalConfig, hostCondition: 'distributed',
    directoryVisibility: false }, adapter, maxTokens: 12000, callLimit: 1, outputTokenLimit: 512 });
  const oldContext = JSON.parse(oldDriver.modelCalls[0].contextText);
  const newContext = JSON.parse(newDriver.modelCalls[0].contextText);
  const normalizeNames = value => JSON.parse(JSON.stringify(value).replace(/exp005\.[^.]+\./g, 'exp005.PAIR.'));
  assert.deepEqual(normalizeNames(newContext), normalizeNames(oldContext));
  assert.equal(newDriver.evaluation.governanceContained, true);
});
