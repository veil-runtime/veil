import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import Fastify from 'fastify';
import { OperatorRuntime, type ExecutionAuthorizer, type Job } from '../src/index.js';
import { linkedinRoutes } from '../src/api/routes/linkedin.routes.js';
import { jobsRoutes } from '../src/api/routes/jobs.routes.js';
import { executionRoutes } from '../src/api/routes/execution.routes.js';
import { plannerRegistry } from '../src/runtime/planner/planner-registry.js';
import { registerPlannerRouters } from '../src/runtime/planner/register-routers.js';
import { registerPlannerStrategies } from '../src/runtime/planner/strategies/register-strategies.js';

const caller = { subject: 'host-user', scopes: ['read'] };
const forged = { approved: true, caller: { subject: 'admin', scopes: ['*'] }, scopes: ['*'], risk: 'read' };

test('LinkedIn status uses admission, host identity, authorization and normal lifecycle', async t => {
  let providerCalls = 0;
  let failProvider = false;
  const result = { authenticated: true, url: 'https://www.linkedin.com/feed/', title: 'Feed' };
  const setup = new OperatorRuntime();
  const missingApp = Fastify();
  t.after(() => missingApp.close());
  await missingApp.register(linkedinRoutes, { runtime: setup });
  assert.equal((await missingApp.inject('/linkedin/status')).statusCode, 404);
  setup.use({
    manifest: { name: 'linkedin-fixture', version: '1', capabilities: ['linkedin.auth.status'] },
    capabilities: [{ name: 'linkedin.auth.status', version: '1.0.0', risk: 'read', description: 'Fixture',
      async execute(_input, context) {
        providerCalls += 1;
        assert.equal(context?.caller?.subject, 'host-user');
        if (failProvider) throw new Error('Browser unavailable');
        return result;
      },
    }],
  });
  for (const mode of ['allow', 'deny', 'malformed', 'throw', 'provider-failure'] as const) {
    await t.test(mode, async st => {
      const previousCalls = providerCalls;
      const previousJobs = new Set((await setup.listJobs()).map(job => job.id));
      let authorizations = 0;
      failProvider = mode === 'provider-failure';
      const runtime = new OperatorRuntime({ authorizer: {
        async authorize(context) {
          authorizations += 1;
          assert.equal(context.capability.name, 'linkedin.auth.status');
          assert.equal(context.capability.risk, 'read');
          assert.equal(context.caller?.subject, 'host-user');
          assert.deepEqual(context.caller?.scopes, ['read']);
          assert.equal(context.input, undefined);
          if (mode === 'throw') throw new Error('Policy unavailable');
          if (mode === 'malformed') return {} as Awaited<ReturnType<ExecutionAuthorizer['authorize']>>;
          return { decision: mode === 'deny' ? 'deny' : 'allow' };
        },
      } });
      const app = Fastify();
      st.after(() => app.close());
      await app.register(linkedinRoutes, { prefix: '/api', runtime, resolveCaller: async () => caller });
      const response = await app.inject('/api/linkedin/status?approved=true&caller=admin&scopes=*&risk=read');
      const expectedStatus = mode === 'allow' ? 200 : mode === 'deny' ? 403 : 500;
      assert.equal(response.statusCode, expectedStatus);
      assert.equal(authorizations, 1);
      const started = mode === 'allow' || mode === 'provider-failure';
      assert.equal(providerCalls - previousCalls, started ? 1 : 0);
      const jobs = await runtime.listJobs();
      assert.equal(jobs.length, previousJobs.size + 1);
      const job = jobs.find(entry => !previousJobs.has(entry.id))!;
      assert.equal(job.steps[0].capabilityVersion, '1.0.0');
      assert.equal(job.events.some(event => event.type === 'capability.started'), started);
      assert.equal(job.events.some(event => event.type === 'capability.denied'), mode === 'deny');
      assert.equal(job.status, mode === 'allow' ? 'completed' : 'failed');
      if (mode === 'allow') assert.deepEqual(response.json(), result);
    });
  }
});

test('HTTP plan and generic routes cannot acquire authority from request fields', async t => {
  const name = `governance.write.${randomUUID()}`;
  let providerCalls = 0;
  let authorizations = 0;
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize(context) {
      authorizations += 1;
      assert.equal(context.capability.risk, 'write');
      assert.equal(context.caller?.subject, 'host-user');
      assert.deepEqual(context.caller?.scopes, ['read']);
      return { decision: 'deny' };
    },
  } });
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', description: 'Write fixture', risk: 'write',
    async execute() { providerCalls += 1; },
  }] });
  const app = Fastify();
  t.after(() => app.close());
  await app.register(jobsRoutes, { prefix: '/api', runtime, resolveCaller: () => caller });
  await app.register(executionRoutes, { prefix: '/api', runtime, resolveCaller: () => caller });
  const response = await app.inject({ method: 'POST', url: '/api/jobs/execute-plan', payload: {
    version: '1.0', ...forged, metadata: forged,
    steps: [{ id: 'write', capability: name, input: forged, ...forged }],
  } });
  assert.equal(response.statusCode, 201);
  const job = response.json<Job>();
  assert.equal(job.status, 'failed');
  assert.ok(job.events.some(event => event.type === 'capability.denied'));
  const generic = await app.inject({ method: 'POST', url: `/api/capabilities/${name}/execute`, payload: {
    ...forged, input: forged,
  } });
  assert.equal(generic.statusCode, 403);
  assert.equal(authorizations, 2);
  assert.equal(providerCalls, 0);
});

