import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import Fastify from 'fastify';
import { OperatorRuntime, type ExecutionAuthorizer } from '../src/index.js';
import { shellCommandRunCapability } from '../src/capabilities/shell/command-run.js';
import { evaluateCommandPolicy } from '../src/runtime/permissions/command-policy.js';
import { executionRoutes } from '../src/api/routes/execution.routes.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { ConsoleExecutionLogger } from '../src/runtime/execution/console-execution-logger.js';

const setup = new OperatorRuntime();
setup.use({ manifest: { name: 'shell-fixture', version: '1', capabilities: ['shell.command.run'] },
  capabilities: [shellCommandRunCapability] });

const plan = (input: unknown) => ({ version: '1.0', steps: [{
  id: 'shell', capability: 'shell.command.run', input,
}] });
const permitting = () => new OperatorRuntime({ authorizer: {
  async authorize() { return { decision: 'allow' }; },
} });
function intercept(t: TestContext) {
  const calls: Array<{ command: string; args: string[]; options: childProcess.SpawnOptions }> = [];
  t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: childProcess.SpawnOptions) => {
    calls.push({ command, args: [...args], options });
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    setImmediate(() => { child.stdout.emit('data', 'fixture output'); child.emit('close', 0); });
    return child;
  });
  return calls;
}

test('an allowed shell prefix cannot be extended into branch deletion', async t => {
  const attempts: unknown[] = [];
  t.mock.method(childProcess, 'spawn', (command: string, args: string[]) => {
    attempts.push({ command, args: [...args] });
    throw new Error('Intercepted process invocation; no process was started');
  });
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize({ input }) {
      assert.deepEqual(input, { command: 'git', args: ['branch', '-D', 'fixture-only'] });
      // Even a coarse host permission must not bypass the capability restriction.
      return { decision: 'allow' };
    },
  } });
  const job = await runtime.executePlan({ version: '1.0', steps: [{
    id: 'shell', capability: 'shell.command.run',
    input: { command: 'git', args: ['branch', '-D', 'fixture-only'] },
  }] });
  assert.equal(job.status, 'failed');
  assert.deepEqual(attempts, [], 'mutation arguments must never reach spawn');
});

const invocations: Array<[string, string[]]> = [
  ['git', ['status']], ['git', ['log']], ['git', ['diff']], ['git', ['branch']], ['git', ['show']],
  ['docker', ['ps']], ['docker', ['images']], ['node', ['--version']], ['npm', ['--version']],
  ['pnpm', ['--version']], ['python', ['--version']], ['python3', ['--version']], ['dotnet', ['--info']],
];

test('complete tuple matching rejects every prefix extension and argument-boundary confusion', () => {
  for (const [command, args] of invocations) {
    assert.equal(evaluateCommandPolicy(command, args).allowed, true);
    for (const suffix of ['-D', 'new-branch', '--output=fixture-only', '|', '>', '$(id)', '']) {
      assert.equal(evaluateCommandPolicy(command, [...args, suffix]).allowed, false);
    }
    assert.equal(evaluateCommandPolicy(command, [args.join(' ') + ' extra']).allowed, false);
  }
  for (const [command, args] of [
    ['git', ['-c', 'alias.x=!anything', 'x']], ['git', ['branch -D fixture-only']],
    ['git', ['branch', '-m', 'old', 'new']], ['git', ['diff', '--output=fixture-only']],
    ['git', ['show', '--ext-diff']], ['git', ['log', '--output=fixture-only']],
    ['docker', ['model', 'list']], ['npx', ['--version']], ['sh', ['-c', 'git status']],
    ['env', ['git', 'status']], ['/usr/bin/git', ['status']],
  ] as Array<[string, string[]]>) {
    assert.equal(evaluateCommandPolicy(command, args).allowed, false);
  }
  assert.equal(evaluateCommandPolicy('git', new Array<string>(1)).allowed, false);
});

test('canonical supported commands retain exact dispatch under explicit host authorization', async t => {
  const calls = intercept(t);
  for (const [command, args] of invocations) {
    const job = await permitting().executePlan(plan({ command, args }));
    assert.equal(job.status, 'completed', job.error ?? 'Canonical invocation should complete');
    const call = calls.at(-1)!;
    assert.equal(call.command, command);
    assert.deepEqual(call.args, args);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.cwd, resolve(process.env.OPERATOR_FILES_ROOT ?? process.cwd()));
    assert.equal(call.options.env, process.env); // Host environment remains a documented trust assumption.
  }
  assert.equal(calls.length, invocations.length);
});

test('ambiguous encodings, unsupported arguments and interpreters never reach spawn', async t => {
  const calls = intercept(t);
  for (const input of [
    { command: 'git branch', args: ['branch', '-D', 'fixture-only'] },
    { command: 'git status' }, { command: '["git","status"]' },
    { command: '["git",broken]' }, { command: ['git', 'status'] },
    { command: ' git', args: ['status'] }, { command: 'git\nstatus' },
    { command: 'git;anything' }, { command: '$(git)', args: ['status'] },
    { command: 'git', args: ['status', '>', 'fixture-only'] },
    { command: 'git', args: ['branch', 'new-branch'] },
    { command: 'git', args: ['diff', '--output=fixture-only'] },
    { command: 'git', args: [null] }, { command: 'git', args: [{}] },
    { command: 'git', args: new Array(1) }, { command: 'git', args: 'status' },
    { command: 'git', args: ['status\0'] }, { command: 'git', args: ['status'], cwd: '..' },
    { command: 'node', args: ['--version', '-e', 'anything'] },
    { command: 'sh', args: ['-c', 'git status'] },
    { command: 'npx', args: ['some-package'] },
  ]) {
    try {
      const job = await permitting().executePlan(plan(input));
      assert.equal(job.status, 'failed', JSON.stringify(input));
    } catch (error) {
      assert.match((error as Error).message, /^Execution plan failed validation:/);
    }
  }
  assert.deepEqual(calls, []);
});

