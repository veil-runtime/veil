import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlanAdmissionError, OperatorRuntime, type ExecutionPlan } from '../src/index.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { captureGovernedValue, GovernedValueError } from '../src/runtime/execution/governed-value.js';

let capabilityNumber = 0;

function runtime(authorize: (input: unknown) => Promise<void> | void) {
  const capabilityName = `test.governed-v2.echo-${capabilityNumber++}`;
  const instance = new OperatorRuntime({
    planVersions: ['2.0'],
    authorizer: {
      async authorize(context) {
        await authorize(context.input);
        return { decision: 'allow' };
      },
    },
  });
  let entered: unknown;
  instance.use({
    manifest: { name: capabilityName, version: '1', capabilities: [capabilityName] },
    capabilities: [{
      name: capabilityName,
      version: '1',
      risk: 'read',
      description: 'governed value fixture',
      async execute(input) {
        entered = input;
        return input;
      },
    }],
  });
  return { instance, get entered() { return entered; } };
}

function plan(input: unknown, capabilityName = `test.governed-v2.echo-${Math.max(0, capabilityNumber - 1)}`): ExecutionPlan {
  return { version: '2.0', steps: [{ id: 'echo', capability: capabilityName, input }] };
}

test('v2 gives authorization a frozen view and capability a detached equivalent', async () => {
  let authorizationInput: any;
  const fixture = runtime(input => { authorizationInput = input; });
  const source = { nested: { value: 1 } };
  const job = await fixture.instance.executePlan(plan(source));
  assert.equal(job.status, 'completed');
  assert.ok(Object.isFrozen(authorizationInput));
  assert.ok(Object.isFrozen(authorizationInput.nested));
  assert.notEqual(authorizationInput, fixture.entered);
  assert.notEqual(authorizationInput.nested, (fixture.entered as any).nested);
  assert.deepEqual(fixture.entered, { nested: { value: 1 } });
  source.nested.value = 7;
  assert.equal((fixture.entered as any).nested.value, 1);
});

test('v2 constructs capability input after allow and before the running/start transition', async t => {
  const capabilityName = `test.governed-v2.order-${capabilityNumber++}`;
  const order: string[] = [];
  const originalGetPrototypeOf = Object.getPrototypeOf;
  t.after(() => { Object.getPrototypeOf = originalGetPrototypeOf; });

  const instance = new OperatorRuntime({
    planVersions: ['2.0'],
    authorizer: {
      async authorize({ caller }) {
        order.push('authorize');
        assert.equal(caller?.subject, 'host-user');
        assert.deepEqual(caller?.scopes, ['capability:execute']);
        Object.getPrototypeOf = value => {
          order.push('copy');
          return originalGetPrototypeOf(value);
        };
        return { decision: 'allow' };
      },
    },
  });
  instance.use({
    manifest: { name: capabilityName, version: '1', capabilities: [capabilityName] },
    capabilities: [{
      name: capabilityName,
      version: '1',
      risk: 'read',
      description: 'v2 ordering fixture',
      async execute() {
        order.push('execute');
        return { effected: true };
      },
    }],
  });
  t.after(runtimeEventBus.subscribe('capability.started', event => {
    if (event.data?.capability === capabilityName) order.push('started');
  }));

  const job = await instance.executePlan({
    version: '2.0',
    steps: [{ id: 'ordered', capability: capabilityName, input: { value: 'ok' } }],
  }, { caller: { subject: 'host-user', scopes: ['capability:execute'] } });

  Object.getPrototypeOf = originalGetPrototypeOf;
  assert.equal(job.status, 'completed');
  assert.deepEqual(order, ['authorize', 'copy', 'started', 'execute']);
  assert.ok(job.steps[0].startedAt);
  assert.ok(job.events.some(event => event.type === 'capability.started'));
});

