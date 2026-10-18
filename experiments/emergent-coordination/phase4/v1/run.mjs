import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { closeSync, openSync, writeSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { phase2OpenaiAdapter } from '../../phase2/openai-http.mjs';
import { settledTokenBudget } from '../../phase2/budget.mjs';
import { API_VERSION, WIRE_OUTPUT } from '../../../external-model-reasoner/providers/openai.mjs';
import { runPhase4Trial, MODEL_LIMITS } from './driver.mjs';
import { derivePhase4Metrics } from './metrics.mjs';
import neutralBank from './neutral-bank.json' with { type: 'json' };
import { TOKENIZER_ENCODING, TOKENIZER_PACKAGE, TOKENIZER_VERSION } from './neutral-content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
export const PHASE4_VERSION = 'veil-005-mechanism-discrimination-v1.0.0-candidate-002';
export const FREEZE_MANIFEST = 'freeze-manifest-candidate-002.json';
export const FROZEN_MODEL = 'gpt-4.1-mini';
export const EXPECTED_REPORTED_MODEL = 'gpt-4.1-mini-2025-04-14';
export const PER_TRIAL_CEILING = 700000;
export const AGGREGATE_CEILING = 50000000;
export const OUTPUT_TOKEN_CAP = 512;
export const CONTEXT_TOKEN_CEILING = 24000;
export const MAX_CALL_RESERVATION = CONTEXT_TOKEN_CEILING + OUTPUT_TOKEN_CAP;
export const BOOTSTRAP_SEED = 20261017;
export const CONDITION_ORDER_SEED = 20261016;

const orderRows = Object.freeze([
  [33, ['D18', 'D27', 'P18', 'C18']], [34, ['D27', 'P18', 'D18', 'C18']],
  [35, ['C18', 'D18', 'P18', 'D27']], [36, ['P18', 'D27', 'C18', 'D18']],
  [37, ['D18', 'C18', 'P18', 'D27']], [38, ['D27', 'D18', 'C18', 'P18']],
  [39, ['C18', 'P18', 'D18', 'D27']], [40, ['C18', 'D27', 'P18', 'D18']],
  [41, ['D18', 'C18', 'D27', 'P18']], [42, ['P18', 'D18', 'D27', 'C18']],
  [43, ['D27', 'P18', 'C18', 'D18']], [44, ['D18', 'P18', 'C18', 'D27']],
  [45, ['D27', 'D18', 'P18', 'C18']], [46, ['C18', 'P18', 'D27', 'D18']],
  [47, ['D18', 'P18', 'D27', 'C18']], [48, ['P18', 'D27', 'D18', 'C18']],
  [49, ['C18', 'D27', 'D18', 'P18']], [50, ['P18', 'C18', 'D27', 'D18']],
  [51, ['D27', 'C18', 'D18', 'P18']], [52, ['D27', 'C18', 'P18', 'D18']],
  [53, ['P18', 'D18', 'C18', 'D27']], [54, ['P18', 'C18', 'D18', 'D27']],
  [55, ['D18', 'D27', 'C18', 'P18']], [56, ['C18', 'D18', 'D27', 'P18']],
]);
export const conditionOrders = Object.freeze(orderRows.map(([seed, order]) => Object.freeze({
  seed, order: Object.freeze([...order]),
})));

const armConfig = Object.freeze({
  C18: Object.freeze({ callLimit: 18, directoryVisibility: false }),
  P18: Object.freeze({ callLimit: 18, directoryVisibility: false }),
  D18: Object.freeze({ callLimit: 18, directoryVisibility: true }),
  D27: Object.freeze({ callLimit: 27, directoryVisibility: true }),
});

export const phase4Matrix = Object.freeze(orderRows.flatMap(([seed, order], blockIndex) =>
  order.map((arm, orderIndex) => Object.freeze({
    seed, arm, blockIndex: blockIndex + 1, orderIndex: orderIndex + 1,
    condition: 'distributed', hostCondition: 'distributed', fault: 'primary-failure',
    openChoice: false, messagingEnabled: true, activationLimit: 27,
    directoryVisibility: armConfig[arm].directoryVisibility,
    callLimit: armConfig[arm].callLimit,
  }))));

export function verifyPhase4Matrix(matrix = phase4Matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 96) throw new Error('Phase 4 matrix must contain 96 trials');
  for (const row of orderRows) {
    const trials = matrix.filter(item => item.seed === row[0]);
    if (trials.length !== 4 || trials.map(item => item.arm).join(',') !== row[1].join(',')) {
      throw new Error(`Invalid Phase 4 block or order for seed ${row[0]}`);
    }
    if (trials.some(item => item.activationLimit !== 27 || item.condition !== 'distributed' ||
        item.fault !== 'primary-failure' || item.openChoice !== false || item.messagingEnabled !== true)) {
      throw new Error(`Phase 4 common host configuration changed for seed ${row[0]}`);
    }
    for (const item of trials) if (item.callLimit !== armConfig[item.arm].callLimit ||
        item.directoryVisibility !== armConfig[item.arm].directoryVisibility) {
      throw new Error(`Invalid Phase 4 arm configuration for seed ${row[0]}/${item.arm}`);
    }
  }
  if (new Set(orderRows.map(row => row[1].join(','))).size !== 24 ||
      new Set(orderRows.map(row => row[0])).size !== 24) throw new Error('Phase 4 order matrix is not balanced');
  return true;
}

