import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runPhase4Trial } from './driver.mjs';
import { runModelTrial } from './host.mjs';
import { derivePhase4Metrics } from './metrics.mjs';
import { buildNeutralBank, generateNeutralNote, propertyTokenCount, validateNeutralText } from './neutral-content.mjs';
import bank from './neutral-bank.json' with { type: 'json' };
import { conditionOrders, FREEZE_MANIFEST, PHASE4_VERSION, phase4Matrix, runPhase4Matrix, verifyPhase4Matrix, verifyFrozenSources } from './run.mjs';
import { phase3Matrix } from '../../phase3/v1.2/run.mjs';
import { runPhase3Trial } from '../../phase3/v1.2/driver.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const reply = action => ({ ok: true, outputText: JSON.stringify(action), metadata: {
  requestedModel: 'offline-mock', reportedModel: 'offline-mock', inputTokens: 80, outputTokens: 8,
} });
const withoutConditionFields = value => {
  if (Array.isArray(value)) return value.map(withoutConditionFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'notes' && key !== 'peerCapabilities')
    .map(([key, item]) => [key, withoutConditionFields(item)]));
};
const baseConfig = (arm, seed = 33) => ({ seed, arm,
  hostCondition: 'distributed', condition: 'distributed', fault: 'primary-failure',
  openChoice: false, directoryVisibility: arm === 'D18' || arm === 'D27', activationLimit: 27,
  callLimit: arm === 'D27' ? 27 : 18,
});

test('neutral bank is immutable, reproducible, allowlisted, and exact at o200k_base payload level', async () => {
  const bytes = await readFile(new URL('./neutral-bank.json', import.meta.url));
  const sidecar = (await readFile(new URL('./neutral-bank.json.sha256', import.meta.url), 'utf8')).trim();
  assert.equal(sha(bytes), sidecar);
  assert.equal(bank.entries.length, 72);
  for (const entry of bank.entries) {
    const regenerated = generateNeutralNote({ targetTokens: entry.directoryPropertyTokens,
      seed: entry.seed, participant: entry.participant });
    assert.equal(regenerated, entry.notes);
    assert.equal(validateNeutralText(entry.notes), true);
    assert.equal(propertyTokenCount('notes', entry.notes), entry.directoryPropertyTokens);
    assert.equal(entry.notesPropertyTokens, entry.directoryPropertyTokens);
    assert.equal(sha(entry.notes), entry.notesSha256);
  }
  const fixture = { 33: { p0: [], p1: [], p2: [] } };
  assert.throws(() => buildNeutralBank({}), /Missing peer-directory payloads/);
});

test('actual P18 and D18 request contexts match every current and historical condition-property occurrence', async () => {
  for (let seed = 33; seed <= 56; seed++) {
    const captures = {};
    for (const arm of ['P18', 'D18']) {
      captures[arm] = [];
      const trial = await runPhase4Trial({ config: baseConfig(arm, seed), model: 'offline-mock', maxTokens: 700000,
        neutralBank: bank,
        adapter: { async reason(text) { captures[arm].push(JSON.parse(text)); return reply({ type: 'wait' }); } },
      });
      assert.equal(trial.stop, 'quiescent');
      assert.equal(captures[arm].length, 3);
      assert.ok(trial.modelCalls.every(call => call.exactContextTokens > 0 && call.contextHash));
      assert.deepEqual(trial.modelCalls.map(call => call.conditionPayloadTokens),
        trial.modelCalls.map(call => call.conditionPropertyOccurrences.reduce((sum, item) => sum + item.tokens, 0)));
      for (const context of captures[arm]) {
        const field = arm === 'P18' ? 'notes' : 'peerCapabilities';
        const occurrences = [...context.history.map(item => item.observation), context.observation]
          .map(observation => observation[field]);
        assert.equal(occurrences.length, context.history.length + 1);
        const target = bank.entries.find(entry => entry.seed === seed && entry.participant === context.audience)
          .directoryPropertyTokens;
        assert.ok(occurrences.every(value => propertyTokenCount(field, value) === target));
      }
    }
    assert.deepEqual(captures.P18.map(context => context.audience), captures.D18.map(context => context.audience));
    for (let index = 0; index < captures.P18.length; index++) {
      assert.equal(captures.P18[index].observation.notes.length > 0, true);
      assert.equal(Object.hasOwn(captures.P18[index].observation, 'peerCapabilities'), false);
      assert.equal(Object.hasOwn(captures.D18[index].observation, 'notes'), false);
    }
  }
});

