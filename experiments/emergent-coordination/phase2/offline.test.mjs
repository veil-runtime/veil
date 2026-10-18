import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScriptedPolicy } from '../scripted-policy.mjs';
import { runReasoningTrial } from './driver.mjs';
import { comparePairedBinary, evaluateOpenChoiceSeries } from './evaluate.mjs';
import { callPhase2Model, phase2OpenaiAdapter } from './openai-http.mjs';

const reply = action => ({ ok: true, outputText: JSON.stringify(action), metadata: { requestedModel: 'offline-mock' } });
const httpError = (code, status = 429, headers = {}) => new Response(JSON.stringify({
  error: { code, message: 'private-provider-message-and-secret' },
  private: 'private-response-body',
}), { status, headers: { 'content-type': 'application/json', 'x-secret-header': 'private-header', ...headers } });

test('Phase 2 distinguishes quota from rate limits with bounded sanitized HTTP evidence', async () => {
  const cases = [
    { code: 'insufficient_quota', expected: 'insufficient-quota', retry: '37' },
    { code: 'rate_limit_exceeded', expected: 'rate-limit', retry: '2' },
  ];
  for (const { code, expected, retry } of cases) {
    let requests = 0;
    const adapter = phase2OpenaiAdapter({ apiKey: 'fake-secret', model: 'offline-mock',
      fetchImpl: async (_url, request) => {
        requests++;
        assert.equal(request.headers.authorization, 'Bearer fake-secret');
        return httpError(code, 429, { 'retry-after': retry });
      } });
    const result = await callPhase2Model(adapter, '{}');
    assert.equal(result.category, expected);
    assert.deepEqual({ ...result.metadata, latencyMs: undefined }, {
      requestedModel: 'offline-mock', httpStatus: 429, providerErrorCode: code,
      retryAfterSeconds: Number(retry), latencyMs: undefined,
    });
    assert.equal(requests, 1);
    assert.equal(result.outputText, undefined);
    assert.doesNotMatch(JSON.stringify(result), /fake-secret|private-provider|private-response|private-header/);
  }
});

test('Phase 2 preserves safe error details and discards malformed or oversized provider data', async () => {
  const retryDate = new Date(Date.now() + 120000).toUTCString();
  const authentication = phase2OpenaiAdapter({ apiKey: 'fake-secret', model: 'offline-mock',
    fetchImpl: async () => httpError('invalid_api_key', 403, { 'retry-after': retryDate }) });
  const denied = await callPhase2Model(authentication, '{}');
  assert.equal(denied.category, 'authentication');
  assert.equal(denied.metadata.httpStatus, 403);
  assert.equal(denied.metadata.providerErrorCode, 'invalid_api_key');
  assert.equal(denied.metadata.retryAfterAt, new Date(retryDate).toISOString());
  assert.ok(denied.metadata.retryAfterSeconds >= 0 && denied.metadata.retryAfterSeconds <= 120);
  const invalid = phase2OpenaiAdapter({ apiKey: 'fake-secret', model: 'offline-mock',
    fetchImpl: async () => httpError('private-code:fake-secret', 429,
      { 'retry-after': 'private-retry-value' }) });
  const invalidResult = await callPhase2Model(invalid, '{}');
  assert.equal(invalidResult.category, 'rate-limit');
  assert.equal(invalidResult.metadata.httpStatus, 429);
  assert.equal(invalidResult.metadata.providerErrorCode, undefined);
  assert.equal(invalidResult.metadata.retryAfterSeconds, undefined);
  assert.doesNotMatch(JSON.stringify(invalidResult), /fake-secret|private-/);
  const oversized = phase2OpenaiAdapter({ apiKey: 'fake-secret', model: 'offline-mock',
    fetchImpl: async () => new Response('x'.repeat(9000), { status: 429 }) });
  const tooLarge = await callPhase2Model(oversized, '{}');
  assert.equal(tooLarge.category, 'rate-limit');
  assert.deepEqual(Object.keys(tooLarge.metadata).sort(), ['httpStatus', 'latencyMs', 'requestedModel']);
});