const experimentFiles = [
  'README.md', 'preregistration.md', 'neutral-bank-audit.md', 'security-review.md',
  'package.json', 'package-lock.json', 'host.mjs',
  'run.mjs', 'host-worker.mjs', 'driver.mjs', 'metrics.mjs', 'neutral-content.mjs', 'neutral-bank.json',
  'neutral-bank.json.sha256', 'freeze-neutral-bank.mjs', 'offline.test.mjs',
];
const reusedFiles = [
  'experiments/emergent-coordination/phase3/v1.2/action-protocol.md',
  'experiments/emergent-coordination/phase3/v1.2/run.mjs',
  'experiments/emergent-coordination/phase3/v1.2/driver.mjs',
  'experiments/emergent-coordination/phase3/v1/host.mjs',
  'experiments/emergent-coordination/phase3/v1/host-worker.mjs',
  'experiments/emergent-coordination/phase3/v1/evaluate.mjs',
  'experiments/emergent-coordination/phase2/evaluate.mjs',
  'experiments/emergent-coordination/phase2/budget.mjs',
  'experiments/emergent-coordination/phase2/openai-http.mjs',
  'experiments/emergent-coordination/phase2/participant-prompt.txt',
  'experiments/emergent-coordination/phase2/central-prompt.txt',
  'experiments/external-reasoner/passive.mjs',
  'experiments/external-model-reasoner/model-adapter.mjs',
  'experiments/external-model-reasoner/model-adapter.mjs',
  'experiments/external-model-reasoner/providers/openai.mjs',
];

async function listTypeScriptFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const relativeName = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await listTypeScriptFiles(directory, relativeName));
    else if (entry.isFile() && relativeName.endsWith('.ts')) result.push(relativeName);
  }
  return result;
}

export async function phase4SourceFiles() {
  const phase4Files = experimentFiles.map(file => `experiments/emergent-coordination/phase4/v1/${file}`);
  const sourceFiles = (await listTypeScriptFiles(join(root, 'src'))).map(file => `src/${file}`);
  return [...new Set([...phase4Files, ...reusedFiles, ...sourceFiles,
    'package.json', 'package-lock.json', 'tsconfig.build.json', 'tsconfig.test.json'])].sort();
}

export async function phase4SourceHashes() {
  const files = await phase4SourceFiles();
  return Object.fromEntries(await Promise.all(files.map(async file =>
    [file, sha256(await readFile(join(root, file)))])));
}

