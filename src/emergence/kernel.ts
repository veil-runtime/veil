import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { OperatorRuntime } from '../runtime/operator-runtime.js';
import type { ExecutionAuthorizer } from '../runtime/permissions/execution-authorizer.js';
import type { CapabilityDescriptor } from '../runtime/registry/capability.js';
import { FileJournal } from './journal.js';
import type {
  ApprovalRequest, Budget, EmergenceState, Proposal, ReasoningProvider,
  VerificationSpec, WorkerDefinition, WorkItem,
} from './types.js';

export interface KernelOptions {
  journal: FileJournal;
  provider: ReasoningProvider;
  workers: readonly WorkerDefinition[];
  budget: Budget;
  /** Optional additional host policy. A deny still wins after a grant. */
  policy?: ExecutionAuthorizer;
  /** Trusted host must authenticate the human and approve the exact request. */
  approvalGate?: (request: Readonly<ApprovalRequest>, approvedBy: string) => Promise<boolean>;
}

export class EmergenceKernel {
  private readonly workers = new Map<string, WorkerDefinition>();

  constructor(private readonly options: KernelOptions) {
    for (const worker of options.workers) {
      if (this.workers.has(worker.id)) throw new Error(`Duplicate worker: ${worker.id}`);
      this.workers.set(worker.id, worker);
    }
    for (const [name, value] of Object.entries(options.budget)) {
      if (!Number.isSafeInteger(value) || value < 0 ||
        (name !== 'maxCostMicros' && value === 0)) throw new Error('Budgets must be valid integers');
    }
  }

  async start(goal: string, owner: string, verification: VerificationSpec,
    decisionSlice?: number): Promise<EmergenceState> {
    if (!goal.trim() || !this.workers.has(owner)) throw new Error('Invalid goal or owner');
    const verifier = this.worker(verification.worker);
    const descriptor = this.discover(verifier).find((item) => item.name === verification.capability);
    if (!descriptor || descriptor.risk !== 'read') throw new Error('Verification must use a permitted read capability');
    const state: EmergenceState = {
      id: randomUUID(), goal, status: 'running', startedAt: new Date().toISOString(),
      budget: { ...this.options.budget }, decisions: 0, jobs: 0, delegations: 0,
      modelCalls: 0, inputTokens: 0, outputTokens: 0, costMicros: 0, executionMs: 0,
      queue: [{ worker: owner, task: goal, evidence: '' }], approvals: [], events: [], memory: [],
      verification: structuredClone(verification),
    };
    // The host-owned verification rule is journal state, never reasoning context.
    await this.record(state, 'goal.started', owner, { goal, budget: state.budget });
    return this.run(state.id, decisionSlice);
  }

  async grantApproval(id: string, requestId: string, approvedBy: string,
    pauseAfterExecution = false): Promise<EmergenceState> {
    const state = await this.options.journal.load(id);
    if (state.status !== 'awaiting-approval') throw new Error('Goal is not awaiting approval');
    const request = state.approvals.find((item) => item.id === requestId);
    if (!request) throw new Error('Unknown approval request');
    if (!approvedBy.trim() || !this.options.approvalGate ||
      !await this.options.approvalGate(structuredClone(request), approvedBy)) {
      throw new Error('Approval gate denied request');
    }
    request.granted = true;
    state.status = 'running';
    await this.record(state, 'approval.granted', request.worker, { requestId, approvedBy });
    return this.run(id, undefined, pauseAfterExecution);
  }

