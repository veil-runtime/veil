import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runReasoningTrial } from './driver.mjs';
import { phase2OpenaiAdapter } from './openai-http.mjs';
import { liveSmokeMain, runSmoke, smokeMatrix, summarizeSmokeTrial } from './smoke.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const reply = action => ({ ok: true, outputText: JSON.stringify(action),
  metadata: { requestedModel: 'offline-mock', inputTokens: 10, outputTokens: 5 } });
async function withDestination(fn) {
  const root = await mkdtemp(join(tmpdir(), 'veil-005-smoke-test-'));
  try { return await fn(join(root, 'evidence')); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('smoke schedules only central discovery and bounded distributed interaction with hashed evidence', async () => {
  await withDestination(async out => {
    const contexts = [];
    const adapter = { async reason(text) {
      const context = JSON.parse(text); contexts.push(context);
      if (context.audience === 'central') {
        const owner = Object.entries(context.observation.participants).find(([, item]) =>
          item.availableCapabilities.some(name => name.endsWith('.extract')))?.[0];
        if (context.history.length === 0) return reply({ type: 'discover', participant: owner });
        const descriptor = context.observation.participants[owner].capabilities.find(item =>
          item.name.endsWith('.extract'));
        return reply({ type: 'submit', participant: owner, proposalId: 'p1', plan: { version: '2.0',
          steps: [{ id: 's', capability: descriptor.name, capabilityVersion: descriptor.version, input: {} }] } });
      }
      return reply({ type: 'discover' });
    } };
    const summary = await runSmoke({ out, adapter, model: 'offline-mock' });
    const manifestText = await readFile(join(out, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.mode, 'offline-smoke-test');
    assert.equal(manifest.instructionRevision, 'phase2-actions-v2');
    assert.equal(manifest.maxReservedTokens, 30000);
    assert.equal(manifest.outputTokenCap, 512);
    assert.deepEqual(manifest.matrix, smokeMatrix);
    assert.equal(manifest.matrix.length, 2);
    assert.ok(manifest.sourceSha256['smoke.mjs']);
    assert.equal((await readFile(join(out, 'manifest.sha256'), 'utf8')).trim(), hash(manifestText));
    assert.ok(summary.reservedTokens <= 30000);
    assert.equal(summary.trials[0].successfulDiscoveries, 1);
    assert.equal(summary.trials[0].centralDescriptorSeen, true);
    assert.equal(summary.trials[0].validModelActions, 2);
    assert.equal(summary.trials[0].invalidModelActions, 0);
    assert.equal(summary.trials[0].reportedTokenUsage.callsWithUsage, 2);
    assert.equal(summary.trials[0].reportedTokenUsage.inputTokens, 20);
    assert.equal(summary.trials[0].stop, 'incomplete-limit');
    assert.equal(summary.trials[0].proposalsAccepted, 1);
    assert.equal(summary.trials[0].authorizationsAllowed, 1);
    assert.equal(summary.trials[0].actualCapabilityEffects, 1);
    assert.ok(contexts.some(context => context.audience === 'central' &&
      Object.values(context.observation.participants).some(item => item.capabilities.length > 0)));
    assert.equal(summary.emergenceEstablished, false);
    assert.equal(summary.trials.length, 2);
    assert.ok(summary.trials[1].modelCalls >= 2, JSON.stringify(summary.trials.map(trial => ({
      condition: trial.condition, modelCalls: trial.modelCalls, reservedTokens: trial.reservedTokens,
      stop: trial.stop }))));
    for (const [index, trial] of summary.trials.entries()) {
      const base = `smoke-${index + 1}-${trial.condition}`;
      const text = await readFile(join(out, `${base}.json`), 'utf8');
      assert.equal((await readFile(join(out, `${base}.sha256`), 'utf8')).trim(), hash(text));
      const events = (await readFile(join(out, `${base}.jsonl`), 'utf8')).trim().split('\n').map(JSON.parse);
      assert.equal(events.at(-1).phase, 'trial-end');
      assert.equal(events.filter(event => event.phase === 'model-observation').length, trial.modelCalls);
    }
    assert.equal(JSON.parse(await readFile(join(out, 'summary.json'), 'utf8')).status, summary.status);
    await assert.rejects(runSmoke({ out, adapter, model: 'offline-mock' }), { code: 'EEXIST' });
  });
});

test('smoke-only HTTP cap is 512 while the default pilot wire cap stays 2048', async () => {
  const caps = [];
  const fetchImpl = async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.store, false);
    assert.deepEqual(body.text, { format: { type: 'json_object' } });
    assert.equal(Object.hasOwn(body, 'tools'), false);
    caps.push(body.max_output_tokens);
    return new Response('', { status: 429 });
  };
  await phase2OpenaiAdapter({ apiKey: 'offline-secret', model: 'offline-mock',
    outputTokenCap: 512, fetchImpl }).reason('{}');
  await phase2OpenaiAdapter({ apiKey: 'offline-secret', model: 'offline-mock',
    fetchImpl }).reason('{}');
  assert.deepEqual(caps, [512, 2048]);
});

test('smoke shared reservation ceiling stops before a model call and retains a complete checkpoint', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runSmoke({ out, model: 'offline-mock', tokenLimit: 1,
      adapter: { async reason() { calls++; return reply({ type: 'discover' }); } } });
    assert.equal(calls, 0);
    assert.equal(summary.status, 'BUDGET CHECKPOINT');
    assert.equal(summary.completedTrials, 1);
    assert.equal(summary.modelCalls, 0);
    assert.equal(summary.reservedTokens, 0);
    assert.equal(summary.trials[0].stop, 'budget-limit');
    assert.deepEqual((await readdir(out)).filter(name => name.endsWith('.jsonl')),
      ['smoke-1-central.jsonl']);
  });
});

