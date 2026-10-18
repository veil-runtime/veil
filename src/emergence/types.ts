import type { CapabilityDescriptor } from '../runtime/registry/capability.js';
import type { ExecutionCaller } from '../runtime/execution/execution-context.js';
import type { Job } from '../runtime/jobs/job.js';

export interface WorkerDefinition {
  id: string;
  responsibility: string;
  capabilities: readonly string[];
}

export interface Budget {
  maxDecisions: number;
  maxJobs: number;
  maxDelegations: number;
  maxElapsedMs: number;
  maxProposalBytes: number;
}

export type Proposal =
  | { kind: 'execute'; capability: string; input?: unknown; reason: string }
  | { kind: 'delegate'; peer: string; task: string; evidence: string; reason: string }
  | { kind: 'finish'; reason: string };

export interface PeerDescriptor {
  id: string;
  responsibility: string;
  capabilities: CapabilityDescriptor[];
}

export interface ReasoningContext {
  goal: string;
  task: string;
  worker: WorkerDefinition;
  capabilities: CapabilityDescriptor[];
  peers: PeerDescriptor[];
  history: EmergenceEvent[];
  remaining: Budget;
}

/** A provider proposes only. It never receives a runtime or caller credentials. */
export interface ReasoningProvider {
  decide(context: ReasoningContext): Promise<Proposal>;
}

export interface VerificationSpec {
  worker: string;
  capability: string;
  input?: unknown;
  /** Host-owned expected value. Equality is checked against the Veil result. */
  expected: unknown;
}

export interface EmergenceEvent {
  sequence: number;
  at: string;
  type: 'goal.started' | 'capabilities.discovered' | 'reasoning.decision' |
    'work.delegated' | 'work.returned' | 'approval.requested' | 'approval.granted' |
    'execution.started' |
    'execution.completed' | 'execution.failed' | 'verification.completed' |
    'goal.completed' | 'goal.failed';
  worker?: string;
  data: Record<string, unknown>;
}

export interface WorkItem { worker: string; task: string; evidence: string; parent?: string }
export interface ApprovalRequest {
  id: string;
  worker: string;
  capability: string;
  input: unknown;
  reason: string;
  granted: boolean;
}

export interface EmergenceState {
  id: string;
  goal: string;
  status: 'running' | 'awaiting-approval' | 'verified' | 'failed';
  startedAt: string;
  budget: Budget;
  decisions: number;
  jobs: number;
  delegations: number;
  queue: WorkItem[];
  approvals: ApprovalRequest[];
  events: EmergenceEvent[];
  verification: VerificationSpec;
  verified?: boolean;
}

export interface ExecutionHost {
  listCapabilities(): CapabilityDescriptor[];
  executePlan(plan: {
    version: string;
    goal: string;
    steps: { id: string; capability: string; capabilityVersion: string; input?: unknown; reason: string }[];
  }, options: { caller: ExecutionCaller }): Promise<Job>;
}