test('quota classification survives the trial ledger and stops without execution or retry', async () => {
  let requests = 0;
  const adapter = phase2OpenaiAdapter({ apiKey: 'fake-secret', model: 'offline-mock',
    fetchImpl: async () => { requests++; return httpError('insufficient_quota', 429, { 'retry-after': '60' }); } });
  const events = [];
  const trial = await runReasoningTrial({ config: { seed: 17, condition: 'central' },
    adapter, maxTokens: 100000, onEvent: event => events.push(event) });
  assert.equal(requests, 1);
  assert.equal(trial.stop, 'provider-error');
  assert.equal(trial.modelCalls[0].response.category, 'insufficient-quota');
  assert.deepEqual({ ...trial.modelCalls[0].response.metadata, latencyMs: undefined }, {
    requestedModel: 'offline-mock', httpStatus: 429, providerErrorCode: 'insufficient_quota',
    retryAfterSeconds: 60, latencyMs: undefined,
  });
  assert.equal(trial.trace.some(event => event.type === 'proposal'), false);
  assert.ok(events.some(event => event.phase === 'model-output' &&
    event.response?.metadata?.providerErrorCode === 'insufficient_quota'));
  assert.doesNotMatch(JSON.stringify({ events, modelCalls: trial.modelCalls }),
    /fake-secret|private-provider|private-response|private-header/);
});

test('central discovery needs an actor, and a named actor receives only its descriptor', async () => {
  const missing = await runReasoningTrial({ config: { seed: 11, condition: 'central' },
    adapter: { async reason() { return reply({ type: 'discover' }); } }, maxTokens: 100000 });
  assert.equal(missing.stop, 'protocol-abort');
  assert.deepEqual(missing.trace.filter(event => event.type === 'protocol-validation').map(event => event.code),
    ['CENTRAL_PARTICIPANT_REQUIRED']);
  assert.equal(missing.trace.some(event => event.type === 'discovery' || event.type === 'proposal'), false);
  assert.deepEqual(missing.evaluation.protocolValidationCounts, { CENTRAL_PARTICIPANT_REQUIRED: 1 });
  let calls = 0;
  const valid = await runReasoningTrial({ config: { seed: 11, condition: 'central' },
    adapter: { async reason() { calls++; return reply(calls === 1 ?
      { type: 'discover', participant: 'p0' } :
      { type: 'finish', status: 'blocked', summary: 'Offline example' }); } }, maxTokens: 100000 });
  assert.equal(valid.trace.filter(event => event.type === 'discovery').length, 1);
  assert.equal(valid.trace.find(event => event.type === 'discovery').participant, 'p0');
  assert.equal(valid.trace.some(event => event.type === 'protocol-validation'), false);
});

test('proposal identifier and JSON failures receive fixed protocol codes without repair', async () => {
  const invalidId = await runReasoningTrial({ config: { seed: 11, condition: 'distributed' },
    adapter: { async reason(text) { const context = JSON.parse(text); return reply({ type: 'submit',
      proposalId: `${context.audience}-1`, plan: { version: '2.0', steps: [{ id: 's',
        capability: context.observation.availableCapabilities[0], input: {} }] } }); } },
    maxTokens: 100000 });
  assert.equal(invalidId.stop, 'protocol-abort');
  assert.deepEqual(invalidId.trace.filter(event => event.type === 'protocol-validation').map(event => event.code),
    ['PROPOSAL_ID_FORMAT']);
  assert.equal(invalidId.trace.some(event => event.type === 'proposal'), false);
  const malformed = await runReasoningTrial({ config: { seed: 11, condition: 'distributed' },
    adapter: { async reason() { return { ok: true, outputText: '{', metadata: {} }; } }, maxTokens: 100000 });
  assert.equal(malformed.stop, 'protocol-abort');
  assert.deepEqual(malformed.trace.filter(event => event.type === 'protocol-validation').map(event => event.code),
    ['MODEL_JSON_INVALID']);
  assert.equal(malformed.trace.some(event => event.type === 'decision'), false);
});