  async run(id: string, decisionSlice?: number, pauseAfterApprovedExecution = false): Promise<EmergenceState> {
    if (decisionSlice !== undefined && (!Number.isSafeInteger(decisionSlice) || decisionSlice <= 0)) {
      throw new Error('Decision slice must be a positive integer');
    }
    const state = await this.options.journal.load(id);
    const initialDecisions = state.decisions;
    if (state.status === 'verified' || state.status === 'failed') return state;
    if (state.status === 'awaiting-approval') return state;
    state.memory ??= [];
    state.modelCalls ??= 0;
    state.inputTokens ??= 0;
    state.outputTokens ??= 0;
    state.costMicros ??= 0;
    state.executionMs ??= 0;
    const latestStart = [...state.events].reverse().find((event) => event.type === 'execution.started');
    if (latestStart && !state.events.some((event) => event.sequence > latestStart.sequence &&
      (event.type === 'execution.completed' || event.type === 'execution.failed'))) {
      await this.fail(state, 'Uncertain execution after restart; inspect external effect before retry');
      return state;
    }
    const pending = state.approvals.find((item) => item.granted);
    if (pending) {
      const settled = state.events.some((event) =>
        (event.type === 'execution.completed' || event.type === 'execution.failed') &&
        event.data.approvalId === pending.id);
      if (!settled) await this.execute(state, pending.worker, pending.capability, pending.input, pending.reason, pending);
      state.approvals = state.approvals.filter((item) => item.id !== pending.id);
      await this.options.journal.save(state);
      if (pauseAfterApprovedExecution) return state;
    }
    while ((state.active || state.queue.length > 0) && state.status === 'running') {
      if (decisionSlice !== undefined && state.decisions - initialDecisions >= decisionSlice) break;
      if (this.exhausted(state)) {
        await this.fail(state, 'Resource budget exhausted');
        break;
      }
      const item = state.active ?? state.queue.shift()!;
      state.active = item;
      await this.options.journal.save(state);
      const worker = this.worker(item.worker);
      const capabilities = this.discover(worker);
      const peers = [...this.workers.values()]
        .filter((peer) => peer.id !== worker.id)
        .map((peer) => ({ id: peer.id, responsibility: peer.responsibility, capabilities: this.discover(peer) }));
      await this.record(state, 'capabilities.discovered', worker.id, {
        capabilities: capabilities.map((capability) => capability.name),
        peers: peers.map((peer) => ({ id: peer.id, capabilities: peer.capabilities.map((capability) => capability.name) })),
      });
      if (state.budget.maxModelCalls !== undefined && state.modelCalls >= state.budget.maxModelCalls) {
        await this.fail(state, 'Model call budget exhausted');
        break;
      }
      state.decisions += 1;
      state.modelCalls += 1;
      await this.options.journal.save(state);
      let proposal: Proposal;
      try {
        const response = await this.options.provider.decide({
          goal: state.goal, task: item.task, worker, capabilities, peers,
          history: structuredClone(state.events),
          memory: structuredClone(state.memory),
          remaining: {
            maxDecisions: state.budget.maxDecisions - state.decisions,
            maxJobs: state.budget.maxJobs - state.jobs,
            maxDelegations: state.budget.maxDelegations - state.delegations,
            maxElapsedMs: state.budget.maxElapsedMs - (Date.now() - Date.parse(state.startedAt)),
            maxProposalBytes: state.budget.maxProposalBytes,
            maxModelCalls: state.budget.maxModelCalls === undefined ? undefined : state.budget.maxModelCalls - state.modelCalls,
            maxInputTokens: state.budget.maxInputTokens === undefined ? undefined : state.budget.maxInputTokens - state.inputTokens,
            maxOutputTokens: state.budget.maxOutputTokens === undefined ? undefined : state.budget.maxOutputTokens - state.outputTokens,
            maxCostMicros: state.budget.maxCostMicros === undefined ? undefined : state.budget.maxCostMicros - state.costMicros,
            maxExecutionMs: state.budget.maxExecutionMs === undefined ? undefined : state.budget.maxExecutionMs - state.executionMs,
          },
        });
        proposal = 'proposal' in response ? response.proposal : response;
        if ('usage' in response) {
          const { inputTokens, outputTokens, costMicros } = response.usage;
          if (![inputTokens, outputTokens, costMicros].every((value) => Number.isSafeInteger(value) && value >= 0)) {
            throw new Error('Invalid provider usage');
          }
          state.inputTokens += inputTokens;
          state.outputTokens += outputTokens;
          state.costMicros += costMicros;
          await this.options.journal.save(state);
          if ((state.budget.maxInputTokens !== undefined && state.inputTokens > state.budget.maxInputTokens) ||
            (state.budget.maxOutputTokens !== undefined && state.outputTokens > state.budget.maxOutputTokens) ||
            (state.budget.maxCostMicros !== undefined && state.costMicros > state.budget.maxCostMicros)) {
            await this.fail(state, 'Provider usage budget exhausted');
            break;
          }
        }
      } catch (error) {
        await this.fail(state, `Reasoning provider failed: ${String(error)}`);
        break;
      }
      try {
        const encoded = JSON.stringify(proposal);
        if (!encoded || Buffer.byteLength(encoded) > state.budget.maxProposalBytes) {
          await this.record(state, 'reasoning.rejected', worker.id,
            { reason: 'Proposal byte budget exceeded', bytes: encoded ? Buffer.byteLength(encoded) : 0 });
          await this.fail(state, 'Reasoning proposal exceeded byte budget');
          break;
        }
        proposal = JSON.parse(encoded) as Proposal;
        if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) ||
          !['execute', 'delegate', 'finish'].includes(proposal.kind)) {
          await this.record(state, 'reasoning.rejected', worker.id, { reason: 'Invalid proposal shape', proposal });
          await this.fail(state, 'Invalid reasoning proposal');
          break;
        }
      } catch {
        await this.record(state, 'reasoning.rejected', worker.id, { reason: 'Nonserializable proposal' });
        await this.fail(state, 'Reasoning proposal is not serializable');
        break;
      }
      await this.record(state, 'reasoning.decision', worker.id, { task: item.task, proposal });
      if (proposal.kind === 'delegate') {
        const peer = peers.find((entry) => entry.id === proposal.peer);
        if (!peer || typeof proposal.task !== 'string' || !proposal.task.trim() ||
          typeof proposal.reason !== 'string' || !proposal.reason.trim() ||
          typeof proposal.evidence !== 'string' || state.delegations >= state.budget.maxDelegations) {
          await this.fail(state, 'Invalid or over-budget delegation');
          break;
        }
        state.delegations += 1;
        state.active = undefined;
        state.queue.unshift({ worker: peer.id, task: proposal.task, evidence: proposal.evidence.slice(0, 2048), parent: worker.id }, item);
        await this.record(state, 'work.delegated', worker.id, {
          peer: peer.id, task: proposal.task, reason: proposal.reason,
          availableCapabilities: peer.capabilities.map((entry) => entry.name), evidence: proposal.evidence.slice(0, 2048),
        });
      } else if (proposal.kind === 'execute') {
        const descriptor = capabilities.find((entry) => entry.name === proposal.capability);
        if (!descriptor || typeof proposal.reason !== 'string' || !proposal.reason.trim()) {
          await this.fail(state, 'Proposal selected a capability outside worker scope');
          break;
        }
        const input = proposal.input && typeof proposal.input === 'object' && !Array.isArray(proposal.input)
          ? proposal.input as Record<string, unknown> : {};
        const valid = Object.entries(descriptor.inputSchema).every(([field, rule]) => {
          const value = input[field];
          if (rule.required && (value === undefined || value === null || value === '')) return false;
          if (value === undefined) return true;
          return rule.type === 'array' ? Array.isArray(value) :
            rule.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) :
            rule.type === 'number' ? typeof value === 'number' && Number.isFinite(value) :
            ['string', 'boolean'].includes(rule.type) && typeof value === rule.type;
        });
        if (!valid) {
          await this.fail(state, 'Proposal input violates capability schema');
          break;
        }
        if (descriptor.risk !== 'read') {
          const request: ApprovalRequest = {
            id: randomUUID(), worker: worker.id, capability: descriptor.name,
            input: structuredClone(proposal.input), reason: proposal.reason, granted: false,
          };
          state.approvals.push(request);
          state.status = 'awaiting-approval';
          await this.record(state, 'approval.requested', worker.id, { request });
          break;
        }
        await this.execute(state, worker.id, descriptor.name, proposal.input, proposal.reason);
      } else if (proposal.kind === 'finish') {
        if (typeof proposal.reason !== 'string' || !proposal.reason.trim()) {
          await this.fail(state, 'Invalid finish rationale');
          break;
        }
        if (item.parent) {
          state.active = undefined;
          await this.record(state, 'work.returned', worker.id, { parent: item.parent, task: item.task, reason: proposal.reason });
        } else {
          await this.verify(state);
        }
      } else {
        await this.fail(state, 'Invalid reasoning proposal');
      }
    }
    return state;
  }

  private worker(id: string): WorkerDefinition {
    const worker = this.workers.get(id);
    if (!worker) throw new Error(`Unknown worker: ${id}`);
    return worker;
  }

  private discover(worker: WorkerDefinition): CapabilityDescriptor[] {
    const allowed = new Set(worker.capabilities);
    return new OperatorRuntime().listCapabilities().filter((item) => allowed.has(item.name));
  }

  private exhausted(state: EmergenceState): boolean {
    return state.decisions >= state.budget.maxDecisions || state.jobs >= state.budget.maxJobs ||
      Date.now() - Date.parse(state.startedAt) >= state.budget.maxElapsedMs ||
      (state.budget.maxExecutionMs !== undefined && state.executionMs >= state.budget.maxExecutionMs);
  }

  private async execute(state: EmergenceState, workerId: string, capability: string,
    input: unknown, reason: string, approval?: ApprovalRequest): Promise<void> {
    if (state.jobs >= state.budget.maxJobs) { await this.fail(state, 'Job budget exhausted'); return; }
    const descriptor = this.discover(this.worker(workerId)).find((item) => item.name === capability);
    if (!descriptor) { await this.fail(state, 'Capability no longer available to worker'); return; }
    const policy: ExecutionAuthorizer = {
      authorize: async (context) => {
        if (context.caller?.subject !== workerId || context.capability.name !== capability ||
          context.capability.version !== descriptor.version || !isDeepStrictEqual(context.input, input)) {
          return { decision: 'deny', reason: 'Execution differs from authorized proposal' };
        }
        if (descriptor.risk !== 'read' && (!approval?.granted || approval.capability !== capability ||
          approval.worker !== workerId || !isDeepStrictEqual(approval.input, input))) {
          return { decision: 'deny', reason: 'Sensitive action requires human approval' };
        }
        return this.options.policy?.authorize(context) ?? { decision: 'allow' };
      },
    };
    state.jobs += 1;
    const started = Date.now();
    await this.record(state, 'execution.started', workerId, { capability, reason, approvalId: approval?.id });
    try {
      const job = await new OperatorRuntime({ authorizer: policy, planVersions: ['2.0'] }).executePlan({
        version: '2.0', goal: state.goal,
        steps: [{ id: randomUUID(), capability, capabilityVersion: descriptor.version, input, reason }],
      }, { caller: { subject: workerId, scopes: [capability], metadata: { goalId: state.id } } });
      await this.record(state, job.status === 'completed' ? 'execution.completed' : 'execution.failed', workerId, {
        jobId: job.id, capability, status: job.status, outcome: job.outcome, approvalId: approval?.id,
        result: job.result, error: job.error, events: job.events,
      });
    } catch (error) {
      await this.record(state, 'execution.failed', workerId, { capability, error: String(error), approvalId: approval?.id });
    } finally {
      state.executionMs += Date.now() - started;
      await this.options.journal.save(state);
    }
  }

  private async verify(state: EmergenceState): Promise<void> {
    const { worker, capability, input, expected } = state.verification;
    const before = state.events.length;
    await this.execute(state, worker, capability, input, 'Verify goal completion');
    const result = state.events.slice(before).find((event) => event.type === 'execution.completed');
    const verified = result !== undefined && isDeepStrictEqual(result.data.result, expected);
    state.verified = verified;
    await this.record(state, 'verification.completed', worker, {
      verified, expected, actual: result?.data.result, evidenceJobId: result?.data.jobId,
    });
    if (verified) {
      state.status = 'verified';
      await this.record(state, 'goal.completed', worker, { verified: true });
    } else {
      await this.fail(state, 'Verification did not establish the expected outcome');
    }
  }

  private async fail(state: EmergenceState, reason: string): Promise<void> {
    state.status = 'failed';
    await this.record(state, 'goal.failed', undefined, { reason });
  }

  private async record(state: EmergenceState, type: EmergenceState['events'][number]['type'],
    worker: string | undefined, data: Record<string, unknown>): Promise<void> {
    state.events.push({ sequence: state.events.length + 1, at: new Date().toISOString(), type, worker,
      data: JSON.parse(JSON.stringify(data)) as Record<string, unknown> });
    const kind = type === 'capabilities.discovered' ? 'capability' :
      type === 'reasoning.decision' ? 'interpretation' :
      type === 'execution.started' ? 'attempt' :
      type === 'execution.failed' || type === 'goal.failed' ? 'failure' :
      type === 'verification.completed' ? 'verified-result' :
      type === 'execution.completed' ? 'observation' : undefined;
    if (kind) state.memory.push({ sequence: state.events.length, worker, kind,
      source: kind === 'interpretation' ? 'model' : kind === 'capability' || kind === 'verified-result' ? 'host' : 'veil',
      data: state.events.at(-1)!.data });
    await this.options.journal.save(state);
  }
}