test('HTTP plans validate before authorization, authorize resolved inputs and cannot replay stored jobs', async t => {
  const source = `governance.source.${randomUUID()}`;
  const sink = `governance.sink.${randomUUID()}`;
  const calls: string[] = [];
  let authorizations = 0;
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize(context) {
      authorizations += 1;
      assert.equal(context.caller?.subject, 'host-user');
      if (context.capability.name === sink) {
        assert.deepEqual(context.input, { target: 'production' });
        return { decision: 'deny' };
      }
      return { decision: 'allow' };
    },
  } });
  runtime.use({ manifest: { name: source, version: '1', capabilities: [source, sink] }, capabilities: [
    { name: source, version: '1', risk: 'read', description: 'Source',
      async execute() { calls.push('source'); return { target: 'production' }; } },
    { name: sink, version: '1', risk: 'write', description: 'Sink',
      inputSchema: { target: { type: 'string', required: true, description: 'Target' } },
      async execute() { calls.push('sink'); } },
  ] });
  const app = Fastify();
  t.after(() => app.close());
  await app.register(jobsRoutes, { prefix: '/api', runtime, resolveCaller: () => caller });
  const submit = (steps: unknown[]) => app.inject({ method: 'POST', url: '/api/jobs/execute-plan',
    payload: { version: '1.0', steps } });
  const invalid = await submit([{ id: 'bad', capability: sink, input: { target: 123 } }]);
  assert.equal(invalid.statusCode, 400);
  assert.equal(authorizations, 0);
  assert.deepEqual(await runtime.listJobs({ capability: sink }), []);
  const partial = (await submit([
    { id: 'source', capability: source },
    { id: 'sink', capability: sink, input: { target: { $ref: 'steps.source.result.target' } } },
    { id: 'unattempted', capability: source },
  ])).json<Job>();
  assert.equal(partial.status, 'failed');
  assert.deepEqual(partial.steps.map(step => step.status), ['completed', 'failed', 'pending']);
  assert.deepEqual(calls, ['source']);
  assert.equal(authorizations, 2);
  const complete = (await submit([{ id: 'read', capability: source }])).json<Job>();
  const empty = (await app.inject({ method: 'POST', url: '/api/jobs', payload: { goal: 'Empty job' } })).json<Job>();
  const recorded = JSON.stringify(await runtime.getJob(complete.id));
  for (const id of [complete.id, partial.id, empty.id, 'missing']) {
    const response = await app.inject({ method: 'POST', url: `/api/jobs/${id}/execute`, payload: forged });
    assert.equal(response.statusCode, 410);
  }
  assert.equal(JSON.stringify(await runtime.getJob(complete.id)), recorded);
  assert.deepEqual(calls, ['source', 'source']);
  assert.equal(authorizations, 3);
});

test('HTTP run uses the host runtime and caller, and cannot trust planner authority fields', async t => {
  registerPlannerRouters();
  registerPlannerStrategies();
  const name = `governance.run.${randomUUID()}`;
  let calls = 0;
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize(context) {
      assert.equal(context.caller?.subject, 'host-user');
      assert.equal(context.capability.risk, 'write');
      return { decision: 'deny' };
    },
  } });
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', risk: 'write', description: 'Fixture', async execute() { calls += 1; },
  }] });
  plannerRegistry.register({ id: name, type: 'fixture', enabled: true }, {
    name, async plan(goal) {
      return { version: '1.0', goal, ...forged, steps: [{ id: 'write', capability: name, ...forged }] };
    },
  });
  const app = Fastify();
  t.after(() => app.close());
  await app.register(jobsRoutes, { prefix: '/api', runtime, resolveCaller: () => caller });
  const response = await app.inject({ method: 'POST', url: '/api/jobs/run', payload: {
    goal: 'Request work', planner: name, ...forged,
  } });
  assert.equal(response.statusCode, 201);
  assert.ok(response.json<Job>().events.some(event => event.type === 'capability.denied'));
  assert.equal(calls, 0);
});

test('host caller resolution failure never falls back to anonymous execution', async t => {
  const app = Fastify();
  t.after(() => app.close());
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize() { assert.fail('Authorization must not be reached'); },
  } });
  const name = `governance.caller.${randomUUID()}`;
  runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [{
    name, version: '1', risk: 'read', description: 'Fixture', async execute() { assert.fail('Must not execute'); },
  }] });
  const options = { prefix: '/api', runtime, resolveCaller: () => { throw new Error('Identity unavailable'); } };
  await app.register(jobsRoutes, options);
  await app.register(executionRoutes, options);
  await app.register(linkedinRoutes, options);
  for (const url of ['/api/jobs/execute-plan', '/api/jobs/run', `/api/capabilities/${name}/execute`]) {
    const response = await app.inject({ method: 'POST', url, payload: {
      version: '1.0', steps: [{ id: 'read', capability: name }], goal: 'Read', ...forged,
    } });
    assert.ok(response.statusCode >= 400);
  }
  assert.equal((await app.inject('/api/linkedin/status')).statusCode, 500);
  assert.deepEqual(await runtime.listJobs({ capability: name }), []);
});
