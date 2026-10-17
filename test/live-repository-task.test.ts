import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLiveTask, replay, type Transport } from '../apps/repository-task/live.js';
import { workspaceCapabilities } from '../apps/repository-task/workspace.js';
import { acceptanceCapability } from '../apps/repository-task/acceptance.js';
import { trialFixture, trialLimits, trialModel, trialObjective, simulated, dryActions, capabilityAction as a, correctedLabels } from '../apps/repository-task/trial.js';

// Isolate this worker's sandbox artifacts from the existing security suite's
// whole-directory cleanup assertion. Production sandbox behavior is unchanged.
const originalTmp = process.env.TMPDIR;
let isolatedTmp: string;
before(async () => { isolatedTmp = await mkdtemp(join(tmpdir(), 'veil-live-tests-')); process.env.TMPDIR = isolatedTmp; });
after(async () => {
  if (originalTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = originalTmp;
  await rm(isolatedTmp, { recursive: true, force: true });
});

async function fixture(body: (f: Awaited<ReturnType<typeof trialFixture>>) => Promise<void>) {
  const f = await trialFixture(); try { await body(f); } finally { await f.cleanup(); }
}
const verify = a('verification.sandbox.run');
const write = a('workspace.write', { path: 'src/labels.ts', content: correctedLabels });
const finish = '{"type":"finish","summary":"success"}';
const direct = (text: string) => { const parsed = JSON.parse(text); return JSON.stringify({ type: parsed.capability, input: parsed.input }); };

test('live adapter: direct envelopes normalize with raw evidence preserved and canonical replay', async () => fixture(async ({ profile }) => {
  const canonical = [a('workspace.list', { path: '.' }), a('workspace.read', { path: 'src/labels.ts' }), write,
    a('workspace.patch', { path: 'src/labels.ts', search: 'const seen', replace: 'const seen' }), verify];
  const responses = canonical.map(direct);
  const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([...responses, finish]), 'simulated');
  assert.equal(r.report.classification, 'verified');
  canonical.forEach((expected, index) => {
    assert.equal(r.exchanges[index].action, expected);
    assert.equal((r.exchanges[index].response as any).output[0].content[0].text, responses[index]);
  });
  // Replay must use actions, never the raw provider response.
  for (const exchange of r.exchanges) exchange.response = { invalid: true };
  const replayed = await replay(r, profile);
  assert.equal(replayed.report.classification, 'verified');
  assert.equal(replayed.report.patch, r.report.patch);
  for (const invalid of [responses[0], a('shell.run'), '{"type":"finish","input":{}}']) {
    r.exchanges[0].action = invalid;
    const rejected = await replay(r, profile);
    assert.equal(rejected.report.classification, 'uncertain');
    assert.match(rejected.report.reason, /Unsupported action/);
    assert.deepEqual(rejected.report.feedback, []);
  }
}));

test('live adapter: rejects unknown, malformed, extra-field and ambiguous envelopes', async () => fixture(async ({ profile }) => {
  const invalid = ['null', '[]', '{}', '{"type":"capability","input":{}}',
    ...['catalogue name', 'shell.run', 'workspace.delete', 'constructor', '__proto__', 'toString', 'hasOwnProperty'].flatMap(name => [a(name), direct(a(name))]),
    ...[undefined, null, [], 'text', 1, true].flatMap(input => [
      JSON.stringify({ type: 'capability', capability: 'workspace.list', input }),
      JSON.stringify({ type: 'workspace.list', input }),
    ]),
    ...[{ type: 'workspace.list', capability: 'workspace.list', input: { path: '.' } },
      { type: 'workspace.write', capability: 'workspace.read', input: {} },
      { type: 'workspace.list', input: {}, summary: 'extra' },
      { type: 'capability', capability: 'workspace.list', input: {}, extra: true },
      { type: 'finish', capability: 'workspace.list', input: {} }].map(value => JSON.stringify(value)),
    '{"type":"workspace.list","input":{},"__proto__":{}}'];
  for (const response of invalid) {
    const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([response]), 'simulated');
    assert.equal(r.report.classification, 'uncertain', response);
    assert.match(r.report.reason, /Malformed action|Unsupported action/);
    assert.equal(r.exchanges[0].action, undefined);
    assert.equal((r.exchanges[0].response as any).output[0].content[0].text, response);
    assert.deepEqual(r.report.feedback, []);
    assert.equal(r.report.patch, '');
    assert.equal(r.report.originalUnchanged, true);
  }
}));

test('live adapter: normalized actions retain runner schema and authorization checks', async () => fixture(async ({ profile }) => {
  for (const input of [{ path: '../escape', content: 'bad' }, { path: 'src/labels.ts', content: 42 }]) {
    const r = await runLiveTask('Fix', profile, trialModel, trialLimits,
      simulated([JSON.stringify({ type: 'workspace.write', input }), finish]), 'simulated');
    assert.equal(r.exchanges[0].action, a('workspace.write', input));
    assert.equal(r.report.feedback[0].authorized, false);
    assert.notEqual(r.report.feedback[0].status, 'completed');
    assert.equal(r.report.patch, '');
  }
}));