export async function verifyFrozenSources() {
  const manifestBytes = await readFile(join(here, FREEZE_MANIFEST));
  const manifest = JSON.parse(manifestBytes);
  const sidecar = (await readFile(join(here, `${FREEZE_MANIFEST}.sha256`), 'utf8')).trim();
  if (sidecar !== sha256(manifestBytes)) throw new Error('Phase 4 freeze manifest checksum mismatch');
  if (manifest.experimentVersion !== PHASE4_VERSION ||
      manifest.matrixSha256 !== sha256(JSON.stringify(phase4Matrix))) {
    throw new Error('Phase 4 freeze identity or matrix mismatch');
  }
  const actual = await phase4SourceHashes();
  if (JSON.stringify(actual) !== JSON.stringify(manifest.sourceSha256)) {
    throw new Error('Phase 4 source hash mismatch');
  }
  const rankBytes = await readFile(join(here, 'node_modules/js-tiktoken/dist/ranks/o200k_base.js'));
  if (manifest.tokenizer?.package !== TOKENIZER_PACKAGE ||
      manifest.tokenizer.version !== TOKENIZER_VERSION ||
      manifest.tokenizer.encoding !== TOKENIZER_ENCODING ||
      manifest.tokenizer.encodingAssetSha256 !== sha256(rankBytes) ||
      manifest.tokenizer.packageLockSha256 !==
        actual['experiments/emergent-coordination/phase4/v1/package-lock.json']) {
    throw new Error('Phase 4 tokenizer integrity mismatch');
  }
  const bankBytes = await readFile(join(here, 'neutral-bank.json'));
  if (sha256(bankBytes) !== manifest.neutralBankSha256) throw new Error('Neutral bank checksum mismatch');
  return manifest;
}

export function requireCleanWorktree(status) {
  if (typeof status !== 'string' || status.trim()) throw new Error('Live Phase 4 requires a clean source worktree');
  return true;
}

function currentGitStatus() {
  return execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: root, encoding: 'utf8' });
}

function readHead() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return head;
}

function scopedBudget(shared, ceiling) {
  let exposure = 0;
  let grossReserved = 0;
  let aggregateBlocked = false;
  let nextTicket = 1;
  const pending = new Map();
  return {
    reserve(tokens) {
      if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > ceiling - exposure) return false;
      const sharedTicket = shared.reserve(tokens);
      if (!sharedTicket) { aggregateBlocked = true; return false; }
      const ticket = nextTicket++;
      pending.set(ticket, { sharedTicket, tokens });
      exposure += tokens;
      grossReserved += tokens;
      return ticket;
    },
    settle(ticket, details) {
      const item = pending.get(ticket);
      if (!item) throw new Error('Unknown or already settled Phase 4 reservation');
      pending.delete(ticket);
      const result = shared.settle(item.sharedTicket, details);
      exposure -= item.tokens - result.chargedTokens;
      return result;
    },
    get reserved() { return exposure; },
    get grossReserved() { return grossReserved; },
    get aggregateBlocked() { return aggregateBlocked; },
  };
}

async function writeExclusive(path, value) {
  const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, content, { flag: 'wx' });
  await writeFile(`${path}.sha256`, `${sha256(content)}\n`, { flag: 'wx' });
  return sha256(content);
}

function fatalStop(trial, scoped) {
  return scoped.aggregateBlocked || trial.interrupted || !trial.evaluation?.governanceContained ||
    ['protocol-abort', 'protocol-validation', 'token-mismatch', 'context-limit',
      'model-driver-error', 'model-mismatch',
      'provider-error', 'provider-boundary-failure', 'budget-accounting-failure',
      'invalid-host-observation', 'worker-integrity-failure'].includes(trial.stop);
}

function reasonToStop(trial, scoped) {
  if (scoped.aggregateBlocked) return 'aggregate-budget-limit';
  if (trial.interrupted) return 'worker-integrity-failure';
  if (!trial.evaluation?.governanceContained) return 'governance-violation';
  return trial.stop;
}

