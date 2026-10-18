import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_VERSION, WIRE_OUTPUT } from '../../external-model-reasoner/providers/openai.mjs';
import { tokenBudget } from '../../external-model-reasoner/model-adapter.mjs';
import { settledTokenBudget } from './budget.mjs';
import { runReasoningTrial, MODEL_LIMITS } from './driver.mjs';
import { phase2OpenaiAdapter } from './openai-http.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
export const SMOKE_TOKEN_CEILING = 30000;
export const EXTENDED_SMOKE_TOKEN_CEILING = 50000;
export const SMOKE_OUTPUT_TOKEN_CAP = 512;
export const smokeMatrix = Object.freeze([
  Object.freeze({ seed: 11, condition: 'central', fault: 'none', openChoice: false,
    activationLimit: 2, callLimit: 2 }),
  Object.freeze({ seed: 11, condition: 'distributed', fault: 'none', openChoice: false,
    activationLimit: 6, callLimit: 6 }),
]);
export const extendedSmokeMatrix = Object.freeze([
  Object.freeze({ seed: 12, condition: 'distributed', fault: 'primary-failure', openChoice: false,
    activationLimit: 18, callLimit: 18 }),
]);

export function summarizeSmokeTrial(trial) {
  const events = trial.trace;
  const of = type => events.filter(event => event.type === type);
  const validation = of('protocol-validation');
  const decisions = of('decision');
  const discoveries = of('discovery');
  const admissions = of('admission');
  const authorizations = of('authorization');
  const effects = of('effect');
  const usage = trial.modelCalls.map(call => call.response?.metadata ?? {});
  const inputTokens = usage.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0);
  const outputTokens = usage.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0);
  const hostInvalid = validation.filter(event => !event.audience).length;
  const centralDescriptorSeen = trial.condition === 'central' && discoveries.some(discovery =>
    of('activation').some(activation => activation.tick > discovery.tick &&
      activation.participant === 'central' &&
      activation.observation.participants[discovery.participant].capabilities.length > 0));
  return { trialId: trial.trialId, condition: trial.condition, stop: trial.stop,
    validModelActions: decisions.length - hostInvalid, invalidModelActions: validation.length,
    protocolValidationCounts: trial.evaluation.protocolValidationCounts,
    successfulDiscoveries: discoveries.length, centralDescriptorSeen,
    participantsActivated: [...new Set(of('activation').map(event => event.participant))],
    messagesAttempted: decisions.filter(event => event.action?.type === 'send').length,
    messagesDelivered: of('message-queued').length,
    proposalsSubmitted: of('proposal').length,
    proposalsAccepted: admissions.filter(event => event.outcome === 'passed').length,
    proposalsRejected: admissions.filter(event => event.outcome === 'rejected').length,
    admissionIssueCounts: trial.evaluation.admissionIssueCounts,
    authorizationsAllowed: authorizations.filter(event => event.decision === 'allow').length,
    authorizationsDenied: authorizations.filter(event => event.decision === 'deny').length,
    actualCapabilityEffects: effects.length, effectKinds: effects.map(event => event.kind),
    modelCalls: trial.modelCalls.length, reservedTokens: trial.reservedTokens,
    serializedInputBytes: trial.modelCalls.reduce((sum, call) => sum + (call.serializedInputBytes ?? 0), 0),
    estimatedInputTokens: trial.modelCalls.reduce((sum, call) => sum + (call.estimatedInputTokens ?? 0), 0),
    budgetChargedTokens: trial.modelCalls.reduce((sum, call) =>
      sum + (call.budgetSettlement?.chargedTokens ?? call.reservation), 0),
    reportedTokenUsage: { inputTokens, outputTokens,
      callsWithUsage: usage.filter(item => Number.isSafeInteger(item.inputTokens) &&
        Number.isSafeInteger(item.outputTokens)).length,
      callsWithoutUsage: usage.filter(item => !Number.isSafeInteger(item.inputTokens) ||
        !Number.isSafeInteger(item.outputTokens)).length },
    governanceContained: trial.evaluation.governanceContained,
    hostCredentialPresent: trial.hostCredentialPresent,
  };
}

async function sourceHashes(extended = false) {
  const names = ['host.mjs', 'host-worker.mjs', 'driver.mjs', 'evaluate.mjs', 'run.mjs',
    'smoke.mjs', 'openai-http.mjs', 'participant-prompt.txt', 'central-prompt.txt',
    'protocol.md', 'research-addendum.md', 'smoke-readiness.md'];
  if (extended) names.push('budget.mjs', 'extended-smoke-readiness.md');
  const result = Object.fromEntries(await Promise.all(names.map(async name =>
    [name, hash(await readFile(join(here, name)))])));
  result['reused-openai-adapter'] = hash(await readFile(resolve(root,
    'experiments/external-model-reasoner/providers/openai.mjs')));
  result['reused-model-adapter'] = hash(await readFile(resolve(root,
    'experiments/external-model-reasoner/model-adapter.mjs')));
  return result;
}

