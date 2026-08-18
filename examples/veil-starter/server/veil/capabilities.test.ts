import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { deployTriggerCapability, githubRepoGetCapability } from './capabilities.js';
import { starterPlanner } from './planner.js';
import { starterExecutionAuthorizer } from './execution-authorizer.js';
import {
  createDemoPlan,
  createSupportPlan,
  runtime,
} from './runtime.js';
import { runMcpServiceHealth } from './mcp.js';

function mockResponse(
  status: number,
  body: unknown,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function withMockFetch(
  mock: typeof fetch,
  callback: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('github.repo.get maps GitHub metadata through the capability', async () => {
  let requestedUrl = '';
  await withMockFetch(async (url) => {
    requestedUrl = String(url);
    return mockResponse(200, {
      name: 'veil',
      full_name: 'veil-runtime/veil',
      description: 'A governed execution runtime',
      stargazers_count: 42,
      open_issues_count: 3,
      html_url: 'https://github.com/veil-runtime/veil',
    });
  }, async () => {
    const result = await githubRepoGetCapability.execute({
      owner: 'veil-runtime',
      repo: 'veil',
    });

    assert.equal(
      requestedUrl,
      'https://api.github.com/repos/veil-runtime/veil',
    );
    assert.deepEqual(result, {
      name: 'veil',
      fullName: 'veil-runtime/veil',
      description: 'A governed execution runtime',
      stars: 42,
      openIssues: 3,
      url: 'https://github.com/veil-runtime/veil',
    });
  });
});

test('github.repo.get only requests GitHub when its plan executes', async () => {
  let requests = 0;
  await withMockFetch(async () => {
    requests += 1;
    return mockResponse(200, {
      name: 'veil',
      full_name: 'veil-runtime/veil',
      description: null,
      stargazers_count: 42,
      open_issues_count: 3,
      html_url: 'https://github.com/veil-runtime/veil',
    });
  }, async () => {
    const plan = createDemoPlan('github.repo.get', {
      owner: 'veil-runtime',
      repo: 'veil',
    });

    assert.equal(requests, 0);

    const job = await runtime.executePlan(plan);

    assert.equal(requests, 1);
    assert.equal(job.status, 'completed');
    assert.equal(job.steps[0]?.capability, 'github.repo.get');
    assert.deepEqual(job.result, {
      name: 'veil',
      fullName: 'veil-runtime/veil',
      description: null,
      stars: 42,
      openIssues: 3,
      url: 'https://github.com/veil-runtime/veil',
    });
  });
});

test('github.repo.get records non-success GitHub responses as runtime failures', async () => {
  await withMockFetch(async () => mockResponse(404, {}), async () => {
    const job = await runtime.executePlan(createDemoPlan('github.repo.get', {
      owner: 'veil-runtime',
      repo: 'missing',
    }));

    assert.equal(job.status, 'failed');
    assert.match(job.error ?? '', /status 404/);
    assert.equal(job.steps[0]?.status, 'failed');
  });
});

test('github.repo.get records network errors as runtime failures', async () => {
  await withMockFetch(async () => {
    throw new Error('Network unavailable');
  }, async () => {
    const job = await runtime.executePlan(createDemoPlan('github.repo.get', {
      owner: 'veil-runtime',
      repo: 'veil',
    }));

    assert.equal(job.status, 'failed');
    assert.match(job.error ?? '', /Network unavailable/);
    assert.equal(job.steps[0]?.status, 'failed');
  });
});

test('github.repo.get records malformed GitHub responses as runtime failures', async () => {
  await withMockFetch(async () => mockResponse(200, {
    name: 'veil',
  }), async () => {
    const job = await runtime.executePlan(createDemoPlan('github.repo.get', {
      owner: 'veil-runtime',
      repo: 'veil',
    }));

    assert.equal(job.status, 'failed');
    assert.match(job.error ?? '', /response was malformed/);
    assert.equal(job.steps[0]?.status, 'failed');
  });
});

test('support plan chaining remains available', async () => {
  const job = await runtime.executePlan(createSupportPlan({
    customerId: 'CUST-001',
    issue: 'Cannot access account',
  }));

  assert.equal(job.status, 'completed');
  assert.deepEqual(job.steps.map((step) => step.status), [
    'completed',
    'completed',
  ]);
  assert.deepEqual(job.result, [
    {
      id: 'CUST-001',
      name: 'Amina',
      email: 'amina@example.com',
      plan: 'Business',
    },
    {
      to: 'amina@example.com',
      subject: 'Regarding your account access',
      body: 'Hi Amina, we received your message about Cannot access account. We will help you restore access to your Business account.',
      status: 'drafted',
    },
  ]);
});

test('the deterministic planner proposes the registered service.health capability', async () => {
  const goal = 'Check the payments service';
  const plan = await starterPlanner.plan(goal);

  assert.equal(plan.goal, goal);
  assert.deepEqual(plan.steps, [{
    id: 'check-payments-service',
    capability: 'service.health',
    capabilityVersion: '1.0.0',
    input: { serviceName: 'payments-api' },
    reason: 'Check the requested payments service.',
  }]);
  assert.ok(runtime.listCapabilities().some(
    (capability) => capability.name === plan.steps[0]?.capability,
  ));
});

test('the runtime executes a plan proposed by the deterministic planner', async () => {
  const plan = await starterPlanner.plan('Check the payments service');
  const job = await runtime.executePlan(plan);

  assert.equal(job.status, 'completed');
  assert.equal(job.steps[0]?.capability, 'service.health');
  assert.ok(job.events.some((event) => event.type === 'capability.started'));
  assert.deepEqual(job.result, {
    serviceName: 'payments-api',
    status: 'healthy',
    checked: true,
  });
});

test('MCP executes the registered service.health capability through the public adapter', async () => {
  const execution = await runMcpServiceHealth('payments-api');

  assert.deepEqual(execution.request, {
    name: 'service.health',
    arguments: { serviceName: 'payments-api' },
  });
  assert.equal(execution.job.status, 'completed');
  assert.equal(execution.job.steps[0]?.capability, 'service.health');
  assert.ok(execution.job.events.some((event) => event.type === 'capability.started'));
  assert.deepEqual(execution.result, {
    serviceName: 'payments-api',
    status: 'healthy',
    checked: true,
  });
});

test('the MCP Starter integration uses only the public adapter and runtime boundary', async () => {
  const mcp = await readFile(new URL('./mcp.ts', import.meta.url), 'utf8');

  assert.match(mcp, /from '@veil-runtime\/core'/);
  assert.match(mcp, /new McpAdapter\(runtime\)/);
  assert.match(mcp, /client\.callTool\(request\)/);
  assert.match(mcp, /runtime\.listJobs\(\)/);
  assert.doesNotMatch(mcp, /src\/integrations\/mcp|\.execute\s*\(/);
});

test('the planner is isolated from runtime and capability execution', async () => {
  const [planner, client] = await Promise.all([
    readFile(new URL('./planner.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../client/src/App.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(planner, /(?:\.execute|\.executePlan)\s*\(/);
  assert.doesNotMatch(planner, /OperatorRuntime|Capability/);
  assert.match(client, /\/api\/planner|\/api\/plan-and-run/);
  assert.doesNotMatch(client, /service\.health|@veil-runtime\/core/);
});

test('deploy.trigger authorizes a valid staging plan and executes once', async () => {
  const plan = createDemoPlan('deploy.trigger', {
    service: 'payments-api',
    environment: 'staging',
  });
  const decision = await starterExecutionAuthorizer.authorize({
    jobId: 'staging-job',
    stepId: 'deploy-trigger',
    capability: {
      name: deployTriggerCapability.name,
      version: deployTriggerCapability.version,
      risk: deployTriggerCapability.risk,
    },
    input: plan.steps[0]?.input,
  });

  assert.deepEqual(decision, { decision: 'allow' });

  const job = await runtime.executePlan(plan);
  const eventTypes = job.events.map((event) => event.type);

  assert.equal(deployTriggerCapability.risk, 'write');
  assert.equal(job.status, 'completed');
  assert.deepEqual(job.result, {
    service: 'payments-api',
    environment: 'staging',
    status: 'triggered',
  });
  assert.equal(
    eventTypes.filter((type) => type === 'capability.started').length,
    1,
  );
  assert.ok(!eventTypes.includes('capability.denied'));
});

test('deploy.trigger denies a valid production plan before execution', async () => {
  const plan = createDemoPlan('deploy.trigger', {
    service: 'payments-api',
    environment: 'production',
  });
  const decision = await starterExecutionAuthorizer.authorize({
    jobId: 'production-job',
    stepId: 'deploy-trigger',
    capability: {
      name: deployTriggerCapability.name,
      version: deployTriggerCapability.version,
      risk: deployTriggerCapability.risk,
    },
    input: plan.steps[0]?.input,
  });

  assert.deepEqual(decision, {
    decision: 'deny',
    reason: 'Production deployments are not permitted in Veil Starter.',
  });

  const job = await runtime.executePlan(plan);
  const eventTypes = job.events.map((event) => event.type);

  assert.equal(job.status, 'failed');
  assert.ok(eventTypes.includes('execution.started'));
  assert.ok(eventTypes.includes('capability.denied'));
  assert.equal(
    eventTypes.filter((type) => type === 'capability.started').length,
    0,
  );
  assert.equal(
    job.events.find((event) => event.type === 'capability.denied')?.data?.reason,
    'Production deployments are not permitted in Veil Starter.',
  );
});

test('the capability owns the GitHub integration boundary', async () => {
  const [server, client] = await Promise.all([
    readFile(new URL('../index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../client/src/App.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(server, /api\.github\.com|github\.com/);
  assert.doesNotMatch(client, /api\.github\.com|github\.com|@veil-runtime\/core/);
});