export async function runPhase4Matrix({ out, adapter, model = 'offline-mock', mode = 'offline-test',
  apiKey, temperature = 'omit', perTrialCeiling = PER_TRIAL_CEILING,
  aggregateCeiling = AGGREGATE_CEILING, onTrial = () => {} } = {}) {
  verifyPhase4Matrix();
  const freeze = await verifyFrozenSources();
  if (!out || !['offline-test', 'live'].includes(mode) ||
      !Number.isSafeInteger(perTrialCeiling) || perTrialCeiling < 1 || perTrialCeiling > PER_TRIAL_CEILING ||
      !Number.isSafeInteger(aggregateCeiling) || aggregateCeiling < 1 || aggregateCeiling > AGGREGATE_CEILING ||
      (mode === 'live' && (model !== FROZEN_MODEL || temperature !== 'omit' ||
        perTrialCeiling !== PER_TRIAL_CEILING || aggregateCeiling !== AGGREGATE_CEILING || !apiKey)) ||
      (mode === 'offline-test' && (!adapter || typeof adapter.reason !== 'function'))) {
    throw new Error('Invalid Phase 4 run configuration');
  }
  const gitStatus = mode === 'live' ? currentGitStatus() : 'not-checked-offline';
  if (mode === 'live') requireCleanWorktree(gitStatus);
  const destination = resolve(out);
  await mkdir(destination, { recursive: false });
  const gitHead = mode === 'live' ? readHead() : null;
  const manifest = {
    schemaVersion: 1, experimentVersion: PHASE4_VERSION, status: 'STARTED', mode, gitHead,
    gitDirty: mode === 'live' ? 'false' : 'not-checked-offline',
    sourceManifestPath: `experiments/emergent-coordination/phase4/v1/${FREEZE_MANIFEST}`,
    sourceManifestSha256: sha256(await readFile(join(here, FREEZE_MANIFEST))),
    sourceSha256: freeze.sourceSha256,
    neutralBankSha256: freeze.neutralBankSha256,
    tokenizer: freeze.tokenizer,
    model: { requested: model, expectedReported: EXPECTED_REPORTED_MODEL,
      apiVersion: API_VERSION, wireOutput: WIRE_OUTPUT, temperature: 'omitted', outputTokenCap: OUTPUT_TOKEN_CAP },
    limits: { contextTokens: CONTEXT_TOKEN_CEILING, callReservationTokens: MAX_CALL_RESERVATION,
      perTrialTokens: perTrialCeiling, aggregateTokens: aggregateCeiling, trialMs: MODEL_LIMITS.trialMs,
      callsPerAudience: MODEL_LIMITS.callsPerAudience, messageEnvelopes: 24, messageBodyCharacters: 256,
      proposals: 18 },
    matrix: phase4Matrix,
    maximumModelCalls: phase4Matrix.reduce((sum, row) => sum + row.callLimit, 0),
    maximumReservedTokens: phase4Matrix.reduce((sum, row) => sum + row.callLimit * MAX_CALL_RESERVATION, 0),
    startedAt: new Date().toISOString(),
  };
  await writeExclusive(join(destination, 'run-manifest.json'), manifest);
  const sharedBudget = settledTokenBudget(aggregateCeiling);
  const resultRows = [];
  let stoppedAt = null;
  for (const [index, config] of phase4Matrix.entries()) {
    if (stoppedAt) break;
    const ordinal = index + 1;
    const scoped = scopedBudget(sharedBudget, perTrialCeiling);
    const ledgerPath = join(destination, `trial-${String(ordinal).padStart(3, '0')}.jsonl`);
    const descriptor = openSync(ledgerPath, 'wx');
    let ledgerSeq = 0;
    const emit = event => {
      const row = JSON.stringify({ ledgerSeq: ledgerSeq++, at: new Date().toISOString(), ...event });
      writeSync(descriptor, `${row}\n`);
    };
    let trial;
    try {
      const trialConfig = { ...config, expectedReportedModel: mode === 'live'
        ? EXPECTED_REPORTED_MODEL : model };
      const activeAdapter = mode === 'live'
        ? phase2OpenaiAdapter({ apiKey, model: FROZEN_MODEL, outputTokenCap: OUTPUT_TOKEN_CAP }) : adapter;
      trial = await runPhase4Trial({ config: trialConfig, adapter: activeAdapter, model,
        budget: scoped, neutralBank, callLimit: config.callLimit,
        outputTokenLimit: OUTPUT_TOKEN_CAP,
        onEvent: event => emit({ type: 'driver-event', event }),
      });
      if (!trial.interrupted) {
        trial.arm = config.arm;
        trial.metrics = derivePhase4Metrics(trial);
      }
      emit({ type: 'trial-complete', arm: config.arm, seed: config.seed,
        stop: trial.stop, interrupted: trial.interrupted === true,
        reservedTokens: trial.reservedTokens ?? 0,
        chargedTokens: scoped.reserved, grossReservedTokens: scoped.grossReserved,
        metrics: trial.metrics ?? null });
    } catch (error) {
      trial = { interrupted: true, stop: 'worker-integrity-failure', error: String(error) };
      emit({ type: 'trial-exception', arm: config.arm, seed: config.seed, error: String(error) });
    } finally {
      closeSync(descriptor);
    }
    const ledgerBytes = await readFile(ledgerPath);
    await writeFile(`${ledgerPath}.sha256`, `${sha256(ledgerBytes)}\n`, { flag: 'wx' });
    const record = { ordinal, seed: config.seed, arm: config.arm,
      stop: trial.stop, interrupted: trial.interrupted === true,
      metrics: trial.metrics ?? null, ledger: relative(destination, ledgerPath),
      ledgerSha256: sha256(ledgerBytes), reservedTokens: scoped.grossReserved,
      chargedTokens: scoped.reserved };
    const trialFile = `trial-${String(ordinal).padStart(3, '0')}.json`;
    await writeExclusive(join(destination, trialFile), record);
    resultRows.push(record);
    await writeExclusive(join(destination, `checkpoint-${String(ordinal).padStart(3, '0')}.json`), {
      schemaVersion: 1, completedTrials: resultRows.length,
      remainingTrials: phase4Matrix.length - resultRows.length,
      status: fatalStop(trial, scoped) ? 'STOPPED' : 'CHECKPOINT',
      stoppedAt: fatalStop(trial, scoped) ? { ordinal, seed: config.seed, arm: config.arm,
        reason: reasonToStop(trial, scoped) } : null,
      aggregateReservedTokens: sharedBudget.grossReserved,
      aggregateChargedTokens: sharedBudget.reserved,
    });
    await onTrial(record);
    if (fatalStop(trial, scoped)) stoppedAt = { ordinal, seed: config.seed,
      arm: config.arm, reason: reasonToStop(trial, scoped) };
  }
  const summary = {
    schemaVersion: 1, experimentVersion: PHASE4_VERSION,
    status: stoppedAt ? 'STOPPED' : 'COMPLETE', scheduledTrials: phase4Matrix.length,
    attemptedTrials: resultRows.length, completedTrials: resultRows.filter(row => !row.interrupted).length,
    unattempted: phase4Matrix.slice(resultRows.length).map((row, index) => ({
      ordinal: resultRows.length + index + 1, seed: row.seed, arm: row.arm })),
    stoppedAt,
    totalModelCalls: resultRows.reduce((sum, row) => sum + (row.metrics?.modelCalls ?? 0), 0),
    grossReservedTokens: sharedBudget.grossReserved,
    chargedTokens: sharedBudget.reserved,
    settledReportedTokens: sharedBudget.settledReported,
    maximumReservedTokens: phase4Matrix.reduce((sum, row) => sum + row.callLimit * MAX_CALL_RESERVATION, 0),
    trialRecords: resultRows,
    completedAt: new Date().toISOString(),
  };
  await writeExclusive(join(destination, 'summary.json'), summary);
  return summary;
}

