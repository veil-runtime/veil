import { readFile, writeFile, stat } from 'node:fs/promises';
import { openAITransport, replay, runLiveTask, type LiveRecord } from './live.js';
import { dryActions, simulated, trialFixture, trialLimits, trialModel, trialObjective } from './trial.js';

async function main(): Promise<void> {
  const [mode, output, modelOrRecord] = process.argv.slice(2);
  if (!output || !['--dry-run', '--live-paid', '--replay'].includes(mode) || (mode === '--live-paid' && !modelOrRecord)) {
    throw Error('Usage: live-cli.js --dry-run OUTPUT.json | --live-paid OUTPUT.json MODEL | --replay OUTPUT.json RECORD.json');
  }
  const fixture = await trialFixture();
  try {
    let record;
    if (mode === '--replay') {
      if ((await stat(modelOrRecord)).size > trialLimits.transcriptBytes) throw Error('Replay input too large');
      const raw = await readFile(modelOrRecord, 'utf8');
      if (Buffer.byteLength(raw) > trialLimits.transcriptBytes) throw Error('Replay input too large');
      record = await replay(JSON.parse(raw) as LiveRecord, fixture.profile);
    } else {
      const live = mode === '--live-paid';
      const key = live ? process.env.OPENAI_API_KEY ?? '' : '';
      record = await runLiveTask(trialObjective, fixture.profile, live ? modelOrRecord : trialModel, trialLimits,
        live ? openAITransport(key, trialLimits.responseBytes) : simulated(dryActions()), live ? 'live' : 'simulated', [key]);
    }
    await writeFile(output, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ mode: record.mode, classification: record.report.classification, reason: record.report.reason, output }));
    process.exitCode = record.report.classification === 'verified' ? 0 : 1;
  } finally { await fixture.cleanup(); }
}
main().catch(() => { console.error('Trial failed; check arguments, credentials, and output path. No credentials are logged.'); process.exitCode = 1; });
