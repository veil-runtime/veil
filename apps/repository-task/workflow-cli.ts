import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openAITransport, replay, runLiveTask, type InferenceLimits, type LiveRecord, type Transport } from './live.js';
import type { ReasonerContext, RepositoryProfile } from './runner.js';
import { capabilityAction as action, correctedLabels, simulated, trialFixture, trialLimits, trialModel, trialObjective } from './trial.js';

/** A fixture-specific offline policy, not a general software reasoner. It reacts to host feedback. */
export function offlineExampleTransport(): Transport {
  return {
    count: async () => 100,
    generate: async request => {
      const context: ReasonerContext = JSON.parse(request.input.slice(request.input.lastIndexOf('\n') + 1));
      const feedback = context.feedback;
      const last = feedback.at(-1);
      let next: string;
      if (!last) next = action('workspace.list', { path: '.' });
      else if (last.capability === 'workspace.list') next = action('workspace.read', { path: context.workspace.writable[0] });
      else if (last.capability === 'workspace.read') next = action('verification.sandbox.run');
      else if (context.verifiedRevision === context.revision) next = '{"type":"finish"}';
      else if (last.capability === 'verification.sandbox.run' && context.recovery.currentRevisionFailed) {
        next = action('workspace.patch', { path: context.workspace.writable[0],
          search: 'return [...new Set(labels)];', replace: correctedLabels.slice(correctedLabels.indexOf('{') + 1, correctedLabels.lastIndexOf('}')).trim() });
      } else next = action('verification.sandbox.run');
      return simulated([next]).generate(request, new AbortController().signal);
    },
  };
}

const usage = 'Usage: workflow-cli.js --offline-example OUTPUT_DIRECTORY | --profile APPROVED.json --task "change" --output NEW_DIRECTORY (--replay RECORD.json | --live-paid --inference INFERENCE.json)';
const readJSON = async (path: string, maximum = 4 * 1024 * 1024): Promise<any> => {
  if ((await stat(path)).size > maximum) throw Error('Configuration or replay file too large');
  const text = await readFile(path, 'utf8');
  if (Buffer.byteLength(text) > maximum) throw Error('Configuration or replay file too large');
  return JSON.parse(text);
};

export async function main(args: string[]): Promise<void> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--offline-example', '--profile', '--task', '--output', '--replay', '--live-paid', '--inference'].includes(key) || key in flags) throw Error(usage);
    if (key === '--live-paid') flags[key] = 'true';
    else { i++; const value = args.at(i); if (!value || value.startsWith('--')) throw Error(usage); flags[key] = value; }
  }
  const example = '--offline-example' in flags;
  const paid = '--live-paid' in flags;
  if (example ? Object.keys(flags).length !== 1 : !flags['--profile'] || !flags['--task'] || !flags['--output']
    || paid === ('--replay' in flags) || paid !== ('--inference' in flags)) throw Error(usage);
  const output = resolve(example ? flags['--offline-example'] : flags['--output']);
  // Reserve a new private artifact directory before any model request; never overwrite existing evidence.
  await mkdir(output, { mode: 0o700 });
  const fixture = example ? await trialFixture() : undefined;
  try {
    const profile: RepositoryProfile = fixture?.profile ?? await readJSON(flags['--profile']);
    const objective = example ? trialObjective : flags['--task'];
    if (example) {
      profile.acceptanceFeedback = 'diagnostic';
      profile.diagnosticCategories = ['data-consistency', 'boundary-handling', 'data-consistency'];
    }
    let record;
    if (flags['--replay']) {
      const previous: LiveRecord = await readJSON(flags['--replay']);
      if (previous.report.objective !== objective) throw Error('Replay task must match the recorded objective');
      record = await replay(previous, profile);
    } else {
      const inference: { model: string; limits: InferenceLimits } = example
        ? { model: trialModel, limits: trialLimits } : await readJSON(flags['--inference']);
      const key = paid ? process.env.OPENAI_API_KEY ?? '' : '';
      record = await runLiveTask(objective, profile, inference.model, inference.limits,
        example ? offlineExampleTransport() : openAITransport(key, inference.limits.responseBytes), example ? 'simulated' : 'live', [key]);
    }
    const report = record.report;
    const summary = {
      mode: record.mode, objective, outcome: report.classification, reason: report.reason,
      actuallyVerified: report.classification === 'verified' && report.finalRevision === report.verifiedRevision,
      filesChanged: report.filesChanged, initialRevision: report.initialRevision, finalRevision: report.finalRevision,
      verifiedRevision: report.verifiedRevision, originalUnchanged: report.originalUnchanged,
      verification: report.feedback.filter(f => f.capability === 'verification.sandbox.run'),
      usage: 'usage' in record ? record.usage : null,
      inferenceCostUSD: paid && 'usage' in record ? record.usage.estimatedUSD : 0,
      costNote: paid ? 'Estimate using the adapter pricing table; check usage.reliable and reservedUSD. Not a billing receipt.'
        : 'No inference requests. Simulated token usage and estimates, if present, are fixture accounting only.',
      patch: 'changes.patch', evidence: 'record.json',
    };
    for (const [name, content] of [['record.json', JSON.stringify(record, null, 2) + '\n'],
      ['summary.json', JSON.stringify(summary, null, 2) + '\n'], ['changes.patch', report.patch]]) {
      await writeFile(join(output, name), content, { flag: 'wx', mode: 0o600 });
    }
    console.log(JSON.stringify({ ...summary, output }));
    process.exitCode = summary.actuallyVerified ? 0 : 1;
  } finally { await fixture?.cleanup(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(error instanceof Error && [usage, 'Replay task must match the recorded objective'].includes(error.message)
    ? error.message : 'Workflow failed. Check approved profile, limits, credentials (paid mode only), and a new output directory.');
  process.exitCode = 1;
});
