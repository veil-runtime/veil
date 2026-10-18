import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pilotMatrix } from '../run.mjs';
import { extendedSmokeMatrix, smokeMatrix } from '../smoke.mjs';
import { runModelTrial } from '../host.mjs';
import { runReasoningTrial } from '../driver.mjs';
import { comparePairedBinary } from '../evaluate.mjs';
import { AGGREGATE_CEILING, comparisonMatrix, liveComparisonMain,
  PER_TRIAL_CEILING, runComparison } from './run.mjs';
import { runComparisonTrial } from './driver.mjs';
import { comparisonOutcome, pairedSummary } from './outcomes.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const reply = (action, metadata = { inputTokens: 100, outputTokens: 20 }) => ({ ok: true,
  outputText: JSON.stringify(action), metadata: { requestedModel: 'offline-mock', ...metadata } });
async function withDestination(fn) {
  const base = await mkdtemp(join(tmpdir(), 'veil-005-comparison-test-'));
  try { return await fn(join(base, 'evidence')); }
  finally { await rm(base, { recursive: true, force: true }); }
}
const record = async (out, index, condition, seed) => JSON.parse(await readFile(join(out,
  `comparison-${String(index).padStart(2, '0')}-${condition}-seed${seed}.json`), 'utf8'));

test('matrix has exact fixed 2x2 matched seeds and leaves historical schedules unchanged', () => {
  assert.equal(comparisonMatrix.length, 12);
  assert.equal(PER_TRIAL_CEILING, 50000);
  assert.equal(AGGREGATE_CEILING, 12 * PER_TRIAL_CEILING);
  for (const seed of [12, 13, 14]) {
    const rows = comparisonMatrix.filter(item => item.seed === seed);
    assert.deepEqual(new Set(rows.map(item => item.condition)), new Set(['A', 'B', 'C', 'D']));
    assert.ok(rows.every(item => item.fault === 'primary-failure' && !item.openChoice &&
      item.activationLimit === 18 && item.callLimit === 18));
  }
  assert.equal(pilotMatrix.length, 7);
  assert.equal(smokeMatrix.length, 2);
  assert.equal(extendedSmokeMatrix.length, 1);
});

test('matched host seeds give equal layouts and initial scheduler observations', async () => {
  const trials = [];
  for (const condition of ['distributed', 'no-communication']) {
    trials.push(await runModelTrial({ seed: 12, condition, fault: 'primary-failure', openChoice: false,
      activationLimit: 1, decide: async () => ({ action: { type: 'wait' } }) }));
  }
  assert.deepEqual(trials[0].assignment, trials[1].assignment);
  const activation = trial => trial.trace.find(event => event.type === 'activation');
  assert.equal(activation(trials[0]).participant, activation(trials[1]).participant);
  const left = structuredClone(activation(trials[0]).observation);
  const right = structuredClone(activation(trials[1]).observation);
  delete left.messagingEnabled; delete right.messagingEnabled;
  left.availableCapabilities = left.availableCapabilities.map(name => name.split('.').at(-1));
  right.availableCapabilities = right.availableCapabilities.map(name => name.split('.').at(-1));
  assert.deepEqual(left, right);
});

test('baseline model context is byte-identical to the historical driver', async () => {
  const config = { seed: 12, condition: 'distributed', fault: 'primary-failure',
    openChoice: false, activationLimit: 1 };
  const adapter = { async reason() { return reply({ type: 'wait' }); } };
  const oldTrial = await runReasoningTrial({ config, adapter, maxTokens: 10000, callLimit: 1,
    outputTokenLimit: 512 });
  const newTrial = await runComparisonTrial({ config, lifecycleClarified: false,
    adapter, maxTokens: 10000, callLimit: 1, outputTokenLimit: 512 });
  assert.equal(newTrial.modelCalls[0].contextText, oldTrial.modelCalls[0].contextText);
  assert.equal(newTrial.modelCalls[0].contextHash, oldTrial.modelCalls[0].contextHash);
});

