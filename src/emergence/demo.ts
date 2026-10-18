import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OperatorRuntime } from '../runtime/operator-runtime.js';
import { EmergenceKernel } from './kernel.js';
import { FileJournal } from './journal.js';
import type { EmergenceEvent, ReasoningContext, ReasoningProvider } from './types.js';

function latest(events: EmergenceEvent[], type: EmergenceEvent['type'], capability?: string) {
  return [...events].reverse().find((event) => event.type === type &&
    (!capability || event.data.capability === capability));
}

/** Local deterministic reasoning policy for this arithmetic repair fixture. */
export class RepairReasoner implements ReasoningProvider {
  constructor(private readonly names: { test: string; read: string; patch: string }) {}

  async decide(context: ReasoningContext) {
    const { history, worker } = context;
    if (worker.id === 'coordinator') {
      const returns = history.filter((event) => event.type === 'work.returned');
      if (!returns.some((event) => String(event.data.task).startsWith('diagnose'))) {
        return { kind: 'delegate' as const, peer: 'diagnostic', task: 'diagnose failing addition test',
          evidence: context.goal, reason: 'Diagnostic worker has test and source-reading capabilities' };
      }
      if (!returns.some((event) => String(event.data.task).startsWith('repair'))) {
        const failure = latest(history, 'execution.completed', this.names.test);
        return { kind: 'delegate' as const, peer: 'repair', task: 'repair addition implementation',
          evidence: JSON.stringify(failure?.data.result ?? {}),
          reason: 'Observed test failure needs a worker with patch capability' };
      }
      return { kind: 'finish' as const, reason: 'Repair worker returned; request independent test verification' };
    }
    if (worker.id === 'diagnostic') {
      if (!latest(history, 'execution.completed', this.names.test)) {
        return { kind: 'execute' as const, capability: this.names.test, reason: 'Run the failing test to collect evidence' };
      }
      if (!latest(history, 'execution.completed', this.names.read)) {
        return { kind: 'execute' as const, capability: this.names.read, reason: 'Inspect the implementation after test failure' };
      }
      return { kind: 'finish' as const, reason: 'Test result and source are recorded' };
    }
    if (worker.id === 'repair') {
      const patchSuccess = latest(history, 'execution.completed', this.names.patch);
      if (patchSuccess) return { kind: 'finish' as const, reason: 'Patch applied; independent verifier can test it' };
      const patchFailure = latest(history, 'execution.failed', this.names.patch);
      const source = latest(history, 'execution.completed', this.names.read)?.data.result;
      if (patchFailure && typeof source !== 'string') {
        return { kind: 'execute' as const, capability: this.names.read, reason: 'Read source after patch precondition failed' };
      }
      if (patchFailure) {
        return { kind: 'execute' as const, capability: this.names.patch,
          input: { before: 'return a-b', after: 'return a+b' },
          reason: 'Observed source uses compact subtraction; replace exact expression' };
      }
      return { kind: 'execute' as const, capability: this.names.patch,
        input: { before: 'return a - b', after: 'return a+b' },
        reason: 'Propose addition fix from the failing test; exact patch precondition may need inspection' };
    }
    return { kind: 'finish' as const, reason: 'Verification is host-owned' };
  }
}

export async function createRepairDemo(root?: string) {
  const directory = root ?? await mkdtemp(join(tmpdir(), 'veil-emergence-'));
  const source = join(directory, 'calculator.mjs');
  const testFile = join(directory, 'calculator.test.mjs');
  await writeFile(source, 'export function add(a,b){return a-b}\n');
  await writeFile(testFile, 'export function verify(add){return add(2,3) === 5}\n');
  const suffix = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const names = { test: `demo.test.${suffix}`, read: `demo.read.${suffix}`, patch: `demo.patch.${suffix}` };
  new OperatorRuntime().use({
    manifest: { name: `demo.${suffix}`, version: '1.0.0', capabilities: Object.values(names) },
    capabilities: [
      {
        name: names.test, version: '1.0.0', description: 'Run fixed isolated addition test', risk: 'read',
        async execute() {
          const sourceModule = await import(`${pathToFileURL(source).href}?run=${Date.now()}-${Math.random()}`);
          const testModule = await import(pathToFileURL(testFile).href);
          return { passed: testModule.verify(sourceModule.add) as boolean };
        },
      },
      {
        name: names.read, version: '1.0.0', description: 'Read fixed calculator source', risk: 'read',
        async execute() { return readFile(source, 'utf8'); },
      },
      {
        name: names.patch, version: '1.0.0', description: 'Replace exact expression in fixed calculator source', risk: 'write',
        inputSchema: {
          before: { type: 'string', required: true, description: 'Expected source expression' },
          after: { type: 'string', required: true, description: 'Replacement expression' },
        },
        async execute(input) {
          const { before, after } = input as { before: string; after: string };
          if (!['return a - b', 'return a-b'].includes(before) || after !== 'return a+b') {
            throw new Error('Patch expression outside fixture policy');
          }
          const value = await readFile(source, 'utf8');
          if (!value.includes(before)) throw new Error('Patch precondition failed: expression absent');
          await writeFile(source, value.replace(before, after));
          return { patched: true };
        },
      },
    ],
  });
  const journal = new FileJournal(join(directory, 'journal'));
  const makeKernel = () => new EmergenceKernel({
    journal, provider: new RepairReasoner(names),
    workers: [
      { id: 'coordinator', responsibility: 'Route work and request verification', capabilities: [] },
      { id: 'diagnostic', responsibility: 'Diagnose failing tests', capabilities: [names.test, names.read] },
      { id: 'repair', responsibility: 'Apply a scoped source fix', capabilities: [names.read, names.patch] },
      { id: 'verifier', responsibility: 'Independently run acceptance test', capabilities: [names.test] },
    ],
    budget: { maxDecisions: 16, maxJobs: 8, maxDelegations: 2, maxElapsedMs: 60_000, maxProposalBytes: 4096 },
    approvalGate: async (request, approvedBy) => approvedBy === 'local-operator' &&
      request.capability === names.patch && request.worker === 'repair',
  });
  return { directory, source, journal, kernel: makeKernel(), makeKernel, names };
}
