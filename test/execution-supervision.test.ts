import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import {
  OperatorRuntime, isPlanAdmissionError,
  type Capability, type CapabilityAuthorizationDecision, type ExecutionAuthorizer, type Job,
} from '../src/index.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { JobLogSink } from '../src/runtime/logging/job-log-sink.js';
import { jobStore } from '../src/runtime/jobs/job-store.js';
import { plannerRouterRegistry } from '../src/runtime/planner/planner-router-registry.js';
import { plannerStrategyRegistry } from '../src/runtime/planner/strategies/planner-strategy-registry.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(
  version: '1.0' | '2.0', execute: Capability['execute'], authorizer?: ExecutionAuthorizer,
) {
  const name = `supervision.${randomUUID()}`;
  const runtime = new OperatorRuntime({ planVersions: [version], authorizer });
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', description: 'Supervision fixture', risk: 'read', execute,
  }] });
  return { runtime, plan: { version, steps: [
    { id: 'first', capability: name }, { id: 'second', capability: name },
  ] } };
}
function quiet(t: TestContext) {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
}

for (const version of ['1.0', '2.0'] as const) {
  test(`${version}: pre-abort still admits the plan and never authorizes or executes`, async () => {
    const controller = new AbortController();
    controller.abort(new Error('host-private reason'));
    let calls = 0;
    const { runtime, plan } = fixture(version, async () => { calls++; }, {
      async authorize() { calls++; return { decision: 'allow' }; },
    });
    await assert.rejects(runtime.executePlan({ ...plan, steps: [] }, {
      signal: controller.signal,
    }), isPlanAdmissionError);
    const job = await runtime.executePlan(plan, { signal: controller.signal });
    assert.equal(job.status, 'failed');
    assert.equal(job.outcome, 'failed');
    assert.equal(job.error, 'Execution cancelled');
    assert.equal(calls, 0);
    assert.ok(job.steps.every(step => step.status === 'pending'));
    assert.deepEqual(job.events.map(event => event.type), [
      'job.created', 'execution.started', 'job.failed',
    ]);
  });

  for (const late of ['allow', 'deny', 'reject'] as const) {
    test(`${version}: cancellation during authorization fences late ${late}`, async () => {
      const controller = new AbortController();
      const entered = deferred<void>();
      const authorization = deferred<CapabilityAuthorizationDecision>();
      let calls = 0;
      const { runtime, plan } = fixture(version, async () => { calls++; }, {
        authorize() { entered.resolve(); return authorization.promise; },
      });
      const pending = runtime.executePlan(plan, { signal: controller.signal });
      await entered.promise;
      controller.abort(); controller.abort();
      const job = await pending;
      const snapshot = JSON.stringify(job);
      assert.equal(job.error, 'Execution cancelled');
      assert.equal(job.steps[0].status, 'failed');
      assert.equal(job.steps[0].startedAt, undefined);
      if (late === 'reject') authorization.reject(new Error('late authorization'));
      else authorization.resolve({ decision: late });
      await settle();
      assert.equal(calls, 0);
      assert.equal(JSON.stringify(job), snapshot);
      assert.equal(JSON.stringify(await runtime.getJob(job.id)), snapshot);
      assert.ok(!job.events.some(event => event.type === 'capability.started'));
    });
  }

  for (const late of ['resolve', 'reject'] as const) {
    test(`${version}: in-flight cancellation contains late provider ${late}`, async () => {
      const controller = new AbortController();
      const entered = deferred<void>();
      const provider = deferred<unknown>();
      let calls = 0;
      let signal: AbortSignal | undefined;
      const { runtime, plan } = fixture(version, (_input, context) => {
        calls++; signal = context?.signal; entered.resolve(); return provider.promise;
      });
      const pending = runtime.executePlan(plan, { signal: controller.signal });
      await entered.promise;
      assert.ok(signal);
      assert.notEqual(signal, controller.signal);
      controller.abort(); controller.abort();
      const job = await pending;
      assert.equal(signal.aborted, true);
      assert.equal(job.error, 'Execution cancelled');
      assert.equal(job.steps[0].status, 'failed');
      assert.equal(job.steps[1].status, 'pending');
      assert.equal(job.result, undefined);
      const snapshot = JSON.stringify(job);
      if (late === 'resolve') provider.resolve({ external: 'effect may have occurred' });
      else provider.reject(new Error('late provider rejection'));
      await settle();
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(job), snapshot);
    });
  }

  test(`${version}: deadline aborts cooperative work and contains its rejection`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const entered = deferred<void>();
    let calls = 0;
    let signal!: AbortSignal;
    const { runtime, plan } = fixture(version, (_input, context) => {
      calls++; signal = context!.signal!; entered.resolve();
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('cooperative stop')));
      });
    });
    const pending = runtime.executePlan(plan, { timeoutMs: 1000 });
    await entered.promise;
    t.mock.timers.tick(1000);
    const job = await pending;
    assert.equal(signal.aborted, true);
    assert.equal(job.error, 'Execution deadline exceeded');
    assert.equal(job.steps[0].error, job.error);
    assert.equal(job.steps[1].status, 'pending');
    assert.equal(calls, 1);
    await settle();
  });

  test(`${version}: deadline during authorization never grants late entry`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const entered = deferred<void>();
    const authorization = deferred<CapabilityAuthorizationDecision>();
    let calls = 0;
    const { runtime, plan } = fixture(version, async () => { calls++; }, {
      authorize() { entered.resolve(); return authorization.promise; },
    });
    const pending = runtime.executePlan(plan, { timeoutMs: 1000 });
    await entered.promise;
    t.mock.timers.tick(1000);
    const job = await pending;
    const snapshot = JSON.stringify(job);
    authorization.resolve({ decision: 'allow' });
    await settle();
    assert.equal(job.error, 'Execution deadline exceeded');
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(job), snapshot);
  });

  test(`${version}: abort at capability.started prevents capability entry`, async () => {
    const controller = new AbortController();
    let calls = 0;
    const { runtime, plan } = fixture(version, async () => { calls++; });
    const unsubscribe = runtimeEventBus.subscribe('capability.started', () => controller.abort());
    try {
      const job = await runtime.executePlan(plan, { signal: controller.signal });
      assert.equal(calls, 0);
      assert.equal(job.error, 'Execution cancelled');
    } finally { unsubscribe(); }
  });

  test(`${version}: completed effects survive cancellation before the next step`, async () => {
    const controller = new AbortController();
    let calls = 0;
    const result = { completedEffect: true };
    const { runtime, plan } = fixture(version, async () => { calls++; return result; });
    const unsubscribe = runtimeEventBus.subscribe('capability.completed', () => controller.abort());
    try {
      const job = await runtime.executePlan(plan, { signal: controller.signal });
      assert.equal(job.error, 'Execution cancelled');
      assert.equal(job.steps[0].status, 'completed');
      assert.equal(job.steps[0].result, result);
      assert.equal(job.steps[1].status, 'pending');
      assert.equal(calls, 1);
    } finally { unsubscribe(); }
  });

  test(`${version}: abort and completion in the same capability turn selects cancellation`, async () => {
    const controller = new AbortController();
    const { runtime, plan } = fixture(version, async () => { controller.abort(); return 'late'; });
    const job = await runtime.executePlan(plan, { signal: controller.signal });
    assert.equal(job.error, 'Execution cancelled');
    assert.equal(job.steps[0].result, undefined);
  });

  test(`${version}: successful terminal state survives abort during persistence and after return`, async t => {
    const controller = new AbortController();
    const { runtime, plan } = fixture(version, async () => 'success');
    const update = jobStore.update.bind(jobStore);
    t.mock.method(jobStore, 'update', async (job: Job) => {
      if (job.status === 'completed') controller.abort();
      return update(job);
    });
    const job = await runtime.executePlan(plan, { signal: controller.signal });
    const snapshot = JSON.stringify(job);
    controller.abort();
    await settle();
    assert.equal(job.status, 'completed');
    assert.equal(JSON.stringify(job), snapshot);
    assert.deepEqual(job.result, ['success', 'success']);
  });

  test(`${version}: supervision retains fail-closed authorization`, async () => {
    let calls = 0;
    const { runtime, plan } = fixture(version, async () => { calls++; }, {
      async authorize() { return { decision: 'deny', reason: 'host denial' }; },
    });
    const job = await runtime.executePlan(plan, { timeoutMs: 1000 });
    assert.equal(job.error, 'host denial');
    assert.equal(calls, 0);
    assert.ok(job.events.some(event => event.type === 'capability.denied'));
  });
}

