import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_VERSION, WIRE_OUTPUT } from '../../../external-model-reasoner/providers/openai.mjs';
import { settledTokenBudget } from '../../phase2/budget.mjs';
import { phase2OpenaiAdapter } from '../../phase2/openai-http.mjs';
import { runPhase3Trial, MODEL_LIMITS } from '../v1/driver.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
export const PHASE3_VERSION = 'phase3-peer-capability-visibility-v1.1-budget-amendment-001';
export const EVALUATION_VERSION = 'phase3-event-outcomes-v1';
export const FROZEN_MODEL = 'gpt-4.1-mini';
export const PER_TRIAL_CEILING = 450000;
export const AGGREGATE_CEILING = 10800000;
export const OUTPUT_TOKEN_CAP = 512;
export const CALL_LIMIT = 18;
export const ORDER_SEED = 20261015;
const seeds = Object.freeze(Array.from({ length: 12 }, (_, index) => index + 21));

function seeded(seed) {
  let value = seed >>> 0 || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
function makeMatrix() {
  const order = [...seeds];
  const next = seeded(ORDER_SEED);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return Object.freeze(order.flatMap((seed, index) => {
    const conditions = index % 2 === 0 ? ['treatment', 'control'] : ['control', 'treatment'];
    return conditions.map(condition => Object.freeze({ seed, condition,
      directoryVisibility: condition === 'treatment', messagingEnabled: true,
      hostCondition: 'distributed', fault: 'primary-failure', openChoice: false,
      activationLimit: 18, callLimit: CALL_LIMIT }));
  }));
}
export const phase3Matrix = makeMatrix();

export function requireCleanWorktree(status) {
  if (typeof status !== 'string') throw new Error('Git worktree status is unavailable');
  if (status.trim()) throw new Error('Live Phase 3 requires a clean source worktree');
  return true;
}

function currentGitStatus() {
  return execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: root, encoding: 'utf8' });
}

export function verifyMatchedMatrix(matrix = phase3Matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 24) throw new Error('Phase 3 matrix must contain 24 trials');
  for (const seed of seeds) {
    const pair = matrix.filter(row => row.seed === seed);
    if (pair.length !== 2 || new Set(pair.map(row => row.condition)).size !== 2 ||
        !pair.some(row => row.condition === 'control' && row.directoryVisibility === false) ||
        !pair.some(row => row.condition === 'treatment' && row.directoryVisibility === true)) {
      throw new Error(`Invalid matched pair for seed ${seed}`);
    }
    for (const row of pair) {
      if (row.messagingEnabled !== true || row.hostCondition !== 'distributed' ||
          row.fault !== 'primary-failure' || row.openChoice !== false ||
          row.activationLimit !== 18 || row.callLimit !== CALL_LIMIT) {
        throw new Error(`Matched trial configuration changed for seed ${seed}`);
      }
    }
  }
  if (JSON.stringify(matrix.map(row => `${row.seed}:${row.condition}`)) !==
      JSON.stringify(phase3Matrix.map(row => `${row.seed}:${row.condition}`))) {
    throw new Error('Phase 3 trial order differs from preregistered order');
  }
  return true;
}

function trialBudget(shared, ceiling) {
  let charged = 0;
  const tickets = new Map();
  return {
    reserve(tokens) {
      if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > ceiling - charged) return false;
      const ticket = shared.reserve(tokens);
      if (!ticket) return false;
      tickets.set(ticket, tokens); charged += tokens; return ticket;
    },
    settle(ticket, details) {
      const reservation = tickets.get(ticket);
      if (reservation === undefined) throw new Error('Unknown trial budget ticket');
      tickets.delete(ticket);
      const result = shared.settle(ticket, details);
      charged -= reservation - result.chargedTokens;
      return result;
    },
    get reserved() { return charged; },
  };
}