test('smoke stops at first protocol or provider failure without retry or a second condition', async () => {
  for (const [response, expected] of [
    [reply({ type: 'discover' }), 'PROTOCOL CHECKPOINT'],
    [{ ok: false, category: 'rate-limit', metadata: { httpStatus: 429,
      providerErrorCode: 'rate_limit_exceeded', retryAfterSeconds: 3 } }, 'PROVIDER CHECKPOINT'],
  ]) {
    await withDestination(async out => {
      let calls = 0;
      const summary = await runSmoke({ out, model: 'offline-mock', adapter: {
        async reason() { calls++; return response; },
      } });
      assert.equal(calls, 1);
      assert.equal(summary.status, expected);
      assert.equal(summary.completedTrials, 1);
      assert.equal(summary.modelCalls, 1);
      assert.equal(summary.trials[0].actualCapabilityEffects, 0);
      assert.equal(summary.trials[0].invalidModelActions, expected === 'PROTOCOL CHECKPOINT' ? 1 : 0);
      assert.deepEqual((await readdir(out)).filter(name => name.endsWith('.jsonl')),
        ['smoke-1-central.jsonl']);
    });
  }
});

test('distributed smoke cap keeps contexts private and proposals governed', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'offline-smoke-secret';
  const contexts = [];
  try {
    const trial = await runReasoningTrial({ config: smokeMatrix[1], callLimit: smokeMatrix[1].callLimit,
      maxTokens: 100000, adapter: { async reason(text) {
        const context = JSON.parse(text); contexts.push(context);
        if (!context.observation.capabilities.length) return reply({ type: 'discover' });
        const extract = context.observation.capabilities.find(item => item.name.endsWith('.extract'));
        return reply(extract ? { type: 'submit', proposalId: 'p1', plan: { version: '2.0', steps: [
          { id: 's', capability: extract.name, capabilityVersion: extract.version, input: {} },
        ] } } : { type: 'send', to: 'all', body: { text: 'descriptor discovered' } });
      } } });
    const result = summarizeSmokeTrial(trial);
    assert.equal(trial.limits.activations, 6);
    assert.equal(trial.modelCalls.length, 6);
    assert.deepEqual(new Set(result.participantsActivated), new Set(['p0', 'p1', 'p2']));
    assert.equal(result.successfulDiscoveries, 3);
    assert.equal(result.proposalsAccepted, 1);
    assert.equal(result.actualCapabilityEffects, 1);
    assert.equal(result.authorizationsAllowed, 1);
    assert.ok(result.messagesAttempted >= 1 && result.messagesDelivered >= 1);
    assert.equal(result.governanceContained, true);
    assert.equal(result.hostCredentialPresent, false);
    assert.ok(contexts.every(context => !JSON.stringify(context).includes('offline-smoke-secret') &&
      !JSON.stringify(context).includes('privateWorld') && !context.observation.participants));
    assert.ok(contexts.every(context => context.history.every(entry =>
      !entry.observation.participants)));
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('live smoke refuses missing credentials and any ceiling other than 30000 before writing evidence', async () => {
  await withDestination(async out => {
    const before = { key: process.env.OPENAI_API_KEY, model: process.env.VEIL_005_MODEL,
      max: process.env.VEIL_005_MAX_TOKENS };
    try {
      delete process.env.OPENAI_API_KEY;
      process.env.VEIL_005_MODEL = 'offline-mock';
      process.env.VEIL_005_MAX_TOKENS = '30001';
      await assert.rejects(liveSmokeMain(['--live-smoke', '--out', out]));
      process.env.OPENAI_API_KEY = 'offline-smoke-secret';
      await assert.rejects(liveSmokeMain(['--live-smoke', '--out', out]));
      await assert.rejects(liveSmokeMain(['--live-smoke', '--out', '--live-pilot']));
      await assert.rejects(readdir(out), { code: 'ENOENT' });
    } finally {
      for (const [name, value] of Object.entries({ OPENAI_API_KEY: before.key,
        VEIL_005_MODEL: before.model, VEIL_005_MAX_TOKENS: before.max })) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
    }
  });
});