for (const termination of ['cancel', 'deadline'] as const) {
  for (const late of ['resolve', 'reject'] as const) {
    test(`${termination}/${late}: logger stays owned until noncooperative work settles`, async t => {
      quiet(t);
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const opened = new Set<Database.Database>();
      const exec = Database.prototype.exec;
      t.mock.method(Database.prototype, 'exec', function(this: Database.Database, sql: string) {
        if (sql.includes('CREATE TABLE IF NOT EXISTS execution_logs')) opened.add(this);
        return exec.call(this, sql);
      });
      const controller = new AbortController();
      const entered = deferred<void>();
      const provider = deferred<unknown>();
      let lateLog!: () => void;
      const { runtime, plan } = fixture('1.0', (_input, context) => {
        context!.logger.info('before');
        lateLog = () => context!.logger.info('after logical termination');
        entered.resolve(); return provider.promise;
      });
      const pending = runtime.executePlan(plan, { signal: controller.signal, timeoutMs: 1000 });
      await entered.promise;
      if (termination === 'cancel') controller.abort();
      else t.mock.timers.tick(1000);
      const job = await pending;
      assert.equal(job.status, 'failed');
      const snapshot = JSON.stringify(job);
      assert.equal(opened.size, 1);
      const [db] = opened;
      assert.equal(db.open, true);
      lateLog();
      // Another Job must release only its own logger.
      const other = fixture('1.0', async (_input, context) => context!.logger.info('other'));
      await other.runtime.executePlan(other.plan);
      assert.equal(opened.size, 2);
      assert.equal(db.open, true);
      assert.equal([...opened][1].open, false);
      if (late === 'resolve') provider.resolve('late');
      else provider.reject(new Error('late primary failure'));
      await settle();
      assert.equal(db.open, false);
      lateLog();
      assert.equal(opened.size, 2);
      assert.equal(JSON.stringify(job), snapshot);
    });
  }
}