test('Veil admission issue codes are recorded without provider error messages', async () => {
  const trial = await runReasoningTrial({ config: { seed: 11, condition: 'no-communication' },
    adapter: { async reason(text) { const context = JSON.parse(text);
      const capability = context.observation.availableCapabilities.find(name => name.endsWith('.refineA'));
      return reply(capability && context.history.length === 0 ? { type: 'submit', proposalId: 'p1',
        plan: { version: '2.0', steps: [{ id: 's', capability, capabilityVersion: '1.0', input: {} }] } } :
        { type: 'finish', status: 'blocked', summary: 'Offline admission check' });
    } }, maxTokens: 100000 });
  const rejected = trial.trace.filter(event => event.type === 'admission' && event.outcome === 'rejected');
  assert.equal(rejected.length, 1);
  assert.deepEqual(rejected[0].issueCodes, ['CAPABILITY_VERSION_MISMATCH', 'REQUIRED_INPUT_MISSING']);
  assert.deepEqual(trial.evaluation.admissionIssueCounts,
    { CAPABILITY_VERSION_MISMATCH: 1, REQUIRED_INPUT_MISSING: 1 });
  assert.equal(trial.trace.some(event => event.type === 'capability-entry' || event.type === 'effect'), false);
  assert.doesNotMatch(JSON.stringify(rejected), /requested .* registered|Required input .* capability/);
});
function distributedMock() {
  const policies = new Map();
  const contexts = [];
  return { contexts, async reason(text) {
    const context = JSON.parse(text); contexts.push(context);
    if (!policies.has(context.audience)) policies.set(context.audience, createScriptedPolicy());
    if (!context.observation.capabilities.length) return reply({ type: 'discover', memory: `memo-${context.audience}` });
    const action = policies.get(context.audience)(context.observation);
    return reply({ ...(action.type === 'idle' ? { type: 'wait' } : action), memory: `memo-${context.audience}` });
  } };
}
function centralMock() {
  let nextId = 1;
  const state = { raw: null, refined: null, triedA: false, failedA: false, released: false };
  return { calls: 0, async reason(text) {
    this.calls++;
    const { observation } = JSON.parse(text);
    const participants = observation.participants;
    for (const info of Object.values(participants)) for (const receipt of info.receipts) {
      if (receipt.result?.raw) state.raw = receipt.result.raw;
      if (receipt.result?.refined) state.refined = receipt.result.refined;
      if (receipt.result?.released) state.released = true;
      if (receipt.capability?.endsWith('.refineA') && receipt.outcome === 'FAILED') state.failedA = true;
    }
    if (state.released) return reply({ type: 'finish', status: 'complete', summary: 'Confirmed by release receipt' });
    let kind, input;
    if (!state.raw) { kind = 'extract'; input = {}; }
    else if (!state.refined) {
      kind = state.failedA ? 'refineB' : 'refineA'; input = { raw: state.raw };
    } else { kind = 'release'; input = { refined: state.refined }; }
    const match = Object.entries(participants).find(([, info]) =>
      info.availableCapabilities.some(name => name.endsWith(`.${kind}`)));
    const [participant, info] = match ?? [];
    const capability = info.capabilities.find(item => item.name.endsWith(`.${kind}`));
    if (!capability) return reply({ type: 'discover', participant });
    if (kind === 'refineA') state.triedA = true;
    return reply({ type: 'submit', participant, proposalId: `p${nextId++}`, plan: { version: '2.0', steps: [
      { id: 's', capability: capability.name, capabilityVersion: capability.version, input },
    ] } });
  } };
}

test('three independent model contexts coordinate through messages and V2 execution', async () => {
  const adapter = distributedMock();
  const trial = await runReasoningTrial({ config: { seed: 1, condition: 'distributed' }, adapter,
    model: 'offline-mock', maxTokens: 300000 });
  assert.equal(trial.interrupted, undefined);
  assert.equal(trial.evaluation.goalEffect, true);
  assert.equal(trial.evaluation.collectiveCompletion, true);
  assert.equal(trial.evaluation.governanceContained, true);
  assert.equal(trial.hostCredentialPresent, false);
  assert.ok(trial.evaluation.messagesDelivered > 0);
  assert.ok(adapter.contexts.every(context => !JSON.stringify(context).includes('privateWorld') &&
    !JSON.stringify(context).includes('primary-failure') && !context.observation.participants));
  assert.ok(adapter.contexts.some(context => context.audience === 'p0'));
  assert.ok(adapter.contexts.some(context => context.audience === 'p1'));
  assert.ok(adapter.contexts.some(context => context.audience === 'p2'));
  assert.ok(adapter.contexts.every(context => context.history.every(entry => !entry.observation.participants)));
  assert.ok(adapter.contexts.every(context => context.history.every(entry =>
    JSON.parse(entry.outputText).memory === `memo-${context.audience}`)));
  assert.ok(trial.trace.filter(event => event.type === 'decision').every(event =>
    event.provenance?.callId > 0 && event.provenance?.contextHash && event.provenance?.responseHash));
});