export async function sourceHashes() {
  const files = [
    'experiments/emergent-coordination/phase3/v1.1/README.md',
    'experiments/emergent-coordination/phase3/v1.1/budget-amendment.md',
    'experiments/emergent-coordination/phase3/v1.1/preregistration.md',
    'experiments/emergent-coordination/phase3/v1.1/offline.test.mjs',
    'experiments/emergent-coordination/phase3/v1.1/run.mjs',
    'experiments/emergent-coordination/phase3/v1.1/freeze-manifest.json',
    'experiments/emergent-coordination/phase3/v1.1/freeze-manifest.json.sha256',
    'experiments/emergent-coordination/phase3/v1/freeze-manifest.json',
    'experiments/emergent-coordination/phase3/v1/freeze-manifest.json.sha256',
    'experiments/emergent-coordination/phase3/v1/README.md',
    'experiments/emergent-coordination/phase3/v1/driver.mjs',
    'experiments/emergent-coordination/phase3/v1/evaluate.mjs',
    'experiments/emergent-coordination/phase3/v1/host.mjs',
    'experiments/emergent-coordination/phase3/v1/host-worker.mjs',
    'experiments/emergent-coordination/phase3/v1/run.mjs',
    'experiments/emergent-coordination/phase3/v1/offline.test.mjs',
    'experiments/emergent-coordination/phase3/v1/preregistration.md',
    'experiments/emergent-coordination/phase3/v1/amendment-002.md',
    'experiments/emergent-coordination/phase3/v1/amendment-001.md',
    'experiments/emergent-coordination/phase3/v1/seed13-analysis.md',
    'experiments/emergent-coordination/phase2/host.mjs',
    'experiments/emergent-coordination/phase2/comparison/driver.mjs',
    'experiments/emergent-coordination/phase2/comparison/outcomes.mjs',
    'experiments/emergent-coordination/phase2/evaluate.mjs',
    'experiments/emergent-coordination/phase2/protocol.md',
    'experiments/emergent-coordination/phase2/participant-prompt.txt',
    'experiments/emergent-coordination/phase2/central-prompt.txt',
    'experiments/emergent-coordination/phase2/budget.mjs',
    'experiments/emergent-coordination/phase2/openai-http.mjs',
    'experiments/external-model-reasoner/model-adapter.mjs',
    'experiments/external-model-reasoner/providers/openai.mjs',
  ];
  return Object.fromEntries(await Promise.all(files.map(async file =>
    [file, hash(await readFile(join(root, file)))])));
}

async function writeExclusive(destination, name, value) {
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  await writeFile(join(destination, name), content, { flag: 'wx' });
  await writeFile(join(destination, `${name}.sha256`), hash(content) + '\n', { flag: 'wx' });
}

function pairedSummary(trials, matrix, interrupted) {
  const comparable = trials.filter(row => row.completedForComparison);
  const attemptedByCondition = new Map(trials.map(row => [`${row.seed}:${row.condition}`, row]));
  const byCondition = new Map(comparable.map(row => [`${row.seed}:${row.condition}`, row]));
  const interruptedSet = new Set(interrupted.map(row => `${row.seed}:${row.condition}`));
  const pairs = seeds.map(seed => {
    const control = byCondition.get(`${seed}:control`);
    const treatment = byCondition.get(`${seed}:treatment`);
    return { seed, status: control && treatment ? 'COMPLETE' : 'INCOMPLETE',
      control: control?.evaluation ?? null, treatment: treatment?.evaluation ?? null,
      treatmentMinusControl: control && treatment ? {
        successfulSharedObjectiveCompletion: Number(treatment.evaluation.successfulSharedObjectiveCompletion) -
          Number(control.evaluation.successfulSharedObjectiveCompletion),
        informedRawValueTransfer: Number(treatment.evaluation.rawValueTransfers > 0) -
          Number(control.evaluation.rawValueTransfers > 0),
        prematureRetirement: Number(treatment.evaluation.prematureRetirement) -
          Number(control.evaluation.prematureRetirement),
      } : null,
      missing: ['control', 'treatment'].filter(condition => !byCondition.has(`${seed}:${condition}`))
        .map(condition => interruptedSet.has(`${seed}:${condition}`) ? `${condition}:interrupted` :
          attemptedByCondition.has(`${seed}:${condition}`) ?
            `${condition}:incomplete-${attemptedByCondition.get(`${seed}:${condition}`).trial.stop}` :
            `${condition}:unattempted`),
    };
  });
  const complete = pairs.filter(pair => pair.status === 'COMPLETE');
  const means = key => complete.length ? complete.reduce((sum, pair) => sum + pair.treatmentMinusControl[key], 0) /
    complete.length : null;
  return { status: complete.length === seeds.length ? 'COMPLETE' : 'INCOMPLETE', seedPairs: pairs,
    completePairs: complete.length,
    meanTreatmentMinusControl: {
      successfulSharedObjectiveCompletion: means('successfulSharedObjectiveCompletion'),
      informedRawValueTransfer: means('informedRawValueTransfer'),
      prematureRetirement: means('prematureRetirement'),
    },
    scheduledSeeds: [...seeds], scheduledTrials: matrix.length };
}

