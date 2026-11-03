import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  OperatorRuntime, isPlanAdmissionError,
  type Capability, type CapabilityAuthorizationDecision, type ExecutionPlan,
  type OperatorRuntimeOptions, type Job,
} from '../src/index.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { jobStore } from '../src/runtime/jobs/job-store.js';
import { plannerRouterRegistry } from '../src/runtime/planner/planner-router-registry.js';
import { plannerStrategyRegistry } from '../src/runtime/planner/strategies/planner-strategy-registry.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const capacityError = /Active execution capacity exceeded/;
function fixture(version: '1.0' | '2.0', execute: Capability['execute'], options: OperatorRuntimeOptions = {}) {
  const name = `capacity.${randomUUID()}`;
  const runtime = new OperatorRuntime({ planVersions: [version], ...options });
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', description: 'Capacity fixture', risk: 'read', execute,
  }] });
  const plan: ExecutionPlan = { version, steps: [{ id: 'first', capability: name }] };
  return { runtime, plan };
}
async function rejectsWithoutJobs(runtime: OperatorRuntime, operation: () => Promise<Job>, expected: RegExp) {
  const existing = new Set((await runtime.listJobs()).map(job => job.id));
  let events = 0;
  const unsubscribe = runtimeEventBus.subscribe('*', event => {
    if (!existing.has(event.jobId!)) events++;
  });
  try {
    await assert.rejects(operation(), error => {
      assert.equal(isPlanAdmissionError(error), false);
      assert.match((error as Error).message, expected);
      return true;
    });
    assert.equal((await runtime.listJobs()).length, existing.size);
    assert.equal(events, 0);
  } finally { unsubscribe(); }
}

test('host limits accept zero and safe integers; reject invalid runtime values', () => {
  for (const key of ['maxPlanSteps', 'maxActiveExecutions'] as const) {
    for (const value of [-1, 0.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, true, {}, 1n]) {
      assert.throws(() => new OperatorRuntime({ [key]: value } as OperatorRuntimeOptions), new RegExp(`${key} must be a nonnegative safe integer`));
    }
    for (const value of [undefined, 0, 1, Number.MAX_SAFE_INTEGER]) {
      assert.doesNotThrow(() => new OperatorRuntime({ [key]: value }));
    }
  }
});