test('live adapter: prompt uses the current host catalogue and a valid optional example', async () => fixture(async ({ profile }) => {
  const list = a('workspace.list', { path: '.' });
  const r = await runLiveTask(trialObjective, profile, trialModel, trialLimits, simulated([list, finish]), 'simulated');
  const expected = [...workspaceCapabilities(profile.repository, profile.readable, profile.limits.snapshotBytes),
    acceptanceCapability(profile.repository, profile.acceptance, profile.limits)]
    .map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  assert.equal(r.exchanges.length, 2);
  for (const [index, exchange] of r.exchanges.entries()) {
    const lines = exchange.request.input.split('\n');
    const context = JSON.parse(lines.pop()!);
    const protocol = lines.join('\n');
    assert.deepEqual(context.capabilities, expected);
    assert.equal(context.objective, trialObjective);
    assert.equal(context.remainingTurns, profile.maxTurns - index);
    assert.deepEqual(context.feedback, r.report.feedback.slice(0, index));
    assert.doesNotMatch(protocol, /catalogue name|workspace\.list\/read/);
    assert.match(protocol, /exact name from capabilities/);
    assert.match(protocol, /required: true/);
    assert.match(protocol, /empty schema accepts \{\} only/);
    assert.match(protocol, /Example only, not a mandatory action:/);
    const example = JSON.parse(protocol.match(/Example only, not a mandatory action: (\{.*\}) lists/)![1]);
    assert.deepEqual(example, JSON.parse(list));
    assert.match(protocol, /Finish only after passing verification on the final revision/);
  }
  assert.equal(r.exchanges[0].action, list);
  assert.equal(r.report.feedback[0].authorized, true);
  assert.equal(r.report.feedback[0].status, 'completed');
}));

test('live adapter: placeholder and unregistered capability names fail the allowlist', async () => fixture(async ({ profile }) => {
  for (const name of ['catalogue name', 'workspace.list/read', 'workspace.delete', 'shell.run']) {
    const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([a(name)]), 'simulated');
    assert.equal(r.report.classification, 'uncertain');
    assert.equal(r.report.reason, 'Unsupported action');
    assert.equal(r.exchanges.length, 1);
    assert.ok(r.exchanges[0].response);
    assert.equal(r.exchanges[0].error, 'Unsupported action');
    assert.equal(r.exchanges[0].action, undefined);
    assert.equal(r.usage.input, 100);
    assert.equal(r.usage.reliable, true);
    assert.deepEqual(r.report.feedback, []);
    assert.equal(r.report.patch, '');
    assert.equal(r.report.originalUnchanged, true);
  }
}));

test('live adapter: discovery, failed verification, correction, evidence, replay and original preservation', async () => fixture(async ({ profile }) => {
  const before = await readFile(join(profile.repository, 'src/labels.ts'), 'utf8');
  const r = await runLiveTask(trialObjective, profile, trialModel, trialLimits, simulated(dryActions()), 'simulated');
  assert.equal(r.report.classification, 'verified', JSON.stringify(r));
  assert.equal((r.report.feedback[3].result as any).accepted, false);
  assert.equal((r.report.feedback[5].result as any).accepted, true);
  assert.equal(r.report.finalRevision, r.report.verifiedRevision);
  assert.equal(r.exchanges.length, 7);
  assert.ok(r.exchanges.every(e => e.request && e.response && e.action && e.countedInput));
  assert.match(r.exchanges[4].request.input, /accepted/);
  assert.equal(r.usage.input, 700);
  assert.equal(await readFile(join(profile.repository, 'src/labels.ts'), 'utf8'), before);
  const replayed = await replay(r, profile);
  assert.equal(replayed.mode, 'replay'); assert.equal(replayed.independentReproduction, false);
  assert.equal(replayed.report.classification, 'verified');
  assert.equal(replayed.report.patch, r.report.patch);
}));

test('live adapter: malformed and unsupported actions stop without effects', async () => fixture(async ({ profile }) => {
  for (const response of ['no JSON', '{"type":"spawn"}', a('shell.run'), '{"type":"finish","permissions":"all"}']) {
    const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([response]), 'simulated');
    assert.equal(r.report.classification, 'uncertain'); assert.equal(r.report.feedback.length, 0); assert.equal(r.report.patch, '');
    assert.ok(r.exchanges[0].response);
  }
}));

test('live adapter: unauthorized effects denied and recovery governed', async () => fixture(async ({ profile }) => {
  const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([a('workspace.write', { path: '../escape', content: 'bad' }), write, verify, finish]), 'simulated');
  assert.equal(r.report.feedback[0].authorized, false); assert.equal(r.report.classification, 'verified');
}));

