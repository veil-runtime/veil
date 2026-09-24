import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

import { SQLiteJobStore } from '../src/providers/storage/sqlite-job-store.js';
import { OperatorRuntime } from '../src/index.js';
import { jobManager } from '../src/runtime/jobs/job-manager.js';
import { jobStore } from '../src/runtime/jobs/job-store.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { capabilityRegistry } from '../src/runtime/registry/registry.js';

const a = 'test.structure.a';
const b = 'test.structure.b';
let calls: string[] = [];
for (const name of [a, b]) {
  capabilityRegistry.register({
    name, version: '1', description: 'structural ownership', risk: 'read',
    inputSchema: { value: { type: 'string', required: true, description: 'value' } },
    async execute(input) { calls.push(name); return input; },
  });
}
function step(id = 'first') {
  return { id, capability: a, capabilityVersion: '1' as string | undefined,
    input: { value: id } as unknown, reason: 'original reason', idempotencyKey: 'step-key' };
}
function plan() {
  return { version: '1.0', goal: ' original goal ', idempotencyKey: 'plan-key',
    steps: [step(), step('second')] };
}
type Plan = ReturnType<typeof plan>;

const mutations: Record<string, (p: Plan) => void> = {
  'replace steps': p => { p.steps = [step('replacement')]; },
  'replace element': p => { p.steps[0] = step('replacement'); },
  push: p => { p.steps.push(step('extra')); },
  splice: p => { p.steps.splice(0, 1); },
  clear: p => { p.steps.length = 0; },
  reverse: p => { p.steps.reverse(); },
  'change ID': p => { p.steps[0].id = 'replacement'; },
  'duplicate ID': p => { p.steps[1].id = 'first'; },
  'capability A to B': p => { p.steps[0].capability = b; },
  'unknown capability': p => { p.steps[0].capability = 'unknown'; },
  'change version': p => { p.steps[0].capabilityVersion = 'bad'; },
  'remove version': p => { delete p.steps[0].capabilityVersion; },
  'goal': p => { p.goal = 'changed'; },
  'plan key': p => { p.idempotencyKey = 'changed'; },
  'reason': p => { p.steps[0].reason = 'changed'; },
  'step key': p => { p.steps[0].idempotencyKey = 'changed'; },
};
for (const [label, input] of Object.entries({ object: { value: 'changed' }, primitive: 42, null: null, undefined })) {
  mutations[`input root ${label}`] = p => { p.steps[0].input = input; };
}

function gateCreation(t: TestContext) {
  const original = jobStore.create.bind(jobStore);
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  const gate = { promise, resolve };
  t.mock.method(jobStore, 'create', async (job: Parameters<typeof original>[0]) => {
    await gate.promise;
    return original(job);
  });
  return gate;
}

for (const timing of ['immediate', 'pending creation'] as const) {
  for (const [label, mutate] of Object.entries(mutations)) {
    test(`${timing}: ${label} cannot alter submitted structure`, async t => {
      calls = [];
      const p = plan();
      const expected = p.steps.map(s => ({ ...s }));
      const gate = timing === 'pending creation' ? gateCreation(t) : undefined;
      const pending = new OperatorRuntime().executePlan(p);
      if (gate) await Promise.resolve();
      mutate(p);
      gate?.resolve();
      const job = await pending;
      assert.equal(job.status, 'completed');
      assert.equal(job.goal, 'original goal');
      assert.equal(job.idempotencyKey, 'plan-key');
      assert.deepEqual(calls, [a, a]);
      assert.deepEqual(job.steps.map(s => ({ id: s.id, capability: s.capability,
        capabilityVersion: s.capabilityVersion, input: s.input, reason: s.reason,
        idempotencyKey: s.idempotencyKey })), expected);
      assert.deepEqual(job.steps.map(s => s.result), [{ value: 'first' }, { value: 'second' }]);
    });
  }
}

test('adding a version after capture does not add a job version', async () => {
  const p = plan();
  delete p.steps[0].capabilityVersion;
  const pending = new OperatorRuntime().executePlan(p);
  p.steps[0].capabilityVersion = 'bad';
  const job = await pending;
  assert.equal(job.status, 'completed');
  assert.equal(job.steps[0].capabilityVersion, undefined);
});

