import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { AGGREGATE_CEILING, CALL_LIMIT, FROZEN_MODEL, PER_TRIAL_CEILING,
  phase3Matrix, runPhase3Comparison, sourceHashes, verifyMatchedMatrix } from './run.mjs';
import { phase3Matrix as v1Matrix } from '../v1/run.mjs';
import { runPhase3Trial } from '../v1/driver.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const withDestination = async fn => {
  const base = await mkdtemp(join(tmpdir(), 'veil-005-phase3-v1-1-test-'));
  try { return await fn(join(base, 'evidence')); }
  finally { await rm(base, { recursive: true, force: true }); }
};

test('v1.1 changes only budget and evidence identifiers while retaining matched order and call limit', () => {
  assert.equal(PER_TRIAL_CEILING, 450000);
  assert.equal(AGGREGATE_CEILING, 10800000);
  assert.equal(CALL_LIMIT, 18);
  assert.equal(CALL_LIMIT * phase3Matrix.length, 432);
  assert.deepEqual(phase3Matrix, v1Matrix);
  assert.equal(verifyMatchedMatrix(), true);
});

test('v1.1 still refuses a call before dispatch when its full reservation will not fit', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runPhase3Comparison({ out, model: 'offline-mock',
      perTrialCeiling: 1000, aggregateCeiling: 24000,
      adapter: { async reason() {
        calls++;
        return { ok: true, outputText: '{"type":"wait"}',
          metadata: { inputTokens: 1, outputTokens: 0 } };
      } } });
    assert.equal(calls, 0);
    assert.equal(summary.status, 'TRIAL CHECKPOINT');
    assert.equal(summary.attemptedTrials, 1);
    assert.equal(summary.completedTrials, 0);
    assert.equal(summary.trials[0].stop, 'budget-limit');
    assert.equal(summary.chargedExposureTokens, 0);
    assert.equal(summary.unattempted.length, 23);
    assert.equal(summary.paired.completePairs, 0);
  });
});

test('contexts over the frozen 24,000 input bound fail closed before adapter dispatch', async () => {
  let calls = 0;
  const histories = new Map(['central', 'p0', 'p1', 'p2']
    .map(audience => [audience, ['x'.repeat(24000)]]));
  const trial = await runPhase3Trial({ config: { seed: 25, directoryVisibility: true,
    hostCondition: 'distributed', activationLimit: 18 }, histories, maxTokens: 500000,
    callLimit: CALL_LIMIT,
    outputTokenLimit: 512, adapter: { async reason() { calls++; return {}; } } });
  assert.equal(trial.stop, 'context-limit');
  assert.equal(trial.modelCalls.length, 0);
  assert.equal(calls, 0);
});

test('replacement run writes distinct manifest, all matched trials, and exclusive checksummed evidence offline', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runPhase3Comparison({ out, model: 'offline-mock', mode: 'offline-test',
      perTrialCeiling: PER_TRIAL_CEILING, aggregateCeiling: AGGREGATE_CEILING,
      adapter: { async reason() {
        calls++;
        return { ok: true, outputText: JSON.stringify({ type: 'wait' }),
          metadata: { requestedModel: 'offline-mock', inputTokens: 1, outputTokens: 0 } };
      } } });
    assert.equal(summary.status, 'COMPARISON COMPLETE');
    assert.equal(summary.attemptedTrials, 24);
    assert.equal(summary.completedTrials, 24);
    assert.equal(summary.paired.completePairs, 12);
    assert.ok(calls <= 24 * CALL_LIMIT);
    assert.equal(summary.maxPerTrialExposureTokens, 450000);
    assert.equal(summary.maxAggregateExposureTokens, 10800000);

    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    assert.equal(manifest.experimentVersion, 'phase3-peer-capability-visibility-v1.1-budget-amendment-001');
    assert.equal(manifest.evidenceClass,
      'replacement-exploratory-peer-capability-visibility-comparison-after-incomplete-v1');
    assert.equal(manifest.model, 'offline-mock');
    assert.equal(FROZEN_MODEL, 'gpt-4.1-mini');
    assert.equal(manifest.temperature, 'omit');
    const frozen = JSON.parse(await readFile(new URL('../v1/freeze-manifest.json', import.meta.url), 'utf8'));
    assert.equal(manifest.sourceSha256['experiments/emergent-coordination/phase2/participant-prompt.txt'],
      frozen.promptProtocolSha256.participantPrompt);
    assert.equal(manifest.sourceSha256['experiments/emergent-coordination/phase2/protocol.md'],
      frozen.promptProtocolSha256.protocol);
    assert.equal(manifest.budget.perTrialCeiling, 450000);
    assert.equal(manifest.budget.aggregateCeiling, 10800000);
    assert.equal(manifest.budget.callLimit, 18);
    assert.equal(manifest.excludedPriorEvidence.reason,
      'incomplete budget-limited treatment; excluded from matched outcomes and replacement trial counts');
    assert.ok(manifest.sourceSha256['experiments/emergent-coordination/phase3/v1.1/run.mjs']);
    assert.ok(manifest.sourceSha256['experiments/emergent-coordination/phase3/v1/freeze-manifest.json']);
    assert.deepEqual(Object.keys(manifest.sourceSha256).sort(), Object.keys(await sourceHashes()).sort());

    const names = await readdir(out);
    const dataFiles = names.filter(name => name.endsWith('.json') || name.endsWith('.jsonl'));
    for (const name of dataFiles) {
      assert.ok(names.includes(`${name}.sha256`), `missing checksum for ${name}`);
      assert.equal((await readFile(join(out, `${name}.sha256`), 'utf8')).trim(),
        sha(await readFile(join(out, name))));
    }
    let retryCalls = 0;
    await assert.rejects(runPhase3Comparison({ out, model: 'offline-mock', adapter: {
      async reason() { retryCalls++; return { ok: true, outputText: '{"type":"wait"}',
        metadata: { inputTokens: 1, outputTokens: 0 } }; },
    } }), { code: 'EEXIST' });
    assert.equal(retryCalls, 0);
  });
});