for (const version of ['1.0', '2.0'] as const) {
  test(`${version}: exact step boundary executes, over-boundary rejects before Job/events/authorization`, async () => {
    let calls = 0;
    let authorizations = 0;
    const { runtime, plan } = fixture(version, async () => { calls++; return 'ok'; }, {
      maxPlanSteps: 2, maxActiveExecutions: 1,
      authorizer: { async authorize() { authorizations++; return { decision: 'allow' }; } },
    });
    const steps = [plan.steps[0], { ...plan.steps[0], id: 'second' }];
    assert.equal((await runtime.executePlan({ ...plan, steps })).status, 'completed');
    await rejectsWithoutJobs(runtime, () => runtime.executePlan({ ...plan, steps: [...steps, { ...steps[0], id: 'third' }] }), /step limit exceeded/);
    assert.equal(calls, 2);
    assert.equal(authorizations, 2);
    assert.equal((await runtime.executePlan(plan)).status, 'completed');
  });

  test(`${version}: oversized sparse and maximum-length arrays are rejected without reading contents`, async () => {
    const { runtime, plan } = fixture(version, async () => assert.fail('invoked'), { maxPlanSteps: 1 });
    for (const length of [2, 1_000_000, 4_294_967_295]) {
      const steps = new Array<ExecutionPlan['steps'][number]>(length);
      Object.defineProperty(steps, '0', { get() { assert.fail('step read'); } });
      const oversized = { ...plan, steps, get goal() { assert.fail('goal read'); return ''; } };
      await rejectsWithoutJobs(runtime, () => runtime.executePlan(oversized), /step limit exceeded/);
    }
  });

  test(`${version}: zero step/capacity limits reject nonempty plans; omitted limits preserve execution`, async () => {
    const { plan } = fixture(version, async () => 'ok');
    for (const options of [{ maxPlanSteps: 0 }, { maxActiveExecutions: 0 }]) {
      const runtime = new OperatorRuntime({ planVersions: [version], ...options });
      await rejectsWithoutJobs(runtime, () => runtime.executePlan(plan), options.maxPlanSteps === 0 ? /step limit exceeded/ : capacityError);
    }
    const runtime = new OperatorRuntime({ planVersions: [version] });
    assert.equal((await runtime.executePlan(plan)).status, 'completed');
    const empty = new OperatorRuntime({ planVersions: [version], maxPlanSteps: 0 });
    await assert.rejects(empty.executePlan({ ...plan, steps: [] }), isPlanAdmissionError);
    // A sparse plan within the limit keeps the existing malformed-plan rejection.
    await assert.rejects(runtime.executePlan({ ...plan, steps: new Array(1) }), TypeError);
  });

  test(`${version}: simultaneous submissions reject immediately and capacity is per instance`, async () => {
    const entered = deferred<void>();
    const work = deferred<unknown>();
    let calls = 0;
    const { runtime, plan } = fixture(version, (_input, context) => {
      calls++;
      assert.equal(Object.hasOwn(context!, 'signal'), false);
      entered.resolve(); return work.promise;
    }, { maxActiveExecutions: 2 });
    const first = runtime.executePlan(plan);
    const second = runtime.executePlan(plan);
    await rejectsWithoutJobs(runtime, () => runtime.executePlan(plan), capacityError);
    await entered.promise;
    const other = fixture(version, async () => 'independent', { maxActiveExecutions: 1 });
    assert.equal((await other.runtime.executePlan(other.plan)).status, 'completed');
    work.resolve('ok');
    assert.ok((await Promise.all([first, second])).every(job => job.status === 'completed'));
    assert.equal(calls, 2);
    const recovered = await Promise.all([runtime.executePlan(plan), runtime.executePlan(plan)]);
    assert.ok(recovered.every(job => job.status === 'completed'));
  });

  test(`${version}: pre-cancelled submission retains admission semantics and recovers its slot`, async () => {
    let calls = 0;
    const { runtime, plan } = fixture(version, async () => { calls++; }, { maxActiveExecutions: 1, maxPlanSteps: 1 });
    const controller = new AbortController(); controller.abort(); controller.abort();
    await assert.rejects(runtime.executePlan({ ...plan, steps: [...plan.steps, ...plan.steps] }, { signal: controller.signal }), /step limit exceeded/);
    const job = await runtime.executePlan(plan, { signal: controller.signal });
    assert.equal(job.error, 'Execution cancelled');
    assert.deepEqual(job.events.map(event => event.type), ['job.created', 'execution.started', 'job.failed']);
    assert.equal(calls, 0);
    assert.equal((await runtime.executePlan(plan)).status, 'completed');
  });

  for (const termination of ['cancel', 'deadline'] as const) {
    for (const late of ['allow', 'deny', 'reject'] as const) {
      test(`${version}: ${termination} during authorization retains capacity until late ${late} settles`, async t => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const entered = deferred<void>();
        const authorization = deferred<CapabilityAuthorizationDecision>();
        let calls = 0;
        let checks = 0;
        const { runtime, plan } = fixture(version, async () => { calls++; return 'ok'; }, {
          maxActiveExecutions: 1,
          authorizer: { authorize() { checks++; entered.resolve(); return checks === 1 ? authorization.promise : Promise.resolve({ decision: 'allow' }); } },
        });
        const controller = new AbortController();
        const pending = runtime.executePlan(plan, { signal: controller.signal, timeoutMs: 1000 });
        await entered.promise;
        if (termination === 'cancel') { controller.abort(); controller.abort(); }
        else t.mock.timers.tick(1000);
        const job = await pending;
        assert.equal(job.error, termination === 'cancel' ? 'Execution cancelled' : 'Execution deadline exceeded');
        const snapshot = JSON.stringify(job);
        await rejectsWithoutJobs(runtime, () => runtime.executePlan(plan), capacityError);
        if (late === 'reject') authorization.reject(new Error('late authorization'));
        else authorization.resolve({ decision: late });
        await settle();
        assert.equal(calls, 0);
        assert.equal(JSON.stringify(job), snapshot);
        assert.equal((await runtime.executePlan(plan)).status, 'completed');
      });
    }
  }

  for (const termination of ['cancel', 'deadline'] as const) {
    for (const late of ['resolve', 'reject'] as const) {
      test(`${version}: ${termination}/${late} retains capacity for noncooperative capability work`, async t => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const entered = deferred<void>();
        const work = deferred<unknown>();
        let calls = 0;
        const { runtime, plan } = fixture(version, () => {
          calls++; entered.resolve(); return calls === 1 ? work.promise : Promise.resolve('new');
        }, { maxActiveExecutions: 1 });
        const controller = new AbortController();
        const pending = runtime.executePlan(plan, { signal: controller.signal, timeoutMs: 1000 });
        await entered.promise;
        if (termination === 'cancel') { controller.abort(); controller.abort(); t.mock.timers.tick(1000); }
        else { t.mock.timers.tick(1000); controller.abort(); }
        const job = await pending;
        assert.equal(job.error, termination === 'cancel' ? 'Execution cancelled' : 'Execution deadline exceeded');
        const snapshot = JSON.stringify(job);
        await rejectsWithoutJobs(runtime, () => runtime.executePlan(plan), capacityError);
        if (late === 'resolve') work.resolve('late'); else work.reject(new Error('late rejection'));
        await settle();
        assert.equal(JSON.stringify(job), snapshot);
        assert.equal(JSON.stringify(await runtime.getJob(job.id)), snapshot);
        assert.equal((await runtime.executePlan(plan)).status, 'completed');
        // Prove late settlement/repeated cancellation did not double-release.
        const blocking = deferred<unknown>();
        const next = fixture(version, () => blocking.promise);
        const held = runtime.executePlan(next.plan);
        await rejectsWithoutJobs(runtime, () => runtime.executePlan(plan), capacityError);
        blocking.resolve('done'); await held;
      });
    }
  }

  test(`${version}: cooperative deadline recovers capacity after provider rejection`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const entered = deferred<void>();
    let calls = 0;
    const { runtime, plan } = fixture(version, (_input, context) => {
      if (++calls > 1) return Promise.resolve('recovered');
      entered.resolve();
      return new Promise((_resolve, reject) => context!.signal!.addEventListener('abort', () => reject(new Error('stopped'))));
    }, { maxActiveExecutions: 1 });
    const pending = runtime.executePlan(plan, { timeoutMs: 1000 });
    await entered.promise; t.mock.timers.tick(1000);
    assert.equal((await pending).error, 'Execution deadline exceeded');
    assert.equal((await runtime.executePlan(plan)).status, 'completed');
  });

  test(`${version}: invalid configuration, admission, denial and synchronous throws release capacity`, async () => {
    let calls = 0;
    const { runtime, plan } = fixture(version, () => { calls++; throw new Error('sync execution'); }, { maxActiveExecutions: 1 });
    await assert.rejects(runtime.executePlan(plan, { timeoutMs: -1 }), /timeoutMs must/);
    await assert.rejects(runtime.executePlan({ ...plan, version: 'bad' }), isPlanAdmissionError);
    await assert.rejects(runtime.executePlan({ ...plan, steps: [] }), isPlanAdmissionError);
    assert.equal((await runtime.executePlan(plan)).error, 'sync execution');
    assert.equal((await runtime.executePlan(plan)).error, 'sync execution');
    assert.equal(calls, 2);
    for (const authorize of [() => { throw new Error('sync authorization'); }, async () => ({ decision: 'deny' as const }), async () => ({ decision: 'bad' } as unknown as CapabilityAuthorizationDecision)]) {
      const denied = fixture(version, async () => assert.fail('invoked'), { maxActiveExecutions: 1, authorizer: { authorize } });
      assert.equal((await denied.runtime.executePlan(denied.plan)).status, 'failed');
      assert.equal((await denied.runtime.executePlan(denied.plan)).status, 'failed');
    }
  });

  test(`${version}: same-turn cancellation and completion release exactly one reservation`, async () => {
    const controller = new AbortController();
    let calls = 0;
    const { runtime, plan } = fixture(version, async () => {
      calls++; controller.abort(); controller.abort(); return 'completed external effect';
    }, { maxActiveExecutions: 1 });
    const job = await runtime.executePlan(plan, { signal: controller.signal });
    assert.equal(job.error, 'Execution cancelled');
    assert.equal(job.result, undefined);
    const work = deferred<unknown>();
    const other = fixture(version, () => work.promise);
    const held = runtime.executePlan(other.plan);
    await assert.rejects(runtime.executePlan(plan), capacityError);
    work.resolve('done'); await held;
    assert.equal((await runtime.executePlan(plan)).status, 'completed');
    assert.equal(calls, 2);
  });
}

