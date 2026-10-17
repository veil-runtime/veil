import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OperatorRuntime, type Capability } from '../../src/index.js';
import { acceptanceCapability, type AcceptanceCase, type AcceptanceResult } from './acceptance.js';
import { digest, materialize, patch, readApproved, safePath, workspaceCapabilities, type Tree } from './workspace.js';
import type { VerificationProfile } from '../../src/providers/sandbox/linux-verification-sandbox.js';

export interface RepositoryProfile {
  repository: string;
  /** Explicit approved existing UTF-8 files only. Unlisted project files are not copied. */
  readable: string[];
  writable: string[];
  acceptance: AcceptanceCase[];
  limits: Omit<VerificationProfile, 'workspace' | 'executable' | 'args'>;
  maxTurns: number;
  maxVerifications: number;
  reasonerTimeoutMs: number;
}
export interface Feedback {
  turn: number; capability: string; authorized: boolean; revision: string;
  status: string; input: Record<string, unknown>; jobId?: string; result?: unknown; error?: string;
}
export interface ReasonerContext {
  objective: string;
  capabilities: { name: string; description: string; inputSchema: Capability['inputSchema'] }[];
  feedback: Feedback[];
  remainingTurns: number;
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
  feedback: Feedback[];
  /** Detached trusted configuration makes acceptance and resource choices reviewable. */
  profile: RepositoryProfile;
}

function validate(p: RepositoryProfile): void {
  if (!isAbsolute(p.repository) || !p.readable.length || !p.acceptance.length) throw new Error('Absolute repository, approved files and acceptance cases required');
  for (const n of [p.maxTurns, p.maxVerifications, p.reasonerTimeoutMs, p.limits.snapshotBytes, p.limits.snapshotFiles]) {
    if (!Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) throw new Error('Invalid budget');
  }
  if (p.readable.length > p.limits.snapshotFiles || new Set(p.readable).size !== p.readable.length) throw new Error('Invalid file budget/list');
  if (!p.readable.every(safePath) || !p.writable.every(f => p.readable.includes(f))) throw new Error('Invalid file permissions');
  if (!p.acceptance.every(c => p.readable.includes(c.file) && typeof c.export === 'string' && Array.isArray(c.args))) throw new Error('Invalid acceptance cases');
}

export async function runRepositoryTask(objective: string, approved: RepositoryProfile, reasoner: Reasoner): Promise<TaskReport> {
  const p = structuredClone(approved);
  const report: TaskReport = { classification: 'blocked', objective, reason: '', originalUnchanged: false, patch: '', feedback: [], profile: p };
  let temporary: string | undefined;
  let initial: Tree | undefined;
  let verifiedRevision: string | undefined;
  let verificationCount = 0;
  try {
    validate(p);
    initial = await readApproved(p.repository, p.readable, p.limits.snapshotBytes);
    report.initialRevision = digest(initial);
    temporary = await mkdtemp(join(tmpdir(), 'veil-task-'));
    await materialize(temporary, initial);
    const capabilities = [...workspaceCapabilities(temporary, p.readable, p.limits.snapshotBytes), acceptanceCapability(temporary, p.acceptance, p.limits)];
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
        name === 'workspace.read' ? typeof path === 'string' && p.readable.includes(path) :
        ['workspace.write', 'workspace.patch'].includes(name) && typeof path === 'string' && p.writable.includes(path));
      authorized = allowed;
      return allowed ? { decision: 'allow' } : { decision: 'deny', reason: 'Outside approved repository profile' };
    } } });
    // Registry is process-global. Unique internal names prevent one task from addressing another.
    runtime.use({ manifest: { name: namespace, version: '1.0.0', capabilities: capabilities.map(c => namespace + c.name) },
      capabilities: capabilities.map(c => ({ ...c, name: namespace + c.name })) });
    report.classification = 'exhausted';
    report.reason = 'Turn budget exhausted';
    for (let turn = 1; turn <= p.maxTurns; turn++) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let response: string;
      try {
        response = await Promise.race([
          reasoner(structuredClone({ objective, capabilities: capabilities.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
            feedback: report.feedback, remainingTurns: p.maxTurns - turn + 1 }), controller.signal),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Reasoner deadline exceeded')); }, p.reasonerTimeoutMs); }),
        ]);
      } finally { clearTimeout(timer); controller.abort(); }
      if (typeof response !== 'string' || Buffer.byteLength(response) > p.limits.snapshotBytes * 2 + 4096) throw new Error('Reasoner response exceeds protocol budget');
      const action = JSON.parse(response);
      if (!action || typeof action !== 'object') throw new Error('Invalid action');
      const revision = digest(await readApproved(temporary, p.readable, p.limits.snapshotBytes));
      if (action.type === 'finish') {
        report.classification = verifiedRevision === revision ? 'verified' : 'failed';
        report.reason = verifiedRevision === revision ? 'Host acceptance passed on final revision' : 'No passing acceptance on final revision';
        break;
      }
      if (action.type !== 'capability' || !capabilities.some(c => c.name === action.capability)
        || !action.input || typeof action.input !== 'object' || Array.isArray(action.input)) throw new Error('Invalid capability action');
      if (action.capability === 'verification.sandbox.run' && verificationCount >= p.maxVerifications) {
        report.reason = 'Verification budget exhausted'; break;
      }
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
          const result = entry.result as AcceptanceResult | undefined;
          verifiedRevision = entry.status === 'completed' && result?.accepted ? revision : undefined;
          if (result?.status === 'unavailable') { report.classification = 'blocked'; report.reason = result.diagnostic ?? 'Sandbox unavailable'; }
        }
      } catch (error) { entry.error = String(error); }
      entry.revision = digest(await readApproved(temporary, p.readable, p.limits.snapshotBytes));
      if (entry.revision !== revision) verifiedRevision = undefined;
      report.feedback.push(entry);
      if (report.classification === 'blocked') break;
    }
    report.verifiedRevision = verifiedRevision;
  } catch (error) {
    report.classification = initial && temporary ? 'uncertain' : 'blocked';
    report.reason = String(error);
  } finally {
    try {
      if (initial) {
        report.originalUnchanged = digest(await readApproved(p.repository, p.readable, p.limits.snapshotBytes)) === digest(initial);
        if (temporary) {
          const final = await readApproved(temporary, p.readable, p.limits.snapshotBytes);
          report.finalRevision = digest(final);
          report.patch = patch(initial, final);
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
