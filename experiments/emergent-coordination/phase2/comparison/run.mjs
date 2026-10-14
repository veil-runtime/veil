import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_VERSION, WIRE_OUTPUT } from '../../../external-model-reasoner/providers/openai.mjs';
import { settledTokenBudget } from '../budget.mjs';
import { phase2OpenaiAdapter } from '../openai-http.mjs';
import { runComparisonTrial, MODEL_LIMITS } from './driver.mjs';
import { comparisonOutcome, pairedSummary } from './outcomes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
export const COMPARISON_VERSION = 'phase2-lifecycle-comparison-v1';
export const PER_TRIAL_CEILING = 50000;
export const AGGREGATE_CEILING = 600000;
export const OUTPUT_TOKEN_CAP = 512;
export const CALL_LIMIT = 18;
export const comparisonMatrix = Object.freeze([
  [12, 'A'], [12, 'B'], [12, 'C'], [12, 'D'],
  [13, 'B'], [13, 'A'], [13, 'D'], [13, 'C'],
  [14, 'C'], [14, 'D'], [14, 'A'], [14, 'B'],
].map(([seed, condition]) => Object.freeze({ seed, condition,
  messagingEnabled: condition === 'A' || condition === 'C',
  lifecycleClarified: condition === 'C' || condition === 'D',
  hostCondition: condition === 'A' || condition === 'C' ? 'distributed' : 'no-communication',
  fault: 'primary-failure', openChoice: false, activationLimit: 18, callLimit: CALL_LIMIT })));

