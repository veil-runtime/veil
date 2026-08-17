import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  OperatorRuntime,
  type CapabilityAuthorizationContext,
  type ExecutionAuthorizer,
} from '../src/index.js';
import { ExecutionCaller } from '../src/runtime/execution/execution-context.js';
import { validatePlan } from '../src/runtime/execution/plan-validator.js';
import { capabilityRegistry } from '../src/runtime/registry/registry.js';

const suffix = `${process.pid}-${Date.now()}`;
const sourceName = `test.source.${suffix}`;
const sinkName = `test.sink.${suffix}`;
let capabilitySequence = 0;
let receivedCaller: ExecutionCaller | undefined;
let receivedInput: unknown;

function uniqueCapabilityName(label: string): string {
  capabilitySequence += 1;
  return `test.execution-authorizer.${label}.${suffix}.${capabilitySequence}`;
}

function eventTypes(job: { events: ReadonlyArray<{ type: string }> }): string[] {
  return job.events.map((event) => event.type);
}

function registerCapability(
  name: string,
  risk: 'read' | 'write' | 'destructive',
  execute: (input: unknown) => Promise<unknown>,
  inputSchema?: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>,
): void {
  capabilityRegistry.register({
    name,
    version: '1.0.0',
    description: `execution authorizer ${risk} capability`,
    risk,
    inputSchema,
    execute,
  });
}

function oneStepPlan(capability: string, input?: unknown) {
  return {
    version: '1.0' as const,
    steps: [{
      id: 'step',
      capability,
      capabilityVersion: '1.0.0',
      input,
    }],
  };
}

capabilityRegistry.register({
  name: sourceName,
  version: '1.0.0',
  description: 'test source',
  risk: 'read',
  async execute() {
    return { user: { id: 'user-123' } };
  },
});

capabilityRegistry.register({
  name: sinkName,
  version: '1.0.0',
  description: 'test sink',
  risk: 'read',
  inputSchema: {
    userId: { type: 'string', required: true, description: 'user id' },
  },
  async execute(input, context) {
    receivedInput = input;
    receivedCaller = context?.caller;
    return input;
  },
});

test('external linear plans resolve earlier results and propagate immutable caller context', async () => {
  const runtime = new OperatorRuntime();
  const caller: ExecutionCaller = {
    subject: 'subject-1',
    tenant: 'tenant-1',
    scopes: ['read'],
    metadata: { source: 'test' },
  };

  const job = await runtime.executePlan({
    version: '1.0',
    idempotencyKey: 'plan-once',
    steps: [
      { id: 'source', capability: sourceName, capabilityVersion: '1.0.0' },
      {
        id: 'sink',
        capability: sinkName,
        capabilityVersion: '1.0.0',
        idempotencyKey: 'sink-once',
        input: { userId: { $ref: 'steps.source.result.user.id' } },
      },
    ],
  }, { caller });

  assert.equal(job.status, 'completed');
  assert.equal(job.idempotencyKey, 'plan-once');
  assert.deepEqual(receivedInput, { userId: 'user-123' });
  assert.deepEqual(receivedCaller, caller);
  assert.ok(Object.isFrozen(receivedCaller));
  assert.ok(Object.isFrozen(receivedCaller?.scopes));
  assert.ok(Object.isFrozen(receivedCaller?.metadata));
  assert.equal(job.steps[0].status, 'completed');
  assert.ok(job.steps[0].createdAt);
});

test('plan validation rejects incompatible versions, malformed input, and forward references', () => {
  const result = validatePlan([
    {
      id: 'sink',
      capability: sinkName,
      capabilityVersion: '2.0.0',
      input: { userId: { $ref: 'steps.source.result.user.id' } },
    },
    { id: 'source', capability: sourceName },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.message).join('\n'), /version mismatch/);
  assert.match(result.errors.map((error) => error.message).join('\n'), /earlier step/);

  const malformed = validatePlan([
    { id: 'sink-2', capability: sinkName, input: { userId: 42 } },
  ]);
  assert.equal(malformed.valid, false);
  assert.match(malformed.errors[0].message, /must be of type 'string'/);
});

