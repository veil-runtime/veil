import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { OperatorRuntime, isPlanAdmissionError, type ExecutionPlan, type PlanAdmissionError, type Job } from '../src/index.js';
import { issuePlanAdmissionError } from '../src/runtime/execution/plan-admission-error.js';
import { jobManager } from '../src/runtime/jobs/job-manager.js';
import { jobStore } from '../src/runtime/jobs/job-store.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { capabilityRegistry } from '../src/runtime/registry/registry.js';

let invoked = 0;
const name = 'test.admission.echo';
capabilityRegistry.register({ name, version: '1', risk: 'read', description: 'fixture',
  inputSchema: { value: { type: 'string', required: true, description: 'value' } },
  async execute(input) { invoked++; return input; },
});
const unsupported = 'test.admission.schema';
capabilityRegistry.register({ name: unsupported, version: '1', risk: 'read', description: 'fixture',
  inputSchema: { value: { type: 'unsupported', required: false, description: 'value' } },
  async execute() { invoked++; },
});
const step = (input: unknown = { value: 'ok' }) => ({ id: 's', capability: name, input });
const plan = (steps = [step()]): ExecutionPlan => ({ version: '1.0', steps });
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try { await promise; } catch (error) { return error; }
  assert.fail('Expected rejection');
}
async function admission(runtime = new OperatorRuntime()): Promise<PlanAdmissionError> {
  const error = await rejection(runtime.executePlan(plan([])));
  assert.ok(isPlanAdmissionError(error));
  return error;
}

const cases = [
  { code: 'EMPTY_PLAN', steps: [], message: 'Execution plan contains no steps' },
  { code: 'DUPLICATE_STEP_ID', steps: [step(), step()], index: 1, message: 'Duplicate step ID: s' },
  { code: 'UNKNOWN_CAPABILITY', steps: [{ ...step(), capability: 'secret-capability' }], index: 0, message: 'Unknown capability: secret-capability' },
  { code: 'CAPABILITY_VERSION_MISMATCH', steps: [{ ...step(), capabilityVersion: 'secret-version' }], index: 0, message: `Capability version mismatch for '${name}': requested secret-version, registered 1` },
  { code: 'REQUIRED_INPUT_MISSING', steps: [step({})], index: 0, field: 'value', message: `Required input 'value' is missing for capability '${name}'` },
  { code: 'INPUT_TYPE_MISMATCH', steps: [step({ value: { secret: 'credential' } })], index: 0, field: 'value', message: `Input 'value' must be of type 'string' for capability '${name}'` },
  { code: 'UNSUPPORTED_INPUT_SCHEMA', steps: [{ ...step(), capability: unsupported }], index: 0, field: 'value', message: `Unsupported schema type 'unsupported' for capability '${unsupported}'` },
  { code: 'INVALID_RESULT_REFERENCE', steps: [step({ value: { $ref: 'secret-reference' } })], index: 0, message: 'Invalid result reference: secret-reference' },
  { code: 'RESULT_REFERENCE_NOT_EARLIER', steps: [step({ value: { $ref: 'steps.secret.result' } })], index: 0, message: 'Result reference must target an earlier step: steps.secret.result' },
];
for (const c of cases) test(`admission ${c.code}: pre-Job, sanitized, legacy-compatible`, async t => {
  const create = t.mock.method(jobManager, 'create');
  const persist = t.mock.method(jobStore, 'create');
  const update = t.mock.method(jobStore, 'update');
  const events: string[] = [];
  t.after(runtimeEventBus.subscribe('*', event => { events.push(event.type); }));
  let policies = 0;
  const runtime = new OperatorRuntime({ authorizer: { async authorize() { policies++; return { decision: 'allow' }; } } });
  const before = invoked;
  const error = await rejection(runtime.executePlan({ version: '1.0', steps: c.steps }));
  assert.ok(isPlanAdmissionError(error));
  assert.ok(error instanceof Error);
  assert.equal(error.constructor, Error);
  assert.equal(error.name, 'Error');
  assert.equal(error.message, c.code === 'EMPTY_PLAN' ? c.message : `Execution plan failed validation: ${c.message}`);
  assert.equal(error.issues.length, 1);
  assert.equal(error.issues[0].code, c.code);
  assert.equal(error.issues[0].stepIndex, c.index);
  assert.equal(error.issues[0].field, c.field);
  assert.doesNotMatch(JSON.stringify(error.issues), /secret|credential|test\.admission|scopes|provider|caller/);
  assert.equal(JSON.stringify(error), '{}');
  assert.equal(create.mock.callCount() + persist.mock.callCount() + update.mock.callCount(), 0);
  assert.equal(policies, 0); assert.equal(invoked, before); assert.deepEqual(events, []);
});

