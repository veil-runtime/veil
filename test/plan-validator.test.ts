import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OperatorRuntime } from '../src/index.js';
import { validatePlan } from '../src/runtime/execution/plan-validator.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { jobManager } from '../src/runtime/jobs/job-manager.js';
import { jobStore } from '../src/runtime/jobs/job-store.js';
import { capabilityRegistry } from '../src/runtime/registry/registry.js';

const success = 'test.step-identity.success';
const failure = 'test.step-identity.failure';
let invocations = 0;
for (const name of [success, failure]) {
  capabilityRegistry.register({
    name, version: '1.0.0', description: 'step identity regression', risk: 'read',
    async execute(input) {
      invocations += 1;
      if (name === failure) throw new Error('capability failed');
      return input ?? { value: 'result' };
    },
  });
}

const step = (id: string, capability = success, input?: unknown) => ({ id, capability, input });
const duplicate = (id: string, capability = success) => ({
  stepId: id, capability, message: `Duplicate step ID: ${id}`,
});

for (const ids of [['a', 'a'], ['a', 'b', 'a'], ['a', 'a', 'a'], ['a', 'b', 'a', 'a']]) {
  test(`duplicate occurrences aggregate: ${JSON.stringify(ids)}`, () => {
    assert.deepEqual(validatePlan(ids.map(id => step(id))), {
      valid: false,
      errors: ids.slice(1).filter(id => id === 'a').map(() => duplicate('a')),
    });
  });
}

for (const id of ['', ' ', '\t', '雪', 'a.b', 'a.result.b', '__proto__', 'constructor', 'toString', '\0']) {
  test(`exact unusual duplicate: ${JSON.stringify(id)}`, () => {
    assert.deepEqual(validatePlan([step(id), step(id)]), {
      valid: false, errors: [duplicate(id)],
    });
  });
}

test('exact identity preserves case, whitespace, and Unicode distinctions', () => {
  assert.deepEqual(validatePlan(['a', 'A', ' a', 'a ', '', ' ', '\t', 'é', 'e\u0301']
    .map(id => step(id))), { valid: true, errors: [] });
});

test('duplicates aggregate with unknown capabilities, including an unknown first occurrence', () => {
  const unknown = 'test.step-identity.unknown';
  assert.deepEqual(validatePlan([step('a', unknown), step('a', unknown), step('a')]), {
    valid: false,
    errors: [
      { stepId: 'a', capability: unknown, message: `Unknown capability: ${unknown}` },
      duplicate('a', unknown),
      { stepId: 'a', capability: unknown, message: `Unknown capability: ${unknown}` },
      duplicate('a'),
    ],
  });
});

test('reference ordering and error aggregation retain earlier-step semantics', () => {
  const ref = (id: string) => ({ $ref: `steps.${id}.result` });
  assert.deepEqual(validatePlan([
    step('a', success, ref('a')),
    step('b', success, ref('c')),
    step('c'),
    step('a', success, ref('a')),
  ]), {
    valid: false,
    errors: [
      { stepId: 'a', capability: success, message: 'Result reference must target an earlier step: steps.a.result' },
      { stepId: 'b', capability: success, message: 'Result reference must target an earlier step: steps.c.result' },
      duplicate('a'),
    ],
  });
  assert.deepEqual(validatePlan([step('a'), step('b', success, ref('a'))]), {
    valid: true, errors: [],
  });
  assert.equal(validatePlan([step('a', 'unknown'), step('b', success, ref('a'))]).errors.length, 1);
});

for (const capabilities of [[success, success], [failure, failure], [success, failure], [failure, success]]) {
  test(`runtime rejects duplicates before all side effects: ${capabilities.join(', ')}`, async (t) => {
    const create = t.mock.method(jobManager, 'create');
    const persist = t.mock.method(jobStore, 'create');
    const update = t.mock.method(jobStore, 'update');
    const before = await jobStore.list();
    const callsBefore = invocations;
    let authorizations = 0;
    const events: string[] = [];
    const unsubscribe = runtimeEventBus.subscribe('*', event => { events.push(event.type); });
    t.after(unsubscribe);
    const runtime = new OperatorRuntime({ authorizer: {
      async authorize() { authorizations += 1; return { decision: 'allow' }; },
    } });
    await assert.rejects(runtime.executePlan({ version: '1.0', steps:
      capabilities.map(capability => step('duplicate', capability)),
    }), { message: 'Execution plan failed validation: Duplicate step ID: duplicate' });
    assert.equal(create.mock.callCount(), 0);
    assert.equal(persist.mock.callCount(), 0);
    assert.equal(update.mock.callCount(), 0);
    assert.deepEqual(await jobStore.list(), before);
    assert.deepEqual(events, []);
    assert.equal(authorizations, 0);
    assert.equal(invocations, callsBefore);
  });
}

test('separate plans can reuse IDs and unique plans still resolve results', async () => {
  const runtime = new OperatorRuntime();
  const plan = { version: '1.0', steps: [
    step('source'), step('sink', success, { $ref: 'steps.source.result.value' }),
  ] };
  const first = await runtime.executePlan(plan);
  const second = await runtime.executePlan(plan);
  assert.notEqual(first.id, second.id);
  for (const job of [first, second]) {
    assert.equal(job.status, 'completed');
    assert.equal(job.steps[1].result, 'result');
  }
});