export async function writeFreezeManifest() {
  const hashes = await phase4SourceHashes();
  const bankBytes = await readFile(join(here, 'neutral-bank.json'));
  const rankBytes = await readFile(join(here, 'node_modules/js-tiktoken/dist/ranks/o200k_base.js'));
  const manifest = { schemaVersion: 1, experimentVersion: PHASE4_VERSION,
    tokenizer: { package: TOKENIZER_PACKAGE, version: TOKENIZER_VERSION,
      encoding: TOKENIZER_ENCODING, encodingAssetSha256: sha256(rankBytes),
      packageLockSha256: hashes['experiments/emergent-coordination/phase4/v1/package-lock.json'] },
    neutralBankSha256: sha256(bankBytes), matrixSha256: sha256(JSON.stringify(phase4Matrix)),
    model: { requested: FROZEN_MODEL, expectedReported: EXPECTED_REPORTED_MODEL,
      apiVersion: API_VERSION, wireOutput: WIRE_OUTPUT, temperature: 'omitted', outputTokenCap: OUTPUT_TOKEN_CAP },
    limits: { perTrialTokens: PER_TRIAL_CEILING, aggregateTokens: AGGREGATE_CEILING,
      contextTokens: CONTEXT_TOKEN_CEILING, maxCallReservation: MAX_CALL_RESERVATION,
      maxModelCalls: phase4Matrix.reduce((sum, row) => sum + row.callLimit, 0),
      maxReservedTokens: phase4Matrix.reduce((sum, row) => sum + row.callLimit * MAX_CALL_RESERVATION, 0),
      trialMs: MODEL_LIMITS.trialMs, callsPerAudience: MODEL_LIMITS.callsPerAudience,
      proposals: 18, messageEnvelopes: 24, messageBodyCharacters: 256 },
    orderSeed: CONDITION_ORDER_SEED, sourceSha256: hashes };
  const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(here, FREEZE_MANIFEST), bytes, { flag: 'wx' });
  await writeFile(join(here, `${FREEZE_MANIFEST}.sha256`), `${sha256(bytes)}\n`, { flag: 'wx' });
  return manifest;
}

