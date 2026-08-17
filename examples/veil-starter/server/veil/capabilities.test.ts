import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { githubRepoGetCapability } from './capabilities.js';
import {
  createDemoPlan,
  createSupportPlan,
  runtime,
} from './runtime.js';

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

test('the capability owns the GitHub integration boundary', async () => {
  const [server, client] = await Promise.all([
    readFile(new URL('../index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../client/src/App.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(server, /api\.github\.com|github\.com/);
  assert.doesNotMatch(client, /api\.github\.com|github\.com|@veil-runtime\/core/);
});
