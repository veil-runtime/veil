import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { OperatorRuntime, type Capability, type Job, createCapability } from '../src/index.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { ConsoleExecutionLogger } from '../src/runtime/execution/console-execution-logger.js';
import { CompositeLogSink } from '../src/runtime/logging/composite-log-sink.js';
import { SQLiteJobStore } from '../src/providers/storage/sqlite-job-store.js';
import { httpRequestCapability } from '../src/capabilities/http/request.js';
import { httpProvider } from '../src/providers/http/fetch-http-provider.js';
import type { HttpRequestOptions } from '../src/providers/http/http-provider.js';

// Characterization of current gaps, not a contract that these gaps must persist.
// Revisit with an accepted value-ownership ADR. All providers below are inert.
type Value = { targets: Array<{ environment: string }> };
const initial = (): Value => ({ targets: [{ environment: 'staging' }] });
const snapshot = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
function register(runtime: OperatorRuntime, execute: Capability['execute'], inputSchema?: Capability['inputSchema']) {
  const name = `ownership.${randomUUID()}`;
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', risk: 'write', description: 'Inert ownership fixture', inputSchema, execute,
  }] });
  return name;
}
const plan = (capability: string, input: unknown) => ({ version: '1.0', steps: [{ id: 'step', capability, input }] });

test('control: literal nested caller values are detached by resolution, though job input remains aliased', async () => {
  const submitted = initial();
  const entered = gate();
  const resume = gate();
  let authorized: unknown;
  let consumed: unknown;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    authorized = snapshot(input);
    assert.notEqual(input, submitted);
    assert.notEqual((input as Value).targets, submitted.targets);
    return { decision: 'allow' };
  } } });
  const name = register(runtime, async input => {
    entered.release();
    await resume.promise; // A real capability async boundary, no timing assumptions.
    consumed = snapshot(input);
  });
  const pending = runtime.executePlan(plan(name, submitted));
  await entered.promise;
  submitted.targets[0].environment = 'production';
  resume.release();
  const job = await pending;
  assert.deepEqual(authorized, initial());
  assert.deepEqual(consumed, initial());
  assert.equal(job.steps[0].input, submitted);
  assert.equal((job.steps[0].input as Value).targets[0].environment, 'production');
});

test('A/F: retained authorization input can mutate nested values while capability awaits provider dispatch', async () => {
  const entered = gate();
  const resume = gate();
  let retained!: Value;
  let authorized: unknown;
  let consumed: unknown;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    retained = input as Value;
    authorized = snapshot(input);
    return { decision: 'allow' };
  } } });
  const name = register(runtime, async input => {
    assert.equal(input, retained);
    entered.release();
    await resume.promise;
    consumed = snapshot(input); // Inert provider consumption.
  });
  const pending = runtime.executePlan(plan(name, initial()));
  await entered.promise; // Explicit allow has returned and invocation has begun.
  retained.targets[0].environment = 'production';
  retained.targets.push({ environment: 'other-tenant' });
  resume.release();
  assert.equal((await pending).status, 'completed');
  assert.deepEqual(authorized, initial());
  assert.deepEqual(consumed, { targets: [{ environment: 'production' }, { environment: 'other-tenant' }] });
});

test('B/F: completed result remains producer-owned and aliased into a later authorized invocation', async () => {
  const produced = initial();
  const entered = gate();
  const resume = gate();
  let authorized: unknown;
  let consumed: unknown;
  let consumer = '';
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ capability, input }) {
    if (capability.name === consumer) {
      assert.equal((input as { value: Value }).value, produced);
      authorized = snapshot(input);
    }
    return { decision: 'allow' };
  } } });
  const source = register(runtime, async () => produced);
  consumer = register(runtime, async input => {
    entered.release();
    await resume.promise;
    consumed = snapshot(input);
  });
  const pending = runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'consumer', capability: consumer, input: { value: { $ref: 'steps.source.result' } } },
  ] });
  await entered.promise;
  produced.targets[0].environment = 'production';
  resume.release();
  const job = await pending;
  assert.deepEqual(authorized, { value: initial() });
  assert.deepEqual(consumed, { value: produced });
  assert.equal(job.steps[0].status, 'completed');
  assert.equal(job.steps[0].result, produced);
  assert.equal(((await runtime.getJob(job.id))!.steps[0].result as Value).targets[0].environment, 'production');
});

test('B/E: synchronous started subscriber changes a retained result between allow and capability entry', async t => {
  const produced = initial();
  let authorized: unknown;
  let atEntry: unknown;
  let consumer = '';
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ capability, input }) {
    if (capability.name === consumer) authorized = snapshot(input);
    return { decision: 'allow' };
  } } });
  const source = register(runtime, async () => produced);
  consumer = register(runtime, async input => { atEntry = snapshot(input); });
  t.after(runtimeEventBus.subscribe('capability.started', event => {
    if (event.data?.capability === consumer) produced.targets[0].environment = 'production';
  }));
  await runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'consumer', capability: consumer, input: { value: { $ref: 'steps.source.result' } } },
  ] });
  assert.deepEqual(authorized, { value: initial() });
  assert.deepEqual(atEntry, { value: { targets: [{ environment: 'production' }] } });
});