test('default, denied, malformed and throwing authorizers never start a shell process', async t => {
  const calls = intercept(t);
  assert.equal(setup.describeCapability('shell.command.run')?.risk, 'destructive');
  const malformed = {} as Awaited<ReturnType<ExecutionAuthorizer['authorize']>>;
  const policies: Array<ExecutionAuthorizer | undefined> = [undefined,
    { async authorize() { return { decision: 'deny' }; } },
    { async authorize() { return malformed; } },
    { async authorize() { throw new Error('Policy unavailable'); } },
  ];
  for (const authorizer of policies) {
    const job = await new OperatorRuntime({ authorizer }).executePlan(plan({ command: 'git', args: ['status'] }));
    assert.equal(job.status, 'failed');
    assert.ok(!job.events.some(event => event.type === 'capability.started'));
  }
  assert.deepEqual(calls, []);
});

test('runtime authorization observes resolved command, full args and requested cwd before dispatch', async t => {
  const calls = intercept(t);
  const source = 'shell.source';
  const invocation = { command: 'git', args: ['branch'], cwd: '.' };
  const observed: unknown[] = [];
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize(context) {
      if (context.capability.name === 'shell.command.run') {
        assert.equal(calls.length, 0);
        assert.equal(context.capability.risk, 'destructive');
        assert.deepEqual(context.input, invocation);
        observed.push(JSON.parse(JSON.stringify(context.input)));
      }
      return { decision: 'allow' };
    },
  } });
  runtime.use({ manifest: { name: source, version: '1', capabilities: [source] }, capabilities: [{
    name: source, version: '1', risk: 'read', description: 'Invocation fixture',
    async execute() { return invocation; },
  }] });
  const job = await runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'shell', capability: 'shell.command.run', input: {
      command: { $ref: 'steps.source.result.command' },
      args: { $ref: 'steps.source.result.args' },
      cwd: { $ref: 'steps.source.result.cwd' },
    } },
  ] });
  assert.equal(job.status, 'completed');
  assert.deepEqual(observed, [invocation]);
  assert.deepEqual(calls.map(({ command, args }) => ({ command, args })), [{ command: 'git', args: ['branch'] }]);
});

test('a retained result mutated to an unlisted invocation after authorization is blocked at the shell boundary', async t => {
  const calls = intercept(t);
  const args = ['branch'];
  const source = 'shell.mutable-source';
  const runtime = permitting();
  runtime.use({ manifest: { name: source, version: '1', capabilities: [source] }, capabilities: [{
    name: source, version: '1', risk: 'read', description: 'Mutable result fixture', async execute() { return args; },
  }] });
  t.after(runtimeEventBus.subscribe('capability.started', event => {
    if (event.data?.capability === 'shell.command.run') args.push('-D', 'fixture-only');
  }));
  const job = await runtime.executePlan({ version: '1.0', steps: [
    { id: 'source', capability: source },
    { id: 'shell', capability: 'shell.command.run', input: { command: 'git', args: { $ref: 'steps.source.result' } } },
  ] });
  assert.equal(job.status, 'failed');
  assert.match(job.error!, /exact policy/);
  assert.deepEqual(calls, []);
  // This proves only rejection of unlisted tuples, not authorization-value stability.
});

test('HTTP authority claims cannot turn default shell denial into execution', async t => {
  const calls = intercept(t);
  const app = Fastify();
  t.after(() => app.close());
  await app.register(executionRoutes, { runtime: new OperatorRuntime() });
  const claims = { approved: true, risk: 'read', caller: { scopes: ['*'] }, scopes: ['*'] };
  const response = await app.inject({ method: 'POST', url: '/capabilities/shell.command.run/execute',
    payload: { ...claims, input: { command: 'git', args: ['status'], ...claims } } });
  assert.equal(response.statusCode, 403);
  assert.deepEqual(calls, []);
});

test('log metadata cannot extend the checked argument vector before spawn', async t => {
  const calls = intercept(t);
  t.mock.method(ConsoleExecutionLogger.prototype, 'info', (_message: string, metadata?: Record<string, unknown>) => {
    if (Array.isArray(metadata?.args)) metadata.args.push('-D', 'fixture-only');
  });
  const job = await permitting().executePlan(plan({ command: 'git', args: ['branch'] }));
  assert.equal(job.status, 'completed');
  assert.deepEqual(calls.map(call => call.args), [['branch']]);
});

test('explicitly authorized node version executes successfully on the trusted test host', async () => {
  const job = await permitting().executePlan(plan({ command: 'node', args: ['--version'] }));
  assert.equal(job.status, 'completed', job.error ?? 'Node version should complete');
  const result = job.result as { exitCode: number; stdout: string };
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout.trim(), /^v\d+\.\d+\.\d+/);
});