test('default authorization allows reads and denies write and destructive capabilities', async () => {
  const readName = uniqueCapabilityName('default-read');
  const writeName = uniqueCapabilityName('default-write');
  const destructiveName = uniqueCapabilityName('default-destructive');
  let readExecutions = 0;
  let writeExecutions = 0;
  let destructiveExecutions = 0;

  registerCapability(readName, 'read', async () => {
    readExecutions += 1;
    return 'read result';
  });
  registerCapability(writeName, 'write', async () => {
    writeExecutions += 1;
    return 'write result';
  });
  registerCapability(destructiveName, 'destructive', async () => {
    destructiveExecutions += 1;
    return 'destructive result';
  });

  const runtime = new OperatorRuntime();
  const readJob = await runtime.executePlan(oneStepPlan(readName));
  const writeJob = await runtime.executePlan(oneStepPlan(writeName));
  const destructiveJob = await runtime.executePlan(oneStepPlan(destructiveName));

  assert.equal(readJob.status, 'completed');
  assert.equal(readExecutions, 1);
  assert.equal(writeJob.status, 'failed');
  assert.equal(destructiveJob.status, 'failed');
  assert.equal(writeExecutions, 0);
  assert.equal(destructiveExecutions, 0);

  for (const job of [writeJob, destructiveJob]) {
    const events = eventTypes(job);
    assert.ok(events.includes('capability.denied'));
    assert.ok(events.includes('job.failed'));
    assert.ok(!events.includes('capability.started'));
    assert.ok(!events.includes('capability.failed'));
  }
});

test('configured authorization can allow a write and explicitly deny a read', async () => {
  const allowedName = uniqueCapabilityName('configured-allow');
  const deniedName = uniqueCapabilityName('configured-deny');
  let allowedExecutions = 0;
  let deniedExecutions = 0;

  registerCapability(allowedName, 'write', async () => {
    allowedExecutions += 1;
    return 'allowed';
  });
  registerCapability(deniedName, 'read', async () => {
    deniedExecutions += 1;
    return 'denied';
  });

  const authorizer: ExecutionAuthorizer = {
    async authorize(context) {
      return context.capability.name === allowedName
        ? { decision: 'allow' }
        : { decision: 'deny', reason: 'test policy denied this capability' };
    },
  };
  const runtime = new OperatorRuntime({ authorizer });

  const allowedJob = await runtime.executePlan(oneStepPlan(allowedName));
  const deniedJob = await runtime.executePlan(oneStepPlan(deniedName));

  assert.equal(allowedJob.status, 'completed');
  assert.equal(allowedExecutions, 1);
  assert.equal(deniedJob.status, 'failed');
  assert.match(deniedJob.error ?? '', /test policy denied this capability/);
  assert.equal(deniedExecutions, 0);

  const events = eventTypes(deniedJob);
  assert.ok(events.includes('capability.denied'));
  assert.ok(events.includes('job.failed'));
  assert.ok(!events.includes('capability.started'));
  assert.ok(!events.includes('capability.failed'));
});

test('authorization receives the immutable caller and resolved, validated reference input', async () => {
  const source = uniqueCapabilityName('authorization-source');
  const sink = uniqueCapabilityName('authorization-sink');
  const caller: ExecutionCaller = {
    subject: 'authorizer-subject',
    tenant: 'authorizer-tenant',
    scopes: ['execute'],
    metadata: { requestId: 'authorization-request' },
  };
  const contexts: CapabilityAuthorizationContext[] = [];
  let sinkExecutions = 0;

  registerCapability(source, 'read', async () => ({ nested: { value: 'resolved' } }));
  registerCapability(
    sink,
    'read',
    async (input) => {
      sinkExecutions += 1;
      return input;
    },
    {
      value: { type: 'string', required: true, description: 'resolved value' },
    },
  );

  const runtime = new OperatorRuntime({
    authorizer: {
      authorize(context) {
        contexts.push(context);
        return Promise.resolve({ decision: 'allow' });
      },
    },
  });
  const job = await runtime.executePlan({
    version: '1.0',
    steps: [
      { id: 'source', capability: source, capabilityVersion: '1.0.0' },
      {
        id: 'sink',
        capability: sink,
        capabilityVersion: '1.0.0',
        input: { value: { $ref: 'steps.source.result.nested.value' } },
      },
    ],
  }, { caller });

  assert.equal(job.status, 'completed');
  assert.equal(sinkExecutions, 1);
  assert.equal(contexts.length, 2);
  const sinkContext = contexts.find(
    (context) => context.capability.name === sink,
  );
  assert.ok(sinkContext);
  assert.deepEqual(sinkContext.input, { value: 'resolved' });
  assert.deepEqual(sinkContext.caller, caller);
  assert.ok(Object.isFrozen(sinkContext.caller));
});