test('live adapter: editing invalidates verification and finish alone is not completion', async () => fixture(async ({ profile }) => {
  for (const sequence of [[finish], [write, verify, a('workspace.write', { path: 'src/labels.ts', content: correctedLabels + '\n' }), finish]]) {
    const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated(sequence), 'simulated');
    assert.equal(r.report.classification, 'failed');
  }
}));

test('live adapter: timeout stops inference and preserves reservation', async () => fixture(async ({ profile }) => {
  profile.reasonerTimeoutMs = 10;
  const t: Transport = { count: async () => 100, generate: async () => new Promise(() => {}) };
  const r = await runLiveTask('Fix', profile, trialModel, trialLimits, t, 'simulated');
  assert.equal(r.report.reason, 'Model call timeout'); assert.equal(r.usage.reliable, false); assert.ok(r.usage.reservedUSD > 0);
  assert.equal(r.exchanges[0].error, 'Model call timeout');
}));

test('live adapter: turn, token, cost, observation and transcript limits', async () => fixture(async ({ profile }) => {
  for (const [override, expected] of [[{ inputTokens: 1 }, 'Input token'], [{ outputTokens: 100, outputPerCall: 100 }, 'Output token'],
    [{ costUSD: 0.000001 }, 'Cost limit'], [{ observationBytes: 1 }, 'Observation'], [{ transcriptBytes: 1 }, 'Transcript']] as const) {
    let calls = 0; const t = simulated([a('workspace.list', { path: '.' })]);
    const r = await runLiveTask('Fix', profile, trialModel, { ...trialLimits, ...override }, { count: t.count, generate: async (...args) => { calls++; return t.generate(...args); } }, 'simulated');
    assert.equal(r.report.classification, 'exhausted'); assert.match(r.report.reason, new RegExp(expected));
    assert.equal(calls, expected === 'Output token' ? 1 : 0);
  }
  profile.maxTurns = 1;
  const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([write]), 'simulated');
  assert.equal(r.report.classification, 'exhausted');
}));

test('live adapter: unknown price and unreliable usage fail closed', async () => fixture(async ({ profile }) => {
  let calls = 0;
  const t: Transport = { count: async () => 100, generate: async () => { calls++; return {}; } };
  for (const model of ['unknown', '__proto__', 'constructor']) {
    const blocked = await runLiveTask('Fix', profile, model, trialLimits, t, 'simulated');
    assert.equal(blocked.report.classification, 'blocked'); assert.equal(calls, 0);
  }
  const r = await runLiveTask('Fix', profile, trialModel, trialLimits, t, 'simulated');
  assert.equal(r.usage.reliable, false); assert.equal(r.report.classification, 'uncertain'); assert.equal(calls, 1);
}));

test('live adapter: secrets excluded from requests, responses, profile and patch evidence', async () => fixture(async ({ profile }) => {
  const secret = 'synthetic-key-123456';
  const r = await runLiveTask('Fix ' + secret, profile, trialModel, trialLimits, simulated([JSON.stringify({ type: 'finish', summary: secret })]), 'simulated', [secret]);
  assert.ok(!JSON.stringify(r).includes(secret)); assert.match(JSON.stringify(r), /REDACTED/);
}));

test('live adapter: verification and task duration limits remain host controlled', async () => fixture(async ({ profile }) => {
  profile.maxVerifications = 1;
  const r = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([verify, write, verify]), 'simulated');
  assert.equal(r.report.reason, 'Verification budget exhausted');
  profile.maxDurationMs = 1;
  const expired = await runLiveTask('Fix', profile, trialModel, trialLimits, simulated([verify]), 'simulated');
  assert.equal(expired.report.classification, 'exhausted'); assert.match(expired.report.reason, /duration/);
}));

test('live adapter: count failure, identity mismatch, oversized response and excess usage stop before effects', async () => fixture(async ({ profile }) => {
  let generations = 0;
  const missingCount: Transport = { count: async () => NaN, generate: async () => { generations++; return {}; } };
  const missing = await runLiveTask('Fix', profile, trialModel, trialLimits, missingCount, 'simulated');
  assert.equal(generations, 0); assert.equal(missing.report.classification, 'uncertain');
  for (const mutation of [(r: any) => { r.model = 'wrong'; }, (r: any) => { r.usage.output_tokens = 1501; },
    (r: any) => { r.extra = 'x'.repeat(trialLimits.responseBytes); }]) {
    const t = simulated([write]);
    const r = await runLiveTask('Fix', profile, trialModel, trialLimits, { count: t.count, generate: async (...args) => {
      const response = await t.generate(...args); mutation(response); return response;
    } }, 'simulated');
    assert.notEqual(r.report.classification, 'verified'); assert.equal(r.report.feedback.length, 0);
  }
}));