test('C: authorizer can change a validated field to a schema-invalid value consumed by execution', async () => {
  let authorized: unknown;
  let consumed: unknown;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    authorized = snapshot(input);
    (input as { environment: unknown }).environment = 42;
    return { decision: 'allow' };
  } } });
  const name = register(runtime, async input => { consumed = snapshot(input); }, {
    environment: { type: 'string', required: true, description: 'Environment' },
  });
  assert.equal((await runtime.executePlan(plan(name, { environment: 'staging' }))).status, 'completed');
  assert.deepEqual(authorized, { environment: 'staging' });
  assert.deepEqual(consumed, { environment: 42 });
});

test('D: capability can mutate input and independently reconstruct a different provider request', async () => {
  let authorized: unknown;
  let atEntry: unknown;
  let providerRequest: unknown;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    authorized = snapshot(input);
    return { decision: 'allow' };
  } } });
  const name = register(runtime, async input => {
    atEntry = snapshot(input);
    (input as Value).targets[0].environment = 'production';
    providerRequest = { operation: 'delete', target: (input as Value).targets[0].environment };
  });
  await runtime.executePlan(plan(name, initial()));
  assert.deepEqual(atEntry, authorized);
  assert.deepEqual(authorized, initial());
  assert.deepEqual(providerRequest, { operation: 'delete', target: 'production' });
});

test('provider mapping: actual HTTP capability normalizes method/URL but retains nested body identity', async t => {
  let authorized!: { method: string; url: string; body: unknown };
  let consumed!: HttpRequestOptions;
  t.mock.method(httpProvider, 'request', async (options: HttpRequestOptions) => {
    consumed = options;
    return { status: 200, headers: {}, body: {}, url: options.url };
  });
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    authorized = input as typeof authorized;
    return { decision: 'allow' };
  } } });
  runtime.use({ manifest: { name: 'ownership.http', version: '1', capabilities: ['http.request'] },
    capabilities: [httpRequestCapability] });
  const job = await runtime.executePlan(plan('http.request', {
    method: 'get', url: 'https://example.com', body: { nested: { value: 'original' } },
  }));
  assert.equal(job.status, 'completed');
  assert.equal(authorized.method, 'get');
  assert.equal(consumed.method, 'GET');
  assert.equal(authorized.url, 'https://example.com');
  assert.equal(consumed.url, 'https://example.com/');
  assert.equal(consumed.body, authorized.body);
  assert.notEqual(consumed, authorized);
});

test('E: started subscriber can use public memory job lookup to mutate a referenced result before provider use', async t => {
  const callbackDone = gate();
  let authorized: unknown;
  let consumed: unknown;
  let subscriberError: unknown;
  let consumer = '';
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ capability, input }) {
    if (capability.name === consumer) authorized = snapshot(input);
    return { decision: 'allow' };
  } } });
  const source = register(runtime, async () => initial());
  consumer = register(runtime, async input => {
    await callbackDone.promise; // Lets the actual async job lookup finish.
    consumed = snapshot(input);
  });
  t.after(runtimeEventBus.subscribe('capability.started', async event => {
    if (event.data?.capability !== consumer) return;
    try {
      assert.deepEqual(Object.keys(event.data).sort(), ['capability', 'stepId']);
      const job = await runtime.getJob(event.jobId!);
      (job!.steps[0].result as Value).targets[0].environment = 'production';
    } catch (error) { subscriberError = error; }
    finally { callbackDone.release(); }
  }));
  await runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'consumer', capability: consumer, input: { value: { $ref: 'steps.source.result' } } },
  ] });
  assert.equal(subscriberError, undefined);
  assert.deepEqual(authorized, { value: initial() });
  assert.deepEqual(consumed, { value: { targets: [{ environment: 'production' }] } });
});

test('E: event data aliases job history but ordinary event payloads do not directly expose execution input', async t => {
  const runtime = new OperatorRuntime();
  const name = register(runtime, async () => { assert.fail('Default policy denies this write'); });
  t.after(runtimeEventBus.subscribe('capability.denied', event => {
    if (event.data?.capability === name) event.data.reason = 'subscriber rewrite';
  }));
  const job = await runtime.executePlan(plan(name, initial()));
  assert.match(job.error!, /requires explicit approval/);
  assert.equal(job.events.find(event => event.type === 'capability.denied')!.data!.reason, 'subscriber rewrite');
  assert.ok(!job.events.some(event => event.type === 'capability.started'));
});

