import { randomUUID } from 'node:crypto';
import { lstat, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { OperatorRuntime } from '../runtime/operator-runtime.js';
import { EmergenceKernel } from './kernel.js';
import { FileJournal } from './journal.js';
import { OpenAICompatibleReasoningProvider } from './providers.js';
import { isLiveVerifierSandboxReady } from './trial-tasks.js';
import { VerifierInfrastructureError } from './trial-tasks.js';
import type { ApprovalRequest, Budget, EmergenceState, ReasoningProvider } from './types.js';

export interface LocalTrial {
  workspace: string;
  goal: string;
  allowedFiles: readonly string[];
  verify: (workspace: string) => Promise<boolean>;
  provider: ReasoningProvider | ((names: { list: string; read: string; replace: string; check: string }) => ReasoningProvider);
  journalDirectory: string;
  budget: Budget;
  approve?: (request: Readonly<ApprovalRequest>) => Promise<string | undefined>;
}

export interface TrialResult {
  state: EmergenceState;
  independentSuccess: boolean;
  verifierFailure?: string;
  report: string;
}

/** Host-owned capability configuration and verifier stay outside the reasoner context. */
export async function runLocalTrial(config: LocalTrial): Promise<TrialResult> {
  const workspace = await realpath(config.workspace);
  if (workspace !== resolve(config.workspace)) throw new Error('Workspace must be a real directory');
  const temporaryRoot = await realpath(tmpdir());
  if (!workspace.startsWith(`${temporaryRoot}/`) || !resolve(config.journalDirectory).startsWith(`${temporaryRoot}/`)) {
    throw new Error('Trial workspace and journal must stay under the temporary root');
  }
  if (!config.allowedFiles.length || config.allowedFiles.some((file) =>
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(file) ||
    file.split('/').some((part) => part === '.' || part === '..'))) {
    throw new Error('Invalid workspace file allowlist');
  }
  for (const file of config.allowedFiles) await checkedFile(workspace, file);
  await checkWorkspaceContents(workspace, config.allowedFiles);
  const suffix = randomUUID();
  const names = { list: `trial.list.${suffix}`, read: `trial.read.${suffix}`,
    replace: `trial.replace.${suffix}`, check: `trial.check.${suffix}` };
  new OperatorRuntime().use({
    manifest: { name: `trial.${suffix}`, version: '1.0', capabilities: Object.values(names) },
    capabilities: [
      { name: names.list, version: '1.0', risk: 'read', description: 'List permitted workspace source files',
        async execute() { return { files: [...config.allowedFiles] }; } },
      { name: names.read, version: '1.0', risk: 'read', description: 'Read one permitted workspace source file',
        inputSchema: { path: { type: 'string', required: true, description: 'Path returned by list' } },
        async execute(input) { const path = (input as { path: string }).path;
          await requireAllowed(workspace, config.allowedFiles, path);
          return { path, content: await readAllowedFile(workspace, path) }; } },
      { name: names.replace, version: '1.0', risk: 'write',
        description: 'Replace one exact substring in a permitted source file; before must occur exactly once; maximum result 8 KiB',
        inputSchema: { path: { type: 'string', required: true, description: 'Permitted source path' },
          before: { type: 'string', required: true, description: 'Exact existing text' },
          after: { type: 'string', required: true, description: 'Replacement text' } },
        async execute(input) {
          const { path, before, after } = input as { path: string; before: string; after: string };
          await requireAllowed(workspace, config.allowedFiles, path);
          if (!before || before.length > 8192 || after.length > 8192) throw new Error('Invalid replacement size');
          const current = await readAllowedFile(workspace, path);
          if (current.split(before).length !== 2) throw new Error('Replacement precondition failed');
          const result = current.replace(before, after);
          if (Buffer.byteLength(result) > 8192) throw new Error('Result exceeds file limit');
          const temporary = join(workspace, `${path}.${randomUUID()}.tmp`);
          try {
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(result); } finally { await handle.close(); }
            await checkedFile(workspace, path);
            await rename(temporary, join(workspace, path));
          } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          }); }
          return { changed: true, path };
        } },
      { name: names.check, version: '1.0', risk: 'read', description: 'Run bounded acceptance check; returns only pass or fail',
        async execute() { return { passed: await config.verify(workspace) }; } },
    ],
  });
  const journal = new FileJournal(config.journalDirectory);
  const provider = typeof config.provider === 'function' ? config.provider(names) : config.provider;
  if (provider instanceof OpenAICompatibleReasoningProvider) {
    if (!isLiveVerifierSandboxReady()) throw new Error('Live provider requires network-isolated verifier');
    // Probe the exact task workspace before the provider can make a paid call.
    await config.verify(workspace);
  }
  const kernel = new EmergenceKernel({ journal, provider,
    workers: [
      { id: 'coordinator', responsibility: 'Solve the software goal using observed capabilities',
        capabilities: [names.list, names.read, names.replace, names.check] },
      { id: 'diagnostic', responsibility: 'Inspect workspace and checks', capabilities: [names.list, names.read, names.check] },
      { id: 'repair', responsibility: 'Change one permitted source file', capabilities: [names.read, names.replace, names.check] },
      { id: 'verifier', responsibility: 'Run host acceptance check', capabilities: [names.check] },
    ], budget: config.budget,
    approvalGate: async (request, approvedBy) => approvedBy === 'local-trial-operator' &&
      request.capability === names.replace,
  });
  let state = await kernel.start(config.goal, 'coordinator',
    { worker: 'verifier', capability: names.check, expected: { passed: true } });
  while (state.status === 'awaiting-approval') {
    const request = state.approvals.at(-1)!;
    const approver = await config.approve?.(structuredClone(request));
    if (approver !== 'local-trial-operator') break;
    state = await kernel.grantApproval(state.id, request.id, approver);
  }
  // The final verifier is independent of the model decision and the kernel's verdict.
  let independentSuccess = false;
  let verifierFailure: string | undefined;
  try { independentSuccess = await config.verify(workspace); }
  catch (error) {
    if (!(error instanceof VerifierInfrastructureError)) throw error;
    verifierFailure = error.message;
  }
  return { state, independentSuccess, verifierFailure,
    report: renderTrialReport(state, independentSuccess, verifierFailure) };
}

