import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { OperatorRuntime, isPlanAdmissionError, type ExecutionPlan } from '../src/index.js';
import { jobManager } from '../src/runtime/jobs/job-manager.js';
import { jobStore } from '../src/runtime/jobs/job-store.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';
import { jobsRoutes } from '../src/api/routes/jobs.routes.js';
import { deterministicPlanner } from '../src/runtime/planner/deterministic-planner.js';
import { OpenAICompatiblePlannerProvider } from '../src/runtime/planner/providers/openai-compatible-planner.js';

let invoked = 0;
let authorized = 0;
const runtime = new OperatorRuntime({ authorizer: { async authorize() {
  authorized++; return { decision: 'allow' };
} } });
const capability = 'test.plan-version.echo';
runtime.use({ manifest: { name: capability, version: '1', capabilities: [capability] }, capabilities: [{
  name: capability, version: '1', risk: 'read', description: 'version fixture',
  async execute(input) { invoked++; return input; },
}] });
const steps = [{ id: 'echo', capability, input: { value: 'ok' } }];
async function rejection(plan: unknown) {
  try { await runtime.executePlan(plan as ExecutionPlan); } catch (error) { return error; }
  assert.fail('Expected rejection');
}

for (const [label, version] of [
  ['missing', undefined], ['future', '2.0'], ['empty', ''], ['numeric', 1], ['null', null],
  ['boolean', true], ['array', ['1.0']], ['record', { value: '1.0' }],
  ['whitespace', ' 1.0'], ['patch', '1.0.0'], ['alias', 'v1'],
] as const) test(`plan version rejects ${label} before Job/auth/invocation`, async t => {
  const create = t.mock.method(jobManager, 'create');
  const persist = t.mock.method(jobStore, 'create');
  const update = t.mock.method(jobStore, 'update');
  const events: string[] = [];
  t.after(runtimeEventBus.subscribe('*', event => { events.push(event.type); }));
  const counts = [authorized, invoked];
  // Exercise genuinely untyped transport data; missing version is not supplied.
  const proposal: unknown = JSON.parse(JSON.stringify({ version, steps }));
  const error = await rejection(proposal);
  assert.ok(isPlanAdmissionError(error));
  assert.equal(error.name, 'Error');
  assert.equal(error.message, "Execution plan version is not supported; expected '1.0'.");
  assert.deepEqual(error.issues, [{ code: 'UNSUPPORTED_PLAN_VERSION', message: 'The plan version is not supported.' }]);
  assert.equal(JSON.stringify(error), '{}');
  assert.equal(create.mock.callCount() + persist.mock.callCount() + update.mock.callCount(), 0);
  assert.deepEqual([authorized, invoked], counts); assert.deepEqual(events, []);
});

test('version is read once before other fields; no coercion or implicit fallback', async () => {
  let reads = 0;
  const job = await runtime.executePlan({ get version() { reads++; return reads === 1 ? '1.0' : '2.0'; }, steps });
  assert.equal(reads, 1); assert.equal(job.status, 'completed');
  assert.deepEqual(job.result, { value: 'ok' });
  const error = await rejection({ version: { toString(): never { throw Error('coercion'); } },
    get steps(): never { throw Error('must not capture'); } });
  assert.ok(isPlanAdmissionError(error));
  const accessorError = new Error('version getter');
  assert.equal(await rejection({ get version(): never { throw accessorError; }, steps }), accessorError);
  assert.equal(isPlanAdmissionError(accessorError), false);
});

test('version admission preserves identity provenance and foreign-call containment', async () => {
  const first = await rejection({ version: '2.0', steps });
  assert.ok(isPlanAdmissionError(first));
  assert.equal(isPlanAdmissionError(Object.assign(new Error(), { code: first.code, issues: first.issues })), false);
  const second = await rejection({ get version(): never { throw first; }, steps });
  assert.ok(second instanceof Error); assert.equal(isPlanAdmissionError(second), false);
  assert.equal(second.cause, first); assert.ok(isPlanAdmissionError(first));
});

test('HTTP external JSON retains safe fixed-message response and supported v1 succeeds', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(jobsRoutes, { runtime });
  for (const body of [{ steps }, { version: 1, steps }, { version: 'secret-future-version', steps }]) {
    const counts = [authorized, invoked];
    const response = await app.inject({ method: 'POST', url: '/jobs/execute-plan', payload: body });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Execution plan version is not supported; expected '1.0'." });
    assert.deepEqual([authorized, invoked], counts);
  }
  const response = await app.inject({ method: 'POST', url: '/jobs/execute-plan', payload: { version: '1.0', steps } });
  assert.equal(response.statusCode, 201); assert.equal(response.json().status, 'completed');
});

test('built-in planners construct supported v1 even from untrusted model version data', async t => {
  assert.equal((await deterministicPlanner.plan('Read https://example.invalid')).version, '1.0');
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ choices: [{ message: {
    content: JSON.stringify({ version: '2.0', steps: [{ capability, input: {} }] }),
  } }] }), { status: 200 }));
  const planner = new OpenAICompatiblePlannerProvider('fixture', 'https://example.invalid', 'fixture');
  assert.equal((await planner.plan('fake task')).version, '1.0');
});
