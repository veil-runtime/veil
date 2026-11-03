import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { OperatorRuntime, type Capability } from '../src/index.js';
import { ConsoleExecutionLogger } from '../src/runtime/execution/console-execution-logger.js';
import type { ExecutionLogEntry } from '../src/runtime/execution/execution-logger.js';
import { CompositeLogSink } from '../src/runtime/logging/composite-log-sink.js';
import { ConsoleLogSink } from '../src/runtime/logging/console-log-sink.js';
import { ExecutionLogStore } from '../src/runtime/logging/execution-log-store.js';
import { JobLogSink } from '../src/runtime/logging/job-log-sink.js';
import { reportLoggingFailure } from '../src/runtime/logging/logging-diagnostic.js';
import { SQLiteLogSink } from '../src/runtime/logging/sqlite-log-sink.js';

const entry: ExecutionLogEntry = {
  timestamp: 'now', level: 'info', message: 'fixture', jobId: 'job', stepId: 'step',
};
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function quiet(t: TestContext) {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
}
function fixture(execute: Capability['execute'], runtime = new OperatorRuntime()) {
  const name = `logging.${randomUUID()}`;
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', description: 'Logging regression', risk: 'read', execute,
  }] });
  return { runtime, plan: { version: '1.0', steps: [
    { id: 'first', capability: name }, { id: 'second', capability: name },
  ] } };
}
function connections(t: TestContext) {
  const opened = new Set<Database.Database>();
  const exec = Database.prototype.exec;
  t.mock.method(Database.prototype, 'exec', function(this: Database.Database, sql: string) {
    if (sql.includes('CREATE TABLE IF NOT EXISTS execution_logs')) opened.add(this);
    return exec.call(this, sql);
  });
  return opened;
}

test('diagnostics are sanitized, bounded and contain recursion, throws and rejection', async t => {
  let calls = 0;
  const diagnostic = t.mock.method(console, 'error', (message: unknown) => {
    calls += 1;
    assert.equal(typeof message, 'string');
    assert.ok(String(message).length < 150);
    assert.ok(!String(message).includes('secret'));
    reportLoggingFailure();
    throw new Error('secret');
  });
  reportLoggingFailure();
  assert.equal(calls, 1);
  diagnostic.mock.mockImplementation(() => {
    calls += 1;
    return Promise.reject(new Error('diagnostic rejection')) as unknown as void;
  });
  for (let i = 0; i < 100; i += 1) reportLoggingFailure();
  await settle();
  assert.equal(calls, 10);
});

test('logger contains synchronous throws, async rejections and hostile thenables', async t => {
  quiet(t);
  for (const write of [
    () => { throw new Error('sync'); },
    () => Promise.reject(new Error('async')),
    () => Object.defineProperty({}, 'then', { get() { throw new Error('then'); } }) as Promise<void>,
  ]) {
    const logger = new ConsoleExecutionLogger('job', 'step', { write });
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      assert.doesNotThrow(() => logger[level]('message'));
    }
  }
  await settle(); // node:test also fails the test on any unhandled rejection.
});

test('composite attempts every sink despite synchronous and asynchronous failure', async t => {
  quiet(t);
  const observed: ExecutionLogEntry[] = [];
  const sink = new CompositeLogSink([
    { write() { throw new Error('sync'); } },
    { write() { return Promise.reject(new Error('async')); } },
    { write(value) { observed.push(value); } },
  ]);
  await assert.doesNotReject(sink.write(entry));
  assert.deepEqual(observed, [entry]);
});

test('cyclic metadata in console and SQLite leaves successful execution intact', async t => {
  quiet(t);
  const opened = connections(t);
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const { runtime, plan } = fixture(async (_input, context) => {
    context!.logger.info('cycle', cycle);
    return 'success';
  });
  const job = await runtime.executePlan(plan);
  await settle();
  assert.equal(job.status, 'completed');
  assert.deepEqual(job.result, ['success', 'success']);
  assert.equal(opened.size, 1);
  assert.ok([...opened].every(db => !db.open));
});

test('repeated jobs open one connection per logging execution and close every one', async t => {
  quiet(t);
  const opened = connections(t);
  const { runtime, plan } = fixture(async (_input, context) => {
    const logger = context!.logger;
    logger.info('one'); logger.info('two');
  });
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await runtime.executePlan(plan)).status, 'completed');
    assert.equal(opened.size, i + 1);
    assert.ok([...opened].every(db => !db.open));
  }
  const silent = fixture(async () => {});
  await silent.runtime.executePlan(silent.plan);
  assert.equal(opened.size, 20);
});

test('logging and cleanup failure preserve primary execution error', async t => {
  quiet(t);
  const opened = connections(t);
  t.mock.method(ConsoleLogSink.prototype, 'write', () => { throw new Error('console'); });
  t.mock.method(SQLiteLogSink.prototype, 'write', function(this: SQLiteLogSink) {
    throw new Error('sqlite write');
  });
  const close = Database.prototype.close;
  t.mock.method(Database.prototype, 'close', function(this: Database.Database) {
    close.call(this);
    throw new Error('cleanup');
  });
  const { runtime, plan } = fixture(async (_input, context) => {
    const logger = context!.logger;
    logger.error('failure');
    throw new Error('primary execution error');
  });
  const job = await runtime.executePlan(plan);
  await settle();
  assert.equal(job.error, 'primary execution error');
  assert.equal(job.steps[0].error, 'primary execution error');
  assert.equal(opened.size, 1);
  assert.ok([...opened].every(db => !db.open));
});

