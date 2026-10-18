import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OperatorRuntime, type Capability } from '../../src/index.js';
import { acceptanceCapability, diagnosticCategories, type AcceptanceCase, type AcceptanceResult, type DiagnosticCategory } from './acceptance.js';
import { digest, materialize, patch, readApproved, safePath, workspaceCapabilities, type Tree } from './workspace.js';
import { tsxAcceptanceCapability, validateTsxPolicy, type TsxAcceptance } from './tsx-verification.js';
import type { VerificationProfile } from '../../src/providers/sandbox/linux-verification-sandbox.js';
import { componentAcceptanceCapability, validateComponentPolicy, type ComponentAcceptance } from './component-verification.js';

export interface RepositoryProfile {
  repository: string;
  /** Explicit approved existing UTF-8 files only. Unlisted project files are not copied. */
  readable: string[];
  writable: string[];
  acceptance: AcceptanceCase[];
  tsxAcceptance?: TsxAcceptance;
  componentAcceptance?: ComponentAcceptance;
  acceptanceFeedback?: 'summary' | 'diagnostic';
  patchOnly?: boolean;
  allowAppend?: boolean;
  recoverPrematureFinish?: boolean;
  diagnosticCategories?: readonly (DiagnosticCategory | null)[];
  limits: Omit<VerificationProfile, 'workspace' | 'executable' | 'args'>;
  maxDurationMs?: number;
  maxTurns: number;
  maxVerifications: number;
  reasonerTimeoutMs: number;
}
export interface Feedback {
  turn: number; capability: string; authorized: boolean; revision: string;
  status: string; input: Record<string, unknown>; jobId?: string; result?: unknown; error?: string;
  repeatedFailedRevision?: string;
  guidance?: string;
}
export interface ReasonerContext {
  objective: string;
  capabilities: { name: string; description: string; inputSchema: Capability['inputSchema'] }[];
  feedback: Feedback[];
  remainingTurns: number;
  remainingVerifications: number;
  workspace: { pathInstructions: string; readable: string[]; writable: string[] };
  revision: string;
  verifiedRevision?: string;
  recovery: { currentRevisionFailed: boolean; guidance: string };
}
/** Trusted transport adapter returns untrusted JSON; it receives no workspace path/profile/identity. */
export type Reasoner = (context: ReasonerContext, signal: AbortSignal) => Promise<string>;
export interface TaskReport {
  classification: 'verified' | 'failed' | 'blocked' | 'exhausted' | 'uncertain';
  objective: string;
  reason: string;
  initialRevision?: string;
  finalRevision?: string;
  verifiedRevision?: string;
  originalUnchanged: boolean;
  patch: string;
  filesChanged: string[];
  feedback: Feedback[];
  /** Detached trusted configuration makes acceptance and resource choices reviewable. */
  profile: RepositoryProfile;
}

function validate(p: RepositoryProfile): void {
  if (p.patchOnly !== undefined && typeof p.patchOnly !== 'boolean') throw new Error('Invalid patch-only policy');
  if (p.allowAppend !== undefined && typeof p.allowAppend !== 'boolean') throw new Error('Invalid append policy');
  if (p.recoverPrematureFinish !== undefined && typeof p.recoverPrematureFinish !== 'boolean') throw new Error('Invalid finish-recovery policy');
  if (!isAbsolute(p.repository) || !p.readable.length || (!p.acceptance.length && !p.tsxAcceptance && !p.componentAcceptance)) throw new Error('Absolute repository, approved files and acceptance cases required');
  for (const n of [p.maxTurns, p.maxVerifications, p.reasonerTimeoutMs, p.limits.snapshotBytes, p.limits.snapshotFiles]) {
    if (!Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) throw new Error('Invalid budget');
  }
  if (p.readable.length > p.limits.snapshotFiles || new Set(p.readable).size !== p.readable.length) throw new Error('Invalid file budget/list');
  if (!p.readable.every(safePath) || !p.writable.every(f => p.readable.includes(f))) throw new Error('Invalid file permissions');
  if (!p.acceptance.every(c => p.readable.includes(c.file) && typeof c.export === 'string' && Array.isArray(c.args))) throw new Error('Invalid acceptance cases');
  if (p.tsxAcceptance) {
    validateTsxPolicy(p.tsxAcceptance);
    if (p.acceptance.length || p.readable.length !== 1 || p.readable[0] !== p.tsxAcceptance.file) throw Error('TSX policy requires one approved file and no function cases');
  }
  if (p.componentAcceptance) {
    validateComponentPolicy(p.componentAcceptance);
    if (p.tsxAcceptance || p.acceptance.length || p.readable.length !== 2
      || ![p.componentAcceptance.file, p.componentAcceptance.styleFile].every(f => p.readable.includes(f))) throw Error('Component policy requires exactly the component and style files');
  }
  if (p.acceptanceFeedback !== undefined && !['summary', 'diagnostic'].includes(p.acceptanceFeedback)) throw Error('Invalid acceptance feedback');
  if (p.acceptanceFeedback === 'diagnostic' && (!p.diagnosticCategories || p.diagnosticCategories.length !== p.acceptance.length
    || !p.diagnosticCategories.every(category => category === null || diagnosticCategories.includes(category)))) throw Error('Invalid diagnostic mapping');
}