export async function runPhase3Comparison({ out, adapter, model, temperature = 'omit',
  mode = 'offline-test', perTrialCeiling = PER_TRIAL_CEILING,
  aggregateCeiling = AGGREGATE_CEILING } = {}) {
  verifyMatchedMatrix();
  if (!out || !adapter || typeof adapter.reason !== 'function' || !model ||
      !['offline-test', 'live'].includes(mode) || !['omit', '0'].includes(temperature) ||
      (mode === 'live' && (model !== FROZEN_MODEL || temperature !== 'omit')) ||
      !Number.isSafeInteger(perTrialCeiling) || perTrialCeiling < 1 || perTrialCeiling > PER_TRIAL_CEILING ||
      !Number.isSafeInteger(aggregateCeiling) || aggregateCeiling < 1 ||
      aggregateCeiling > AGGREGATE_CEILING ||
      (mode === 'live' && (perTrialCeiling !== PER_TRIAL_CEILING || aggregateCeiling !== AGGREGATE_CEILING))) {
    throw new Error('Invalid Phase 3 comparison configuration');
  }
  const gitStatus = currentGitStatus();
  if (mode === 'live') requireCleanWorktree(gitStatus);
  const destination = resolve(out);
  const head = (await readFile(join(root, '.git', 'HEAD'), 'utf8')).trim();
  const gitHead = head.startsWith('ref: ')
    ? (await readFile(join(root, '.git', head.slice(5)), 'utf8')).trim() : head;
  const manifest = { schemaVersion: 1, experimentVersion: PHASE3_VERSION,
    evidenceClass: 'replacement-exploratory-peer-capability-visibility-comparison-after-incomplete-v1', mode, gitHead,
    gitDirty: gitStatus.trim() ? 'true' : 'false', sourceSha256: await sourceHashes(),
    designSha256: { analysis: hash(await readFile(join(here, '../v1/seed13-analysis.md'))),
      baseFreeze: hash(await readFile(join(here, '../v1/freeze-manifest.json'))),
      preregistration: hash(await readFile(join(here, 'preregistration.md'))),
      budgetAmendment: hash(await readFile(join(here, 'budget-amendment.md')))},
    provider: mode === 'live' ? 'openai' : 'offline-mock', apiVersion: API_VERSION, wireOutput: WIRE_OUTPUT,
    model, temperature, providerSeed: 'not-supported-by-adapter', orderSeed: ORDER_SEED,
    budget: { aggregateCeiling, perTrialCeiling, outputTokenCap: OUTPUT_TOKEN_CAP,
      callLimit: CALL_LIMIT, maxModelCalls: phase3Matrix.length * CALL_LIMIT,
      method: 'settled-token-budget-v1' }, hostLimits: MODEL_LIMITS,
    directory: { field: 'peerCapabilities', visibleInitially: true, readOnly: true,
      contents: 'other participant IDs and static capability descriptors only',
      excludes: ['receipts', 'execution status', 'intermediate values', 'message histories', 'evaluator state'] },
    matrix: phase3Matrix,
    evaluationVersion: EVALUATION_VERSION,
    interpretation: 'Prospective replacement study designed after observing the incomplete v1 seed-25 treatment trace; not independent of that observation. Task success and raw-value transfer do not establish emergence.',
    excludedPriorEvidence: { run: '.tmp/veil-005-phase3-v1-budget-limited-archive',
      reason: 'incomplete budget-limited treatment; excluded from matched outcomes and replacement trial counts' } };
  await mkdir(destination, { recursive: false });
  await writeExclusive(destination, 'manifest.json', manifest);
  const shared = settledTokenBudget(aggregateCeiling);
  const trials = [];
  const interrupted = [];
  let status = 'RUNNING';

  async function snapshot(name) {
    const attempted = trials.length + interrupted.length;
    const summary = { experimentVersion: PHASE3_VERSION, status, scheduledTrials: phase3Matrix.length,
      attemptedTrials: attempted, completedTrials: trials.filter(row => row.completedForComparison).length,
      recordedTrials: trials.length,
      unattempted: phase3Matrix.slice(attempted), interrupted,
      trials: trials.map(row => ({ trialId: row.trialId, seed: row.seed, condition: row.condition,
        stop: row.trial.stop, evaluation: row.evaluation, modelCalls: row.trial.modelCalls.length,
        completedForComparison: row.completedForComparison,
        reservedTokens: row.trial.reservedTokens })),
      paired: pairedSummary(trials, phase3Matrix, interrupted),
      modelCalls: trials.reduce((sum, row) => sum + row.trial.modelCalls.length, 0) +
        interrupted.reduce((sum, row) => sum + (row.modelCalls ?? 0), 0),
      grossReservedTokens: shared.grossReserved, chargedExposureTokens: shared.reserved,
      settledReportedTokens: shared.settledReported, maxAggregateExposureTokens: aggregateCeiling,
      maxPerTrialExposureTokens: perTrialCeiling, maxModelCalls: phase3Matrix.length * CALL_LIMIT,
      emergenceEstablished: false };
    await writeExclusive(destination, name, summary);
    return summary;
  }
  await snapshot('checkpoint-00.json');
  for (const [index, row] of phase3Matrix.entries()) {
    const trialId = `phase3-${String(index + 1).padStart(2, '0')}-${row.condition}-seed${row.seed}`;
    const ledger = openSync(join(destination, `${trialId}.jsonl`), 'wx');
    writeSync(ledger, JSON.stringify({ phase: 'trial-config', trialId,
      experimentVersion: PHASE3_VERSION, ...row }) + '\n');
    let trial;
    let attemptedCalls = 0;
    try {
      trial = await runPhase3Trial({ config: row, adapter, model,
        budget: trialBudget(shared, perTrialCeiling), callLimit: row.callLimit,
        outputTokenLimit: OUTPUT_TOKEN_CAP,
        onEvent(event) {
          writeSync(ledger, JSON.stringify(event) + '\n');
          if (event.phase === 'model-observation') attemptedCalls++;
        } });
    } catch {
      interrupted.push({ trialId, seed: row.seed, condition: row.condition,
        reason: 'runner-interrupted', ledger: `${trialId}.jsonl`, modelCalls: attemptedCalls });
      status = 'WORKER CHECKPOINT';
    } finally { closeSync(ledger); }
    await writeFile(join(destination, `${trialId}.jsonl.sha256`),
      hash(await readFile(join(destination, `${trialId}.jsonl`))) + '\n', { flag: 'wx' });
    if (status !== 'RUNNING') {
      await snapshot(`checkpoint-${String(index + 1).padStart(2, '0')}.json`); break;
    }
    if (trial.interrupted) {
      interrupted.push({ trialId, seed: row.seed, condition: row.condition,
        reason: 'worker-interrupted', ledger: `${trialId}.jsonl`,
        modelCalls: trial.modelCalls.length, reservedTokens: trial.reservedTokens });
      status = 'WORKER CHECKPOINT';
      await snapshot(`checkpoint-${String(index + 1).padStart(2, '0')}.json`); break;
    }
    trial.trialId = trialId;
    trial.seed = row.seed;
    trial.condition = row.condition;
    trial.directoryVisibility = row.directoryVisibility;
    trial.model = model;
    const record = { experimentVersion: PHASE3_VERSION, trialId, seed: row.seed,
      condition: row.condition, directoryVisibility: row.directoryVisibility,
      model, trial, evaluation: trial.evaluation,
      completedForComparison: ['quiescent', 'incomplete-limit', 'participants-finished'].includes(trial.stop) &&
        !trial.evaluation.uncertain && trial.evaluation.governanceContained && !trial.hostCredentialPresent,
      sourceSha256: manifest.sourceSha256,
      designSha256: manifest.designSha256, budget: manifest.budget };
    await writeExclusive(destination, `${trialId}.json`, record);
    trials.push(record);
    if (!trial.evaluation.governanceContained || trial.hostCredentialPresent) status = 'SECURITY FAILURE';
    else if (trial.stop === 'budget-accounting-failure') status = 'BUDGET ACCOUNTING FAILURE';
    else if (trial.stop === 'protocol-abort') status = 'PROTOCOL CHECKPOINT';
    else if (trial.evaluation.uncertain) status = 'UNCERTAIN EFFECT CHECKPOINT';
    else if (['provider-error', 'provider-boundary-failure', 'model-driver-error'].includes(trial.stop)) {
      status = 'PROVIDER CHECKPOINT';
    } else if (!record.completedForComparison) status = 'TRIAL CHECKPOINT';
    await snapshot(`checkpoint-${String(index + 1).padStart(2, '0')}.json`);
    if (status !== 'RUNNING') break;
  }
  if (status === 'RUNNING') status = 'COMPARISON COMPLETE';
  return snapshot('summary.json');
}