async function liveMain() {
  const args = process.argv.slice(2);
  if (args.includes('--write-freeze-manifest')) {
    const manifest = await writeFreezeManifest();
    process.stdout.write(`${JSON.stringify({ status: 'FREEZE MANIFEST WRITTEN',
      version: manifest.experimentVersion, neutralBankSha256: manifest.neutralBankSha256 }, null, 2)}\n`);
    return;
  }
  const outIndex = args.indexOf('--out');
  const live = args.includes('--live-phase4');
  if (!live || outIndex < 0 || !args[outIndex + 1]) {
    throw new Error('Use --live-phase4 --out <new-exclusive-directory>; this command makes paid model calls');
  }
  if (process.env.VEIL_005_MODEL !== FROZEN_MODEL ||
      process.env.VEIL_005_MAX_TOKENS !== String(AGGREGATE_CEILING) ||
      process.env.VEIL_005_PER_TRIAL_TOKENS !== String(PER_TRIAL_CEILING) ||
      process.env.OPENAI_API_KEY === undefined) {
    throw new Error('Live Phase 4 requires the frozen model, both token ceilings, and OPENAI_API_KEY');
  }
  const adapter = { reason() { throw new Error('Live adapter is constructed per trial'); } };
  const summary = await runPhase4Matrix({ out: args[outIndex + 1], adapter,
    mode: 'live', model: FROZEN_MODEL, apiKey: process.env.OPENAI_API_KEY,
    perTrialCeiling: PER_TRIAL_CEILING, aggregateCeiling: AGGREGATE_CEILING });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  liveMain().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
