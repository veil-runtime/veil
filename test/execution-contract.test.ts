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
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';

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

for (const fails of [false, true]) {
  test(`observer failures preserve capability ${fails ? 'failure' : 'success'} and lifecycle history`, async () => {
    const capability = uniqueCapabilityName(`observer-${fails}`);
    registerCapability(capability, 'read', async () => {
      if (fails) throw new Error('genuine capability failure');
      return { value: 'successful result' };
    });
    const baseline = await new OperatorRuntime().executePlan(oneStepPlan(capability));
    const unsubscribeReject = runtimeEventBus.subscribe('*', () =>
      Promise.reject(new Error('observer rejected')));
    const unsubscribeThrow = runtimeEventBus.subscribe('*', () => {
      throw new Error('observer threw');
    });
    const observed: { id: string; jobId?: string }[] = [];
    const unsubscribeObserver = runtimeEventBus.subscribe('*', (event) => {
      observed.push({ id: event.id, jobId: event.jobId });
    });
    try {
      const job = await new OperatorRuntime().executePlan(oneStepPlan(capability));
      assert.equal(job.status, fails ? 'failed' : 'completed');
      assert.equal(job.steps[0].status, fails ? 'failed' : 'completed');
      if (fails) {
        assert.match(job.error ?? '', /genuine capability failure/);
      } else {
        assert.deepEqual(job.steps[0].result, { value: 'successful result' });
      }
      const types = eventTypes(job);
      assert.deepEqual(types, eventTypes(baseline));
      for (const type of [
        'job.created', 'capability.started',
        fails ? 'capability.failed' : 'capability.completed',
        fails ? 'job.failed' : 'job.completed',
      ]) {
        assert.ok(types.includes(type), `missing retained event: ${type}`);
      }
      assert.ok(!types.includes(fails ? 'job.completed' : 'job.failed'));
      assert.deepEqual(
        observed.filter((event) => event.jobId === job.id).map((event) => event.id),
        job.events.map((event) => event.id),
      );
    } finally {
      unsubscribeReject();
      unsubscribeThrow();
      unsubscribeObserver();
    }
  });
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

for (const [label, version, accepted] of [
  ['omitted', undefined, true],
  ['matching', '1.0.0', true],
  ['empty', '', false],
  ['mismatching', '2.0.0', false],
] as const) {
  test(`capability version validation: ${label}`, async () => {
    const capability = uniqueCapabilityName(`version-${label}`);
    let executions = 0;
    registerCapability(capability, 'read', async () => {
      executions += 1;
      return 'executed';
    });
    const step = {
      id: 'step',
      capability,
      ...(version === undefined ? {} : { capabilityVersion: version }),
    };
    const validation = validatePlan([step]);
    assert.deepEqual(validation, accepted
      ? { valid: true, errors: [] }
      : {
        valid: false,
        errors: [{
          stepId: 'step',
          capability,
          message: `Capability version mismatch for '${capability}': requested ${version}, registered 1.0.0`,
        }],
      });

    const execute = () => new OperatorRuntime().executePlan({ version: '1.0', steps: [step] });
    if (accepted) {
      assert.equal((await execute()).status, 'completed');
    } else {
      await assert.rejects(execute, {
        message: `Execution plan failed validation: ${validation.errors[0].message}`,
      });
    }
    assert.equal(executions, accepted ? 1 : 0);
  });
}

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

const malformedAuthorizationResponses: [string, unknown][] = [
  ['missing decision', {}],
  ['unknown decision', { decision: 'unexpected' }],
  ['undefined decision', { decision: undefined }],
  ['null', null],
  ['undefined', undefined],
  ['string', 'allow'],
  ['number', 1],
  ['boolean', true],
  ['bigint', 1n],
  ['symbol', Symbol('allow')],
  ['array', []],
  ['array with allow', Object.assign([], { decision: 'allow' })],
  ['function with allow', Object.assign(() => {}, { decision: 'allow' })],
  ['inherited allow', Object.create({ decision: 'allow' })],
  ['inherited deny', Object.create({ decision: 'deny' })],
  ['null prototype without decision', Object.create(null)],
  ['shadowed own-property method', { hasOwnProperty: () => true }],
  ['proxy synthesizing allow without own decision', new Proxy({}, {
    get: () => 'allow',
  })],
  ...[123, null, {}, [], true, 1n, Symbol('reason'), () => {}, new String('reason')]
    .flatMap((reason): [string, unknown][] => [
      [`own non-string reason ${String(reason)}`, { decision: 'deny', reason }],
      [`inherited non-string reason ${String(reason)}`,
        Object.assign(Object.create({ reason }), { decision: 'deny' })],
    ]),
];

for (const [label, response] of malformedAuthorizationResponses) {
  test(`malformed authorization (${label}) fails closed and stops subsequent steps`, async () => {
    await assertAuthorizationFailure(
      // Simulate untyped JavaScript policy implementations at the runtime boundary.
      { authorize: async () => response } as ExecutionAuthorizer,
      'Invalid authorization decision',
    );
  });
}

for (const rejects of [false, true]) {
  test(`authorization ${rejects ? 'rejection' : 'throw'} fails closed and stops subsequent steps`, async () => {
    await assertAuthorizationFailure({
      authorize() {
        const error = new Error('authorizer unavailable');
        if (rejects) return Promise.reject(error);
        throw error;
      },
    }, 'authorizer unavailable');
  });
}

for (const property of ['decision', 'reason']) {
  for (const inherited of [false, true]) {
    test(`throwing ${inherited ? 'inherited' : 'own'} ${property} accessor fails closed`, async () => {
      const response = Object.defineProperty({}, property, {
        get() { throw new Error('authorization accessor failed'); },
      });
      const authorization = inherited ? Object.create(response) : response;
      if (property === 'reason') authorization.decision = 'deny';
      await assertAuthorizationFailure({ authorize: async () => authorization },
        inherited && property === 'decision'
          ? 'Invalid authorization decision' : 'authorization accessor failed');
    });
  }
}

for (const reason of [undefined, '', 'policy denial']) {
  for (const shape of ['own', 'inherited', 'null prototype']) {
    test(`valid deny preserves ${shape} reason ${String(reason)}`, async () => {
      const capability = uniqueCapabilityName('valid-deny');
      let executions = 0;
      registerCapability(capability, 'read', async () => { executions += 1; });
      const response = shape === 'inherited'
        ? Object.assign(Object.create({ reason }), { decision: 'deny' })
        : Object.assign(shape === 'null prototype' ? Object.create(null) : {},
          { decision: 'deny', reason });
      const job = await new OperatorRuntime({
        authorizer: { authorize: async () => response },
      }).executePlan(oneStepPlan(capability));
      assert.equal(executions, 0);
      assert.equal(job.status, 'failed');
      assert.equal(job.steps[0].error, reason ?? `Capability not permitted: ${capability}`);
      assert.equal(job.events.find(event => event.type === 'capability.denied')?.data?.reason, reason);
      assert.ok(eventTypes(job).includes('capability.denied'));
      assert.ok(!eventTypes(job).includes('capability.failed'));
      assert.ok(!eventTypes(job).includes('capability.started'));
    });
  }
}

test('deny reason accessor is read once before error and event use', async () => {
  const capability = uniqueCapabilityName('reason-accessor');
  registerCapability(capability, 'read', async () => assert.fail('must not execute'));
  let reads = 0;
  const job = await new OperatorRuntime({ authorizer: { authorize: async () => ({
    decision: 'deny',
    get reason() {
      if (++reads > 1) throw new Error('reason read again');
      return 'stable denial';
    },
  }) } }).executePlan(oneStepPlan(capability));
  assert.equal(reads, 1);
  assert.equal(job.steps[0].error, 'stable denial');
  assert.equal(job.events.find(event => event.type === 'capability.denied')?.data?.reason, 'stable denial');
});

test('own allow works with null prototype and shadowed hasOwnProperty', async () => {
  const capability = uniqueCapabilityName('own-allow');
  let executions = 0;
  registerCapability(capability, 'read', async () => { executions += 1; });
  const response = Object.assign(Object.create(null), {
    decision: 'allow', hasOwnProperty: null,
  });
  Object.defineProperty(response, 'reason', {
    get() { throw new Error('allow must not read deny reason'); },
  });
  const job = await new OperatorRuntime({
    authorizer: { authorize: async () => response },
  }).executePlan(oneStepPlan(capability));
  assert.equal(executions, 1);
  assert.equal(job.status, 'completed');
});

test('own decision accessor is read once and cannot change a denial to allow', async () => {
  let reads = 0;
  await assertAuthorizationFailure({ authorize: async () => ({
    get decision() { return ++reads === 1 ? 'unexpected' : 'allow'; },
  }) } as ExecutionAuthorizer, 'Invalid authorization decision');
  assert.equal(reads, 1);
});

test('throwing own-property proxy trap fails closed', async () => {
  await assertAuthorizationFailure({ authorize: async () => new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error('authorization shape failed'); },
    get: () => 'allow',
  }) } as unknown as ExecutionAuthorizer, 'authorization shape failed');
});