test('deferred cleanup throw cannot replace cancellation or leak a rejection', async t => {
  quiet(t);
  const entered = deferred<void>();
  const provider = deferred<unknown>();
  const controller = new AbortController();
  t.mock.method(JobLogSink.prototype, Symbol.dispose, () => { throw new Error('cleanup'); });
  const { runtime, plan } = fixture('1.0', () => { entered.resolve(); return provider.promise; });
  const pending = runtime.executePlan(plan, { signal: controller.signal });
  await entered.promise;
  controller.abort();
  const job = await pending;
  provider.reject(new Error('late execution failure'));
  await settle();
  assert.equal(job.error, 'Execution cancelled');
});

test('zero deadline admits a valid Job without entry; invalid timeouts reject before work', async () => {
  let calls = 0;
  const { runtime, plan } = fixture('1.0', async () => { calls++; });
  for (const timeoutMs of [-1, 0.5, NaN, Infinity, 2_147_483_648]) {
    await assert.rejects(runtime.executePlan(plan, { timeoutMs }), /timeoutMs must/);
  }
  const job = await runtime.executePlan(plan, { timeoutMs: 0 });
  assert.equal(job.error, 'Execution deadline exceeded');
  assert.equal(calls, 0);
});

test('host listener and deadline timer are released on success and admission failure', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  const add = t.mock.method(controller.signal, 'addEventListener');
  const remove = t.mock.method(controller.signal, 'removeEventListener');
  let signal!: AbortSignal;
  const { runtime, plan } = fixture('1.0', async (_input, context) => { signal = context!.signal!; });
  await runtime.executePlan(plan, { signal: controller.signal, timeoutMs: 1000 });
  assert.equal(add.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 1);
  t.mock.timers.tick(1000);
  controller.abort();
  assert.equal(signal.aborted, false);
  await assert.rejects(runtime.executePlan({ ...plan, steps: [] }, {
    signal: controller.signal, timeoutMs: 1000,
  }), isPlanAdmissionError);
  assert.equal(add.mock.callCount(), 2);
  assert.equal(remove.mock.callCount(), 2);
});