async function readAllowedFile(root: string, file: string): Promise<string> {
  const handle = await open(join(root, file), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 8192) throw new Error('Workspace file exceeds limit or is linked');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}

async function checkedFile(root: string, file: string): Promise<void> {
  const parts = file.split('/');
  let path = root;
  for (const part of parts) {
    path = join(path, part);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && part !== parts.at(-1)) ||
      (part === parts.at(-1) && !stat.isFile())) throw new Error('Workspace path is not a regular file');
  }
  const fileStat = await lstat(path);
  if (fileStat.size > 8192 || fileStat.nlink !== 1) throw new Error('Workspace file exceeds limit or is linked');
}

async function checkWorkspaceContents(root: string, allowlist: readonly string[]): Promise<void> {
  async function walk(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error('Workspace symlink is forbidden');
      if (entry.isDirectory()) {
        if (!allowlist.some((file) => file.startsWith(`${name}/`))) throw new Error('Unexpected workspace directory');
        await walk(join(directory, entry.name), name);
      } else if (!entry.isFile() || !allowlist.includes(name)) throw new Error('Unexpected workspace file');
    }
  }
  await walk(root, '');
}

async function requireAllowed(root: string, allowlist: readonly string[], file: string): Promise<void> {
  if (!allowlist.includes(file)) throw new Error('Path outside workspace allowlist');
  await checkedFile(root, file);
}

export function renderTrialReport(state: EmergenceState, independentSuccess: boolean, verifierFailure?: string): string {
  const lines = [`# Veil local trial: ${state.goal}`, '',
    `Status: ${state.status}; independent verifier: ${verifierFailure ? 'ERROR' : independentSuccess ? 'PASS' : 'FAIL'}`,
    ...(verifierFailure ? [`Verifier failure: ${verifierFailure}`] : []),
    `Usage: ${state.modelCalls} calls, ${state.inputTokens} input tokens, ${state.outputTokens} output tokens, ${state.costMicros} micro-USD, ${state.jobs} Veil jobs, ${state.executionMs} ms execution`, '',
    '| # | Actor | Event | Evidence |', '| --- | --- | --- | --- |'];
  for (const event of state.events) {
    if (!['reasoning.decision', 'reasoning.rejected', 'approval.requested', 'approval.granted', 'execution.completed',
      'execution.failed', 'verification.completed', 'goal.failed'].includes(event.type)) continue;
    const detail = JSON.stringify(event.data).replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 1000);
    lines.push(`| ${event.sequence} | ${event.worker ?? 'host'} | ${event.type} | ${detail} |`);
  }
  return lines.join('\n') + '\n';
}
