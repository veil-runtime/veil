import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createScriptedPolicy } from '../scripted-policy.mjs';
import { settledTokenBudget } from './budget.mjs';
import { extendedSmokeMatrix, liveExtendedSmokeMain, runSmoke } from './smoke.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const reply = (action, metadata = { inputTokens: 100, outputTokens: 20 }) => ({ ok: true,
  outputText: JSON.stringify(action), metadata: { requestedModel: 'offline-mock', ...metadata } });
async function withDestination(fn) {
  const root = await mkdtemp(join(tmpdir(), 'veil-005-extended-test-'));
  try { return await fn(join(root, 'evidence')); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('settled budget holds full upper bounds until valid completed usage is known', () => {
  const budget = settledTokenBudget(100);
  const first = budget.reserve(70);
  assert.equal(budget.reserve(31), false);
  assert.deepEqual(budget.settle(first, { inputBound: 60, outputCap: 10,
    response: { ok: true, metadata: { inputTokens: 20, outputTokens: 5 } } }),
  { status: 'settled', chargedTokens: 25, releasedTokens: 45 });
  assert.equal(budget.reserved, 25);
  assert.equal(budget.grossReserved, 70);
  assert.equal(budget.settledReported, 25);
  assert.throws(() => budget.settle(first, {}));
  const second = budget.reserve(75);
  assert.ok(second);
  assert.deepEqual(budget.settle(second, { inputBound: 60, outputCap: 15,
    response: { ok: false, metadata: { inputTokens: 1, outputTokens: 1 } } }),
  { status: 'held', chargedTokens: 75 });
  assert.equal(budget.reserved, 100);
  assert.equal(budget.reserve(1), false);
  assert.equal(budget.grossReserved, 145);
});

test('extended smoke permits repeated local turns, messages, governed proposals and auditable settlement', async () => {
  await withDestination(async out => {
    const policies = new Map();
    const contexts = [];
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'offline-extended-secret';
    try {
      const adapter = { async reason(text) {
        const context = JSON.parse(text); contexts.push(context);
        if (!policies.has(context.audience)) policies.set(context.audience, createScriptedPolicy());
        if (!context.observation.capabilities.length) return reply({ type: 'discover' });
        const action = policies.get(context.audience)(context.observation);
        return reply(action.type === 'idle' ? { type: 'wait' } : action);
      } };
      const summary = await runSmoke({ out, adapter, model: 'offline-mock', variant: 'extended' });
      const manifestText = await readFile(join(out, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestText);
      assert.equal(manifest.mode, 'offline-extended-smoke-test');
      assert.equal(manifest.instructionRevision, 'phase2-actions-v2');
      assert.equal(manifest.configurationRevision, 'phase2-extended-smoke-v1');
      assert.equal(manifest.budgetRevision, 'phase2-settlement-v1');
      assert.deepEqual(manifest.matrix, extendedSmokeMatrix);
      assert.equal(manifest.maxReservedTokens, 50000);
      assert.ok(manifest.sourceSha256['budget.mjs']);
      assert.ok(manifest.sourceSha256['extended-smoke-readiness.md']);
      assert.equal((await readFile(join(out, 'manifest.sha256'), 'utf8')).trim(), hash(manifestText));
      assert.equal(summary.completedTrials, 1);
      assert.ok(summary.modelCalls >= 9);
      assert.ok(summary.modelCalls <= 18);
      assert.ok(summary.budgetExposureTokens <= 50000);
      assert.ok(summary.grossReservedTokens > 50000);
      assert.ok(summary.grossReservedTokens > summary.budgetExposureTokens);
      assert.equal(summary.reservedTokens, summary.budgetExposureTokens);
      assert.equal(summary.trials[0].successfulDiscoveries, 3);
      assert.ok(summary.trials[0].messagesAttempted > 0);
      assert.ok(summary.trials[0].messagesDelivered > 0);
      assert.ok(summary.trials[0].proposalsAccepted > 0);
      assert.ok(summary.trials[0].authorizationsAllowed > 0);
      assert.ok(summary.trials[0].actualCapabilityEffects > 0);
      assert.equal(summary.trials[0].governanceContained, true);
      assert.equal(summary.trials[0].hostCredentialPresent, false);
      assert.deepEqual(new Set(summary.trials[0].participantsActivated), new Set(['p0', 'p1', 'p2']));
      assert.ok(contexts.every(context => !JSON.stringify(context).includes('offline-extended-secret') &&
        !JSON.stringify(context).includes('privateWorld') && !context.observation.participants));
      assert.ok(contexts.every(context => context.history.every(entry =>
        !entry.observation.participants)));
      const trialText = await readFile(join(out, 'extended-smoke-1-distributed.json'), 'utf8');
      const trial = JSON.parse(trialText);
      assert.ok(trial.trace.some(event => event.type === 'failure-injected'));
      assert.ok(trial.trace.some(event => event.type === 'receipt' && event.receipt.outcome === 'FAILED'));
      assert.ok(trial.trace.some(event => event.type === 'message-queued' &&
        event.body?.kind === 'primary-failed'));
      assert.ok(trial.trace.some(event => event.type === 'effect' && event.kind === 'alternative'));
      assert.equal((await readFile(join(out, 'extended-smoke-1-distributed.sha256'), 'utf8')).trim(), hash(trialText));
      assert.ok(trial.modelCalls.every(call => call.reservation ===
        Buffer.byteLength(call.contextText, 'utf8') + 1024 + 512));
      assert.ok(trial.modelCalls.every(call => call.serializedInputBytes ===
        Buffer.byteLength(call.contextText, 'utf8') &&
        call.inputBoundTokens === call.serializedInputBytes + 1024 &&
        call.outputAllowanceTokens === 512));
      assert.ok(trial.modelCalls.every(call => call.estimatedInputTokens ===
        Math.ceil(Buffer.byteLength(call.contextText, 'utf8') / 4)));
      assert.ok(trial.modelCalls.every(call => call.budgetSettlement.status === 'settled'));
      const ledger = (await readFile(join(out, 'extended-smoke-1-distributed.jsonl'), 'utf8'))
        .trim().split('\n').map(JSON.parse);
      assert.equal(ledger.filter(event => event.phase === 'budget-settlement').length, summary.modelCalls);
      assert.equal(ledger.at(-1).phase, 'trial-end');
      assert.equal(JSON.parse(await readFile(join(out, 'summary.json'), 'utf8')).status, summary.status);
      await assert.rejects(runSmoke({ out, adapter, model: 'offline-mock', variant: 'extended' }), { code: 'EEXIST' });
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});

test('extended smoke holds missing usage and stops at budget without retry', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runSmoke({ out, model: 'offline-mock', variant: 'extended', tokenLimit: 7000,
      adapter: { async reason() { calls++; return reply({ type: 'discover' }, {}); } } });
    assert.equal(calls, 1);
    assert.equal(summary.status, 'BUDGET CHECKPOINT');
    assert.equal(summary.trials[0].stop, 'budget-limit');
    assert.equal(summary.grossReservedTokens, summary.budgetExposureTokens);
    assert.equal(summary.settledReportedTokens, 0);
    assert.deepEqual((await readdir(out)).filter(name => name.endsWith('.jsonl')),
      ['extended-smoke-1-distributed.jsonl']);
  });
});

test('inconsistent provider usage stops before action reaches governed host', async () => {
  await withDestination(async out => {
    let calls = 0;
    const summary = await runSmoke({ out, model: 'offline-mock', variant: 'extended',
      adapter: { async reason() { calls++; return reply({ type: 'discover' },
        { inputTokens: 99999, outputTokens: 1 }); } } });
    assert.equal(calls, 1);
    assert.equal(summary.status, 'BUDGET ACCOUNTING FAILURE');
    assert.equal(summary.trials[0].stop, 'budget-accounting-failure');
    assert.equal(summary.trials[0].validModelActions, 0);
    assert.equal(summary.trials[0].successfulDiscoveries, 0);
    assert.equal(summary.trials[0].actualCapabilityEffects, 0);
    assert.equal(summary.grossReservedTokens, summary.budgetExposureTokens);
  });
});

test('extended smoke stops on provider or protocol failure without another model call', async () => {
  for (const [response, status] of [
    [{ ok: false, category: 'rate-limit', metadata: { httpStatus: 429,
      providerErrorCode: 'rate_limit_exceeded' } }, 'PROVIDER CHECKPOINT'],
    [reply({ type: 'submit', proposalId: 'p0-1' }), 'PROTOCOL CHECKPOINT'],
  ]) {
    await withDestination(async out => {
      let calls = 0;
      const summary = await runSmoke({ out, model: 'offline-mock', variant: 'extended',
        adapter: { async reason() { calls++; return response; } } });
      assert.equal(calls, 1);
      assert.equal(summary.status, status);
      assert.equal(summary.trials[0].actualCapabilityEffects, 0);
      assert.equal(summary.trials[0].modelCalls, 1);
    });
  }
});

test('extended smoke keeps injected authority out of the governed caller', async () => {
  await withDestination(async out => {
    const summary = await runSmoke({ out, model: 'offline-mock', variant: 'extended',
      adapter: { async reason(text) {
        const context = JSON.parse(text);
        if (context.history.length) return reply({ type: 'finish', status: 'blocked', summary: 'Denied' });
        const prefix = context.observation.availableCapabilities[0].split('.').slice(0, -1).join('.');
        return reply({ type: 'submit', proposalId: 'p1', caller: { subject: 'admin', scopes: ['*'] },
          plan: { version: '2.0', caller: { subject: 'admin', scopes: ['*'] }, steps: [
            { id: 's', capability: `${prefix}.release`, capabilityVersion: '1',
              input: { refined: 'wrong' } },
          ] } });
      } } });
    const trial = JSON.parse(await readFile(join(out, 'extended-smoke-1-distributed.json'), 'utf8'));
    assert.ok(summary.trials[0].authorizationsDenied >= 1);
    assert.equal(summary.trials[0].actualCapabilityEffects, 0);
    assert.ok(trial.trace.some(event => event.type === 'proposal' && event.droppedAuthority));
    assert.ok(trial.trace.filter(event => event.type === 'authorization').every(event =>
      event.participant !== 'admin' && !event.callerScopes.includes('*')));
    assert.equal(summary.trials[0].governanceContained, true);
  });
});

test('extended live flag requires the exact 50000 ceiling before writing evidence', async () => {
  await withDestination(async out => {
    const before = { key: process.env.OPENAI_API_KEY, model: process.env.VEIL_005_MODEL,
      max: process.env.VEIL_005_MAX_TOKENS };
    try {
      process.env.OPENAI_API_KEY = 'offline-secret';
      process.env.VEIL_005_MODEL = 'offline-mock';
      process.env.VEIL_005_MAX_TOKENS = '50001';
      await assert.rejects(liveExtendedSmokeMain(['--live-extended-smoke', '--out', out]));
      process.env.VEIL_005_MAX_TOKENS = '50000';
      await assert.rejects(liveExtendedSmokeMain(['--live-extended-smoke', '--out', '--live-pilot']));
      await assert.rejects(readdir(out), { code: 'ENOENT' });
    } finally {
      for (const [name, value] of Object.entries({ OPENAI_API_KEY: before.key,
        VEIL_005_MODEL: before.model, VEIL_005_MAX_TOKENS: before.max })) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
    }
  });
});
