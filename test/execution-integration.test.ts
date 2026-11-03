import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import {
  OperatorRuntime,
  type Capability, type CapabilityAuthorizationDecision, type ExecutionPlan,
} from '../src/index.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const capacityError = /Active execution capacity exceeded/;

function connections(t: TestContext) {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
  const opened: Database.Database[] = [];
  const exec = Database.prototype.exec;
  t.mock.method(Database.prototype, 'exec', function(this: Database.Database, sql: string) {
    if (sql.includes('CREATE TABLE IF NOT EXISTS execution_logs')) opened.push(this);
    return exec.call(this, sql);
  });
  // Test-owned fallback cleanup also runs if an assertion fails before settlement.
  const close = Database.prototype.close;
  t.after(() => { for (const db of opened) if (db.open) close.call(db); });
  return opened;
}

function register(runtime: OperatorRuntime, version: '1.0' | '2.0', execute: Capability['execute']) {
  const name = `integration.${randomUUID()}`;
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', description: 'Integrated lifecycle fixture', risk: 'read', execute,
  }] });
  return (input?: unknown): ExecutionPlan => ({ version, steps: [{ id: 'first', capability: name, input }] });
}

for (const version of ['1.0', '2.0'] as const) {
  for (const termination of ['cancel', 'deadline'] as const) {
    for (const late of ['resolve', 'reject'] as const) {
      test(`${version}: integrated logging/capacity ${termination}, late ${late}, concurrent owners`, async t => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const opened = connections(t);
        const runtime = new OperatorRuntime({ planVersions: [version], maxPlanSteps: 2, maxActiveExecutions: 2 });
        const stoppedEntry = deferred<Database.Database>();
        const peerEntry = deferred<Database.Database>();
        const replacementEntry = deferred<Database.Database>();
        const stoppedWork = deferred<unknown>();
        const peerWork = deferred<unknown>();
        const replacementWork = deferred<unknown>();
        let lateLog!: () => void;
        let calls = 0;
        const plan = register(runtime, version, (input, context) => {
          calls++;
          context!.logger.info('active');
          const db = opened.at(-1)!;
          if (input === 'stopped') {
            lateLog = () => context!.logger.info('still owned after logical stop');
            stoppedEntry.resolve(db);
            return stoppedWork.promise;
          }
          if (input === 'peer') { peerEntry.resolve(db); return peerWork.promise; }
          if (input === 'replacement') { replacementEntry.resolve(db); return replacementWork.promise; }
          return Promise.resolve('quick');
        });
        const controller = new AbortController();
        const firstPlan = plan('stopped');
        const stopped = runtime.executePlan({ ...firstPlan, steps: [
          ...firstPlan.steps, { ...firstPlan.steps[0], id: 'never', input: 'forbidden-next-step' },
        ] }, { signal: controller.signal, timeoutMs: 1000 });
        const firstDb = await stoppedEntry.promise;
        const peer = runtime.executePlan(plan('peer'));
        const peerDb = await peerEntry.promise;
        assert.notEqual(firstDb, peerDb);
        await assert.rejects(runtime.executePlan(plan()), capacityError);
        if (termination === 'cancel') controller.abort();
        else t.mock.timers.tick(1000);
        const job = await stopped;
        assert.equal(job.error, termination === 'cancel' ? 'Execution cancelled' : 'Execution deadline exceeded');
        assert.equal(job.steps[1].status, 'pending');
        const snapshot = JSON.stringify(job);
        assert.equal(firstDb.open, true);
        assert.equal(peerDb.open, true);
        lateLog();
        assert.deepEqual(firstDb.prepare('SELECT count(*) AS n FROM execution_logs WHERE job_id = ?').get(job.id), { n: 2 });
        await assert.rejects(runtime.executePlan(plan()), capacityError);
        peerWork.resolve('peer completed');
        assert.equal((await peer).status, 'completed');
        assert.equal(peerDb.open, false);
        assert.equal(firstDb.open, true);
        // Fill the peer's released slot. The stopped Job still owns the other slot.
        const replacement = runtime.executePlan(plan('replacement'));
        const replacementDb = await replacementEntry.promise;
        await assert.rejects(runtime.executePlan(plan()), capacityError);
        if (late === 'resolve') stoppedWork.resolve('late external effect');
        else stoppedWork.reject(new Error('late provider failure'));
        await settle();
        assert.equal(firstDb.open, false);
        assert.equal(replacementDb.open, true);
        assert.equal(JSON.stringify(job), snapshot);
        assert.equal(JSON.stringify(await runtime.getJob(job.id)), snapshot);
        lateLog();
        assert.equal(opened.length, 3, 'retained logger cannot reopen SQLite');
        assert.equal((await runtime.executePlan(plan())).status, 'completed');
        assert.equal(calls, 4, 'late work cannot schedule the next step');
        replacementWork.resolve('replacement completed');
        await replacement;
        assert.ok(opened.every(db => !db.open));
      });
    }
  }

  for (const failure of ['deny', 'malformed', 'throw'] as const) {
    test(`${version}: ${failure} authorization while a logging Job owns capacity`, async t => {
      const opened = connections(t);
      const entered = deferred<void>();
      const work = deferred<unknown>();
      const authorizationEntered = deferred<void>();
      const authorization = deferred<CapabilityAuthorizationDecision>();
      let checks = 0;
      let calls = 0;
      const runtime = new OperatorRuntime({ planVersions: [version], maxActiveExecutions: 2,
        authorizer: { authorize() {
          if (++checks !== 2) return Promise.resolve({ decision: 'allow' as const });
          authorizationEntered.resolve(); return authorization.promise;
        } },
      });
      const plan = register(runtime, version, (_input, context) => {
        calls++; context!.logger.info('held'); entered.resolve(); return work.promise;
      });
      const held = runtime.executePlan(plan());
      await entered.promise;
      const denied = runtime.executePlan(plan(), { timeoutMs: 1000 });
      await authorizationEntered.promise;
      await assert.rejects(runtime.executePlan(plan()), capacityError);
      if (failure === 'throw') authorization.reject(new Error('primary authorization failure'));
      else authorization.resolve(failure === 'deny' ? { decision: 'deny', reason: 'host denial' }
        : { decision: 'invalid' } as unknown as CapabilityAuthorizationDecision);
      const job = await denied;
      assert.equal(job.status, 'failed');
      assert.equal(job.error, failure === 'throw' ? 'primary authorization failure'
        : failure === 'deny' ? 'host denial' : 'Invalid authorization decision');
      assert.ok(!job.events.some(event => event.type === 'capability.started'));
      assert.equal(calls, 1);
      assert.equal(opened.length, 1);
      assert.equal(opened[0].open, true);
      // Authorization failure released only its reservation.
      const recovered = runtime.executePlan(plan());
      await settle();
      assert.equal(calls, 2);
      await assert.rejects(runtime.executePlan(plan()), capacityError);
      work.resolve('done');
      await Promise.all([held, recovered]);
      assert.ok(opened.every(db => !db.open));
    });
  }

  test(`${version}: cleanup failure preserves execution failure and releases capacity`, async t => {
    const opened = connections(t);
    const close = Database.prototype.close;
    t.mock.method(Database.prototype, 'close', function(this: Database.Database) {
      close.call(this); throw new Error('secondary cleanup failure');
    });
    const runtime = new OperatorRuntime({ planVersions: [version], maxActiveExecutions: 1, maxPlanSteps: 1 });
    const plan = register(runtime, version, async (_input, context) => {
      context!.logger.info('before primary failure');
      throw new Error('primary execution failure');
    });
    for (let i = 0; i < 2; i++) {
      const job = await runtime.executePlan(plan(), { timeoutMs: 1000 });
      assert.equal(job.error, 'primary execution failure');
      assert.equal(job.steps[0].error, job.error);
      assert.equal(job.events.filter(event => event.type === 'job.failed').length, 1);
    }
    assert.equal(opened.length, 2);
    assert.ok(opened.every(db => !db.open));
  });
}