test('limits are captured from trusted construction options and cannot be overridden by a plan', async () => {
  const options = { maxPlanSteps: 1, maxActiveExecutions: 1 };
  const { runtime, plan } = fixture('1.0', async () => 'ok', options);
  options.maxPlanSteps = 10; options.maxActiveExecutions = 0;
  const untrusted = { ...plan, maxPlanSteps: 10, maxActiveExecutions: 10,
    metadata: { maxPlanSteps: 10 }, steps: [...plan.steps, { ...plan.steps[0], id: 'second' }] };
  await assert.rejects(runtime.executePlan(untrusted), /step limit exceeded/);
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
});

test('omitting the step limit preserves the legacy structural getter order', async () => {
  const { runtime, plan } = fixture('1.0', async () => 'ok');
  const reads: string[] = [];
  const submitted = {
    get version() { reads.push('version'); return plan.version; },
    get goal() { reads.push('goal'); return 'goal'; },
    get idempotencyKey() { reads.push('key'); return 'key'; },
    get steps() { reads.push('steps'); return plan.steps; },
  };
  assert.equal((await runtime.executePlan(submitted)).status, 'completed');
  assert.deepEqual(reads, ['version', 'goal', 'key', 'steps']);
});

test('capacity is reserved before reentrant admission or event callbacks', async () => {
  const { runtime, plan } = fixture('1.0', async () => 'ok', { maxActiveExecutions: 1 });
  const rejected: Promise<unknown>[] = [];
  const unsubscribe = runtimeEventBus.subscribe('job.created', () => {
    rejected.push(assert.rejects(runtime.executePlan(plan), capacityError));
  });
  try {
    const submitted = { ...plan, get goal() {
      rejected.push(assert.rejects(runtime.executePlan(plan), capacityError)); return 'reentrant';
    } };
    assert.equal((await runtime.executePlan(submitted)).status, 'completed');
    await Promise.all(rejected);
    assert.equal(rejected.length, 2);
  } finally { unsubscribe(); }
});

