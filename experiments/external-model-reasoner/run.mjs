import { fork } from 'node:child_process';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LIMITS } from './model-adapter.mjs';
import { API_VERSION } from './providers/anthropic.mjs';
import { sourceManifest, root } from './manifest.mjs';
import { hash } from './trace.mjs';
import { summarize } from './evaluate.mjs';

export function trialMatrix(scenarios, mode) {
  if (!Array.isArray(scenarios) || scenarios.length !== 9 ||
      new Set(scenarios.map(s => s?.id)).size !== 9 ||
      scenarios.some(s => typeof s?.id !== 'string' || typeof s.goal !== 'string' || !s.task) ||
      !scenarios.some(s => s.id === 'unknown')) throw new Error('Invalid fixed scenario matrix');
  if (mode === 'smoke') return [{ scenario: scenarios[0], prefix: 'fixture.records', evidenceClass: 'real-model-smoke' }];
  if (mode === 'pilot') return [scenarios[0], scenarios.find(s => s.id === 'unknown')].map(scenario =>
    ({ scenario, prefix: 'fixture.records', evidenceClass: 'real-model-pilot' }));
  if (mode !== 'primary') throw new Error('Use smoke, pilot or primary mode');
  return scenarios.flatMap(scenario => Array.from({ length: 5 }, (_, index) => ({ scenario,
    prefix: index < 3 ? 'fixture.records' : 'different.discovered.surface', evidenceClass: 'real-model-primary' })));
}
function args(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--mode', '--out', '--pilot-dir'].includes(argv[i]) || !argv[i + 1]) throw new Error('Invalid runner arguments');
    options[argv[i].slice(2)] = argv[i + 1];
  }
  return options;
}
async function realTrial(config, logPath, onEvent) {
  const child = fork(fileURLToPath(new URL('./worker.mjs', import.meta.url)), [], {
    cwd: root, env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }, execArgv: [], silent: true,
  });
  child.stdout.resume(); child.stderr.resume();
  let writes = Promise.resolve(); let complete; let failure = false;
  const timer = setTimeout(() => { failure = true; child.kill(); }, LIMITS.trialMs + 10000);
  child.on('message', message => {
    if (message.type === 'event') {
      try { onEvent(message.event); } catch { failure = true; child.kill(); }
      writes = writes.then(() => appendFile(logPath, JSON.stringify(message.event) + '\n'))
        .catch(() => { failure = true; child.kill(); });
    } else if (message.type === 'result') complete = message.trial;
    else failure = true;
  });
  const ended = new Promise(resolveEnd => {
    child.on('error', () => { failure = true; resolveEnd(); });
    child.on('exit', code => { if (code !== 0) failure = true; resolveEnd(); });
  });
  child.send(config);
  await ended; clearTimeout(timer); await writes;
  if (failure || !complete) return null;
  return complete;
}
export async function main(argv = process.argv.slice(2)) {
  const options = args(argv); const mode = options.mode ?? 'pilot';
  const scenarios = JSON.parse(await readFile(new URL('./scenarios.json', import.meta.url), 'utf8'));
  const matrix = trialMatrix(scenarios, mode);
  const maxTokens = Number(process.env.VEIL_EXPERIMENT_MAX_TOKENS);
  const model = process.env.VEIL_EXPERIMENT_MODEL;
  const temperatureSetting = process.env.VEIL_EXPERIMENT_TEMPERATURE ?? 'omit';
  if (!['0', 'omit'].includes(temperatureSetting)) throw new Error('Temperature must be 0 or omit');
  const out = resolve(options.out ?? resolve(root, '.tmp', `external-model-${Date.now()}`));
  await mkdir(out, { recursive: false }); // Never overwrite an existing run.
  const prerequisites = { credentials: Boolean(process.env.ANTHROPIC_API_KEY), model: Boolean(model),
    budget: Number.isSafeInteger(maxTokens) && maxTokens > 0 };
  if (Object.values(prerequisites).some(ok => !ok)) {
    const status = { status: 'NOT RUN', prerequisites, realModelCalls: 0, trialsCompleted: 0 };
    await writeFile(resolve(out, 'summary.json'), JSON.stringify(status, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ ...status, out }) + '\n'); return status;
  }
  const source = await sourceManifest();
  if (mode === 'primary') {
    if (!options['pilot-dir']) throw new Error('Primary trials require --pilot-dir from the frozen two-trial pilot');
    const pilotManifest = JSON.parse(await readFile(resolve(options['pilot-dir'], 'manifest.json'), 'utf8'));
    const pilotSummary = JSON.parse(await readFile(resolve(options['pilot-dir'], 'summary.json'), 'utf8'));
    if (pilotManifest.mode !== 'pilot' || pilotManifest.source.contentHash !== source.contentHash ||
        pilotManifest.model !== model || pilotManifest.temperature !== temperatureSetting ||
        pilotSummary.completedTrialRecords !== 2 || pilotSummary.status !== 'COMPLETED' ||
        pilotSummary.securityViolations.length || pilotSummary.infrastructureFailures > 0) {
      throw new Error('Pilot is incomplete, failed, or differs from the frozen configuration');
    }
  }
  const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), mode, model,
    provider: 'anthropic', apiVersion: API_VERSION, temperature: temperatureSetting,
    temperatureSupport: temperatureSetting === 'omit' ? 'not-requested' : 'requested; rejection ends trial',
    seed: 'not-supported-by-adapter', maxTokens, budgetMethod: 'reserve UTF-8 input bytes + 1024 framing + 2048 output; no refunds',
    pricing: { inputPerMillion: process.env.VEIL_EXPERIMENT_INPUT_RATE ?? 'not-recorded',
      outputPerMillion: process.env.VEIL_EXPERIMENT_OUTPUT_RATE ?? 'not-recorded',
      source: 'operator-configured; record provider published rates before paid runs' },
    limits: LIMITS, source, matrix: matrix.map(({ scenario, ...config }, index) => ({ ...config, scenario: scenario.id, trialId: `trial-${index + 1}` })) };
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(resolve(out, 'manifest.sha256'), hash(JSON.stringify(manifest)) + '\n');
  const trials = []; const interruptedTrials = [];
  let reservedTokens = 0; let realModelCalls = 0; let status = 'COMPLETED'; let attempted = 0;
  const checkpoint = async () => {
    const summary = { ...summarize(trials), status, scheduledTrials: matrix.length, attemptedTrials: attempted,
      realModelCalls, reservedTokens, interruptedTrials,
      infrastructureFailures: interruptedTrials.length + trials.filter(t => ['host-error', 'provider-error'].includes(t.stop)).length };
    await writeFile(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    return summary;
  };
  for (const [index, item] of matrix.entries()) {
    if (reservedTokens >= maxTokens) { status = 'BUDGET CHECKPOINT'; break; }
    attempted++;
    status = 'RUNNING'; await checkpoint();
    const trialId = `trial-${index + 1}`;
    const logPath = resolve(out, `${trialId}.jsonl`);
    await writeFile(logPath, '', { flag: 'wx' });
    const trial = await realTrial({ ...item, trialId, model,
      ...(temperatureSetting === '0' ? { temperature: 0 } : {}), maxTokens: maxTokens - reservedTokens },
    logPath, event => {
      if (event.phase === 'budget') {
        if (!Number.isSafeInteger(event.reserved) || event.reserved <= 0 ||
            reservedTokens + event.reserved > maxTokens) throw new Error('Invalid budget reservation');
        reservedTokens += event.reserved;
      }
      if (event.phase === 'model-observation') realModelCalls++;
    });
    if (!trial) {
      interruptedTrials.push({ trialId, ledger: `${trialId}.jsonl`, status: 'interrupted; inspect partial evidence' });
      status = 'WORKER CHECKPOINT'; break;
    }
    trials.push(trial);
    const text = JSON.stringify(trial, null, 2) + '\n';
    await writeFile(resolve(out, `${trialId}.json`), text, { flag: 'wx' });
    await writeFile(resolve(out, `${trialId}.sha256`), hash(text) + '\n');
    if (trial.stop === 'security-failure') { status = 'SECURITY FAILURE'; break; }
    if (trial.stop === 'budget-limit') { status = 'BUDGET CHECKPOINT'; break; }
    if (trial.stop === 'provider-error' || trial.stop === 'host-error') { status = 'INFRASTRUCTURE CHECKPOINT'; break; }
    status = index === matrix.length - 1 ? 'COMPLETED' : 'RUNNING';
    await checkpoint();
  }
  const summary = await checkpoint();
  process.stdout.write(JSON.stringify({ out, status, realModelCalls: summary.realModelCalls,
    trialsCompleted: trials.length, scheduledTrials: matrix.length }) + '\n');
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('Runner failed; inspect retained manifest/ledger. No automatic retry.\n'); process.exitCode = 1; });
}
