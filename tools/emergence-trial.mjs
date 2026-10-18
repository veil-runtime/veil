import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { RepairReasoner } from '../src/emergence/demo.ts';
import { OpenAICompatibleReasoningProvider } from '../src/emergence/providers.ts';
import { runLocalTrial } from '../src/emergence/trial.ts';
import { checkLiveVerifierSandbox, seedTask, trialTasks } from '../src/emergence/trial-tasks.ts';

const mode = process.argv[2];
if (!['--baseline', '--live'].includes(mode)) throw new Error('Use --baseline or --live');
const selection = process.argv.slice(3);
let selectedTasks;
if (selection.length === 0) selectedTasks = [trialTasks[0]];
else if (selection.length === 2 && selection[0] === '--task') {
  const task = trialTasks.find((candidate) => candidate.id === selection[1]);
  if (!task) throw new Error('Use --task slug|config|invoice');
  selectedTasks = [task];
} else if (selection.length === 1 && selection[0] === '--all') selectedTasks = trialTasks;
else throw new Error('Use --task slug|config|invoice or --all');
const live = mode === '--live';
const budget = {
  maxDecisions: 12, maxJobs: 8, maxDelegations: 2, maxElapsedMs: 120_000,
  maxProposalBytes: 4096, maxModelCalls: 12, maxInputTokens: 60_000,
  maxOutputTokens: 8_000, maxCostMicros: 1_500_000, maxExecutionMs: 20_000,
};
let prompt;
let modelOptions;
if (live) {
  if (process.env.VEIL_TRIAL_ENABLE !== 'YES' || !stdin.isTTY || !stdout.isTTY) {
    throw new Error('Live trial requires VEIL_TRIAL_ENABLE=YES and an interactive terminal');
  }
  if (selectedTasks.length > 1 && process.env.VEIL_TRIAL_MULTI !== 'YES') {
    throw new Error('Multi-task live trial requires separate VEIL_TRIAL_MULTI=YES authorization');
  }
  const required = ['VEIL_MODEL_ENDPOINT', 'VEIL_MODEL_NAME', 'VEIL_MODEL_API_KEY',
    'VEIL_INPUT_MICROS_PER_MILLION', 'VEIL_OUTPUT_MICROS_PER_MILLION'];
  for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
  modelOptions = { authorized: true, endpoint: process.env.VEIL_MODEL_ENDPOINT,
    model: process.env.VEIL_MODEL_NAME, apiKey: process.env.VEIL_MODEL_API_KEY,
    maxOutputTokens: 640, timeoutMs: 15_000,
    inputMicrosPerMillion: Number(process.env.VEIL_INPUT_MICROS_PER_MILLION),
    outputMicrosPerMillion: Number(process.env.VEIL_OUTPUT_MICROS_PER_MILLION) };
  if (![modelOptions.inputMicrosPerMillion, modelOptions.outputMicrosPerMillion].every(
    (value) => Number.isSafeInteger(value) && value > 0)) throw new Error('Model price rates must be positive integer micro-USD values');
  const sandboxProbe = await mkdtemp(join(tmpdir(), 'veil-trial-sandbox-probe-'));
  await checkLiveVerifierSandbox(sandboxProbe);
  prompt = createInterface({ input: stdin, output: stdout });
  const cap = `$${(budget.maxCostMicros * selectedTasks.length / 1_000_000).toFixed(2)}`;
  const consentPhrase = `PAY UP TO ${cap}`;
  const consent = await prompt.question(`This will make paid model calls for ${selectedTasks.length} task(s): ${selectedTasks.map((task) => task.id).join(', ')}. Configured spending cap: ${cap} total. Type ${consentPhrase} to start: `);
  if (consent !== consentPhrase) throw new Error('Paid execution was not authorized');
  if (selectedTasks.length > 1 && await prompt.question('Type AUTHORIZE MULTI TASK to confirm this separate multi-task run: ') !== 'AUTHORIZE MULTI TASK') {
    throw new Error('Multi-task paid execution was not authorized');
  }
}

try {
  const results = [];
  for (const task of selectedTasks) {
    const root = await mkdtemp(join(tmpdir(), `veil-trial-${mode.slice(2)}-${task.id}-`));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);
    await seedTask(task, workspace);
    const result = await runLocalTrial({ workspace, goal: task.goal,
      allowedFiles: [task.file], verify: task.verify,
      journalDirectory: join(root, 'journal'), budget,
      provider: live ? new OpenAICompatibleReasoningProvider(modelOptions) :
        (names) => new RepairReasoner({ test: names.check, read: names.read, patch: names.replace }),
      approve: async (request) => {
        if (!live) return 'local-trial-operator';
        stdout.write(`\nExact proposed write for ${task.id}:\n${JSON.stringify(request, null, 2)}\n`);
        return (await prompt.question('Type APPROVE to execute this exact Veil write: ')) === 'APPROVE'
          ? 'local-trial-operator' : undefined;
      },
    });
    await writeFile(join(root, 'report.md'), result.report);
    results.push({ task: task.id, status: result.state.status,
      independentlyVerified: result.independentSuccess, verifierFailure: result.verifierFailure,
      calls: result.state.modelCalls,
      costMicros: result.state.costMicros, evidence: root });
    stdout.write(`${JSON.stringify(results.at(-1))}\n`);
  }
  stdout.write(`${JSON.stringify({ mode, results }, null, 2)}\n`);
} finally {
  prompt?.close();
}