function trialBudget(shared, ceiling) {
  let charged = 0;
  const tickets = new Map();
  return {
    reserve(tokens) {
      if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > ceiling - charged) return false;
      const ticket = shared.reserve(tokens);
      if (!ticket) return false;
      tickets.set(ticket, tokens);
      charged += tokens;
      return ticket;
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

async function sourceHashes() {
  const files = [
    'experiments/emergent-coordination/phase2/comparison/preregistration.md',
    'experiments/emergent-coordination/phase2/comparison/lifecycle.txt',
    'experiments/emergent-coordination/phase2/comparison/driver.mjs',
    'experiments/emergent-coordination/phase2/comparison/outcomes.mjs',
    'experiments/emergent-coordination/phase2/comparison/run.mjs',
    'experiments/emergent-coordination/phase2/comparison/offline.test.mjs',
    'experiments/emergent-coordination/phase2/participant-prompt.txt',
    'experiments/emergent-coordination/phase2/central-prompt.txt',
    'experiments/emergent-coordination/phase2/protocol.md',
    'experiments/emergent-coordination/phase2/host.mjs',
    'experiments/emergent-coordination/phase2/host-worker.mjs',
    'experiments/emergent-coordination/phase2/evaluate.mjs',
    'experiments/emergent-coordination/phase2/budget.mjs',
    'experiments/emergent-coordination/phase2/openai-http.mjs',
    'experiments/external-model-reasoner/model-adapter.mjs',
    'experiments/external-model-reasoner/providers/openai.mjs',
  ];
  return Object.fromEntries(await Promise.all(files.map(async file =>
    [file, hash(await readFile(join(root, file)))])));
}

async function promptHashes() {
  const [prompt, protocol, addendum] = await Promise.all([
    readFile(join(here, '../participant-prompt.txt')),
    readFile(join(here, '../protocol.md')),
    readFile(join(here, 'lifecycle.txt')),
  ]);
  return { participantPromptSha256: hash(prompt), baselineProtocolSha256: hash(protocol),
    lifecycleAddendumSha256: hash(addendum),
    clarifiedProtocolSha256: hash(Buffer.concat([protocol, Buffer.from('\n'), addendum])) };
}

async function writeExclusive(destination, name, value) {
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  await writeFile(join(destination, name), content, { flag: 'wx' });
  await writeFile(join(destination, `${name}.sha256`), hash(content) + '\n', { flag: 'wx' });
}

export async function runComparison({ out, adapter, model, temperature = 'omit',
  mode = 'offline-comparison-test', perTrialCeiling = PER_TRIAL_CEILING,
  aggregateCeiling = AGGREGATE_CEILING }) {
  if (!out || !adapter || typeof adapter.reason !== 'function' || !model ||
      !['offline-comparison-test', 'live-comparison'].includes(mode) ||
      !['omit', '0'].includes(temperature) ||
      !Number.isSafeInteger(perTrialCeiling) || perTrialCeiling < 1 ||
      !Number.isSafeInteger(aggregateCeiling) ||
      aggregateCeiling !== comparisonMatrix.length * perTrialCeiling ||
      (mode === 'live-comparison' && (perTrialCeiling !== PER_TRIAL_CEILING ||
        aggregateCeiling !== AGGREGATE_CEILING))) throw new Error('Invalid comparison configuration');
  const destination = resolve(out);
  const head = (await readFile(join(root, '.git', 'HEAD'), 'utf8')).trim();
  const gitHead = head.startsWith('ref: ') ?
    (await readFile(join(root, '.git', head.slice(5)), 'utf8')).trim() : head;
  const manifest = { schemaVersion: 1, experimentVersion: COMPARISON_VERSION,
    evidenceClass: 'exploratory-lifecycle-comparison', mode, gitHead,
    gitDirty: process.env.VEIL_005_GIT_DIRTY ?? 'not-recorded',
    sourceSha256: await sourceHashes(), promptSha256: await promptHashes(),
    provider: mode === 'live-comparison' ? 'openai' : 'offline-mock',
    apiVersion: API_VERSION, wireOutput: WIRE_OUTPUT, model, temperature,
    providerSeed: 'not-supported-by-adapter',
    budget: { aggregateCeiling, perTrialCeiling, outputTokenCap: OUTPUT_TOKEN_CAP,
      callLimit: CALL_LIMIT, method: 'settled-token-budget-v1' },
    hostLimits: MODEL_LIMITS, matrix: comparisonMatrix,
    interpretation: 'Exploratory comparison; neither task success nor messaging alone establishes emergence' };
  await mkdir(destination, { recursive: false });
  await writeExclusive(destination, 'manifest.json', manifest);
  const shared = settledTokenBudget(aggregateCeiling);
  const outcomes = [];
  const interrupted = [];
  let status = 'RUNNING';
  async function snapshot(name) {
    const attempted = outcomes.length + interrupted.length;
    const paired = pairedSummary(outcomes, comparisonMatrix, interrupted);
    const summary = { experimentVersion: COMPARISON_VERSION, status,
      scheduledTrials: comparisonMatrix.length, attemptedTrials: attempted,
      completedTrials: outcomes.length, unattempted: comparisonMatrix.slice(attempted),
      interrupted, trials: outcomes, paired,
      completeMatchedSeedComparison: paired.status === 'COMPLETE',
      modelCalls: outcomes.reduce((sum, row) => sum + row.modelCalls, 0) +
        interrupted.reduce((sum, row) => sum + (row.modelCalls ?? 0), 0),
      estimatedInputTokens: outcomes.reduce((sum, row) => sum + row.estimatedInputTokens, 0),
      grossReservedTokens: shared.grossReserved, chargedExposureTokens: shared.reserved,
      settledReportedTokens: shared.settledReported,
      maxAggregateExposureTokens: aggregateCeiling, maxPerTrialExposureTokens: perTrialCeiling,
      emergenceEstablished: false };
    await writeExclusive(destination, name, summary);
    return summary;
  }
  await snapshot('checkpoint-00.json');
  for (const [index, row] of comparisonMatrix.entries()) {
    const trialId = `comparison-${String(index + 1).padStart(2, '0')}-${row.condition}-seed${row.seed}`;
    const ledger = openSync(join(destination, `${trialId}.jsonl`), 'wx');
    writeSync(ledger, JSON.stringify({ phase: 'trial-config', trialId,
      experimentVersion: COMPARISON_VERSION, ...row }) + '\n');
    let trial;
    let attemptedCalls = 0;
    try {
      trial = await runComparisonTrial({ config: { seed: row.seed, condition: row.hostCondition,
        fault: row.fault, openChoice: row.openChoice, activationLimit: row.activationLimit },
      lifecycleClarified: row.lifecycleClarified, adapter, model,
      budget: trialBudget(shared, perTrialCeiling), callLimit: row.callLimit,
      outputTokenLimit: OUTPUT_TOKEN_CAP,
      onEvent(event) {
        writeSync(ledger, JSON.stringify(event) + '\n');
        if (event.phase === 'model-observation') attemptedCalls++;
      } });
    } catch {
      interrupted.push({ trialId, seed: row.seed, condition: row.condition,
        reason: 'runner-interrupted', ledger: `${trialId}.jsonl`,
        modelCalls: attemptedCalls });
      status = 'WORKER CHECKPOINT';
    } finally { closeSync(ledger); }
    if (status !== 'RUNNING') { await snapshot(`checkpoint-${String(index + 1).padStart(2, '0')}.json`); break; }
    if (trial.interrupted) {
      interrupted.push({ trialId, seed: row.seed, condition: row.condition,
        reason: 'worker-interrupted', ledger: `${trialId}.jsonl`,
        modelCalls: trial.modelCalls.length, grossReservedTokens: trial.reservedTokens });
      status = 'WORKER CHECKPOINT';
      await snapshot(`checkpoint-${String(index + 1).padStart(2, '0')}.json`);
      break;
    }
    const record = { experimentVersion: COMPARISON_VERSION, studyCondition: row.condition,
      messagingEnabled: row.messagingEnabled, lifecycleClarified: row.lifecycleClarified,
      model, promptSha256: { participant: manifest.promptSha256.participantPromptSha256,
        protocol: row.lifecycleClarified ? manifest.promptSha256.clarifiedProtocolSha256 :
          manifest.promptSha256.baselineProtocolSha256 },
      sourceSha256: manifest.sourceSha256, budget: manifest.budget, trial };
    await writeExclusive(destination, `${trialId}.json`, record);
    outcomes.push(comparisonOutcome(trial, row.condition));
    if (!trial.evaluation.governanceContained || trial.hostCredentialPresent) status = 'SECURITY FAILURE';
    else if (trial.stop === 'budget-accounting-failure') status = 'BUDGET ACCOUNTING FAILURE';
    else if (trial.stop === 'protocol-abort') status = 'PROTOCOL CHECKPOINT';
    else if (trial.evaluation.uncertain) status = 'UNCERTAIN EFFECT CHECKPOINT';
    else if (['provider-error', 'provider-boundary-failure', 'model-driver-error'].includes(trial.stop)) {
      status = 'PROVIDER CHECKPOINT';
    }
    await snapshot(`checkpoint-${String(index + 1).padStart(2, '0')}.json`);
    if (status !== 'RUNNING') break;
  }
  if (status === 'RUNNING') status = 'COMPARISON COMPLETE';
  return snapshot('summary.json');
}

export async function liveComparisonMain(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--out');
  if (argv.length !== 3 || !argv.includes('--live-comparison') || index < 0 ||
      !argv[index + 1] || argv[index + 1].startsWith('--') ||
      argv.filter(value => value === '--live-comparison').length !== 1 ||
      argv.filter(value => value === '--out').length !== 1) {
    throw new Error('Use exactly --live-comparison --out NEW_DIRECTORY');
  }
  const model = process.env.VEIL_005_MODEL;
  const temperature = process.env.VEIL_005_TEMPERATURE ?? 'omit';
  if (!process.env.OPENAI_API_KEY || !model ||
      process.env.VEIL_005_MAX_TOKENS !== String(AGGREGATE_CEILING) ||
      process.env.VEIL_005_PER_TRIAL_TOKENS !== String(PER_TRIAL_CEILING) ||
      !['omit', '0'].includes(temperature)) {
    throw new Error('Live comparison requires OPENAI_API_KEY, VEIL_005_MODEL, VEIL_005_MAX_TOKENS=600000, VEIL_005_PER_TRIAL_TOKENS=50000, and temperature omit or 0');
  }
  const adapter = phase2OpenaiAdapter({ apiKey: process.env.OPENAI_API_KEY, model,
    outputTokenCap: OUTPUT_TOKEN_CAP,
    ...(temperature === '0' ? { temperature: 0 } : {}) });
  const summary = await runComparison({ out: argv[index + 1], adapter, model,
    temperature, mode: 'live-comparison' });
  process.stdout.write(JSON.stringify({ out: resolve(argv[index + 1]), status: summary.status,
    completedTrials: summary.completedTrials, chargedExposureTokens: summary.chargedExposureTokens }) + '\n');
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  liveComparisonMain().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