test('omitting supervision preserves absent context.signal and result identity', async () => {
  const result = { legacy: true };
  const { runtime, plan } = fixture('1.0', async (_input, context) => {
    assert.equal(Object.hasOwn(context!, 'signal'), false);
    return result;
  });
  const job = await runtime.executePlan({ ...plan, steps: plan.steps.slice(0, 1) });
  assert.equal(job.result, result);
});

test('run forwards execution supervision after planning has completed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  const planning = deferred<void>();
  const planningEntered = deferred<void>();
  let calls = 0;
  const { runtime, plan } = fixture('1.0', async () => { calls++; });
  const strategy = `supervision.strategy.${randomUUID()}`;
  plannerStrategyRegistry.register({ id: strategy, type: 'test', async execute() {
    planningEntered.resolve(); await planning.promise; return plan;
  } });
  t.mock.method(plannerRouterRegistry, 'getDefault', () => ({ async select() {
    return { strategy };
  } }));
  const pending = runtime.run('planned goal', { signal: controller.signal, timeoutMs: 1000 });
  await planningEntered.promise;
  t.mock.timers.tick(2000);
  planning.resolve();
  const completed = await pending;
  assert.equal(completed.status, 'completed');
  assert.equal(calls, 2);
  controller.abort();
  const cancelled = await runtime.run('pre-cancelled goal', { signal: controller.signal });
  assert.equal(cancelled.error, 'Execution cancelled');
  assert.equal(calls, 2);
});

test('deadline checkpoint prevents entry after synchronous input work delays the timer', async () => {
  let calls = 0;
  const { runtime, plan } = fixture('1.0', async () => { calls++; });
  const input = { get value() {
    const until = performance.now() + 20;
    while (performance.now() < until) { /* Deliberately block timer dispatch. */ }
    return 'value';
  } };
  const job = await runtime.executePlan({ ...plan, steps: [
    { ...plan.steps[0], input },
  ] }, { timeoutMs: 10 });
  assert.equal(job.error, 'Execution deadline exceeded');
  assert.equal(calls, 0);
  assert.ok(!job.events.some(event => event.type === 'capability.started'));
});

for (const first of ['cancel', 'deadline'] as const) {
  test(`${first} remains the primary stop reason when both controls fire`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const controller = new AbortController();
    const entered = deferred<void>();
    const provider = deferred<unknown>();
    const { runtime, plan } = fixture('1.0', () => { entered.resolve(); return provider.promise; });
    const pending = runtime.executePlan(plan, { signal: controller.signal, timeoutMs: 1000 });
    await entered.promise;
    if (first === 'cancel') { controller.abort(); t.mock.timers.tick(1000); }
    else { t.mock.timers.tick(1000); controller.abort(); }
    const job = await pending;
    assert.equal(job.error, first === 'cancel' ? 'Execution cancelled' : 'Execution deadline exceeded');
    provider.resolve('late');
    await settle();
  });
}

test('persistence failure still retains in-flight logger ownership until settlement', async t => {
  const controller = new AbortController();
  const entered = deferred<void>();
  const provider = deferred<unknown>();
  const update = jobStore.update.bind(jobStore);
  const dispose = t.mock.method(JobLogSink.prototype, Symbol.dispose);
  t.mock.method(jobStore, 'update', async (job: Job) => {
    if (job.status === 'failed') throw new Error('persistence failed');
    return update(job);
  });
  const { runtime, plan } = fixture('1.0', () => { entered.resolve(); return provider.promise; });
  const pending = runtime.executePlan(plan, { signal: controller.signal });
  await entered.promise;
  controller.abort();
  await assert.rejects(pending, /persistence failed/);
  assert.equal(dispose.mock.callCount(), 0);
  provider.resolve('late');
  await settle();
  assert.equal(dispose.mock.callCount(), 1);
});