test('diagnostic graph is detached and immutable; Error itself retains normal behavior', async () => {
  const input = { code: 'INPUT_TYPE_MISMATCH' as const, stepIndex: 2, field: 'value' };
  const issues = [input];
  const error = issuePlanAdmissionError({}, 'legacy', issues);
  input.field = 'changed'; input.stepIndex = 3; issues.length = 0;
  assert.equal(error.issues[0].field, 'value'); assert.equal(error.issues[0].stepIndex, 2);
  for (const key of ['code', 'issues']) {
    const descriptor = Object.getOwnPropertyDescriptor(error, key)!;
    assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false); assert.equal(descriptor.enumerable, false);
    assert.throws(() => Object.defineProperty(error, key, { value: null }), TypeError);
    assert.equal(Reflect.deleteProperty(error, key), false);
    assert.equal(Reflect.set(error, key, null), false);
  }
  for (const value of [error.issues, error.issues[0]]) {
    assert.ok(Object.isFrozen(value));
    assert.throws(() => Object.setPrototypeOf(value, null), TypeError);
    assert.throws(() => Object.defineProperty(value, 'x', { value: 1 }), TypeError);
  }
  assert.throws(() => (error.issues as unknown[]).push(null), TypeError);
  assert.throws(() => (error.issues as unknown[]).splice(0, 1), TypeError);
  assert.equal(Reflect.set(error.issues[0], 'message', 'changed'), false);
  assert.equal(Reflect.deleteProperty(error.issues[0], 'code'), false);
  error.message = 'local'; assert.equal(error.message, 'local');
  assert.ok(isPlanAdmissionError(error));
});

test('predicate uses issuance identity, not public shape, realm, or getters', async () => {
  const error = await admission();
  let traps = 0;
  const proxy = new Proxy(error, { get() { traps++; throw Error('trap'); }, getPrototypeOf() { traps++; throw Error('trap'); } });
  const revoked = Proxy.revocable(error, {}); revoked.revoke();
  const lookalikes = [null, undefined, 1, 'x', Symbol(), () => {}, new Error(error.message),
    Object.assign(new Error(), { code: error.code, issues: error.issues }),
    Object.create(error), Object.create(Object.getPrototypeOf(error), Object.getOwnPropertyDescriptors(error)),
    proxy, revoked.proxy, structuredClone(error), JSON.parse(JSON.stringify(error)),
    { get code() { traps++; throw Error('trap'); } }];
  for (const value of lookalikes) assert.equal(isPlanAdmissionError(value), false);
  assert.equal(traps, 0);
  assert.equal(runInNewContext('predicate(error)', { predicate: isPlanAdmissionError, error }), true);
  assert.ok(isPlanAdmissionError(error)); assert.ok(isPlanAdmissionError(error));
  const require = createRequire(__filename);
  const path = require.resolve('../src/runtime/execution/plan-admission-error.js');
  const original = require.cache[path];
  try {
    delete require.cache[path];
    assert.equal(require(path).isPlanAdmissionError(error), false);
  } finally { require.cache[path] = original; }
});

test('foreign diagnostics from synchronous caller/plan callbacks are contained using recorded message', async () => {
  const runtime = new OperatorRuntime();
  const error = await admission(runtime);
  Object.defineProperty(error, 'message', { get() { throw Error('must not read mutated message'); } });
  for (const run of [
    () => runtime.executePlan(plan(), { get caller(): never { throw error; } }),
    () => runtime.executePlan({ get steps(): never { throw error; }, version: '1.0' }),
  ]) {
    const caught = await rejection(run());
    assert.ok(caught instanceof Error); assert.equal(isPlanAdmissionError(caught), false);
    assert.equal(caught.message, 'Execution plan contains no steps'); assert.equal(caught.cause, error);
    assert.equal(Object.hasOwn(caught, 'issues'), false);
  }
  assert.ok(isPlanAdmissionError(error));
});

test('concurrent calls do not consume each other’s evidence', async () => {
  const runtime = new OperatorRuntime();
  const [a, b] = await Promise.all([admission(runtime), admission(runtime)]);
  assert.notEqual(a, b);
  const outcomes = await Promise.all([admission(runtime), rejection(runtime.executePlan({ version: '1.0', get steps(): never { throw a; } }))]);
  assert.ok(isPlanAdmissionError(outcomes[0])); assert.equal(isPlanAdmissionError(outcomes[1]), false);
  assert.ok(isPlanAdmissionError(a)); assert.ok(isPlanAdmissionError(b));
});

test('reentrant authorizer and post-effect storage rejection cannot relay nested admission evidence', async t => {
  let nested: PlanAdmissionError | undefined;
  const runtime = new OperatorRuntime({ authorizer: { async authorize() {
    nested = await admission(runtime); return { decision: 'allow' };
  } } });
  const update = jobStore.update.bind(jobStore);
  t.mock.method(jobStore, 'update', async (job: Job) => {
    if (nested) throw nested;
    return update(job);
  });
  const before = invoked;
  const caught = await rejection(runtime.executePlan(plan()));
  assert.equal(invoked, before + 1);
  assert.ok(nested && isPlanAdmissionError(nested));
  assert.equal(isPlanAdmissionError(caught), false);
  assert.ok(caught instanceof Error); assert.equal(caught.cause, nested);
});