test('v2 capability-copy failure after allow has no running/start transition or effect', async t => {
  const capabilityName = `test.governed-v2.copy-failure-${capabilityNumber++}`;
  const copyFailure = new Error('detached capability copy failed');
  const originalGetPrototypeOf = Object.getPrototypeOf;
  t.after(() => { Object.getPrototypeOf = originalGetPrototypeOf; });
  let authorizations = 0;
  let decisionReads = 0;
  let invocations = 0;
  let effects = 0;

  const instance = new OperatorRuntime({
    planVersions: ['2.0'],
    authorizer: {
      async authorize({ caller }) {
        authorizations += 1;
        assert.equal(caller?.subject, 'host-user');
        assert.deepEqual(caller?.scopes, ['capability:execute']);
        return Object.defineProperty({}, 'decision', {
          enumerable: true,
          get() {
            decisionReads += 1;
            Object.getPrototypeOf = () => {
              Object.getPrototypeOf = originalGetPrototypeOf;
              throw copyFailure;
            };
            return 'allow';
          },
        }) as { decision: 'allow' };
      },
    },
  });
  instance.use({
    manifest: { name: capabilityName, version: '1', capabilities: [capabilityName] },
    capabilities: [{
      name: capabilityName,
      version: '1',
      risk: 'read',
      description: 'v2 copy-failure fixture',
      async execute() {
        invocations += 1;
        effects += 1;
      },
    }],
  });

  const job = await instance.executePlan({
    version: '2.0',
    steps: [{
      id: 'copy-failure',
      capability: capabilityName,
      input: {
        value: 'supported',
        caller: { subject: 'forged' },
        scopes: ['*'],
      },
    }],
  }, { caller: { subject: 'host-user', scopes: ['capability:execute'] } });

  Object.getPrototypeOf = originalGetPrototypeOf;
  assert.equal(authorizations, 1);
  assert.equal(decisionReads, 1);
  assert.equal(invocations, 0);
  assert.equal(effects, 0);
  assert.equal(job.status, 'failed');
  assert.equal(job.steps[0].status, 'failed');
  assert.equal(job.steps[0].startedAt, undefined);
  assert.equal(job.steps[0].error, copyFailure.message);
  // The job-wide execution envelope starts before step processing; it is not a
  // capability running/start transition.
  assert.ok(job.events.some(event => event.type === 'execution.started'));
  assert.ok(job.events.some(event => event.type === 'capability.failed'));
  assert.ok(job.events.some(event => event.type === 'job.failed'));
  assert.ok(!job.events.some(event => event.type === 'capability.started'));
});

test('v1 retains allow then start/execute without a governed capability copy', async t => {
  const capabilityName = `test.governed-v2.v1-order-${capabilityNumber++}`;
  const originalGetPrototypeOf = Object.getPrototypeOf;
  t.after(() => { Object.getPrototypeOf = originalGetPrototypeOf; });
  let invocations = 0;

  const instance = new OperatorRuntime({
    planVersions: ['1.0', '2.0'],
    authorizer: {
      async authorize({ caller }) {
        assert.equal(caller?.subject, 'host-user');
        Object.getPrototypeOf = () => {
          Object.getPrototypeOf = originalGetPrototypeOf;
          throw new Error('v1 must not copy after authorization');
        };
        return { decision: 'allow' };
      },
    },
  });
  instance.use({
    manifest: { name: capabilityName, version: '1', capabilities: [capabilityName] },
    capabilities: [{
      name: capabilityName,
      version: '1',
      risk: 'read',
      description: 'v1 ordering fixture',
      async execute() {
        Object.getPrototypeOf = originalGetPrototypeOf;
        invocations += 1;
        return { effected: true };
      },
    }],
  });

  const job = await instance.executePlan({
    version: '1.0',
    steps: [{ id: 'legacy', capability: capabilityName, input: { value: 'legacy' } }],
  }, { caller: { subject: 'host-user', scopes: ['capability:execute'] } });

  Object.getPrototypeOf = originalGetPrototypeOf;
  assert.equal(job.status, 'completed');
  assert.equal(invocations, 1);
  assert.ok(job.steps[0].startedAt);
  assert.ok(job.events.some(event => event.type === 'capability.started'));
});

test('v2 preserves aliases within each owned representation', async () => {
  const shared = { value: 1 };
  const captured: any = captureGovernedValue({ left: shared, right: shared });
  assert.equal(captured.left, captured.right);
});

test('v2 rejects unsupported representations before authorization and invocation', async () => {
  let authorized = 0;
  const fixture = runtime(() => { authorized += 1; });
  const job = await fixture.instance.executePlan(plan(Symbol('unsupported')));
  assert.equal(job.status, 'failed');
  assert.equal(authorized, 0);
  assert.equal(fixture.entered, undefined);
  assert.match(job.error ?? '', /supported governed representation/);
});

