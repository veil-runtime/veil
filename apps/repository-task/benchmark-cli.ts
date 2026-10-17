import { runBenchmark } from './benchmark.js';
import { taskBank } from './benchmark-tasks.js';
import { openAITransport, prices } from './live.js';
import { trialLimits, trialModel } from './trial.js';

async function main() {
  const [mode, outputDirectory, model, selection, condition, policy, feedbackCondition = 'sparse', ...extra] = process.argv.slice(2);
  if (extra.length || !['--dry-run', '--live-paid'].includes(mode) || !outputDirectory || !model || !selection
    || !['standard', 'recovery'].includes(condition) || !['continue-model-failures', 'stop-on-failure'].includes(policy)
    || !['sparse', 'diagnostic'].includes(feedbackCondition)) {
    throw Error('Usage: benchmark-cli.js --dry-run|--live-paid OUTPUT_DIR MODEL TASK_IDS|all standard|recovery continue-model-failures|stop-on-failure [sparse|diagnostic]');
  }
  const live = mode === '--live-paid';
  if (!Object.hasOwn(prices, model) || (!live && model !== trialModel)) throw Error('Unsupported model');
  const key = live ? process.env.OPENAI_API_KEY ?? '' : '';
  const transport = live ? openAITransport(key, trialLimits.responseBytes) : undefined;
  const offline = live ? undefined : await import('./benchmark-simulated.js');
  const report = await runBenchmark({ mode: live ? 'live' : 'simulated', model, outputDirectory,
    tasks: selection === 'all' ? taskBank.map(t => t.id) : selection.split(','), condition: condition as 'standard' | 'recovery',
    feedbackCondition: feedbackCondition as 'sparse' | 'diagnostic',
    policy: policy as 'continue-model-failures' | 'stop-on-failure', secrets: [key],
    transport: id => transport ?? offline!.offlineTransport(id, condition as 'standard' | 'recovery') });
  console.log(JSON.stringify({ directory: report.directory, stopReason: report.stopReason, denominators: report.denominators }));
  process.exitCode = report.denominators.verified === report.denominators.selected ? 0 : 1;
}
main().catch(error => { console.error(error instanceof Error && error.message.startsWith('Usage:') ? error.message : 'Benchmark stopped; inspect arguments, credentials, and evidence directory.'); process.exitCode = 1; });