const invalid: Record<string, (p: Plan) => void> = {
  duplicate: p => { p.steps[1].id = 'first'; },
  unknown: p => { p.steps[0].capability = 'unknown'; },
  version: p => { p.steps[0].capabilityVersion = 'bad'; },
  input: p => { p.steps[0].input = { value: 42 }; },
  reference: p => { p.steps[0].input = { value: { $ref: 'steps.second.result' } }; },
  empty: p => { p.steps = []; },
};
async function rejectionBeforeEffects(t: TestContext, p: Plan, repair = () => {}) {
  calls = [];
  const create = t.mock.method(jobManager, 'create');
  const persist = t.mock.method(jobStore, 'create');
  const update = t.mock.method(jobStore, 'update');
  const events: string[] = [];
  t.after(runtimeEventBus.subscribe('*', event => { events.push(event.type); }));
  let authorizations = 0;
  const pending = new OperatorRuntime({ authorizer: {
    async authorize() { authorizations++; return { decision: 'allow' }; },
  } }).executePlan(p);
  repair();
  await assert.rejects(pending);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(persist.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(authorizations, 0);
  assert.deepEqual(events, []);
  assert.deepEqual(calls, []);
}
for (const [label, invalidate] of Object.entries(invalid)) {
  test(`invalid ${label} remains rejected after immediate repair`, async t => {
    const p = plan();
    invalidate(p);
    await rejectionBeforeEffects(t, p, () => { p.steps = plan().steps; });
  });
}

test('input getter mutations during validation cannot change any captured structural field', async () => {
  const p = plan();
  const [first, second] = p.steps;
  first.input = { get value() {
    p.goal = 'changed';
    p.idempotencyKey = 'changed';
    p.steps = [];
    first.id = 'changed';
    first.capability = b;
    first.capabilityVersion = 'bad';
    first.input = null;
    first.reason = 'changed';
    first.idempotencyKey = 'changed';
    second.id = 'changed';
    second.capability = 'unknown';
    second.input = undefined;
    return 'getter value';
  } };
  const job = await new OperatorRuntime().executePlan(p);
  assert.equal(job.status, 'completed');
  assert.equal(job.goal, 'original goal');
  assert.equal(job.idempotencyKey, 'plan-key');
  assert.deepEqual(job.steps.map(s => [s.id, s.capability, s.capabilityVersion, s.reason, s.idempotencyKey]),
    ['first', 'second'].map(id => [id, a, '1', 'original reason', 'step-key']));
  assert.deepEqual(job.steps.map(s => s.result), [{ value: 'getter value' }, { value: 'second' }]);
});

test('changing accessors are read once; unused plan and step fields are not consumed', async () => {
  const p = plan();
  const reads = new Map<string, number>();
  function once(object: object, key: string, value: unknown) {
    Object.defineProperty(object, key, { configurable: true, get() {
      const count = (reads.get(key) ?? 0) + 1;
      reads.set(key, count);
      if (count > 1) throw new Error(`reread ${key}`);
      return value;
    } });
  }
  const first = p.steps[0];
  for (const [key, value] of Object.entries(first)) once(first, key, value);
  // Separate plan keys from step keys in the counter.
  Object.defineProperty(p, 'idempotencyKey', { get: () => 'plan-key' });
  once(p, 'steps', [first]);
  once(p, 'goal', p.goal);
  once(p, 'version', '1.0');
  for (const key of ['id', 'metadata']) {
    Object.defineProperty(p, key, { get() { throw new Error(`unused ${key}`); } });
  }
  Object.defineProperty(first, 'extra', { enumerable: true, get() { throw new Error('unused extra'); } });
  const job = await new OperatorRuntime().executePlan(p);
  assert.equal(job.status, 'completed');
  assert.ok([...reads.values()].every(count => count === 1));
});

test('proxies retain single structural reads without freezing or enumerating caller steps', async () => {
  const p = plan();
  const reads: string[] = [];
  p.steps = [new Proxy(p.steps[0], {
    get(target, key) { reads.push(String(key)); return target[key as keyof typeof target]; },
    ownKeys() { throw new Error('must not enumerate'); },
    set() { throw new Error('must not mutate'); },
    preventExtensions() { throw new Error('must not freeze'); },
  })];
  let stepsReads = 0;
  const proxied = new Proxy(p, { get(target, key) {
    if (key === 'steps' && ++stepsReads > 1) return [];
    return target[key as keyof typeof target];
  } });
  const job = await new OperatorRuntime().executePlan(proxied);
  assert.equal(job.status, 'completed');
  assert.equal(stepsReads, 1);
  assert.deepEqual(reads, ['id', 'capability', 'capabilityVersion', 'input', 'reason', 'idempotencyKey']);
});

for (const field of ['steps', 'goal', 'idempotencyKey', 'id', 'capability', 'capabilityVersion', 'input', 'reason']) {
  test(`throwing ${field} accessor rejects before effects`, async t => {
    const p = plan();
    const target = ['steps', 'goal', 'idempotencyKey'].includes(field) ? p : p.steps[0];
    Object.defineProperty(target, field, { get() { throw new Error('capture failed'); } });
    await rejectionBeforeEffects(t, p);
  });
}
for (const position of [0, 1, 2]) {
  test(`sparse slot ${position} is not compacted into an admitted plan`, async t => {
    const p = plan();
    p.steps = [step(), step('second'), step('third')];
    delete p.steps[position];
    await rejectionBeforeEffects(t, p);
  });
}
for (const shape of ['null prototype', 'frozen', 'sealed', 'inherited', 'non-enumerable']) {
  test(`${shape} structural fields retain their values`, async () => {
    let p = plan();
    if (shape === 'null prototype') {
      Object.setPrototypeOf(p, null);
      for (const s of p.steps) {
        Object.setPrototypeOf(s, null);
        Object.setPrototypeOf(s.input, null);
      }
    } else if (shape === 'inherited') {
      p.steps = p.steps.map(s => Object.create(s));
      p = Object.create(p);
    } else if (shape === 'non-enumerable') {
      for (const object of [p, ...p.steps]) {
        for (const key of Object.keys(object)) Object.defineProperty(object, key, { enumerable: false });
      }
    } else {
      const lock = shape === 'frozen' ? Object.freeze : Object.seal;
      for (const s of p.steps) { lock(s.input); lock(s); }
      lock(p.steps); lock(p);
    }
    const job = await new OperatorRuntime().executePlan(p);
    assert.equal(job.status, 'completed');
    assert.equal(job.goal, 'original goal');
    assert.equal(job.idempotencyKey, 'plan-key');
    assert.deepEqual(job.steps.map(s => s.id), ['first', 'second']);
    assert.deepEqual(job.steps.map(s => s.result), [{ value: 'first' }, { value: 'second' }]);
  });
}

test('limit: input fields, nested objects and arrays remain shared until resolution', async t => {
  const p = plan();
  const input = { value: 'before', nested: { value: 'before' }, array: ['before'] };
  p.steps[0].input = input;
  const gate = gateCreation(t);
  const pending = new OperatorRuntime().executePlan(p);
  input.value = 'after';
  input.nested.value = 'after';
  input.array.push('after');
  gate.resolve();
  const job = await pending;
  assert.equal(job.status, 'completed');
  assert.equal(job.steps[0].input, input);
  assert.equal((job.steps[0].input as typeof input).nested, input.nested);
  assert.equal((job.steps[0].input as typeof input).array, input.array);
  assert.deepEqual(job.steps[0].result, input);
  assert.equal(Object.isFrozen(input), false);
});

test('limit: reference objects can change until resolution; results preserve identity and mutability', async () => {
  const result = { before: { value: 'before' }, after: { value: 'after' } };
  const ref = { $ref: 'steps.source.result.before' };
  const source = 'test.structure.reference-source';
  const sink = 'test.structure.reference-sink';
  capabilityRegistry.register({ name: sink, version: '1', description: 'sink', risk: 'read',
    async execute(input) { return input; } });
  capabilityRegistry.register({ name: source, version: '1', description: 'source', risk: 'read',
    async execute() { ref.$ref = 'steps.source.result.after'; return result; } });
  const job = await new OperatorRuntime().executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source }, { id: 'sink', capability: sink, input: ref },
  ] });
  assert.equal(job.status, 'completed');
  assert.equal(job.steps[1].input, ref);
  assert.equal(job.steps[0].result, result);
  assert.equal(job.steps[1].result, result.after);
  assert.equal((job.result as unknown[])[1], result.after);
  result.after.value = 'mutated result';
  assert.deepEqual(job.steps[1].result, { value: 'mutated result' });
});


