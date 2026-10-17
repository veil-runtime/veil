import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { benchmarkFixture, getTask } from '../apps/repository-task/benchmark-tasks.js';
import { benchmarkDiagnostics } from '../apps/repository-task/benchmark-diagnostics.js';
import { diagnosticCategories, genericFailure } from '../apps/repository-task/acceptance.js';
import { runLiveTask } from '../apps/repository-task/live.js';
import { capabilityAction as action, simulated, trialLimits, trialModel } from '../apps/repository-task/trial.js';
import { runBenchmark } from '../apps/repository-task/benchmark.js';

const verify = action('verification.sandbox.run');
const finish = '{"type":"finish"}';
const almost = 'export function parseBounded(text:string,min:number,max:number):number|null { const s=text.trim(), n=Number(s); return /^[+-]?\\d+$/.test(s) && Number.isSafeInteger(n) && n>=min && n<=max ? n : null; }';
const correct = 'export function parseBounded(text:string,min:number,max:number):number|null { const s=text.trim(), n=Number(s); return /^[+-]?\\d+$/.test(s) && Number.isSafeInteger(n) && Number.isSafeInteger(min) && Number.isSafeInteger(max) && n>=min && n<=max ? n : null; }';
const write = (content: string) => action('workspace.write', { path: 'src/task.ts', content });

async function run(mode: 'sparse' | 'diagnostic', actions: string[], change?: (profile: Awaited<ReturnType<typeof benchmarkFixture>>['profile']) => void) {
  const fixture = await benchmarkFixture(getTask('bounded-integer'), 'standard', mode);
  try { change?.(fixture.profile); return await runLiveTask(fixture.objective, fixture.profile, trialModel, trialLimits, simulated(actions), 'simulated'); }
  finally { await fixture.cleanup(); }
}

test('diagnostic mappings cover fixed cases with only allowlisted host labels', () => {
  for (const task of ['bounded-integer', 'group-totals', 'interval-union', 'reservation-ledger', 'record-recovery']) {
    const cases = getTask(task).cases;
    const labels = benchmarkDiagnostics[task];
    assert.equal(labels.length, cases.length);
    assert.ok(labels.every(label => diagnosticCategories.includes(label)));
  }
});

test('sparse baseline stays generic; diagnostic names only categories of failed cases', async () => {
  const sparse = await run('sparse', [write(almost), verify, finish]);
  const diagnostic = await run('diagnostic', [write(almost), verify, finish]);
  const sparseResult = sparse.report.feedback[1].result as any;
  const diagnosticResult = diagnostic.report.feedback[1].result as any;
  assert.equal(sparseResult.stdout, genericFailure);
  assert.equal(diagnosticResult.stdout, `${genericFailure}; categories: boundary-handling`);
  assert.equal(sparseResult.stderr, ''); assert.equal(diagnosticResult.stderr, '');
  assert.equal(sparse.report.feedback[1].revision, diagnostic.report.feedback[1].revision);
  assert.equal(sparse.report.classification, diagnostic.report.classification);
  assert.equal(sparse.report.profile.acceptance.length, diagnostic.report.profile.acceptance.length);
  assert.deepEqual(sparse.report.profile.acceptance, diagnostic.report.profile.acceptance);
  assert.equal(sparse.report.profile.maxTurns, diagnostic.report.profile.maxTurns);
  assert.equal(sparse.report.profile.maxVerifications, diagnostic.report.profile.maxVerifications);
  assert.deepEqual(sparse.report.profile.limits, diagnostic.report.profile.limits);
  const baseline = await run('diagnostic', [verify, finish]);
  assert.equal((baseline.report.feedback[0].result as any).stdout,
    `${genericFailure}; categories: boundary-handling,input-validation`);
  const passed = await run('diagnostic', [write(correct), verify, finish]);
  assert.equal((passed.report.feedback[1].result as any).stdout, 'All host acceptance cases passed');
  assert.equal(passed.report.classification, 'verified');
});

test('unclassified and preparation failures stay generic; hidden values and exceptions never reach the reasoner', async () => {
  const unclassified = await run('diagnostic', [write(almost), verify, finish], p => {
    p.diagnosticCategories = p.diagnosticCategories!.map((_label, index) => index === 9 ? null : 'input-validation');
  });
  assert.equal((unclassified.report.feedback[1].result as any).stdout, genericFailure);
  const secretInput = 'HOST-ONLY-INPUT-97c4';
  const secretExpected = 'HOST-ONLY-EXPECTED-e128';
  const thrown = await run('diagnostic', [verify, finish], p => {
    p.acceptance = [{ file: 'src/task.ts', export: 'parseBounded', args: [secretInput, 0, 1], expected: secretExpected }];
    p.diagnosticCategories = ['error-recovery'];
  });
  const observation = thrown.exchanges[1].request.input;
  assert.equal((thrown.report.feedback[0].result as any).stdout, `${genericFailure}; categories: error-recovery`);
  for (const forbidden of [secretInput, secretExpected, 'AssertionError', 'deepStrictEqual', 'HOST-ONLY'])
    assert.ok(!observation.includes(forbidden), forbidden);
  const parseFailure = await run('diagnostic', [write('export function parseBounded(: number) {'), verify, finish]);
  const result = parseFailure.report.feedback[1].result as any;
  assert.equal(result.stdout, genericFailure); assert.equal(result.stderr, '');
});

