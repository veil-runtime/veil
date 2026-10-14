import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { runTrial } from './harness.mjs';
import { evaluateTrial, summarize } from './evaluate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outputArg = process.argv.indexOf('--out');
if (outputArg < 0 || !process.argv[outputArg + 1]) {
  throw new Error('Usage: node experiments/emergent-coordination/run.mjs --out NEW_DIRECTORY');
}
const out = resolve(process.argv[outputArg + 1]);
const sources = ['harness.mjs', 'scripted-policy.mjs', 'evaluate.mjs', 'run.mjs', 'research-spec.md', 'protocol.md'];
const hashes = Object.fromEntries(await Promise.all(sources.map(async file => [file,
  createHash('sha256').update(await readFile(join(here, file))).digest('hex')])));
const head = (await readFile(join(root, '.git', 'HEAD'), 'utf8')).trim();
const gitHead = head.startsWith('ref: ') ? (await readFile(join(root, '.git', head.slice(5)), 'utf8')).trim() : head;
await mkdir(out, { recursive: false });
const matrix = [];
for (const seed of [1, 2, 3, 4, 5]) {
  for (const condition of ['fixed', 'central-adaptive', 'distributed']) {
    for (const fault of ['none', 'primary-failure']) matrix.push({ seed, condition, fault, messages: true });
  }
  matrix.push({ seed, condition: 'distributed', fault: 'none', messages: false });
  matrix.push({ seed, condition: 'distributed', fault: 'unknown-release', messages: true });
}
await writeFile(join(out, 'manifest.json'), JSON.stringify({
  evidenceClass: 'scripted-infrastructure-baseline', gitHead,
  gitDirty: process.env.VEIL_EXPERIMENT_GIT_DIRTY ?? 'not-recorded', node: process.version, sourceSha256: hashes,
  matrix, planVersions: ['2.0'],
}, null, 2) + '\n');
const completed = [];
for (const config of matrix) {
  const trialId = `${config.condition}-${config.fault}-${config.messages ? 'messages' : 'no-messages'}-${config.seed}`;
  const ledger = openSync(join(out, `${trialId}.jsonl`), 'wx');
  let trial;
  try {
    trial = await runTrial({ ...config, onEvent(event) { writeSync(ledger, JSON.stringify(event) + '\n'); } });
  } finally { closeSync(ledger); }
  trial.evaluation = evaluateTrial(trial);
  await writeFile(join(out, `${trialId}.json`), JSON.stringify(trial, null, 2) + '\n', { flag: 'wx' });
  completed.push(trial);
  if (!trial.evaluation.governanceContained) break;
}
const summary = summarize(completed);
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ output: out, ...summary }, null, 2) + '\n');
if (completed.length !== matrix.length || completed.some(trial => !trial.evaluation.governanceContained)) process.exitCode = 1;