export async function livePhase3Main(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--out');
  if (argv.length !== 3 || !argv.includes('--live-phase3') || index < 0 || !argv[index + 1] ||
      argv[index + 1].startsWith('--') || argv.filter(value => value === '--live-phase3').length !== 1 ||
      argv.filter(value => value === '--out').length !== 1) {
    throw new Error('Use exactly --live-phase3 --out NEW_DIRECTORY');
  }
  const model = process.env.VEIL_005_MODEL;
  const temperature = process.env.VEIL_005_TEMPERATURE ?? 'omit';
  if (!process.env.OPENAI_API_KEY || model !== FROZEN_MODEL || temperature !== 'omit' ||
      process.env.VEIL_005_MAX_TOKENS !== String(AGGREGATE_CEILING) ||
      process.env.VEIL_005_PER_TRIAL_TOKENS !== String(PER_TRIAL_CEILING) ||
      !['omit', '0'].includes(temperature)) {
    throw new Error(`Live Phase 3 requires OPENAI_API_KEY, VEIL_005_MODEL=${FROZEN_MODEL}, VEIL_005_MAX_TOKENS=${AGGREGATE_CEILING}, VEIL_005_PER_TRIAL_TOKENS=${PER_TRIAL_CEILING}, and omitted temperature`);
  }
  const adapter = phase2OpenaiAdapter({ apiKey: process.env.OPENAI_API_KEY, model,
    outputTokenCap: OUTPUT_TOKEN_CAP, ...(temperature === '0' ? { temperature: 0 } : {}) });
  const summary = await runPhase3Comparison({ out: argv[index + 1], adapter, model,
    temperature, mode: 'live' });
  process.stdout.write(JSON.stringify({ out: resolve(argv[index + 1]), status: summary.status,
    completedTrials: summary.completedTrials, modelCalls: summary.modelCalls,
    chargedExposureTokens: summary.chargedExposureTokens }) + '\n');
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  livePhase3Main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