test('invalid resolved input skips authorization and execution for that step', async () => {
  const source = uniqueCapabilityName('invalid-input-source');
  const sink = uniqueCapabilityName('invalid-input-sink');
  let authorizationCalls = 0;
  let sourceExecutions = 0;
  let sinkExecutions = 0;

  registerCapability(source, 'read', async () => {
    sourceExecutions += 1;
    return { value: 42 };
  });
  registerCapability(
    sink,
    'read',
    async () => {
      sinkExecutions += 1;
      return 'unexpected';
    },
    {
      value: { type: 'string', required: true, description: 'required value' },
    },
  );

  const runtime = new OperatorRuntime({
    authorizer: {
      authorize() {
        authorizationCalls += 1;
        return Promise.resolve({ decision: 'allow' });
      },
    },
  });

  const job = await runtime.executePlan({
    version: '1.0',
    steps: [
      { id: 'source', capability: source, capabilityVersion: '1.0.0' },
      {
        id: 'sink',
        capability: sink,
        capabilityVersion: '1.0.0',
        input: { value: { $ref: 'steps.source.result.value' } },
      },
    ],
  });

  assert.equal(job.status, 'failed');
  assert.equal(sourceExecutions, 1);
  assert.equal(authorizationCalls, 1);
  assert.equal(sinkExecutions, 0);
  assert.ok(!job.events.some(
    (event) =>
      event.type === 'capability.started' &&
      event.data?.stepId === 'sink',
  ));
});

test('an authorizer error fails closed without execution, start, or denial events', async () => {
  const capability = uniqueCapabilityName('authorizer-throws');
  let executions = 0;

  registerCapability(capability, 'read', async () => {
    executions += 1;
    return 'unexpected';
  });

  const runtime = new OperatorRuntime({
    authorizer: {
      authorize() {
        throw new Error('authorizer unavailable');
      },
    },
  });
  const job = await runtime.executePlan(oneStepPlan(capability));

  assert.equal(job.status, 'failed');
  assert.match(job.error ?? '', /authorizer unavailable/);
  assert.equal(executions, 0);
  const events = eventTypes(job);
  assert.ok(events.includes('job.failed'));
  assert.ok(!events.includes('capability.started'));
  assert.ok(!events.includes('capability.denied'));
});

test('authorizers remain isolated between runtimes sharing the global capability registry', async () => {
  const capability = uniqueCapabilityName('runtime-isolation');
  let executions = 0;

  registerCapability(capability, 'write', async () => {
    executions += 1;
    return 'shared capability result';
  });

  const allowingRuntime = new OperatorRuntime({
    authorizer: { authorize: async () => ({ decision: 'allow' }) },
  });
  const denyingRuntime = new OperatorRuntime({
    authorizer: {
      authorize: async () => ({ decision: 'deny', reason: 'isolated denial' }),
    },
  });

  const allowedJob = await allowingRuntime.executePlan(oneStepPlan(capability));
  const deniedJob = await denyingRuntime.executePlan(oneStepPlan(capability));

  assert.equal(allowedJob.status, 'completed');
  assert.equal(deniedJob.status, 'failed');
  assert.equal(executions, 1);
  assert.ok(eventTypes(deniedJob).includes('capability.denied'));
  assert.ok(!eventTypes(allowedJob).includes('capability.denied'));
});