test('condition isolation preserves only the assigned visible field and static public descriptors', async () => {
  for (const arm of ['C18', 'P18', 'D18', 'D27']) {
    const contexts = [];
    const trial = await runPhase4Trial({ config: baseConfig(arm), model: 'offline-mock', maxTokens: 700000,
      neutralBank: bank,
      adapter: { async reason(text) { contexts.push(JSON.parse(text)); return reply({ type: 'wait' }); } },
    });
    assert.equal(trial.stop, 'quiescent');
    for (const context of contexts) {
      const observation = context.observation;
      assert.equal(Object.hasOwn(observation, 'notes'), arm === 'P18');
      assert.equal(Object.hasOwn(observation, 'peerCapabilities'), arm === 'D18' || arm === 'D27');
      const serialized = JSON.stringify(observation.peerCapabilities ?? observation.notes ?? '').toLowerCase();
      for (const forbidden of ['specimen-', 'sealed:', 'receipt', 'scope', 'evaluator', 'history', 'provider']) {
        assert.equal(serialized.includes(forbidden), false, `${arm} leaked ${forbidden}`);
      }
      if (observation.peerCapabilities) for (const [peer, descriptors] of Object.entries(observation.peerCapabilities)) {
        assert.notEqual(peer, context.audience);
        assert.ok(descriptors.every(item => Object.keys(item).sort().join(',') ===
          'description,inputSchema,name,risk,version'));
      }
    }
  }
});

test('all arms use the same first-18 scheduler and request rules; D27 only extends the call window', async () => {
  const captures = {};
  for (const arm of ['C18', 'P18', 'D18', 'D27']) {
    captures[arm] = [];
    const trial = await runPhase4Trial({ config: baseConfig(arm), neutralBank: bank, model: 'offline-mock',
      maxTokens: 700000,
      adapter: { async reason(text) { captures[arm].push(JSON.parse(text)); return reply({ type: 'discover' }); } },
    });
    const expectedCalls = arm === 'D27' ? 27 : 18;
    assert.equal(trial.modelCalls.length, expectedCalls);
  }
  const first18Audiences = captures.C18.slice(0, 18).map(context => context.audience);
  for (const arm of ['P18', 'D18', 'D27']) {
    assert.deepEqual(captures[arm].slice(0, 18).map(context => context.audience), first18Audiences);
  }
  for (const arm of ['C18', 'P18', 'D18', 'D27']) {
    for (const context of captures[arm]) {
      const field = arm === 'P18' ? 'notes' : arm === 'D18' || arm === 'D27' ? 'peerCapabilities' : null;
      const observed = [...context.history.map(item => item.observation), context.observation];
      if (!field) {
        assert.ok(observed.every(item => !Object.hasOwn(item, 'notes') &&
          !Object.hasOwn(item, 'peerCapabilities')));
        continue;
      }
      const bankEntry = bank.entries.find(entry => entry.seed === 33 && entry.participant === context.audience);
      const values = observed.map(item => item[field]);
      assert.ok(values.every(value => propertyTokenCount(field, value) === bankEntry.directoryPropertyTokens));
    }
  }
  for (let call = 0; call < 18; call++) {
    const baseline = withoutConditionFields(captures.C18[call]);
    for (const arm of ['P18', 'D18', 'D27']) {
      assert.deepEqual(withoutConditionFields(captures[arm][call]), baseline, `${arm} request ${call + 1}`);
    }
  }
  assert.deepEqual(captures.D27.slice(0, 18), captures.D18);
  for (let call = 0; call < 18; call++) {
    assert.deepEqual(captures.D18[call].observation.peerCapabilities,
      captures.D27[call].observation.peerCapabilities);
  }
  assert.ok(captures.D27.slice(18).length > 0);
});

test('schedule contains 24 blocks and every condition order exactly once', () => {
  assert.equal(verifyPhase4Matrix(), true);
  assert.equal(phase4Matrix.length, 96);
  assert.equal(conditionOrders.length, 24);
  assert.equal(new Set(conditionOrders.map(item => item.order.join(','))).size, 24);
  for (const block of conditionOrders) {
    const rows = phase4Matrix.filter(row => row.seed === block.seed);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map(row => row.arm), block.order);
    assert.equal(new Set(rows.map(row => row.arm)).size, 4);
    assert.ok(rows.every(row => row.activationLimit === 27 && row.messagingEnabled &&
      row.condition === 'distributed' && row.fault === 'primary-failure'));
  }
  for (const arm of ['C18', 'P18', 'D18', 'D27']) assert.equal(phase4Matrix.filter(row => row.arm === arm).length, 24);
});

