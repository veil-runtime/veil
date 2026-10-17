import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runLiveTask, prices, type LiveRecord, type Transport } from './live.js';
import { trialLimits } from './trial.js';
import { benchmarkFixture, getTask, type Condition } from './benchmark-tasks.js';

export type Outcome = 'first-pass-success' | 'recovered-success' | 'verified-other' | 'failure-without-recovery' | 'budget-exhaustion' | 'protocol-failure' | 'infrastructure-failure' | 'accounting-failure' | 'integrity-failure';
export const sessionDefaults = { tasks: 5, turns: 60, verifications: 15, inputTokens: 150000, outputTokens: 60000, reservedUSD: 0.20, durationMs: 660000 };
export function metrics(record: LiveRecord, durationMs: number) {
  const { report: r, usage: u } = record;
  const verifications = r.feedback.filter(f => f.capability === 'verification.sandbox.run' && f.authorized);
  const failed = verifications.filter(f => f.status === 'completed' && (f.result as any)?.accepted === false && (f.result as any)?.status !== 'unavailable');
  const firstPass = failed.length === 0 && (verifications[0]?.result as any)?.accepted === true;
  const recovered = failed.some(f => r.feedback.some(edit => edit.turn > f.turn && ['workspace.write', 'workspace.patch'].includes(edit.capability)
    && edit.authorized && edit.status === 'completed' && edit.revision !== f.revision
    && verifications.some(v => v.turn > edit.turn && (v.result as any)?.accepted === true)));
  const revisionIntegrity = !!r.finalRevision && r.finalRevision === r.verifiedRevision;
  const verificationInfrastructureFailure = verifications.some(f => f.status !== 'completed'
    || typeof (f.result as any)?.accepted !== 'boolean' || (f.result as any)?.status === 'unavailable');
  let outcome: Outcome;
  if ((!r.originalUnchanged && !!r.initialRevision) || (r.classification === 'verified' && !revisionIntegrity)) outcome = 'integrity-failure';
  else if (/Unreliable usage|Reliable input|Pricing|Invalid inference/.test(r.reason)) outcome = 'accounting-failure';
  else if (/Malformed|Unsupported|protocol/.test(r.reason)) outcome = 'protocol-failure';
  else if (!u.reliable || verificationInfrastructureFailure || /Transport|timeout|deadline|Final evidence|Cleanup/.test(r.reason) || r.classification === 'blocked') outcome = 'infrastructure-failure';
  else if (r.classification === 'exhausted') outcome = 'budget-exhaustion';
  else if (r.classification === 'verified') outcome = recovered ? 'recovered-success' : firstPass ? 'first-pass-success' : 'verified-other';
  else outcome = r.classification === 'failed' ? 'failure-without-recovery' : 'infrastructure-failure';
  const verified = r.classification === 'verified' && revisionIntegrity && r.originalUnchanged && u.reliable
    && ['first-pass-success', 'recovered-success', 'verified-other'].includes(outcome);
  const firstEffect = r.feedback.find(f => f.authorized && ['workspace.write', 'workspace.patch', 'verification.sandbox.run'].includes(f.capability));
  return { model: record.requestedModel, verified, outcome, hostClassification: r.classification, reason: r.reason,
    firstPassSuccess: verified && firstPass, recoveredSuccess: verified && recovered,
    recoveryConditionFollowed: firstEffect?.capability === 'verification.sandbox.run' && failed.some(f => f.turn === firstEffect.turn),
    modelTurns: record.exchanges.length, completedModelTurns: record.exchanges.filter(e => e.response).length,
    verificationAttempts: verifications.length,
    rejectedActions: r.feedback.filter(f => !f.authorized).length + record.exchanges.filter(e => e.response && !e.action && /Malformed|Unsupported/.test(e.error ?? '')).length,
    tokens: { input: u.input, output: u.output, reliable: u.reliable }, estimatedInferenceCostUSD: u.estimatedUSD,
    reservedUSD: u.reservedUSD, revisionIntegrity, originalSourcePreserved: r.originalUnchanged, durationMs };
}
export interface BenchmarkOptions {
  mode: 'simulated' | 'live'; model: string; tasks: string[]; condition: Condition;
  policy: 'continue-model-failures' | 'stop-on-failure'; outputDirectory: string;
  transport: (taskId: string) => Transport; secrets?: string[];
  sessionLimits?: typeof sessionDefaults;
}
/** Full per-task budgets are admitted before starting. Ambiguous failures always stop. */
export async function runBenchmark(options: BenchmarkOptions) {
  if (!Object.hasOwn(prices, options.model)) throw Error('Unsupported model');
  if (!['simulated', 'live'].includes(options.mode) || !['standard', 'recovery'].includes(options.condition)
    || !['continue-model-failures', 'stop-on-failure'].includes(options.policy)) throw Error('Invalid benchmark mode, condition or policy');
  if (!options.tasks.length || new Set(options.tasks).size !== options.tasks.length) throw Error('Select distinct tasks');
  const tasks = options.tasks.map(getTask);
  if (options.condition === 'recovery' && (tasks.length !== 1 || tasks[0].id !== 'bounded-integer')) throw Error('Recovery selects bounded-integer only');
  const limits = structuredClone(options.sessionLimits ?? sessionDefaults);
  for (const [key, value] of Object.entries(limits)) if (!Number.isFinite(value) || value <= 0 || (key !== 'reservedUSD' && !Number.isSafeInteger(value))) throw Error('Invalid session limits');
  await mkdir(options.outputDirectory, { recursive: true });
  const directory = await mkdtemp(join(options.outputDirectory, 'benchmark-'));
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, mode: options.mode, model: options.model,
    tasks: options.tasks, condition: options.condition, policy: options.policy, sessionLimits: limits, taskInferenceLimits: trialLimits }) + '\n', { flag: 'wx', mode: 0o600 });
  const started = performance.now();
  const totals = { tasks: 0, turns: 0, verifications: 0, inputTokens: 0, outputTokens: 0, reservedUSD: 0, estimatedUSD: 0 };
  const results: { taskId: string; difficulty: string; specificationSHA256: string; evidence: string; metrics: ReturnType<typeof metrics> }[] = [];
  const hostFailures: { taskId: string; stage: string; classification: 'infrastructure-failure' }[] = [];
  let stopReason = 'completed';
  for (const task of tasks) {
    if (totals.tasks + 1 > limits.tasks || totals.turns + 12 > limits.turns || totals.verifications + 3 > limits.verifications
      || totals.inputTokens + trialLimits.inputTokens > limits.inputTokens || totals.outputTokens + trialLimits.outputTokens > limits.outputTokens
      || totals.reservedUSD + trialLimits.costUSD > limits.reservedUSD + 1e-12 || performance.now() - started + 120000 > limits.durationMs) {
      stopReason = 'session-budget-exhaustion'; break;
    }
    let fixture: Awaited<ReturnType<typeof benchmarkFixture>>;
    try { fixture = await benchmarkFixture(task, options.condition); }
    catch { hostFailures.push({ taskId: task.id, stage: 'fixture-setup', classification: 'infrastructure-failure' }); stopReason = 'infrastructure-failure'; break; }
    const taskStarted = performance.now();
    let record: LiveRecord;
    try {
      record = await runLiveTask(fixture.objective, fixture.profile, options.model, trialLimits, options.transport(task.id), options.mode, options.secrets);
    } catch {
      // An unexpected host exception cannot be mistaken for a model failure.
      record = { mode: options.mode, requestedModel: options.model, limits: trialLimits, exchanges: [],
        usage: { input: 0, output: 0, estimatedUSD: 0, reservedUSD: trialLimits.costUSD, reliable: false },
        report: { classification: 'uncertain', objective: fixture.objective, reason: 'Host infrastructure failure; accounting unknown',
          originalUnchanged: false, patch: '', feedback: [], profile: fixture.profile } };
    }
    try { await fixture.cleanup(); }
    catch { record.report.classification = 'uncertain'; record.report.reason = 'Cleanup failed'; }
    const measured = metrics(record, performance.now() - taskStarted);
    const evidence = `${task.id}.json`;
    const specificationSHA256 = createHash('sha256').update(JSON.stringify({ task, source: fixture.source, objective: fixture.objective, condition: options.condition, profile: { ...fixture.profile, repository: '<disposable>' } })).digest('hex');
    await writeFile(join(directory, evidence), JSON.stringify({ schemaVersion: 1, taskId: task.id, condition: options.condition, specificationSHA256, metrics: measured, record }) + '\n', { flag: 'wx', mode: 0o600 });
    results.push({ taskId: task.id, difficulty: task.difficulty, specificationSHA256, evidence, metrics: measured });
    totals.tasks++; totals.turns += measured.modelTurns; totals.verifications += measured.verificationAttempts;
    totals.inputTokens += record.usage.input; totals.outputTokens += record.usage.output;
    totals.reservedUSD += record.usage.reservedUSD; totals.estimatedUSD += record.usage.estimatedUSD;
    if (!measured.verified && (options.policy === 'stop-on-failure' || !['failure-without-recovery', 'budget-exhaustion'].includes(measured.outcome))) {
      stopReason = measured.outcome; break;
    }
  }
  const report = { schemaVersion: 1, mode: options.mode, model: options.model, condition: options.condition, policy: options.policy,
    startedAt: new Date(Date.now() - (performance.now() - started)).toISOString(), directory, sessionLimits: limits, taskInferenceLimits: trialLimits,
    selected: options.tasks, notRun: options.tasks.slice(results.length), stopReason, hostFailures, results, totals, durationMs: performance.now() - started,
    recoveryCompliance: options.condition === 'recovery' ? { followed: results.filter(r => r.metrics.recoveryConditionFollowed).length,
      recoveredAmongCompliant: results.filter(r => r.metrics.recoveryConditionFollowed && r.metrics.recoveredSuccess).length } : null,
    denominators: { selected: tasks.length, attempted: results.length, verified: results.filter(r => r.metrics.verified).length,
      firstPass: results.filter(r => r.metrics.firstPassSuccess).length, recovered: results.filter(r => r.metrics.recoveredSuccess).length },
    limitations: ['Small purposive task bank; not statistically conclusive.', 'Simulated outcomes test machinery, not model skill.',
      'Recovery is a separate condition, not a sixth independent task.', 'Finite oracles do not prove general correctness.',
      'Evidence is not crash durable; JavaScript deadlines do not preempt host stalls.', 'Estimated pricing is a host table, not a billing guarantee.'] };
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return report;
}