// The adapter is injected for offline verification; the live CLI alone creates an HTTP adapter.
export async function runSmoke({ out, adapter, model, temperature = 'omit',
  variant = 'targeted', tokenLimit = variant === 'extended' ? EXTENDED_SMOKE_TOKEN_CEILING : SMOKE_TOKEN_CEILING,
  mode = variant === 'extended' ? 'offline-extended-smoke-test' : 'offline-smoke-test' }) {
  const extended = variant === 'extended';
  const ceiling = extended ? EXTENDED_SMOKE_TOKEN_CEILING : SMOKE_TOKEN_CEILING;
  const matrix = extended ? extendedSmokeMatrix : smokeMatrix;
  const evidenceClass = extended ? 'model-integration-extended-smoke' : 'model-integration-smoke';
  if (!out || !adapter || typeof adapter.reason !== 'function' || !model ||
      !['targeted', 'extended'].includes(variant) ||
      !Number.isSafeInteger(tokenLimit) || tokenLimit < 1 || tokenLimit > ceiling ||
      !(extended ? ['offline-extended-smoke-test', 'live-extended-smoke'] :
        ['offline-smoke-test', 'live-smoke']).includes(mode)) throw new Error('Invalid smoke configuration');
  const destination = resolve(out);
  const head = (await readFile(join(root, '.git', 'HEAD'), 'utf8')).trim();
  const gitHead = head.startsWith('ref: ') ? (await readFile(join(root, '.git', head.slice(5)), 'utf8')).trim() : head;
  const manifest = { schemaVersion: 1, evidenceClass,
    interpretation: 'Integration diagnostics only; not evidence of emergent coordination',
    instructionRevision: 'phase2-actions-v2',
    ...(extended ? { configurationRevision: 'phase2-extended-smoke-v1', budgetRevision: 'phase2-settlement-v1' } : {}),
    mode, gitHead,
    gitDirty: process.env.VEIL_005_GIT_DIRTY ?? 'not-recorded', sourceSha256: await sourceHashes(extended),
    provider: mode.startsWith('live-') ? 'openai' : 'offline-mock', apiVersion: API_VERSION,
    wireOutput: WIRE_OUTPUT, model, temperature, providerSeed: 'not-supported-by-adapter',
    maxReservedTokens: tokenLimit,
    budgetMethod: extended ? 'UTF-8 input bytes + 1024 framing + 512 output tokens reserved before each call; completed valid provider usage settles the reservation; missing or uncertain usage holds the full bound' :
      'UTF-8 input bytes + 1024 framing + 512 output tokens reserved before each call; no refunds',
    outputTokenCap: SMOKE_OUTPUT_TOKEN_CAP,
    limits: MODEL_LIMITS, matrix,
    pricing: { inputPerMillion: process.env.VEIL_005_INPUT_RATE ?? 'not-recorded',
      outputPerMillion: process.env.VEIL_005_OUTPUT_RATE ?? 'not-recorded' } };
  await mkdir(destination, { recursive: false });
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(join(destination, 'manifest.json'), manifestText, { flag: 'wx' });
  await writeFile(join(destination, 'manifest.sha256'), hash(manifestText) + '\n', { flag: 'wx' });
  const budget = extended ? settledTokenBudget(tokenLimit) : tokenBudget(tokenLimit);
  const trials = [];
  const interrupted = [];
  let modelCalls = 0;
  let status = 'RUNNING';
  async function checkpoint() {
    const summary = { evidenceClass, status,
      scheduledConditions: matrix.map(item => item.condition),
      attemptedTrials: trials.length + interrupted.length, completedTrials: trials.length,
      interrupted, trials: trials.map(summarizeSmokeTrial), modelCalls,
      reservedTokens: budget.reserved, maxReservedTokens: tokenLimit,
      ...(extended ? { estimatedInputTokens: trials.reduce((sum, trial) =>
        sum + trial.modelCalls.reduce((total, call) => total + (call.estimatedInputTokens ?? 0), 0), 0),
      grossReservedTokens: budget.grossReserved, budgetExposureTokens: budget.reserved,
      providerReportedTokens: trials.reduce((sum, trial) => sum + trial.modelCalls.reduce((total, call) =>
        total + (call.response?.metadata?.inputTokens ?? 0) + (call.response?.metadata?.outputTokens ?? 0), 0), 0),
      settledReportedTokens: budget.settledReported } : {}),
      emergenceEstablished: false };
    await writeFile(join(destination, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    return summary;
  }
  await checkpoint();
  for (const [index, config] of matrix.entries()) {
    if (budget.reserved >= tokenLimit) { status = 'BUDGET CHECKPOINT'; break; }
    const trialId = `${extended ? 'extended-smoke' : 'smoke'}-${index + 1}-${config.condition}`;
    const ledger = openSync(join(destination, `${trialId}.jsonl`), 'wx');
    let trial;
    try {
      trial = await runReasoningTrial({ config, adapter, model, budget, callLimit: config.callLimit,
        outputTokenLimit: SMOKE_OUTPUT_TOKEN_CAP,
        onEvent(event) {
          writeSync(ledger, JSON.stringify(event) + '\n');
          if (event.phase === 'model-observation') modelCalls++;
        } });
    } catch {
      interrupted.push({ trialId, ledger: `${trialId}.jsonl`, reason: 'runner-interrupted' });
      status = 'WORKER CHECKPOINT';
      break;
    } finally { closeSync(ledger); }
    if (trial.interrupted) {
      interrupted.push({ trialId, ledger: `${trialId}.jsonl`, reason: 'worker-interrupted',
        modelCalls: trial.modelCalls.length, reservedTokens: trial.reservedTokens });
      status = 'WORKER CHECKPOINT'; break;
    }
    const trialText = JSON.stringify(trial, null, 2) + '\n';
    await writeFile(join(destination, `${trialId}.json`), trialText, { flag: 'wx' });
    await writeFile(join(destination, `${trialId}.sha256`), hash(trialText) + '\n', { flag: 'wx' });
    trials.push(trial);
    if (!trial.evaluation.governanceContained || trial.hostCredentialPresent) status = 'SECURITY FAILURE';
    else if (trial.stop === 'budget-accounting-failure') status = 'BUDGET ACCOUNTING FAILURE';
    else if (trial.stop === 'protocol-abort') status = 'PROTOCOL CHECKPOINT';
    else if (['budget-limit', 'context-limit', 'call-limit', 'time-limit'].includes(trial.stop)) {
      status = 'BUDGET CHECKPOINT';
    } else if (['provider-error', 'provider-boundary-failure', 'model-driver-error'].includes(trial.stop)) {
      status = 'PROVIDER CHECKPOINT';
    }
    await checkpoint();
    if (status !== 'RUNNING') break;
  }
  if (status === 'RUNNING') status = extended ? 'EXTENDED SMOKE COMPLETE' : 'SMOKE COMPLETE';
  return checkpoint();
}

export async function liveSmokeMain(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--out');
  if (argv.length !== 3 || !argv.includes('--live-smoke') || index < 0 ||
      !argv[index + 1] || argv[index + 1].startsWith('--') ||
      argv.filter(value => value === '--live-smoke').length !== 1 ||
      argv.filter(value => value === '--out').length !== 1) {
    throw new Error('Use exactly --live-smoke --out NEW_DIRECTORY');
  }
  const model = process.env.VEIL_005_MODEL;
  const temperature = process.env.VEIL_005_TEMPERATURE ?? 'omit';
  if (!process.env.OPENAI_API_KEY || !model || process.env.VEIL_005_MAX_TOKENS !== String(SMOKE_TOKEN_CEILING) ||
      !['omit', '0'].includes(temperature)) {
    throw new Error('Live smoke requires OPENAI_API_KEY, VEIL_005_MODEL, VEIL_005_MAX_TOKENS=30000, and temperature omit or 0');
  }
  const adapter = phase2OpenaiAdapter({ apiKey: process.env.OPENAI_API_KEY, model,
    outputTokenCap: SMOKE_OUTPUT_TOKEN_CAP,
    ...(temperature === '0' ? { temperature: 0 } : {}) });
  const summary = await runSmoke({ out: argv[index + 1], adapter, model,
    temperature, mode: 'live-smoke' });
  process.stdout.write(JSON.stringify({ out: resolve(argv[index + 1]), status: summary.status,
    modelCalls: summary.modelCalls, completedTrials: summary.completedTrials,
    reservedTokens: summary.reservedTokens }) + '\n');
  return summary;
}

export async function liveExtendedSmokeMain(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--out');
  if (argv.length !== 3 || !argv.includes('--live-extended-smoke') || index < 0 ||
      !argv[index + 1] || argv[index + 1].startsWith('--') ||
      argv.filter(value => value === '--live-extended-smoke').length !== 1 ||
      argv.filter(value => value === '--out').length !== 1) {
    throw new Error('Use exactly --live-extended-smoke --out NEW_DIRECTORY');
  }
  const model = process.env.VEIL_005_MODEL;
  const temperature = process.env.VEIL_005_TEMPERATURE ?? 'omit';
  if (!process.env.OPENAI_API_KEY || !model ||
      process.env.VEIL_005_MAX_TOKENS !== String(EXTENDED_SMOKE_TOKEN_CEILING) ||
      !['omit', '0'].includes(temperature)) {
    throw new Error('Live extended smoke requires OPENAI_API_KEY, VEIL_005_MODEL, VEIL_005_MAX_TOKENS=50000, and temperature omit or 0');
  }
  const adapter = phase2OpenaiAdapter({ apiKey: process.env.OPENAI_API_KEY, model,
    outputTokenCap: SMOKE_OUTPUT_TOKEN_CAP,
    ...(temperature === '0' ? { temperature: 0 } : {}) });
  const summary = await runSmoke({ out: argv[index + 1], adapter, model,
    temperature, variant: 'extended', mode: 'live-extended-smoke' });
  process.stdout.write(JSON.stringify({ out: resolve(argv[index + 1]), status: summary.status,
    modelCalls: summary.modelCalls, completedTrials: summary.completedTrials,
    grossReservedTokens: summary.grossReservedTokens,
    budgetExposureTokens: summary.budgetExposureTokens }) + '\n');
  return summary;
}