test('passive capture accepts visible representation while ignoring hidden/private state', () => {
  class PrivateValue {
    #hidden = 9;
    value = 1;
  }
  const source = new PrivateValue();
  Object.setPrototypeOf(source, Object.prototype);
  assert.deepEqual(captureGovernedValue(source), { value: 1 });
});

test('passive capture rejects cycles, sparse arrays, symbols, functions and proxies', () => {
  const cycle: any = {};
  cycle.self = cycle;
  assert.throws(() => captureGovernedValue(cycle), GovernedValueError);
  const sparse: any[] = [];
  sparse.length = 1;
  assert.throws(() => captureGovernedValue(sparse), GovernedValueError);
  assert.throws(() => captureGovernedValue(Symbol('x')), GovernedValueError);
  assert.throws(() => captureGovernedValue(() => undefined), GovernedValueError);
  assert.throws(() => captureGovernedValue(new Proxy({}, { ownKeys() { throw new Error('trap'); } })), GovernedValueError);
  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('getter invoked'); } });
  assert.throws(() => captureGovernedValue(accessor), GovernedValueError);
});

test('v2 requires explicit host opt-in and v1 remains the default', async () => {
  const fixture = runtime(() => undefined);
  const legacy = new OperatorRuntime({ authorizer: { async authorize() { return { decision: 'allow' }; } } });
  await assert.rejects(() => legacy.executePlan(plan({ value: 1 })), /expected '1.0'/);
  assert.equal((await fixture.instance.executePlan(plan({ value: 1 }))).status, 'completed');
});

test('one host can explicitly run v1 and v2 without semantic leakage', async () => {
  const name = `test.governed-v2.coexist-${capabilityNumber++}`;
  const seen: unknown[] = [];
  const instance = new OperatorRuntime({
    planVersions: ['1.0', '2.0'],
    authorizer: { async authorize(context) { seen.push(context.input); return { decision: 'allow' }; } },
  });
  instance.use({
    manifest: { name, version: '1', capabilities: [name] },
    capabilities: [{ name, version: '1', risk: 'read', description: 'coexistence', async execute(input) { return input; } }],
  });
  const source = { value: 1 };
  const v1 = await instance.executePlan({ version: '1.0', steps: [{ id: 'v1', capability: name, input: source }] });
  const v2 = await instance.executePlan({ version: '2.0', steps: [{ id: 'v2', capability: name, input: source }] });
  assert.equal(v1.status, 'completed');
  assert.equal(v2.status, 'completed');
  assert.equal(seen.length, 2);
  assert.equal(Object.isFrozen(seen[0]), false);
  assert.notEqual(seen[1], source);
  assert.ok(Object.isFrozen(seen[1]));
});

test('exact result-reference wrappers preserve v1 and v2 resolution and parser diagnostics', async () => {
  const source = `test.governed-v2.reference-source-${capabilityNumber++}`;
  const sink = `test.governed-v2.reference-sink-${capabilityNumber++}`;
  const instance = new OperatorRuntime({
    planVersions: ['1.0', '2.0'],
    authorizer: { async authorize() { return { decision: 'allow' }; } },
  });
  instance.use({
    manifest: { name: sink, version: '1', capabilities: [source, sink] },
    capabilities: [
      {
        name: source,
        version: '1',
        risk: 'read',
        description: 'reference source',
        async execute() {
          return { value: 'resolved' };
        },
      },
      {
        name: sink,
        version: '1',
        risk: 'read',
        description: 'reference sink',
        inputSchema: { value: { type: 'string', required: true, description: 'value' } },
        async execute(input) {
          return input;
        },
      },
    ],
  });

  for (const version of ['1.0', '2.0']) {
    const job = await instance.executePlan({ version, steps: [
      { id: 'source', capability: source },
      {
        id: 'sink',
        capability: sink,
        input: { value: { $ref: 'steps.source.result.value' } },
      },
    ] });
    assert.equal(job.status, 'completed');
    assert.deepEqual(job.steps[1].result, { value: 'resolved' });

    await assert.rejects(instance.executePlan({ version, steps: [{
      id: 'sink',
      capability: sink,
      input: { value: { $ref: 'not-a-result-reference' } },
    }] }), error => {
      assert.ok(isPlanAdmissionError(error));
      assert.deepEqual(error.issues, [{
        code: 'INVALID_RESULT_REFERENCE',
        message: 'A result reference was not accepted by the admission parser.',
        stepIndex: 0,
      }]);
      return true;
    });
  }
});