export function compactFeedback(
  history: readonly Feedback[],
  currentRevision: string,
): Feedback[] {
  const selected = new Map<number, Feedback>();

  // Preserve recent action outcomes.
  for (let i = Math.max(0, history.length - 6); i < history.length; i++) {
    const entry = structuredClone(history[i]);
    if (['workspace.read', 'workspace.readRange'].includes(entry.capability) &&
        entry.revision !== currentRevision) {
      delete entry.result;
      entry.guidance = 'Source observation is stale; read the file again.';
    }
    selected.set(i, entry);
  }

  // Preserve distinct current-revision source observations.
  const observed = new Set<string>();
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (!['workspace.read', 'workspace.readRange'].includes(entry.capability) ||
        entry.status !== 'completed' ||
        entry.revision !== currentRevision) continue;

    const path = entry.input.path;
    if (typeof path !== 'string') continue;

    const key = entry.capability === 'workspace.read'
      ? `full:${path}`
      : `range:${path}:${entry.input.startLine}:${entry.input.lineCount}`;

    if (observed.has(key)) continue;
    observed.add(key);
    selected.set(i, structuredClone(entry));
  }

  return [...selected.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, entry]) => entry);
}

export async function runRepositoryTask(objective: string, approved: RepositoryProfile, reasoner: Reasoner): Promise<TaskReport> {
  const p = structuredClone(approved);
  const report: TaskReport = { classification: 'blocked', objective, reason: '', originalUnchanged: false, patch: '', filesChanged: [], feedback: [], profile: p };
  const deadline = performance.now() + (p.maxDurationMs ?? 2_147_483_647);
  let temporary: string | undefined;
  let initial: Tree | undefined;
  let verifiedRevision: string | undefined;
  let verificationCount = 0;
  const failedRevisions = new Set<string>();
  try {
    validate(p);
    if (p.maxDurationMs !== undefined && (!Number.isSafeInteger(p.maxDurationMs) || p.maxDurationMs <= 0 || p.maxDurationMs > 2_147_483_647)) throw new Error("Invalid task duration");
    initial = await readApproved(p.repository, p.readable, p.limits.snapshotBytes);
    report.initialRevision = digest(initial);
    temporary = await mkdtemp(join(tmpdir(), 'veil-task-'));
    await materialize(temporary, initial);
    const workspace = workspaceCapabilities(temporary, p.readable, p.limits.snapshotBytes)
      .filter(capability =>
        !(p.patchOnly === true && capability.name === 'workspace.write') &&
        !(p.allowAppend !== true && capability.name === 'workspace.append'));
    const capabilities = [...workspace,
      p.componentAcceptance ? await componentAcceptanceCapability(temporary, initial, p.componentAcceptance, p.limits)
        : p.tsxAcceptance ? await tsxAcceptanceCapability(temporary, initial[p.tsxAcceptance.file], p.tsxAcceptance, p.limits)
        : acceptanceCapability(temporary, p.acceptance, p.limits, p.acceptanceFeedback ?? 'summary', p.diagnosticCategories)];
    const namespace = `task.${randomUUID()}.`;
    const caller = randomUUID();
    let authorized = false;
    const runtime = new OperatorRuntime({ planVersions: ['2.0'], authorizer: { async authorize(context) {
      const name = context.capability.name.slice(namespace.length);
      const input = context.input as Record<string, unknown>;
      const path = input?.path;
      const allowed = context.caller?.subject === caller && context.capability.name.startsWith(namespace) && (
        name === 'verification.sandbox.run' ? Object.keys(input).length === 0 :
        name === 'workspace.list' ? typeof path === 'string' && (path === '.' || safePath(path) && p.readable.some(f => f.startsWith(`${path}/`))) :
        (name === 'workspace.read' || name === 'workspace.readRange')
          ? typeof path === 'string' && p.readable.includes(path) :
        (name === 'workspace.patch' ||
          name === 'workspace.write' && p.patchOnly !== true ||
          name === 'workspace.append' && p.allowAppend === true)
          && typeof path === 'string' && p.writable.includes(path));
      authorized = allowed;
      return allowed ? { decision: 'allow' } : { decision: 'deny', reason: 'Outside approved repository profile. Use exact approved root-relative paths from workspace.readable/writable; list the root with path ".". Verification accepts {} only.' };
    } } });
    // Registry is process-global. Unique internal names prevent one task from addressing another.
    runtime.use({ manifest: { name: namespace, version: '1.0.0', capabilities: capabilities.map(c => namespace + c.name) },
      capabilities: capabilities.map(c => ({ ...c, name: namespace + c.name })) });
    report.classification = 'exhausted';
    report.reason = 'Turn budget exhausted';
    for (let turn = 1; turn <= p.maxTurns; turn++) {
      if (performance.now() >= deadline) { report.reason = 'Task duration exhausted'; break; }
      const currentRevision = digest(await readApproved(temporary, p.readable, p.limits.snapshotBytes));
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let response: string;
      try {
        response = await Promise.race([
          reasoner(structuredClone({ objective, capabilities: capabilities.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
            feedback: compactFeedback(report.feedback, currentRevision), remainingTurns: p.maxTurns - turn + 1,
            remainingVerifications: p.maxVerifications - verificationCount,
            workspace: { pathInstructions: 'Paths are canonical workspace-root-relative names with forward slashes. Use src/file.ts, never /src/file.ts, ./src/file.ts, a repository prefix, or traversal. Use "." only to list the root. Only listed approved files exist; writes require writable membership.',
              readable: p.readable, writable: p.writable },
            revision: currentRevision, verifiedRevision,
            recovery: { currentRevisionFailed: failedRevisions.has(currentRevision),
              guidance: failedRevisions.has(currentRevision)
                ? 'This exact revision already failed. Inspect approved source and host feedback, make a meaningful correction before verifying again. Repeated verification consumes the remaining budget.'
                : 'Verify after editing; finish only when verifiedRevision equals revision. Only host-approved diagnostic categories may be disclosed.' } }), controller.signal),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Reasoner deadline exceeded')); }, Math.min(p.reasonerTimeoutMs, Math.max(1, deadline - performance.now()))); }),
        ]);
      } finally { clearTimeout(timer); controller.abort(); }
      if (performance.now() >= deadline) { report.reason = 'Task duration exhausted'; break; }
      if (typeof response !== 'string' || Buffer.byteLength(response) > p.limits.snapshotBytes * 2 + 4096) throw new Error('Reasoner response exceeds protocol budget');
      const action = JSON.parse(response);
      if (!action || typeof action !== 'object') throw new Error('Invalid action');
      const revision = digest(await readApproved(temporary, p.readable, p.limits.snapshotBytes));
      if (performance.now() >= deadline) { report.reason = 'Task duration exhausted'; break; }
      if (action.type === 'finish') {
        if (verifiedRevision === revision) {
          report.classification = 'verified';
          report.reason = 'Host acceptance passed on final revision';
          break;
        }

        if (p.recoverPrematureFinish !== true) {
          report.classification = 'failed';
          report.reason = 'No passing acceptance on final revision';
          break;
        }

        report.feedback.push({
          turn,
          capability: 'finish',
          authorized: false,
          revision,
          status: 'rejected',
          input: {},
          error: 'Cannot finish: current revision has not passed host verification.',
          guidance: 'Call verification.sandbox.run with {} before finishing.',
        });
        report.classification = 'failed';
        report.reason = 'No passing acceptance on final revision';
        continue;
      }
      if (action.type !== 'capability' || !capabilities.some(c => c.name === action.capability)
        || !action.input || typeof action.input !== 'object' || Array.isArray(action.input)) throw new Error('Invalid capability action');
      if (action.capability === 'workspace.patch') {
        const repeated = report.feedback.find(f =>
          f.capability === action.capability &&
          f.revision === revision &&
          f.status === 'failed' &&
          JSON.stringify(f.input) === JSON.stringify(action.input)
        );
        if (repeated) {
          report.feedback.push({
            turn,
            capability: action.capability,
            authorized: false,
            revision,
            status: 'rejected',
            input: structuredClone(action.input),
            error: 'Identical patch already failed on this workspace revision.',
            guidance: 'Do not repeat this patch. Read the current file and use an exact, different search string.',
          });
          const recent = report.feedback.slice(-3);
          if (recent.length === 3 && recent.every(f =>
            f.capability === action.capability &&
            f.status === 'rejected' &&
            f.error === 'Identical patch already failed on this workspace revision.'
          )) {
            report.classification = 'failed';
            report.reason = 'Repeated identical patch attempts without progress';
            break;
          }
          continue;
        }
      }
      if (action.capability === 'verification.sandbox.run' && verificationCount >= p.maxVerifications) {
        report.reason = 'Verification budget exhausted'; break;
      }
      if (action.capability === 'verification.sandbox.run' && deadline - performance.now() < p.limits.wallMs + 1000) { report.reason = 'Insufficient task duration for verification'; break; }
      if (action.capability === 'verification.sandbox.run') verifiedRevision = undefined;
      authorized = false;
      const entry: Feedback = { turn, capability: action.capability, authorized: false, revision, status: 'rejected', input: structuredClone(action.input) };
      try {
        const job = await runtime.executePlan({ version: '2.0', goal: objective, steps: [{ id: `turn-${turn}`, capability: namespace + action.capability,
          capabilityVersion: '1.0.0', input: action.input }] }, { caller: { subject: caller } });
        entry.jobId = job.id;
        entry.authorized = authorized;
        entry.status = job.steps[0]?.status ?? job.status;
        entry.result = job.steps[0]?.result;
        entry.error = job.steps[0]?.error ?? job.error;
        if (action.capability === 'verification.sandbox.run' && authorized) {
          verificationCount++;
          if (failedRevisions.has(revision)) entry.repeatedFailedRevision = revision;
          const result = entry.result as AcceptanceResult | undefined;
          verifiedRevision = entry.status === 'completed' && result?.accepted ? revision : undefined;
          if (entry.status === 'completed' && result?.accepted === false && result.status !== 'unavailable') failedRevisions.add(revision);
          if (result?.status === 'unavailable') { report.classification = 'blocked'; report.reason = result.diagnostic ?? 'Sandbox unavailable'; }
        }
      } catch (error) { entry.error = String(error); }
      entry.revision = digest(await readApproved(temporary, p.readable, p.limits.snapshotBytes));
      if (entry.revision !== revision) verifiedRevision = undefined;
      if (entry.authorized && entry.status === 'completed' && ['workspace.write', 'workspace.patch', 'workspace.append'].includes(entry.capability)
        && entry.revision === revision) entry.guidance = 'Unchanged write: workspace revision did not change. Inspect the source and make a meaningful correction if acceptance failed.';
      if (!entry.authorized) entry.guidance = 'Request rejected. Use the capability schema and exact paths in workspace.readable/writable. List "." to discover approved entries. Authorization has not changed.';
      report.feedback.push(entry);
      if (performance.now() >= deadline) { report.classification = 'exhausted'; report.reason = 'Task duration exhausted'; break; }
      if (report.classification === 'blocked') break;
    }
    report.verifiedRevision = verifiedRevision;
  } catch (error) {
    report.classification = performance.now() >= deadline ? 'exhausted' : initial && temporary ? 'uncertain' : 'blocked';
    report.reason = performance.now() >= deadline ? 'Task duration exhausted' : String(error);
  } finally {
    try {
      if (initial) {
        report.originalUnchanged = digest(await readApproved(p.repository, p.readable, p.limits.snapshotBytes)) === digest(initial);
        if (temporary) {
          const final = await readApproved(temporary, p.readable, p.limits.snapshotBytes);
          report.finalRevision = digest(final);
          report.patch = await patch(initial, final, p.readable);
          report.filesChanged = Object.keys(initial).filter(path => initial![path] !== final[path]).sort();
          if (report.classification === 'verified' && report.verifiedRevision !== report.finalRevision) {
            report.classification = 'uncertain'; report.reason = 'Final revision does not match acceptance evidence';
          }
        }
        if (!report.originalUnchanged) { report.classification = 'uncertain'; report.reason = 'Original approved inputs changed during task'; }
      }
    } catch (error) { report.classification = 'uncertain'; report.reason = `Final evidence failed: ${error}`; }
    if (temporary) {
      try { await rm(temporary, { recursive: true, force: true }); }
      catch (error) { report.classification = 'uncertain'; report.reason = `Cleanup failed: ${error}`; }
    }
  }
  return report;
}