test('persistence failure does not release the reservation while capability work remains', async t => {
  const entered = deferred<void>();
  const work = deferred<unknown>();
  let calls = 0;
  const { runtime, plan } = fixture('1.0', () => { entered.resolve(); return ++calls === 1 ? work.promise : Promise.resolve('ok'); }, { maxActiveExecutions: 1 });
  const update = jobStore.update.bind(jobStore);
  t.mock.method(jobStore, 'update', async (job: Job) => {
    if (job.status === 'failed') throw new Error('persistence failed');
    return update(job);
  });
  const controller = new AbortController();
  const pending = runtime.executePlan(plan, { signal: controller.signal });
  await entered.promise; controller.abort();
  await assert.rejects(pending, /persistence failed/);
  await assert.rejects(runtime.executePlan(plan), capacityError);
  work.resolve('late'); await settle();
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
});

test('run plans outside the reservation and then applies runtime admission limits', async t => {
  const planning = deferred<void>();
  const planningEntered = deferred<void>();
  const { runtime, plan } = fixture('1.0', async () => 'ok', { maxActiveExecutions: 1, maxPlanSteps: 1 });
  const strategy = `capacity.strategy.${randomUUID()}`;
  plannerStrategyRegistry.register({ id: strategy, type: 'test', async execute() {
    planningEntered.resolve(); await planning.promise;
    return { ...plan, steps: [...plan.steps, { ...plan.steps[0], id: 'second' }] };
  } });
  t.mock.method(plannerRouterRegistry, 'getDefault', () => ({ async select() { return { strategy }; } }));
  const pending = runtime.run('goal');
  await planningEntered.promise;
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
  planning.resolve(); await assert.rejects(pending, /step limit exceeded/);
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
});
