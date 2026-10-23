import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { OperatorRuntime } from '../src/index.js';
import { OpenAICompatiblePlannerProvider } from '../src/runtime/planner/providers/openai-compatible-planner.js';
import { registerPlanners } from '../src/runtime/planner/register-planners.js';
import { registerPlannerStrategies } from '../src/runtime/planner/strategies/register-strategies.js';
import { registerPlannerRouters } from '../src/runtime/planner/register-routers.js';

const read = 'local-planner.read', write = 'local-planner.write';
let starts = 0;
const runtime = new OperatorRuntime();
runtime.use({ manifest: { name: 'local-planner-test', version: '1', capabilities: [read, write, 'web.page.read'] }, capabilities: [
  { name: read, version: '3.2.1', risk: 'read', description: 'Read fixture',
    inputSchema: { value: { type: 'string', required: true, description: 'value' } },
    async execute(input) { starts++; return input; } },
  { name: write, version: '1.0.0', risk: 'write', description: 'Write fixture', async execute() { starts++; } },
  { name: 'web.page.read', version: '1.0.0', risk: 'read', description: 'No-network deterministic fixture',
    async execute(input) { starts++; return input; } },
] });
const response = (plan: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }));
const valid = () => ({ steps: [{ capability: read, input: { value: 'ok' }, reason: 'inspect' }] });
const planner = (limits = {}) => new OpenAICompatiblePlannerProvider('test', 'http://127.0.0.1:11434/v1', 'fixture-model', limits);

test('local planner: bounded request advertises passive metadata, pins versions and never executes while planning', async t => {
  const before = starts;
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    const body = JSON.parse(options.body as string);
    assert.equal(body.max_tokens, 1024); assert.equal(body.temperature, 0);
    const data = JSON.parse(body.messages[1].content);
    assert.ok(data.capabilities.some((entry: { name: string }) => entry.name === read));
    assert.equal(JSON.stringify(data).includes('"execute"'), false);
    return response({ ...valid(), version: '2.0' });
  });
  const plan = await planner().plan('Inspect fixture');
  assert.equal(starts, before); assert.equal(plan.version, '1.0');
  assert.equal(plan.steps[0]!.capabilityVersion, '3.2.1');
  assert.equal((await runtime.executePlan(plan)).status, 'completed');
});

test('local planner: model writes remain default-denied and input validation precedes authority', async t => {
  t.mock.method(globalThis, 'fetch', async () => response({ steps: [{ capability: write, input: {} }] }));
  const before = starts;
  const job = await runtime.executePlan(await planner().plan('Write fixture'));
  assert.equal(job.status, 'failed');
  assert.ok(job.events.some(event => event.type === 'capability.denied'));
  assert.ok(!job.events.some(event => event.type === 'capability.started'));
  let authorized = 0;
  const policyRuntime = new OperatorRuntime({ authorizer: { async authorize() { authorized++; return { decision: 'allow' }; } } });
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => response({ steps: [{ capability: read, input: { value: 12 } }] }));
  await assert.rejects(policyRuntime.executePlan(await planner().plan('Invalid input')), /validation/);
  assert.equal(authorized, 0); assert.equal(starts, before);
});

test('local planner: malformed envelopes, authority fields and unsupported steps fail before execution', async t => {
  const before = starts;
  const invalid = [null, [], {}, { steps: [] }, { steps: [null] }, { steps: [{ capability: 'invented' }] },
    { steps: [{ capability: read, input: [] }] }, { steps: [{ capability: read, input: null }] },
    { steps: [{ capability: read, reason: 42 }] }, { ...valid(), approved: true },
    { steps: [{ capability: read, caller: { subject: 'admin' } }] },
    { steps: Array.from({ length: 17 }, () => valid().steps[0]) }];
  for (const proposal of invalid) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response(proposal));
    await assert.rejects(planner().plan('Inspect fixture'));
    mock.mock.restore();
  }
  for (const body of ['private invalid response', '{}', '{"choices":[]}', '{"choices":[{"message":{"content":"not-json-secret"}}]}']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(body));
    await assert.rejects(planner().plan('Inspect'), error => error instanceof Error && !error.message.includes('secret'));
    mock.mock.restore();
  }
  assert.equal(starts, before);
});