async function assertAuthorizationFailure(
  authorizer: ExecutionAuthorizer,
  message: string,
): Promise<void> {
  const capability = uniqueCapabilityName('authorization-failure');
  let executions = 0;
  let authorizationCalls = 0;
  registerCapability(capability, 'read', async () => {
    executions += 1;
    return 'unexpected';
  });
  const runtime = new OperatorRuntime({
    authorizer: {
      authorize(context) {
        authorizationCalls += 1;
        return authorizer.authorize(context);
      },
    },
  });
  const step = oneStepPlan(capability).steps[0];
  const job = await runtime.executePlan({
    version: '1.0',
    steps: [step, { ...step, id: 'subsequent' }],
  });

  assert.equal(executions, 0);
  assert.equal(authorizationCalls, 1);
  assert.equal(job.status, 'failed');
  assert.equal(job.outcome, 'failed');
  assert.equal(job.error, message);
  assert.ok(job.completedAt);
  assert.equal(job.steps[0].status, 'failed');
  assert.equal(job.steps[0].error, message);
  assert.ok(job.steps[0].completedAt);
  assert.equal(job.steps[0].startedAt, undefined);
  assert.equal(job.steps[1].status, 'pending');
  assert.equal(job.steps[1].startedAt, undefined);
  assert.equal(job.steps[1].completedAt, undefined);
  assert.deepEqual(eventTypes(job), [
    'job.created', 'execution.started', 'capability.failed', 'job.failed',
  ]);
  assert.deepEqual(job.events.find(event => event.type === 'capability.failed')?.data, {
    stepId: step.id,
    capability,
    error: message,
  });
}

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