test('only clarified contexts receive lifecycle text; ledgers, hashes and isolation are intact', async () => {
  await withDestination(async out => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'offline-comparison-secret';
    try {
      const summary = await runComparison({ out, model: 'offline-mock', adapter: {
        async reason(text) {
          const context = JSON.parse(text);
          return reply(context.observation.capabilities.length ?
            { type: 'finish', status: 'blocked', summary: 'No work attempted' } : { type: 'discover' });
        },
      } });
      assert.equal(summary.status, 'COMPARISON COMPLETE');
      assert.equal(summary.completedTrials, 12);
      assert.equal(summary.unattempted.length, 0);
      assert.equal(summary.completeMatchedSeedComparison, true);
      assert.equal(summary.paired.status, 'COMPLETE');
      assert.deepEqual(Object.values(summary.paired.groups).map(group => group.status),
        ['COMPLETE', 'COMPLETE', 'COMPLETE']);
      assert.equal(summary.trials.every(row => row.governanceContained && !row.hostCredentialPresent), true);
      assert.equal(summary.trials.every(row => row.messagesDelivered === 0), true);
      assert.ok(summary.chargedExposureTokens <= AGGREGATE_CEILING);
      assert.ok(summary.trials.every(row => row.chargedExposureTokens <= PER_TRIAL_CEILING));
      assert.deepEqual(summary.paired.pairs['A-B'].seeds, [12, 13, 14]);
      const manifestText = await readFile(join(out, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestText);
      assert.equal(manifest.experimentVersion, 'phase2-lifecycle-comparison-v1');
      assert.equal((await readFile(join(out, 'manifest.json.sha256'), 'utf8')).trim(), sha(manifestText));
      const original = await readFile(new URL('../protocol.md', import.meta.url), 'utf8');
      const addendum = await readFile(new URL('./lifecycle.txt', import.meta.url), 'utf8');
      assert.equal(manifest.promptSha256.baselineProtocolSha256, sha(original));
      assert.equal(manifest.promptSha256.clarifiedProtocolSha256, sha(original + '\n' + addendum));
      const a = await record(out, 1, 'A', 12);
      const b = await record(out, 2, 'B', 12);
      const c = await record(out, 3, 'C', 12);
      const d = await record(out, 4, 'D', 12);
      const firstContext = item => JSON.parse(item.trial.modelCalls[0].contextText);
      const ac = [firstContext(a), firstContext(c)];
      const bd = [firstContext(b), firstContext(d)];
      assert.equal(ac[0].protocol, original);
      assert.equal(bd[0].protocol, original);
      assert.equal(ac[1].protocol, original + '\n' + addendum);
      assert.equal(bd[1].protocol, original + '\n' + addendum);
      for (const [left, right] of [ac, bd]) {
        delete left.protocol; delete right.protocol;
        assert.deepEqual(left, right);
      }
      assert.equal(firstContext(a).observation.messagingEnabled, true);
      assert.equal(firstContext(b).observation.messagingEnabled, false);
      assert.ok(a.trial.modelCalls.every(call => !call.contextText.includes('offline-comparison-secret') &&
        !call.contextText.includes('privateWorld')));
      assert.ok((await readFile(join(out, 'summary.json.sha256'), 'utf8')).trim() ===
        sha(await readFile(join(out, 'summary.json'), 'utf8')));
      const file = 'comparison-01-A-seed12.json';
      assert.equal((await readFile(join(out, `${file}.sha256`), 'utf8')).trim(),
        sha(await readFile(join(out, file), 'utf8')));
      const ledger = (await readFile(join(out, 'comparison-01-A-seed12.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      assert.equal(ledger[0].phase, 'trial-config');
      assert.equal(ledger.at(-1).phase, 'trial-end');
      assert.equal(ledger.filter(item => item.phase === 'budget-settlement').length, a.trial.modelCalls.length);
      await assert.rejects(runComparison({ out, model: 'offline-mock',
        adapter: { async reason() { return reply({ type: 'wait' }); } } }), { code: 'EEXIST' });
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});

test('disabled communication does not deliver private raw values; authority remains host-owned', async () => {
  await withDestination(async out => {
    const summary = await runComparison({ out, model: 'offline-mock', adapter: {
      async reason(text) {
        const { observation, history } = JSON.parse(text);
        const extract = observation.availableCapabilities.find(name => name.endsWith('.extract'));
        if (!observation.capabilities.length) return reply({ type: 'discover' });
        const raw = observation.receipts.find(item => item.capability?.endsWith('.extract') &&
          item.outcome === 'SUCCESS')?.result?.raw;
        if (raw) return reply({ type: 'send', to: 'all', body: { raw } });
        if (extract && !history.some(item => item.outputText.includes('"type":"submit"'))) {
          return reply({ type: 'submit', proposalId: 'p1', caller: { subject: 'admin', scopes: ['*'] },
            plan: { version: '2.0', caller: { subject: 'admin' }, steps: [
              { id: 's', capability: extract, capabilityVersion: '1', input: {} }] } });
        }
        return reply({ type: 'finish', status: 'blocked', summary: 'No further work' });
      },
    } });
    assert.equal(summary.completedTrials, 12);
    const enabled = await record(out, 1, 'A', 12);
    const disabled = await record(out, 2, 'B', 12);
    assert.ok(enabled.trial.trace.some(event => event.type === 'message-queued'));
    assert.equal(disabled.trial.trace.some(event => event.type === 'message-queued'), false);
    assert.ok(disabled.trial.trace.some(event => event.type === 'message-blocked'));
    assert.ok(enabled.trial.trace.some(event => event.type === 'proposal' && event.droppedAuthority));
    assert.ok(enabled.trial.trace.filter(event => event.type === 'authorization').every(event =>
      event.participant !== 'admin' && !event.callerScopes.includes('*')));
    assert.ok(disabled.trial.trace.filter(event => event.type === 'activation').every(event =>
      event.observation.inbox.length === 0));
    assert.ok(summary.trials.every(row => row.governanceContained));
    assert.ok(summary.trials.some(row => row.rawTransfers > 0));
    assert.ok(summary.trials.filter(row => !row.messagingEnabled).every(row => row.rawTransfers === 0));
  });
});

test('untrusted cross-participant authority request reaches V2 authorization and is denied', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runComparison({ out, model: 'offline-mock', adapter: {
      async reason(text) {
        calls++;
        if (calls > 1) return { ok: false, category: 'provider-error', metadata: {} };
        const { observation } = JSON.parse(text);
        const prefix = observation.availableCapabilities[0].split('.').slice(0, -1).join('.');
        const kind = ['extract', 'refineA', 'refineB', 'release'].find(name =>
          !observation.availableCapabilities.includes(`${prefix}.${name}`));
        const input = kind === 'extract' ? {} : kind === 'release' ?
          { refined: 'wrong' } : { raw: 'wrong' };
        return reply({ type: 'submit', proposalId: 'p1', caller: { subject: 'admin', scopes: ['*'] },
          plan: { version: '2.0', caller: { subject: 'admin' }, steps: [
            { id: 's', capability: `${prefix}.${kind}`, capabilityVersion: '1', input }] } });
      },
    } });
    const first = await record(out, 1, 'A', 12);
    assert.equal(summary.status, 'PROVIDER CHECKPOINT');
    assert.equal(summary.unattempted.length, 11);
    assert.ok(first.trial.trace.some(event => event.type === 'admission' && event.outcome === 'passed'));
    assert.ok(first.trial.trace.some(event => event.type === 'authorization' && event.decision === 'deny'));
    assert.ok(first.trial.trace.some(event => event.type === 'proposal' && event.droppedAuthority));
    assert.equal(first.trial.trace.some(event => event.type === 'effect'), false);
    assert.equal(first.trial.evaluation.governanceContained, true);
  });
});

test('per-trial and aggregate ceilings record censored trials without skipping conditions', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runComparison({ out, model: 'offline-mock', perTrialCeiling: 9000,
      aggregateCeiling: 108000, adapter: { async reason() { calls++; return reply({ type: 'discover' }, {}); } } });
    assert.equal(summary.completedTrials, 12);
    assert.equal(summary.unattempted.length, 0);
    assert.equal(calls, 12);
    assert.equal(summary.completeMatchedSeedComparison, true);
    assert.equal(summary.paired.groups['12'].conditionStatus.A, 'OBSERVED_CENSORED');
    assert.ok(summary.trials.every(row => row.stop === 'budget-limit' && row.censored));
    assert.ok(summary.trials.every(row => row.chargedExposureTokens <= 9000));
    assert.ok(summary.chargedExposureTokens <= 108000);
    assert.equal(summary.chargedExposureTokens, summary.grossReservedTokens);
  });
});