test('E: SDK middleware can replace the input after runtime authorization', async () => {
  let authorized: unknown;
  let consumed: unknown;
  const name = `ownership.sdk.${randomUUID()}`;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    authorized = snapshot(input);
    return { decision: 'allow' };
  } } });
  const capability = createCapability<Value, void>({ name, version: '1', risk: 'write', description: 'Middleware fixture',
    lifecycleLogging: false,
    middleware: [{ async execute(execution, next) {
      execution.input = { targets: [{ environment: 'production' }] };
      return next();
    } }],
    async execute({ input }) { consumed = snapshot(input); },
  });
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [capability] });
  await runtime.executePlan(plan(name, initial()));
  assert.deepEqual(authorized, initial());
  assert.deepEqual(consumed, { targets: [{ environment: 'production' }] });
});

test('E: logging retains nested metadata references shared with the provider input', async () => {
  const logged = gate();
  const resume = gate();
  let metadata: Record<string, unknown> | undefined;
  let authorized: unknown;
  let consumed: unknown;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    authorized = snapshot(input);
    return { decision: 'allow' };
  } } });
  const name = register(runtime, async (input, context) => {
    // Actual logger/sink implementations, with an inert host sink retaining metadata.
    const logger = new ConsoleExecutionLogger(context!.jobId, context!.stepId, new CompositeLogSink([{
      write(entry) { metadata = entry.metadata; logged.release(); },
    }]));
    logger.info('Input', { value: input });
    await resume.promise;
    consumed = snapshot(input);
  });
  const pending = runtime.executePlan(plan(name, initial()));
  await logged.promise;
  (metadata!.value as Value).targets[0].environment = 'production';
  resume.release();
  await pending;
  assert.deepEqual(authorized, initial());
  assert.deepEqual(consumed, { targets: [{ environment: 'production' }] });
});

test('value domain: literal resolution normalizes typed objects while referenced results retain them', async () => {
  const date = new Date('2026-01-01T00:00:00Z');
  const bytes = Buffer.from([1, 2]);
  class Custom { own = 'value'; }
  const instance = new Custom();
  const fn = () => 'value';
  const values = { date, bytes, instance, fn, missing: undefined, bigint: 1n };
  let observed: unknown;
  const runtime = new OperatorRuntime({ authorizer: { async authorize({ input }) {
    observed = input;
    return { decision: 'allow' };
  } } });
  const sink = register(runtime, async input => input);
  await runtime.executePlan(plan(sink, values));
  const literal = observed as typeof values;
  assert.deepEqual(literal.date, {});
  assert.deepEqual(literal.bytes, { 0: 1, 1: 2 });
  assert.equal(Object.getPrototypeOf(literal.instance), Object.prototype);
  assert.equal(literal.fn, fn);
  assert.ok(Object.hasOwn(literal, 'missing'));
  assert.equal(literal.bigint, 1n);
  const source = register(runtime, async () => values);
  const job = await runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'sink', capability: sink, input: { value: { $ref: 'steps.source.result' } } },
  ] });
  assert.equal((observed as { value: unknown }).value, values);
  assert.equal(job.steps[0].result, values);
});

test('value domain: cyclic literal input fails admission but cyclic referenced results reach authorization', async () => {
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  let authorizations = 0;
  const runtime = new OperatorRuntime({ authorizer: { async authorize() {
    authorizations += 1;
    return { decision: 'allow' };
  } } });
  const source = register(runtime, async () => cycle);
  const sink = register(runtime, async input => input);
  await assert.rejects(runtime.executePlan(plan(sink, cycle)), /call stack/i);
  assert.equal(authorizations, 0);
  const job = await runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'sink', capability: sink, input: { value: { $ref: 'steps.source.result' } } },
  ] });
  assert.equal(job.status, 'completed');
  assert.equal(authorizations, 2);
  assert.equal((job.steps[1].result as { value: unknown }).value, cycle);
});

test('value domain: SQLite JSON round trips differ from live memory jobs and reject bigint/cycles', async () => {
  const sqlite = new SQLiteJobStore(':memory:');
  const result = { date: new Date('2026-01-01T00:00:00Z'), missing: undefined, fn() {}, nan: NaN,
    bytes: Buffer.from([1]), items: [undefined] };
  const job: Job = { id: randomUUID(), goal: 'Fixture', status: 'completed', steps: [], events: [],
    createdAt: 'now', updatedAt: 'now', result };
  await sqlite.create(job);
  const loaded = await sqlite.get(job.id);
  assert.notEqual(loaded, job);
  assert.deepEqual(loaded!.result, { date: '2026-01-01T00:00:00.000Z', nan: null,
    bytes: { type: 'Buffer', data: [1] }, items: [null] });
  await assert.rejects(sqlite.create({ ...job, id: randomUUID(), result: 1n }), /BigInt/i);
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  await assert.rejects(sqlite.create({ ...job, id: randomUUID(), result: cycle }), /circular/i);
});