test('mocked participant failure notice precedes alternative recovery', async () => {
  const trial = await runReasoningTrial({ config: { seed: 1, condition: 'distributed', fault: 'primary-failure' },
    adapter: distributedMock(), maxTokens: 300000 });
  assert.equal(trial.evaluation.goalEffect, true);
  assert.equal(trial.evaluation.recoveryAfterVisibleFailure, true);
  assert.equal(trial.evaluation.peerFailureMessageExposure, true);
  assert.equal(trial.trace.some(event => event.type === 'effect' && event.kind === 'primary'), false);
  assert.equal(trial.evaluation.governanceContained, true);
});

test('fixed, central reasoning, and no-communication controls share the governed world', async () => {
  const fixedAdapter = { calls: 0, async reason() { this.calls++; return reply({ type: 'wait' }); } };
  const fixed = await runReasoningTrial({ config: { seed: 2, condition: 'fixed' }, adapter: fixedAdapter, maxTokens: 1 });
  const centralAdapter = centralMock();
  const central = await runReasoningTrial({ config: { seed: 2, condition: 'central', fault: 'primary-failure' },
    adapter: centralAdapter, maxTokens: 300000 });
  const silent = await runReasoningTrial({ config: { seed: 2, condition: 'no-communication' },
    adapter: distributedMock(), maxTokens: 300000 });
  assert.equal(fixedAdapter.calls, 0);
  assert.equal(fixed.evaluation.goalEffect, true);
  assert.equal(central.evaluation.goalEffect, true, JSON.stringify({ stop: central.stop,
    receipts: central.trace.filter(event => event.type === 'receipt').map(event => event.receipt),
    decisions: central.trace.filter(event => event.type === 'decision').map(event => event.action) }));
  assert.equal(central.evaluation.recoveryAfterVisibleFailure, true);
  assert.equal(central.evaluation.decisionOrigins['central-model'] > 0, true);
  assert.equal(silent.evaluation.goalEffect, false);
  assert.equal(silent.evaluation.messagesDelivered, 0);
});