test('provider, protocol, and invalid usage stop fail-closed with later trials explicit', async () => {
  for (const [response, expected] of [
    [{ ok: false, category: 'rate-limit', metadata: { httpStatus: 429 } }, 'PROVIDER CHECKPOINT'],
    [reply({ type: 'submit', proposalId: 'p0-1' }), 'PROTOCOL CHECKPOINT'],
    [reply({ type: 'discover' }, { inputTokens: 99999, outputTokens: 1 }), 'BUDGET ACCOUNTING FAILURE'],
  ]) {
    await withDestination(async out => {
      let calls = 0;
      const summary = await runComparison({ out, model: 'offline-mock', adapter: {
        async reason() { calls++; return response; },
      } });
      assert.equal(summary.status, expected);
      assert.equal(calls, 1);
      assert.equal(summary.completedTrials, 1);
      assert.equal(summary.unattempted.length, 11);
      assert.equal(summary.completeMatchedSeedComparison, false);
      assert.equal(summary.paired.status, 'INCOMPLETE');
      assert.deepEqual(summary.paired.groups['12'].missingConditions, ['B', 'C', 'D']);
      assert.equal(summary.paired.groups['13'].conditionStatus.A, 'UNATTEMPTED');
      assert.equal(summary.paired.pairs['A-B'].status, 'INCOMPLETE');
      assert.deepEqual(summary.paired.pairs['A-B'].missingSeeds, [12, 13, 14]);
      assert.equal(summary.paired.groups['12'].conditionStatus.A, 'PARTIAL');
      assert.equal(summary.trials[0].effects.extract, 0);
      assert.equal((await readdir(out)).filter(name => name.endsWith('.jsonl')).length, 1);
    });
  }
});

