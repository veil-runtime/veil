import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import Fastify from 'fastify';
import { OperatorRuntime, type CapabilityRisk, type ExecutionAuthorizer } from '../src/index.js';
import { executionRoutes } from '../src/api/routes/execution.routes.js';

async function fixture(
  t: TestContext,
  risk: CapabilityRisk = 'read',
  authorizer?: ExecutionAuthorizer,
  failure?: string,
) {
  const runtime = new OperatorRuntime({ authorizer });
  const name = `test.http.${randomUUID()}`;
  let executions = 0;
  runtime.use({
    manifest: { name, version: '1.0.0', capabilities: [name] },
    capabilities: [{
      name, version: '1.0.0', description: 'HTTP test capability', risk,
      inputSchema: {
        value: { type: 'string', required: true, description: 'Test value' },
      },
      async execute(input) {
        executions += 1;
        if (failure) throw new Error(failure);
        return input;
      },
    }],
  });
  const app = Fastify();
  t.after(() => app.close());
  await app.register(executionRoutes, { prefix: '/api', runtime });
  return {
    app, runtime, name,
    executions: () => executions,
    request: (payload: Record<string, unknown> = { input: { value: 'hello' } }) => app.inject({
      method: 'POST', url: `/api/capabilities/${name}/execute`, payload,
    }),
    jobs: () => runtime.listJobs({ capability: name }),
  };
}

test('HTTP read executes exactly once and records the normal job lifecycle', async (t) => {
  const f = await fixture(t);
  const response = await f.request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    capability: f.name, risk: 'read', result: { value: 'hello' },
  });
  assert.equal(f.executions(), 1);
  const jobs = await f.jobs();
  assert.equal(jobs.length, 1);
  const job = await f.runtime.getJob(jobs[0].id);
  assert.ok(job);
  assert.equal(job.status, 'completed');
  assert.equal(job.outcome, 'success');
  assert.equal(job.steps.length, 1);
  assert.equal(job.steps[0].capability, f.name);
  assert.equal(job.steps[0].status, 'completed');
  assert.deepEqual(job.result, response.json().result);
  assert.deepEqual(job.events.map((event) => event.type), [
    'job.created', 'execution.started', 'capability.started',
    'capability.completed', 'job.completed',
  ]);
});

test('HTTP invalid input never reaches authorization or execution', async (t) => {
  let authorizations = 0;
  const f = await fixture(t, 'read', {
    async authorize() { authorizations += 1; return { decision: 'allow' }; },
  });
  for (const input of [{ value: 123 }, {}, { value: { $ref: 'steps.other.result' } }]) {
    const response = await f.request({ input });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /^Execution plan failed validation:/);
  }
  assert.equal(authorizations, 0);
  assert.equal(f.executions(), 0);
  assert.deepEqual(await f.jobs(), []);
});

test('HTTP unknown capability retains its 404 response', async (t) => {
  const f = await fixture(t);
  const response = await f.app.inject({
    method: 'POST', url: '/api/capabilities/missing/execute', payload: {},
  });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'Capability not found', capability: 'missing' });
  assert.equal(f.executions(), 0);
});

for (const risk of ['write', 'destructive'] as const) {
  test(`HTTP approved:true cannot override default ${risk} denial`, async (t) => {
    const f = await fixture(t, risk);
    const response = await f.request({ input: { value: 'hello' }, approved: true });
    assert.equal(response.statusCode, 403);
    assert.equal(f.executions(), 0);
    const [job] = await f.jobs();
    assert.equal(job.status, 'failed');
    assert.equal(job.outcome, 'failed');
    assert.equal(job.steps[0].startedAt, undefined);
    assert.deepEqual(job.events.map((event) => event.type), [
      'job.created', 'execution.started', 'capability.denied', 'job.failed',
    ]);
    assert.equal(response.json().error, job.error);
  });
}

test('HTTP host authorizer can deny a read', async (t) => {
  const f = await fixture(t, 'read', {
    async authorize(context) {
      assert.deepEqual(context.input, { value: 'hello' });
      return { decision: 'deny', reason: 'Host denied this read' };
    },
  });
  const response = await f.request();
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, 'Host denied this read');
  assert.equal(f.executions(), 0);
  const [job] = await f.jobs();
  assert.equal(job.steps[0].startedAt, undefined);
  assert.ok(job.events.some((event) => event.type === 'capability.denied'));
  assert.ok(!job.events.some((event) => event.type === 'capability.started'));
});

test('HTTP host authorizer can allow a write without client approval', async (t) => {
  let authorizations = 0;
  const f = await fixture(t, 'write', {
    async authorize(context) {
      authorizations += 1;
      assert.equal(context.capability.risk, 'write');
      assert.deepEqual(context.input, { value: 'hello' });
      return { decision: 'allow' };
    },
  });
  const response = await f.request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    capability: f.name, risk: 'write', result: { value: 'hello' },
  });
  assert.equal(authorizations, 1);
  assert.equal(f.executions(), 1);
});

test('HTTP authorizer exception fails the job without starting capability execution', async (t) => {
  const f = await fixture(t, 'read', {
    async authorize() { throw new Error('Policy unavailable'); },
  });
  const response = await f.request();
  assert.equal(response.statusCode, 500);
  assert.equal(f.executions(), 0);
  const [job] = await f.jobs();
  assert.equal(job.status, 'failed');
  assert.equal(job.outcome, 'failed');
  assert.equal(job.steps[0].status, 'failed');
  assert.equal(job.steps[0].startedAt, undefined);
  assert.equal(response.json().error, job.error);
  assert.equal(job.error, 'Policy unavailable');
  assert.deepEqual(job.events.map((event) => event.type), [
    'job.created', 'execution.started', 'capability.failed', 'job.failed',
  ]);
});

test('HTTP capability failure returns 500 and records failure after one execution', async (t) => {
  const f = await fixture(t, 'read', undefined, 'Provider unavailable');
  const response = await f.request();
  assert.equal(response.statusCode, 500);
  assert.equal(f.executions(), 1);
  const [job] = await f.jobs();
  assert.equal(job.status, 'failed');
  assert.equal(job.outcome, 'failed');
  assert.equal(job.steps[0].status, 'failed');
  assert.equal(job.error, 'Provider unavailable');
  assert.equal(response.json().error, job.error);
  assert.deepEqual(job.events.map((event) => event.type), [
    'job.created', 'execution.started', 'capability.started',
    'capability.failed', 'job.failed',
  ]);
});