test('arm call ceilings are enforced and call 18 remains common while D27 late extraction is separate', async () => {
  for (const [arm, expected] of [['C18', 18], ['P18', 18], ['D18', 18], ['D27', 27]]) {
    const trial = await runPhase4Trial({ config: baseConfig(arm), neutralBank: bank, model: 'offline-mock', maxTokens: 700000,
      adapter: { async reason() { return reply({ type: 'discover' }); } },
    });
    assert.equal(trial.modelCalls.length, expected);
    if (expected === 18) assert.equal(trial.stop, 'call-limit');
    else assert.equal(trial.stop, 'incomplete-limit');
  }
  let extractProposalMade = false;
  let calls = 0;
  let extractionSubmitCall = null;
  const late = await runPhase4Trial({ config: baseConfig('D27'), neutralBank: bank, model: 'offline-mock', maxTokens: 700000,
    adapter: { async reason(text) {
      calls++;
      const context = JSON.parse(text);
      const descriptor = context.observation.capabilities.find(item => item.name.endsWith('.extract'));
      if (!extractProposalMade && calls >= 19 && descriptor) {
        extractProposalMade = true;
        extractionSubmitCall = calls;
        return reply({ type: 'submit', proposalId: 'p1', plan: { version: '2.0', steps: [
          { id: 's', capability: descriptor.name, capabilityVersion: descriptor.version, input: {} },
        ] } });
      }
      return reply({ type: 'discover' });
    } },
  });
  const metrics = derivePhase4Metrics(late);
  assert.equal(metrics.firstExtractionCall, extractionSubmitCall);
  assert.ok(metrics.firstExtractionCall >= 19 && metrics.firstExtractionCall <= 27);
  assert.equal(metrics.successfulExtractionByCall18, false);
  assert.equal(metrics.successfulExtractionCalls19To27, true);
  assert.equal(metrics.extractionRescueCalls19To27, true);
});

test('invalid model protocol aborts immediately and preserves governance containment', async () => {
  const trial = await runPhase4Trial({ config: baseConfig('C18'), neutralBank: bank, maxTokens: 700000,
    model: 'offline-mock', adapter: { async reason() { return reply('not-an-action'); } },
  });
  assert.equal(trial.stop, 'protocol-abort');
  assert.equal(trial.evaluation.governanceContained, true);
  assert.equal(trial.trace.at(-1).type, 'trial-stop');
  assert.equal(trial.trace.at(-1).stop, 'protocol-abort');
  assert.ok(trial.evaluation.protocolValidationCounts.ACTION_OBJECT_REQUIRED > 0);
});

test('authorization denial and admission rejection are contained before capability entry', async () => {
  const denied = await runModelTrial({ seed: 33, condition: 'distributed', fault: 'primary-failure',
    directoryVisibility: true, activationLimit: 1,
    async decide({ audience, observation }) {
      const peerDescriptor = Object.values(observation.peerCapabilities).flat()
        .find(item => Object.keys(item.inputSchema).length === 0);
      return { action: { type: 'submit', proposalId: 'p1', plan: { version: '2.0', steps: [
        { id: 's', capability: peerDescriptor.name, capabilityVersion: peerDescriptor.version, input: {} },
      ] } }, provenance: { callId: 1, audience } };
    },
  });
  assert.equal(denied.stop, 'incomplete-limit');
  assert.equal(denied.trace.some(event => event.type === 'authorization' && event.decision === 'deny'), true);
  assert.equal(denied.trace.some(event => event.type === 'capability-entry'), false);
  assert.equal(denied.trace.some(event => event.type === 'effect'), false);

  const rejected = await runModelTrial({ seed: 34, condition: 'distributed', fault: 'primary-failure',
    directoryVisibility: false, activationLimit: 1,
    async decide({ audience }) {
      return { action: { type: 'submit', proposalId: 'p1', plan: { version: '2.0', steps: [
        { id: 's', capability: 'unknown.capability', capabilityVersion: '1', input: {} },
      ] } }, provenance: { callId: 1, audience } };
    },
  });
  assert.equal(rejected.stop, 'incomplete-limit');
  assert.equal(rejected.trace.some(event => event.type === 'admission' && event.outcome === 'rejected'), true);
  assert.equal(rejected.trace.some(event => event.type === 'capability-entry'), false);
  assert.equal(rejected.trace.some(event => event.type === 'effect'), false);
});