test('schema construction failure releases connection and is not retried within job', async t => {
  quiet(t);
  const opened = new Set<Database.Database>();
  const exec = Database.prototype.exec;
  t.mock.method(Database.prototype, 'exec', function(this: Database.Database, sql: string) {
    if (sql.includes('CREATE TABLE IF NOT EXISTS execution_logs')) {
      opened.add(this);
      throw new Error('schema construction');
    }
    return exec.call(this, sql);
  });
  const { runtime, plan } = fixture(async (_input, context) => {
    const logger = context!.logger;
    logger.info('one'); logger.info('two');
    return 'success';
  });
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
  assert.equal(opened.size, 1);
  assert.ok([...opened].every(db => !db.open));
});

test('database open failure is contained without retry or changing success', async t => {
  quiet(t);
  const directory = mkdtempSync(join(tmpdir(), 'veil-log-open-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let attempts = 0;
  // A directory is an invalid SQLite file on every supported platform.
  assert.throws(() => new SQLiteLogSink(directory));
  t.mock.method(fs, 'mkdirSync', () => {
    attempts += 1;
    throw new Error('open failed');
  });
  const { runtime, plan } = fixture(async (_input, context) => {
    context!.logger.info('open failure');
    return 'success';
  });
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
  assert.equal(attempts, 1);
  await settle();
});

test('rejecting sink and failing cleanup cannot change a successful job', async t => {
  quiet(t);
  const opened = connections(t);
  t.mock.method(ConsoleLogSink.prototype, 'write', () =>
    Promise.reject(new Error('async sink')) as unknown as void);
  const close = Database.prototype.close;
  t.mock.method(Database.prototype, 'close', function(this: Database.Database) {
    close.call(this);
    throw new Error('cleanup');
  });
  const { runtime, plan } = fixture(async (_input, context) => {
    context!.logger.info('success');
    return 42;
  });
  const job = await runtime.executePlan(plan);
  await settle();
  assert.equal(job.status, 'completed');
  assert.deepEqual(job.result, [42, 42]);
  assert.ok([...opened].every(db => !db.open));
});

test('constructor cleanup failure does not replace schema error', t => {
  quiet(t);
  const close = Database.prototype.close;
  t.mock.method(Database.prototype, 'exec', () => { throw new Error('schema'); });
  t.mock.method(Database.prototype, 'close', function(this: Database.Database) {
    close.call(this);
    throw new Error('cleanup');
  });
  assert.throws(() => new SQLiteLogSink(':memory:'), /^Error: schema$/);
});

test('concurrent runtimes release only their own connection; retained loggers cannot reopen', async t => {
  quiet(t);
  const opened = connections(t);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  let retained!: () => void;
  const first = fixture(async (_input, context) => {
    const logger = context!.logger;
    logger.info('first'); retained = () => logger.info('late'); entered(); await gate;
  });
  const pending = first.runtime.executePlan(first.plan);
  await started;
  const [firstDb] = opened;
  const second = fixture(async (_input, context) => {
    const logger = context!.logger; logger.info('second'); });
  await second.runtime.executePlan(second.plan);
  assert.equal(opened.size, 2);
  assert.equal(firstDb.open, true);
  assert.equal([...opened][1].open, false);
  release();
  await pending;
  retained();
  assert.equal(opened.size, 2);
  assert.ok([...opened].every(db => !db.open));
});

test('internal owner disposal is idempotent and prevents reopening', t => {
  quiet(t);
  const opened = connections(t);
  const owner = new JobLogSink();
  owner.write(entry);
  owner[Symbol.dispose](); owner[Symbol.dispose](); owner.write(entry);
  assert.equal(opened.size, 1);
  assert.ok([...opened].every(db => !db.open));
});

test('read store uses query-scoped connections on success and failure', t => {
  quiet(t);
  const directory = mkdtempSync(join(tmpdir(), 'veil-log-store-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'logs.db');
  const sink = new SQLiteLogSink(path);
  sink.write(entry);
  const closed: Database.Database[] = [];
  const close = Database.prototype.close;
  t.mock.method(Database.prototype, 'close', function(this: Database.Database) {
    closed.push(this);
    return close.call(this);
  });
  const store = new ExecutionLogStore(path);
  for (let i = 0; i < 10; i += 1) assert.equal(store.listByJob('job').length, 1);
  assert.equal(closed.length, 10);
  assert.ok(closed.every(db => !db.open));
  assert.equal(sink['db'].open, true);
  const missing = new ExecutionLogStore(join(directory, 'missing.db'));
  assert.throws(() => missing.listByJob('job'), /no such table/);
  assert.equal(closed.length, 11);
  sink[Symbol.dispose]();
});

test('native close refusal is contained and attempted once without retry', async t => {
  quiet(t);
  const opened = connections(t);
  const close = Database.prototype.close;
  let attempts = 0;
  t.mock.method(Database.prototype, 'close', () => {
    attempts += 1;
    throw new Error('native close refused');
  });
  t.after(() => {
    for (const db of opened) if (db.open) close.call(db);
  });
  const { runtime, plan } = fixture(async (_input, context) => {
    context!.logger.info('before failure');
    throw new Error('primary');
  });
  const job = await runtime.executePlan(plan);
  assert.equal(job.error, 'primary');
  assert.equal(attempts, 1);
  assert.equal(opened.size, 1);
  // A failed native close cannot promise release; the test owns final cleanup.
  assert.ok([...opened].every(db => db.open));
});
