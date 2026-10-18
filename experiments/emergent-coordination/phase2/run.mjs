import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_VERSION, WIRE_OUTPUT } from '../../external-model-reasoner/providers/openai.mjs';
import { tokenBudget } from '../../external-model-reasoner/model-adapter.mjs';
import { runReasoningTrial, MODEL_LIMITS } from './driver.mjs';
import { evaluateOpenChoiceSeries, summarizeModelTrials } from './evaluate.mjs';
import { phase2OpenaiAdapter } from './openai-http.mjs';
import { liveExtendedSmokeMain, liveSmokeMain } from './smoke.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
export const pilotMatrix = Object.freeze([
  { seed: 11, condition: 'fixed', fault: 'none', openChoice: false },
  { seed: 11, condition: 'central', fault: 'none', openChoice: false },
  { seed: 11, condition: 'distributed', fault: 'none', openChoice: false },
  { seed: 11, condition: 'no-communication', fault: 'none', openChoice: false },
  { seed: 12, condition: 'distributed', fault: 'primary-failure', openChoice: false },
  { seed: 13, condition: 'distributed', fault: 'none', openChoice: true, seriesId: 'open-choice-pilot', episode: 1 },
  { seed: 14, condition: 'distributed', fault: 'none', openChoice: true, seriesId: 'open-choice-pilot', episode: 2 },
]);