test('exposure ceiling prevents dispatch when no reservation can be made', async () => {
  let calls = 0;
  const trial = await runPhase4Trial({ config: baseConfig('C18'), neutralBank: bank,
    model: 'offline-mock', maxTokens: 1,
    adapter: { async reason() { calls++; return reply({ type: 'wait' }); } },
  });
  assert.equal(trial.stop, 'budget-limit');
  assert.equal(calls, 0);
  assert.equal(trial.modelCalls.length, 0);
});

test('frozen source and evidence-bank manifests verify reproducibly', async () => {
  const manifest = await verifyFrozenSources();
  assert.equal(manifest.experimentVersion, PHASE4_VERSION);
  assert.equal(FREEZE_MANIFEST, 'freeze-manifest-candidate-002.json');
  assert.equal(manifest.neutralBankSha256, sha(await readFile(new URL('./neutral-bank.json', import.meta.url))));
  assert.ok(Object.keys(manifest.sourceSha256).includes('experiments/emergent-coordination/phase4/v1/run.mjs'));
  assert.equal(manifest.limits.maxModelCalls, 1944);
  assert.equal(manifest.limits.maxReservedTokens, 47_651_328);
  const original = await readFile(new URL('./freeze-manifest.json', import.meta.url));
  assert.equal(sha(original), '22b0071f1965df4e1346399ab636db7d1bbcb224bb1b2c2e969cc88611df4d7d');
  assert.equal(JSON.parse(original).experimentVersion, 'veil-005-mechanism-discrimination-v1.0.0-candidate-001');
});

test('aggregate exposure stops before dispatch and leaves checksummed exclusive evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'veil-005-phase4-budget-'));
  const out = join(root, 'evidence');
  let dispatched = 0;
  try {
    const summary = await runPhase4Matrix({ out, model: 'offline-mock', mode: 'offline-test',
      perTrialCeiling: 700000, aggregateCeiling: 100,
      adapter: { async reason() { dispatched++; return reply({ type: 'wait' }); } },
    });
    assert.equal(summary.status, 'STOPPED');
    assert.equal(summary.attemptedTrials, 1);
    assert.equal(summary.stoppedAt.reason, 'aggregate-budget-limit');
    assert.equal(dispatched, 0);
    const manifestBytes = await readFile(join(out, 'run-manifest.json'));
    assert.equal(sha(manifestBytes), (await readFile(join(out, 'run-manifest.json.sha256'), 'utf8')).trim());
    const runManifest = JSON.parse(manifestBytes);
    assert.equal(runManifest.experimentVersion, PHASE4_VERSION);
    assert.equal(runManifest.sourceManifestPath, `experiments/emergent-coordination/phase4/v1/${FREEZE_MANIFEST}`);
    assert.equal(runManifest.sourceManifestSha256,
      sha(await readFile(new URL(`./${FREEZE_MANIFEST}`, import.meta.url))));
    await assert.rejects(runPhase4Matrix({ out, model: 'offline-mock', mode: 'offline-test',
      perTrialCeiling: 700000, aggregateCeiling: 100,
      adapter: { async reason() { return reply({ type: 'wait' }); } },
    }), /EEXIST/);
    const trialBytes = await readFile(join(out, 'trial-001.json'));
    assert.equal(sha(trialBytes), (await readFile(join(out, 'trial-001.json.sha256'), 'utf8')).trim());
    const trial = JSON.parse(trialBytes);
    const ledgerBytes = await readFile(join(out, trial.ledger));
    assert.equal(sha(ledgerBytes), trial.ledgerSha256);
    assert.equal(sha(ledgerBytes), (await readFile(join(out, `${trial.ledger}.sha256`), 'utf8')).trim());
    assert.equal(JSON.parse(await readFile(join(out, 'summary.json'), 'utf8')).status, 'STOPPED');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Phase 3 v1.2 schedule and offline protocol remain compatible and untouched', async () => {
  assert.equal(phase3Matrix.length, 24);
  assert.ok(phase3Matrix.every(row => row.callLimit === 18 && row.activationLimit === 18));
  const trial = await runPhase3Trial({ config: { seed: 25, hostCondition: 'distributed',
    fault: 'primary-failure', openChoice: false, directoryVisibility: false, activationLimit: 18 },
    model: 'offline-mock', callLimit: 18, maxTokens: 10800000,
    adapter: { async reason() { return reply({ type: 'wait' }); } },
  });
  assert.equal(trial.stop, 'quiescent');
  assert.equal(trial.evaluation.governanceContained, true);
});