test('local planner: invalid configuration and oversized input stop before fetch', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw Error('Must not call'); });
  for (const endpoint of ['file:///tmp/model', 'http://remote.invalid/v1', 'https://user:secret@example.invalid', 'http://localhost/v1?secret=1']) {
    assert.throws(() => new OpenAICompatiblePlannerProvider('test', endpoint, 'model'));
  }
  for (const limits of [{ timeoutMs: 0 }, { maxSteps: 65 }, { maxResponseBytes: Infinity }, { maxOutputTokens: -1 }]) {
    assert.throws(() => planner(limits), /limits/);
  }
  await assert.rejects(planner({ maxRequestBytes: 100 }).plan('Inspect'), /request exceeds byte limit/);
  assert.equal(mock.mock.callCount(), 0);
});

test('local planner: streamed and declared response limits cancel the body', async t => {
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1000)); }, cancel() { cancelled = true; },
  })));
  await assert.rejects(planner({ maxResponseBytes: 100 }).plan('Inspect'), /response exceeds byte limit/);
  assert.equal(cancelled, true);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { headers: { 'content-length': '1000' } }));
  await assert.rejects(planner({ maxResponseBytes: 100 }).plan('Inspect'), /response exceeds byte limit/);
});

test('local planner: deadlines cover stalled fetch and stalled body without requiring transport cooperation', async t => {
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return new Promise<Response>(() => {});
  });
  await assert.rejects(planner({ timeoutMs: 20 }).plan('Inspect'), /timed out/);
  assert.equal(signal?.aborted, true);
  t.mock.restoreAll();
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await assert.rejects(planner({ timeoutMs: 20 }).plan('Inspect'), /timed out/);
  assert.equal(cancelled, true);
});

test('local planner: bounded health failures and transport errors expose no provider content', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: [{ id: 'fixture-model' }] })));
  assert.deepEqual(await planner().healthCheck(), { healthy: true, available: true });
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(1000)));
  assert.equal((await planner({ maxResponseBytes: 100 }).healthCheck()).healthy, false);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => { throw Error('private token body'); });
  await assert.rejects(planner().plan('Inspect'), /^Error: Planner transport failed$/);
});

test('local planner: source-server default runs deterministically with zero model calls', async t => {
  const old = process.env.OPERATOR_LOCAL_PLANNERS;
  delete process.env.OPERATOR_LOCAL_PLANNERS;
  t.after(() => { if (old === undefined) delete process.env.OPERATOR_LOCAL_PLANNERS; else process.env.OPERATOR_LOCAL_PLANNERS = old; });
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw Error('No default inference'); });
  registerPlanners(); registerPlannerStrategies(); registerPlannerRouters();
  const job = await runtime.run('Read https://example.invalid');
  assert.equal(job.status, 'completed'); assert.equal(mock.mock.callCount(), 0);
  await assert.rejects(runtime.run('Inspect', { planner: 'qwen-local' }), /Planner not found/);
});

test('local planner: explicitly enabled Qwen traverses router, strategy, admission and default authorization', () => {
  const source = resolve(__dirname, '../src');
  const script = `
    const assert = require('node:assert/strict');
    const {OperatorRuntime}=require(${JSON.stringify(joinSource('runtime/operator-runtime.js'))});
    require(${JSON.stringify(joinSource('runtime/planner/register-planners.js'))}).registerPlanners();
    require(${JSON.stringify(joinSource('runtime/planner/strategies/register-strategies.js'))}).registerPlannerStrategies();
    require(${JSON.stringify(joinSource('runtime/planner/register-routers.js'))}).registerPlannerRouters();
    const runtime=new OperatorRuntime(); let started=0;
    runtime.use({manifest:{name:'fixture',version:'1',capabilities:['fixture.write']},capabilities:[{name:'fixture.write',version:'1',risk:'write',description:'fixture',async execute(){started++;}}]});
    let calls=0;
    globalThis.fetch=async url=>{calls++;return new Response(JSON.stringify(String(url).endsWith('/models')?{data:[{id:'fixture'}]}:{choices:[{message:{content:JSON.stringify({steps:[{capability:'fixture.write',input:{}}]})}}]}));};
    runtime.run('Write fixture',{planner:'qwen-local'}).then(job=>{assert.equal(job.status,'failed');assert.equal(started,0);assert.equal(calls,2);assert.ok(job.events.some(e=>e.type==='capability.denied'));console.log('opt-in governed');}).catch(error=>{console.error(error);process.exitCode=1});
  `;
  function joinSource(path: string) { return resolve(source, path); }
  const result = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, OPERATOR_LOCAL_PLANNERS: '1', QWEN_BASE_URL: 'http://127.0.0.1:11434/v1', QWEN_MODEL: 'fixture',
      LLAMA_MAC_BASE_URL: 'http://127.0.0.1:11434/v1', LLAMA_MAC_MODEL: 'fixture' } });
  assert.match(result, /opt-in governed/);
});