test('unauthorized verification cannot select feedback or reveal categories', async () => {
  const denied = await run('diagnostic', [action('verification.sandbox.run', { feedbackCondition: 'diagnostic' }), finish]);
  assert.equal(denied.report.feedback[0].authorized, false);
  assert.equal(denied.report.feedback[0].result, undefined);
  assert.equal(denied.report.feedback[0].repeatedFailedRevision, undefined);
  assert.equal(denied.report.feedback[0].revision, denied.report.initialRevision);
  assert.equal(denied.report.classification, 'failed');
  assert.equal(denied.report.feedback.filter(f => f.capability === 'verification.sandbox.run' && f.authorized).length, 0);
  const invalidMapping = await run('diagnostic', [verify], p => { p.diagnosticCategories = ['forbidden' as any]; });
  assert.equal(invalidMapping.exchanges.length, 0);
  assert.equal(invalidMapping.report.classification, 'blocked');
});

test('repeat failed revision is recorded without changing verification count or host revision identity', async () => {
  const record = await run('diagnostic', [write(almost), verify, write(almost), verify, finish]);
  const [first, second] = [record.report.feedback[1], record.report.feedback[3]];
  assert.equal(record.report.feedback[2].revision, first.revision);
  assert.equal(second.revision, first.revision);
  assert.equal(first.repeatedFailedRevision, undefined);
  assert.equal(second.repeatedFailedRevision, first.revision);
  assert.equal((second.result as any).accepted, false);
  assert.ok(!record.exchanges[4].request.input.includes('repeatedFailedRevision'));
  assert.equal(record.report.classification, 'failed');
  assert.equal(record.report.verifiedRevision, undefined);
  assert.equal(record.report.feedback.filter(f => f.capability === 'verification.sandbox.run' && f.authorized).length, 2);
  const spoof = await run('diagnostic', [action('verification.sandbox.run', { revision: 'forged' }), verify, finish]);
  assert.equal(spoof.report.feedback[0].authorized, false);
  assert.equal(spoof.report.feedback[1].revision, spoof.report.initialRevision);
  assert.equal(spoof.report.feedback[1].repeatedFailedRevision, undefined);
});

test('feedback condition is explicit in new evidence and leaves task specification hash stable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'veil-diagnostic-evidence-'));
  try {
    const base = { mode: 'simulated' as const, model: trialModel, tasks: ['bounded-integer'], condition: 'standard' as const,
      policy: 'stop-on-failure' as const, outputDirectory: root, transport: () => simulated([finish]) };
    const sparse = await runBenchmark(base);
    const diagnostic = await runBenchmark({ ...base, feedbackCondition: 'diagnostic' });
    for (const [report, condition] of [[sparse, 'sparse'], [diagnostic, 'diagnostic']] as const) {
      const manifest = JSON.parse(await readFile(join(report.directory, 'manifest.json'), 'utf8'));
      const evidence = JSON.parse(await readFile(join(report.directory, 'bounded-integer.json'), 'utf8'));
      assert.equal(report.schemaVersion, 2); assert.equal(manifest.schemaVersion, 2); assert.equal(evidence.schemaVersion, 2);
      assert.equal(report.feedbackCondition, condition);
      assert.equal(manifest.feedbackCondition, condition);
      assert.equal(evidence.feedbackCondition, condition);
      assert.equal(report.model, trialModel);
      assert.deepEqual(manifest.sessionLimits, report.sessionLimits);
      assert.deepEqual(manifest.taskInferenceLimits, report.taskInferenceLimits);
    }
    assert.equal(sparse.results[0].specificationSHA256, diagnostic.results[0].specificationSHA256);
    assert.equal(sparse.results[0].metrics.verificationAttempts, diagnostic.results[0].metrics.verificationAttempts);
    const repeated = await runBenchmark({ ...base, feedbackCondition: 'diagnostic', transport: () => simulated([verify, verify, finish]) });
    const repeatedEvidence = JSON.parse(await readFile(join(repeated.directory, 'bounded-integer.json'), 'utf8'));
    assert.equal(repeatedEvidence.metrics.verificationAttempts, 2);
    assert.equal(repeatedEvidence.record.report.feedback[1].repeatedFailedRevision,
      repeatedEvidence.record.report.initialRevision);
  } finally { await rm(root, { recursive: true, force: true }); }
});