test('unbranded capture/storage failures preserve exact identity', async t => {
  const runtime = new OperatorRuntime();
  const error = Object.assign(new Error('storage'), { code: 'PLAN_ADMISSION_REJECTED' });
  assert.equal(await rejection(runtime.executePlan({ version: '1.0', get steps(): never { throw error; } })), error);
  t.mock.method(jobStore, 'create', async () => { throw error; });
  assert.equal(await rejection(runtime.executePlan(plan())), error);
  assert.equal(isPlanAdmissionError(error), false);
});

test('denial, resolved validation/reference and capability/provider failures remain failed Jobs', async () => {
  const deny = new OperatorRuntime({ authorizer: { async authorize() { return { decision: 'deny' }; } } });
  const before = invoked;
  const denied = await deny.executePlan(plan());
  assert.equal(denied.status, 'failed'); assert.equal(invoked, before); assert.equal(isPlanAdmissionError(denied), false);
  const runtime = new OperatorRuntime();
  for (const path of ['missing', '']) {
    const job = await runtime.executePlan(plan([step(), { ...step({ value: { $ref: `steps.s.result${path ? '.' + path : ''}` } }), id: 'sink' }]));
    assert.equal(job.status, 'failed'); assert.equal(job.steps[0].status, 'completed'); assert.equal(isPlanAdmissionError(job), false);
  }
  const failing = 'test.admission.provider';
  capabilityRegistry.register({ name: failing, version: '1', risk: 'read', description: 'provider fixture', async execute() { throw Error('provider failed'); } });
  const failed = await runtime.executePlan(plan([{ ...step(), capability: failing }]));
  assert.equal(failed.status, 'failed'); assert.equal(failed.error, 'provider failed'); assert.equal(isPlanAdmissionError(failed), false);
  const success = await runtime.executePlan({ ...plan([step(), { ...step({ value: { $ref: 'steps.s.result.value' } }), id: 'sink' }]), version: '1.0' });
  assert.equal(success.status, 'completed'); assert.deepEqual(success.steps[1].result, { value: 'ok' });
});

test('adapter projects only permitted direct evidence, never legacy message or cause', async () => {
  const error = await rejection(new OperatorRuntime().executePlan(plan([{ ...step(), capability: 'secret' }])));
  assert.ok(isPlanAdmissionError(error));
  const wire = JSON.parse(JSON.stringify({ code: error.code, issues: error.issues.map(({ code, message, stepIndex, field }) => ({ code, message, stepIndex, field })) }));
  assert.equal(isPlanAdmissionError(wire), false);
  assert.doesNotMatch(JSON.stringify(wire), /secret|stack|cause/);
  assert.equal(Object.hasOwn(wire, 'message'), false);
});

test('aggregated issue order and captured locations survive caller mutation', async () => {
  const submitted = [step({}), step({ value: 7 })];
  const proposal = plan(submitted);
  const error = await rejection(new OperatorRuntime().executePlan(proposal));
  assert.ok(isPlanAdmissionError(error));
  assert.deepEqual(error.issues.map(i => [i.code, i.stepIndex, i.field]), [
    ['REQUIRED_INPUT_MISSING', 0, 'value'], ['DUPLICATE_STEP_ID', 1, undefined], ['INPUT_TYPE_MISMATCH', 1, 'value'],
  ]);
  const snapshot = JSON.stringify(error.issues);
  submitted[0].input = { value: 'repaired' };
  submitted[0].id = 'changed';
  assert.equal(JSON.stringify(error.issues), snapshot);
});

test('pending execution and another call’s rejection retain separate owners', async () => {
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const runtime = new OperatorRuntime({ authorizer: { async authorize() {
    started(); await gate; return { decision: 'allow' };
  } } });
  const running = runtime.executePlan(plan());
  await ready;
  const other = await admission(runtime);
  release();
  assert.equal((await running).status, 'completed');
  assert.ok(isPlanAdmissionError(other));
});

test('ordinary persistence failure after effects is never admission evidence', async t => {
  const update = jobStore.update.bind(jobStore);
  const error = new Error('post-effect persistence');
  t.mock.method(jobStore, 'update', async (job: Job) => {
    if (job.steps.some(s => s.status === 'completed')) throw error;
    return update(job);
  });
  const before = invoked;
  assert.equal(await rejection(new OperatorRuntime().executePlan(plan())), error);
  assert.equal(invoked, before + 1); assert.equal(isPlanAdmissionError(error), false);
});

test('unexpected Proxy, reference-collection and planner failures are not admission diagnostics', async () => {
  const runtime = new OperatorRuntime();
  const failure = new Error('unexpected host callback');
  const proxy = new Proxy(plan(), { get(): never { throw failure; } });
  assert.equal(await rejection(runtime.executePlan(proxy)), failure);
  const input = { value: 'ok', get nested(): never { throw failure; } };
  assert.equal(await rejection(runtime.executePlan(plan([step(input)]))), failure);
  const planning = await rejection(runtime.run('no configured router in this fixture'));
  assert.ok(planning instanceof Error);
  assert.equal(isPlanAdmissionError(planning), false);
});
