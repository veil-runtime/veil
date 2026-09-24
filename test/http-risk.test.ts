import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { OperatorRuntime, type ExecutionAuthorizer } from '../src/index.js';
import { httpRequestCapability } from '../src/capabilities/http/request.js';
import { httpProvider } from '../src/providers/http/fetch-http-provider.js';
import { executionRoutes } from '../src/api/routes/execution.routes.js';

test('HTTP transport risk covers destructive methods and requires runtime authorization for every method', async t => {
  let providerCalls = 0;
  t.mock.method(httpProvider, 'request', async () => {
    providerCalls += 1;
    return { status: 200, headers: {}, body: { ok: true }, url: 'https://example.com/' };
  });
  const runtime = new OperatorRuntime();
  runtime.use({ manifest: { name: 'http-fixture', version: '1', capabilities: ['http.request'] },
    capabilities: [httpRequestCapability] });
  assert.equal(runtime.describeCapability('http.request')?.risk, 'destructive');
  const app = Fastify();
  t.after(() => app.close());
  await app.register(executionRoutes, { runtime });
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'get', 'delete']) {
    const input = { method, url: 'https://example.com/' };
    const job = await runtime.executePlan({ version: '1.0', steps: [{
      id: 'http', capability: 'http.request', input,
    }] });
    assert.equal(job.status, 'failed', method);
    assert.ok(job.events.some(event => event.type === 'capability.denied'));
    assert.ok(!job.events.some(event => event.type === 'capability.started'));
    const response = await app.inject({ method: 'POST', url: '/capabilities/http.request/execute', payload: {
      input, approved: true, risk: 'read', caller: { scopes: ['*'] }, scopes: ['*'],
    } });
    assert.equal(response.statusCode, 403, method);
  }
  assert.equal(providerCalls, 0);

  const host = new OperatorRuntime({ authorizer: {
    async authorize({ capability, input }) {
      assert.equal(capability.risk, 'destructive');
      const request = input as { method: string; url: string };
      return { decision: request.method === 'GET' && request.url === 'https://example.com/' ? 'allow' : 'deny' };
    },
  } });
  for (const method of ['GET', 'DELETE']) {
    const job = await host.executePlan({ version: '1.0', steps: [{
      id: 'http', capability: 'http.request', input: { method, url: 'https://example.com/' },
    }] });
    assert.equal(job.status, method === 'GET' ? 'completed' : 'failed');
  }
  assert.equal(providerCalls, 1);

  for (const mode of ['malformed', 'throw'] as const) {
    const failing = new OperatorRuntime({ authorizer: {
      async authorize() {
        if (mode === 'throw') throw new Error('Policy unavailable');
        return { decision: 'yes' } as unknown as Awaited<ReturnType<ExecutionAuthorizer['authorize']>>;
      },
    } });
    const job = await failing.executePlan({ version: '1.0', steps: [{
      id: 'http', capability: 'http.request', input: { method: 'GET', url: 'https://example.com/' },
    }] });
    assert.equal(job.status, 'failed');
    assert.ok(!job.events.some(event => event.type === 'capability.started'));
  }
  assert.equal(providerCalls, 1);
});