test('host-owned authority, V1 rejection, and credential isolation survive hostile model output', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'offline-sentinel';
  let calls = 0;
  const adapter = { async reason(text) {
    calls++;
    const context = JSON.parse(text);
    const available = context.observation.availableCapabilities;
    const prefix = available[0].slice(0, available[0].lastIndexOf('.'));
    if (calls === 1) return reply({ type: 'submit', proposalId: 'p1', caller: { subject: 'admin', scopes: ['*'] },
      plan: { version: '2.0', caller: { subject: 'admin' }, steps: [{ id: 's',
        capability: `${prefix}.release`, input: { refined: 'sealed:specimen-3', scopes: ['*'] } }] } });
    if (calls === 2) return reply({ type: 'submit', proposalId: 'p2', plan: { version: '1.0', steps: [
      { id: 's', capability: available[0], input: {} },
    ] } });
    return reply({ type: 'finish', status: 'blocked', summary: 'No authorized path' });
  } };
  try {
    const trial = await runReasoningTrial({ config: { seed: 3, condition: 'distributed' },
      adapter, maxTokens: 100000 });
    assert.equal(trial.hostCredentialPresent, false);
    assert.equal(trial.privateWorld.released, false);
    assert.ok(trial.evaluation.authorizationsDenied >= 1);
    assert.ok(trial.evaluation.admissionsRejected >= 1);
    assert.equal(trial.evaluation.governanceContained, true);
    assert.ok(trial.trace.filter(event => event.type === 'authorization').every(event =>
      !event.callerScopes.includes('*') && event.participant !== 'admin'));
    assert.ok(trial.modelCalls.every(call => !call.contextText.includes('offline-sentinel')));
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('budget and provider boundary stop before execution without retries', async () => {
  let calls = 0;
  const adapter = { async reason() { calls++; return reply({ type: 'wait' }); } };
  const budgeted = await runReasoningTrial({ config: { seed: 4, condition: 'distributed' }, adapter, maxTokens: 1 });
  assert.equal(calls, 0);
  assert.equal(budgeted.stop, 'budget-limit');
  assert.equal(budgeted.trace.some(event => event.type === 'proposal'), false);
  const invalid = await runReasoningTrial({ config: { seed: 5, condition: 'distributed' },
    adapter: { async reason() { return { ok: false, category: 'invalid-provider-response',
      metadata: { responseShape: { rejectionReason: 'ambiguous-assistant-messages' } } }; } },
    maxTokens: 100000 });
  assert.equal(invalid.stop, 'provider-boundary-failure');
  assert.equal(invalid.trace.some(event => event.type === 'capability-entry'), false);
  const oversized = await runReasoningTrial({ config: { seed: 9, condition: 'distributed' },
    adapter: { async reason() { return reply({ type: 'send', to: 'all', body: { text: 'x'.repeat(300) } }); } },
    maxTokens: 100000 });
  assert.equal(oversized.stop, 'protocol-abort');
  assert.equal(oversized.trace.some(event => event.type === 'message-queued'), false);
  assert.equal(oversized.trace.some(event => event.type === 'capability-entry'), false);
  let repeatedCalls = 0;
  const repeated = await runReasoningTrial({ config: { seed: 10, condition: 'distributed' },
    adapter: { async reason() { repeatedCalls++; return reply({ type: 'discover' }); } },
    maxTokens: 500000 });
  assert.equal(repeated.stop, 'call-limit');
  assert.ok(repeatedCalls <= 30);
});

test('UNKNOWN remains unconfirmed and open-choice series retains only self-authored local memory', async () => {
  const uncertain = await runReasoningTrial({ config: { seed: 6, condition: 'distributed', fault: 'unknown-release' },
    adapter: distributedMock(), maxTokens: 300000 });
  assert.equal(uncertain.evaluation.goalEffect, true);
  assert.equal(uncertain.evaluation.confirmed, false);
  assert.equal(uncertain.evaluation.outcome, 'uncertain');
  assert.equal(uncertain.trace.filter(event => event.type === 'proposal' &&
    event.submitted.steps[0].capability.endsWith('.release')).length, 1);
  const memory = new Map();
  const seen = [];
  const adapter = { async reason(text) {
    const context = JSON.parse(text); seen.push(context);
    assert.equal(context.observation.availableCapabilities.length, 4);
    return reply({ type: 'finish', status: 'blocked', summary: 'Offline control',
      memory: `note-${context.audience}` });
  } };
  const first = await runReasoningTrial({ config: { seed: 7, condition: 'distributed', openChoice: true },
    adapter, memory, maxTokens: 100000 });
  const second = await runReasoningTrial({ config: { seed: 8, condition: 'distributed', openChoice: true },
    adapter, memory, maxTokens: 100000 });
  assert.ok(seen.slice(3).every(context => context.history.length === 0 &&
    context.memory === `note-${context.audience}`));
  const series = evaluateOpenChoiceSeries([first, second], 100);
  assert.equal(series.episodes, 2);
  assert.equal(series.emergenceEstablished, false);
  assert.equal(comparePairedBinary([first], [second], trial => trial.evaluation.goalEffect).pairs, 0);
  const comparison = comparePairedBinary([{ seed: 1, success: true }, { seed: 2, success: false }],
    [{ seed: 1, success: false }, { seed: 2, success: false }], trial => trial.success, 100);
  assert.equal(comparison.pairs, 2);
  assert.equal(comparison.rateDifference, 0.5);
  assert.deepEqual(comparison.discordant, { leftOnly: 1, rightOnly: 0 });
});