function options(argv) {
  const live = argv.includes('--live-pilot');
  const dry = argv.includes('--dry-run');
  const index = argv.indexOf('--out');
  if (live === dry || index < 0 || !argv[index + 1] || argv.length !== 3 ||
      argv.some((arg, i) => i !== index && i !== index + 1 && !['--live-pilot', '--dry-run'].includes(arg))) {
    throw new Error('Use exactly --dry-run or --live-pilot with --out NEW_DIRECTORY');
  }
  return { live, out: resolve(argv[index + 1]) };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--live-extended-smoke')) return liveExtendedSmokeMain(argv);
  if (argv.includes('--live-smoke')) return liveSmokeMain(argv);
  const { live, out } = options(argv);
  const model = process.env.VEIL_005_MODEL;
  const tokenLimit = Number(process.env.VEIL_005_MAX_TOKENS);
  const temperature = process.env.VEIL_005_TEMPERATURE ?? 'omit';
  if (!['omit', '0'].includes(temperature)) throw new Error('Temperature must be omit or 0');
  if (live && (!Number.isSafeInteger(tokenLimit) || tokenLimit < 1 || tokenLimit > 250000)) {
    throw new Error('Live pilot requires VEIL_005_MAX_TOKENS between 1 and 250000');
  }
  const sources = ['host.mjs', 'host-worker.mjs', 'driver.mjs', 'evaluate.mjs', 'run.mjs', 'openai-http.mjs',
    'participant-prompt.txt', 'central-prompt.txt', 'protocol.md', 'research-addendum.md'];
  const sourceSha256 = Object.fromEntries(await Promise.all(sources.map(async name =>
    [name, hash(await readFile(join(here, name)))])));
  sourceSha256['reused-openai-adapter'] = hash(await readFile(resolve(root,
    'experiments/external-model-reasoner/providers/openai.mjs')));
  sourceSha256['reused-model-adapter'] = hash(await readFile(resolve(root,
    'experiments/external-model-reasoner/model-adapter.mjs')));
  const head = (await readFile(join(root, '.git', 'HEAD'), 'utf8')).trim();
  const gitHead = head.startsWith('ref: ') ? (await readFile(join(root, '.git', head.slice(5)), 'utf8')).trim() : head;
  await mkdir(out, { recursive: false });
  const manifest = { schemaVersion: 1, evidenceClass: 'unscripted-model-pilot',
    instructionRevision: 'phase2-actions-v2', mode: live ? 'live-pilot' : 'dry-run', gitHead,
    gitDirty: process.env.VEIL_005_GIT_DIRTY ?? 'not-recorded', sourceSha256,
    provider: 'openai', apiVersion: API_VERSION, wireOutput: WIRE_OUTPUT,
    model: model ?? 'not-configured', temperature, providerSeed: 'not-supported-by-adapter',
    maxReservedTokens: Number.isSafeInteger(tokenLimit) && tokenLimit > 0 ? tokenLimit : null,
    budgetMethod: 'UTF-8 input bytes + 1024 framing + 2048 output tokens reserved before each call; no refunds',
    limits: MODEL_LIMITS, matrix: pilotMatrix,
    pricing: { inputPerMillion: process.env.VEIL_005_INPUT_RATE ?? 'not-recorded',
      outputPerMillion: process.env.VEIL_005_OUTPUT_RATE ?? 'not-recorded' } };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(join(out, 'manifest.json'), manifestText, { flag: 'wx' });
  await writeFile(join(out, 'manifest.sha256'), hash(manifestText) + '\n', { flag: 'wx' });
  const prerequisites = { explicitLiveFlag: live, credentials: Boolean(process.env.OPENAI_API_KEY),
    model: Boolean(model), budget: Number.isSafeInteger(tokenLimit) && tokenLimit > 0 && tokenLimit <= 250000 };
  if (!live || Object.values(prerequisites).some(value => !value)) {
    const summary = { status: 'NOT RUN', prerequisites, realModelCalls: 0, completedTrials: 0,
      scheduledTrials: pilotMatrix.length, maxReservedTokens: manifest.maxReservedTokens };
    await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ out, ...summary }) + '\n');
    return summary;
  }
  const adapter = phase2OpenaiAdapter({ apiKey: process.env.OPENAI_API_KEY, model,
    ...(temperature === '0' ? { temperature: 0 } : {}) });
  const budget = tokenBudget(tokenLimit);
  const completed = [];
  const interrupted = [];
  const seriesMemories = new Map();
  let realModelCalls = 0;
  let status = 'RUNNING';
  async function checkpoint() {
    const openTrials = completed.filter(trial => trial.seriesId === 'open-choice-pilot');
    const summary = { ...summarizeModelTrials(completed), status, scheduledTrials: pilotMatrix.length,
      attemptedTrials: completed.length + interrupted.length, interrupted,
      realModelCalls,
      reservedTokens: budget.reserved, maxReservedTokens: tokenLimit,
      openChoiceSeries: openTrials.length ? evaluateOpenChoiceSeries(openTrials) : null };
    await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    return summary;
  }
  await checkpoint();
  for (const [index, config] of pilotMatrix.entries()) {
    if (budget.reserved >= tokenLimit) { status = 'BUDGET CHECKPOINT'; break; }
    const trialId = `trial-${index + 1}`;
    const ledger = openSync(join(out, `${trialId}.jsonl`), 'wx');
    let trial;
    try {
      trial = await runReasoningTrial({ config, adapter, model, budget,
        memory: config.seriesId ? (seriesMemories.get(config.seriesId) ?? (() => {
          const value = new Map(); seriesMemories.set(config.seriesId, value); return value;
        })()) : new Map(),
        onEvent(event) {
          writeSync(ledger, JSON.stringify(event) + '\n');
          if (event.phase === 'model-observation') realModelCalls++;
        },
      });
    } finally { closeSync(ledger); }
    if (trial.interrupted) {
      interrupted.push({ trialId, ledger: `${trialId}.jsonl`, reason: 'worker-interrupted' });
      status = 'WORKER CHECKPOINT'; break;
    }
    trial.seriesId = config.seriesId ?? null;
    trial.episode = config.episode ?? null;
    const text = JSON.stringify(trial, null, 2) + '\n';
    await writeFile(join(out, `${trialId}.json`), text, { flag: 'wx' });
    await writeFile(join(out, `${trialId}.sha256`), hash(text) + '\n', { flag: 'wx' });
    completed.push(trial);
    if (!trial.evaluation.governanceContained) { status = 'SECURITY FAILURE'; break; }
    if (['budget-limit', 'context-limit', 'call-limit', 'time-limit'].includes(trial.stop)) {
      status = 'BUDGET CHECKPOINT'; break;
    }
    if (['provider-error', 'provider-boundary-failure', 'model-driver-error'].includes(trial.stop)) {
      status = 'PROVIDER CHECKPOINT'; break;
    }
    await checkpoint();
  }
  if (status === 'RUNNING') status = 'PILOT COMPLETE';
  const summary = await checkpoint();
  process.stdout.write(JSON.stringify({ out, status, realModelCalls: summary.realModelCalls,
    completedTrials: completed.length, reservedTokens: budget.reserved }) + '\n');
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`Pilot runner failed: ${error.message}. Inspect retained evidence.\n`);
    process.exitCode = 1; });
}