test('outcomes and paired comparisons are deterministic and do not impute missing seeds', () => {
  const rows = [
    { seed: 12, condition: 'A', primarySuccess: true },
    { seed: 12, condition: 'B', primarySuccess: false },
    { seed: 12, condition: 'C', primarySuccess: true },
    { seed: 13, condition: 'A', primarySuccess: false },
    { seed: 13, condition: 'B', primarySuccess: false },
  ];
  assert.deepEqual(pairedSummary(rows), pairedSummary(rows));
  assert.deepEqual(pairedSummary(rows).pairs['A-B'].seeds, [12, 13]);
  assert.equal(pairedSummary(rows).status, 'INCOMPLETE');
  assert.equal(pairedSummary(rows).pairs['A-B'].status, 'COMPLETE');
  assert.deepEqual(pairedSummary(rows).groups['12'].missingConditions, ['D']);
  assert.deepEqual(pairedSummary(rows).pairs['C-D'].seeds, []);
  assert.equal(pairedSummary(rows).pairs['C-D'].meanPrimaryDifference, null);
  assert.deepEqual(pairedSummary(rows).pairs['A-B'].secondaryDifferences.messagesDelivered, [null, null]);
  const interrupted = pairedSummary(rows, comparisonMatrix,
    [{ seed: 12, condition: 'D', reason: 'worker-interrupted' }]);
  assert.equal(interrupted.status, 'INCOMPLETE');
  assert.equal(interrupted.groups['12'].conditionStatus.D, 'INTERRUPTED');
  assert.deepEqual(interrupted.groups['14'].missingConditions, ['A', 'B', 'C', 'D']);
  assert.equal(interrupted.pairs['C-D'].status, 'INCOMPLETE');
  assert.deepEqual(interrupted.pairs['C-D'].missingSeeds, [12, 13, 14]);
  const recordedButPartial = pairedSummary(comparisonMatrix.map(item => ({
    seed: item.seed, condition: item.condition, primarySuccess: false,
    partial: item.seed === 14 && item.condition === 'D',
  })), comparisonMatrix);
  assert.equal(recordedButPartial.status, 'INCOMPLETE');
  assert.equal(recordedButPartial.groups['14'].conditionStatus.D, 'PARTIAL');
  assert.deepEqual(recordedButPartial.groups['14'].partialConditions, ['D']);
  assert.equal(recordedButPartial.pairs['C-D'].status, 'INCOMPLETE');
  assert.deepEqual(recordedButPartial.pairs['C-D'].partialSeeds, [14]);
  assert.equal(recordedButPartial.pairs['C-D'].observedPairs, 3);
  assert.equal(recordedButPartial.pairs['C-D'].completePairs, 2);
  assert.equal(recordedButPartial.pairs['C-D'].provisionalDueToPartial, true);
  assert.equal(typeof comparePairedBinary, 'function');
  assert.equal(typeof comparisonOutcome, 'function');
});

test('live CLI rejects wrong ceilings before any evidence or paid call', async () => {
  await withDestination(async out => {
    const before = { key: process.env.OPENAI_API_KEY, model: process.env.VEIL_005_MODEL,
      max: process.env.VEIL_005_MAX_TOKENS, trial: process.env.VEIL_005_PER_TRIAL_TOKENS };
    try {
      process.env.OPENAI_API_KEY = 'offline-secret';
      process.env.VEIL_005_MODEL = 'offline-mock';
      process.env.VEIL_005_MAX_TOKENS = '599999';
      process.env.VEIL_005_PER_TRIAL_TOKENS = '50000';
      await assert.rejects(liveComparisonMain(['--live-comparison', '--out', out]));
      process.env.VEIL_005_MAX_TOKENS = '600000';
      process.env.VEIL_005_PER_TRIAL_TOKENS = '50001';
      await assert.rejects(liveComparisonMain(['--live-comparison', '--out', out]));
      await assert.rejects(readdir(out), { code: 'ENOENT' });
    } finally {
      if (before.key === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = before.key;
      if (before.model === undefined) delete process.env.VEIL_005_MODEL;
      else process.env.VEIL_005_MODEL = before.model;
      if (before.max === undefined) delete process.env.VEIL_005_MAX_TOKENS;
      else process.env.VEIL_005_MAX_TOKENS = before.max;
      if (before.trial === undefined) delete process.env.VEIL_005_PER_TRIAL_TOKENS;
      else process.env.VEIL_005_PER_TRIAL_TOKENS = before.trial;
    }
  });
});
