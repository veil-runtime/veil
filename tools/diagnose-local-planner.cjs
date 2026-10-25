// Manual synthetic-only diagnostic. First run npm test to compile the adapter.
// No real filesystem writes, repository goals, retries or external endpoints.
const assert = require('node:assert/strict');
const { OperatorRuntime } = require('../.tmp/test-build/src/index.js');
const { OpenAICompatiblePlannerProvider } = require('../.tmp/test-build/src/runtime/planner/providers/openai-compatible-planner.js');

const endpoint = 'http://127.0.0.1:11434';
const model = 'qwen3:0.6b';
const timeoutMs = 30_000;
const transport = globalThis.fetch;
const runtime = new OperatorRuntime();
let reads = 0, writes = 0, failures = 0;
runtime.use({ manifest: { name: 'diagnostic', version: '1', capabilities: ['fixture.echo', 'fixture.write'] }, capabilities: [
  { name: 'fixture.echo', version: '1', risk: 'read', description: 'Return supplied synthetic value',
    inputSchema: { value: { type: 'string', required: true, description: 'Synthetic value' } },
    async execute(input) { reads++; return input; } },
  { name: 'fixture.write', version: '1', risk: 'write', description: 'Synthetic write probe; default policy must deny',
    async execute() { writes++; throw Error('Write must not execute'); } },
] });

async function providerProbe(label, goal) {
  let body;
  globalThis.fetch = (url, options) => {
    if (options?.body) body = JSON.parse(options.body);
    return transport(url, options);
  };
  const start = Date.now();
  let capabilities;
  try {
    const planner = new OpenAICompatiblePlannerProvider('diagnostic', `${endpoint}/v1`, model, { timeoutMs });
    const plan = await planner.plan(goal);
    capabilities = plan.steps.map(step => step.capability);
    const job = await runtime.executePlan(plan);
    const denied = job.events.some(event => event.type === 'capability.denied');
    assert.equal(job.status, label === 'read' ? 'completed' : 'failed');
    if (label === 'read') assert.deepEqual(job.result, { value: 'core-v0.4-smoke' });
    else assert.equal(denied, true);
    console.log(JSON.stringify({ label, elapsedMs: Date.now() - start, capabilities, status: job.status, denied }));
  } catch (error) {
    failures++;
    console.log(JSON.stringify({ label, elapsedMs: Date.now() - start, capabilities, error: error.message }));
  } finally { globalThis.fetch = transport; }
  return body;
}

async function nativeProbe(label, captured, think) {
  const start = Date.now();
  let firstByteMs, thinkingCharacters = 0, content = '', pending = '', done;
  const body = { model, messages: captured.messages, format: 'json', stream: true,
    options: { temperature: captured.temperature, num_predict: captured.max_tokens } };
  if (think !== undefined) body.think = think;
  try {
    const response = await transport(`${endpoint}/api/chat`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    assert.equal(response.ok, true);
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      firstByteMs ??= Date.now() - start;
      pending += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (!line.trim()) continue;
        const item = JSON.parse(line);
        thinkingCharacters += (item.message?.thinking ?? '').length;
        content += item.message?.content ?? '';
        assert.ok(thinkingCharacters + content.length < 131_072);
        if (item.done) done = { reason: item.done_reason, evalCount: item.eval_count,
          evalDurationNs: item.eval_duration, promptEvalCount: item.prompt_eval_count,
          promptEvalDurationNs: item.prompt_eval_duration, loadDurationNs: item.load_duration };
      }
    }
    let planJson = false, capabilities;
    try {
      const plan = JSON.parse(content);
      planJson = Array.isArray(plan.steps);
      capabilities = plan.steps?.map(step => step.capability);
    } catch {}
    console.log(JSON.stringify({ label, elapsedMs: Date.now() - start, firstByteMs,
      thinkingCharacters, contentCharacters: content.length, planJson, capabilities, done }));
  } catch (error) {
    console.log(JSON.stringify({ label, elapsedMs: Date.now() - start, firstByteMs,
      thinkingCharacters, contentCharacters: content.length, error: error.name }));
  }
}

async function openAIStreamProbe(captured) {
  const start = Date.now();
  let firstByteMs, thinkingCharacters = 0, content = '', pending = '', finishReason;
  try {
    const response = await transport(`${endpoint}/v1/chat/completions`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...captured, stream: true }),
      signal: AbortSignal.timeout(timeoutMs) });
    assert.equal(response.ok, true);
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      firstByteMs ??= Date.now() - start;
      pending += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline).trim(); pending = pending.slice(newline + 1);
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        const item = JSON.parse(line.slice(6)).choices?.[0];
        thinkingCharacters += (item?.delta?.reasoning ?? item?.delta?.reasoning_content ?? '').length;
        content += item?.delta?.content ?? '';
        finishReason = item?.finish_reason ?? finishReason;
        assert.ok(thinkingCharacters + content.length < 131_072);
      }
    }
    console.log(JSON.stringify({ label: 'openai-stream-explicit-write', elapsedMs: Date.now() - start,
      firstByteMs, thinkingCharacters, contentCharacters: content.length,
      whitespaceCharacters: content.length - content.replace(/\s/g, '').length, finishReason }));
  } catch (error) {
    console.log(JSON.stringify({ label: 'openai-stream-explicit-write', elapsedMs: Date.now() - start,
      firstByteMs, thinkingCharacters, contentCharacters: content.length, error: error.name }));
  }
}

(async () => {
  const version = await (await transport(`${endpoint}/api/version`, { signal: AbortSignal.timeout(5000) })).json();
  console.log(JSON.stringify({ model, version, timeoutMs, node: process.version }));
  await providerProbe('read', 'Use fixture.echo with input {"value":"core-v0.4-smoke"}. Return only the JSON plan. Do not think.');
  const write = await providerProbe('write', 'Propose the single capability fixture.write with input {}. Do not perform it. Return only the JSON plan. Do not think.');
  // Same prompt and token budget: isolate default thinking from explicit disabling.
  await nativeProbe('native-default-write', write);
  await nativeProbe('native-no-thinking-write', write, false);
  const explicit = await providerProbe('write', 'Use exactly fixture.write with input {} in the proposed plan. Return only the JSON plan. /no_think');
  await openAIStreamProbe(explicit);
  await nativeProbe('native-no-thinking-explicit-write', explicit, false);
  assert.equal(writes, 0);
  console.log(JSON.stringify({ reads, writes, failures, note: 'Native probes are observations, not runtime validation.' }));
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