test('SQLite materialization and reload retain the captured structural envelope', async t => {
  const sqlite = new SQLiteJobStore(':memory:');
  t.mock.method(jobStore, 'create', sqlite.create.bind(sqlite));
  t.mock.method(jobStore, 'get', sqlite.get.bind(sqlite));
  t.mock.method(jobStore, 'update', sqlite.update.bind(sqlite));
  const p = plan();
  const pending = new OperatorRuntime().executePlan(p);
  p.steps[0].id = 'changed';
  p.steps[0].capability = b;
  p.steps[0].input = null;
  p.steps.reverse();
  p.goal = 'changed';
  p.idempotencyKey = 'changed';
  const job = await pending;
  assert.equal(job.status, 'completed');
  assert.equal(job.goal, 'original goal');
  assert.equal(job.idempotencyKey, 'plan-key');
  assert.deepEqual(job.steps.map(s => [s.id, s.capability, s.result]),
    [['first', a, { value: 'first' }], ['second', a, { value: 'second' }]]);
  assert.deepEqual(await sqlite.get(job.id), JSON.parse(JSON.stringify(job)));
});


test('validation input getters cannot repair a captured invalid later step', async t => {
  const p = plan();
  p.steps[1].capability = 'unknown';
  p.steps[0].input = { get value() {
    p.steps[1].capability = a;
    return 'valid';
  } };
  await rejectionBeforeEffects(t, p);
});

test('throwing step proxy traps reject before effects', async t => {
  const p = plan();
  p.steps[0] = new Proxy(p.steps[0], { get() { throw new Error('proxy failed'); } });
  await rejectionBeforeEffects(t, p);
});

test('throwing steps membership proxy traps reject before effects', async t => {
  const p = plan();
  p.steps = new Proxy(p.steps, { has() { throw new Error('membership failed'); } });
  await rejectionBeforeEffects(t, p);
});
