import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { decode } from '../../../external-reasoner/passive.mjs';
import { inputTokenBound, LIMITS, tokenBudget } from '../../../external-model-reasoner/model-adapter.mjs';
import { evaluatePhase3Trial } from './evaluate.mjs';
import { callPhase2Model } from '../../phase2/openai-http.mjs';

export const MODEL_LIMITS = Object.freeze({ callsPerTrial: 30, callsPerAudience: 12,
  contextTokens: 24000, trialMs: 180000, outputTokensPerCall: LIMITS.outputTokens });
const hash = text => createHash('sha256').update(text).digest('hex');

export async function runPhase3Trial({ config, adapter, model = 'mock', maxTokens, budget,
  histories = new Map(), memory = new Map(), onEvent = () => {},
  callLimit = MODEL_LIMITS.callsPerTrial, outputTokenLimit = MODEL_LIMITS.outputTokensPerCall }) {
  if (!config || typeof config.directoryVisibility !== 'boolean' ||
      !adapter || typeof adapter.reason !== 'function') throw new Error('Invalid Phase 3 driver configuration');
  if (!Number.isSafeInteger(callLimit) || callLimit < 1 || callLimit > MODEL_LIMITS.callsPerTrial) {
    throw new Error('Invalid model call limit');
  }
  if (!Number.isSafeInteger(outputTokenLimit) || outputTokenLimit < 1 ||
      outputTokenLimit > MODEL_LIMITS.outputTokensPerCall) throw new Error('Invalid output token limit');
  const tokenCeiling = budget ?? tokenBudget(maxTokens);
  const participantPrompt = await readFile(new URL('../../phase2/participant-prompt.txt', import.meta.url), 'utf8');
  const centralPrompt = await readFile(new URL('../../phase2/central-prompt.txt', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../../phase2/protocol.md', import.meta.url), 'utf8');
  const started = Date.now();
  const modelCalls = [];
  const audienceCalls = new Map();
  let ledgerSeq = 0;
  let reservedHere = 0;
  let complete;
  let workerFailure = false;
  const emit = (phase, data) => onEvent({ seq: ledgerSeq++, phase, ...data });
  const child = fork(fileURLToPath(new URL('./host-worker.mjs', import.meta.url)), [], {
    cwd: resolve(fileURLToPath(new URL('../../../..', import.meta.url))),
    env: { PATH: process.env.PATH ?? '' }, execArgv: [], silent: true,
  });
  child.stdout?.resume(); child.stderr?.resume();
  const deadline = setTimeout(() => { workerFailure = true; child.kill(); }, MODEL_LIMITS.trialMs + 5000);
  async function answerRequest(message) {
    const { audience, observation, requestId } = message;
    if (!['p0', 'p1', 'p2', 'central'].includes(audience) || !observation || typeof observation !== 'object') {
      return { stop: 'invalid-host-observation' };
    }
    if (Date.now() - started >= MODEL_LIMITS.trialMs) return { stop: 'time-limit' };
    if (modelCalls.length >= callLimit ||
        (audienceCalls.get(audience) ?? 0) >= MODEL_LIMITS.callsPerAudience) return { stop: 'call-limit' };
    const history = histories.get(audience) ?? [];
    const contextText = JSON.stringify({ protocolVersion: 2,
      instructions: audience === 'central' ? centralPrompt : participantPrompt, protocol,
      audience, observation, memory: memory.get(audience) ?? null, history });
    const inputBound = inputTokenBound(contextText);
    if (inputBound > MODEL_LIMITS.contextTokens) return { stop: 'context-limit' };
    const reservation = inputBound + outputTokenLimit;
    const ticket = tokenCeiling.reserve(reservation);
    if (!ticket) return { stop: 'budget-limit' };
    reservedHere += reservation;
    const callId = modelCalls.length + 1;
    audienceCalls.set(audience, (audienceCalls.get(audience) ?? 0) + 1);
    const entry = { callId, audience, model, contextText, contextHash: hash(contextText),
      reservation, requestId };
    if (tokenCeiling.settle) {
      entry.serializedInputBytes = Buffer.byteLength(contextText, 'utf8');
      entry.estimatedInputTokens = Math.ceil(entry.serializedInputBytes / 4);
      entry.inputBoundTokens = inputBound;
      entry.outputAllowanceTokens = outputTokenLimit;
    }
    modelCalls.push(entry);
    emit('model-observation', { callId, audience, contextText, contextHash: entry.contextHash, reservation });
    const remaining = Math.max(1, MODEL_LIMITS.trialMs - (Date.now() - started));
    const response = await callPhase2Model(adapter, contextText, Math.min(LIMITS.callMs, remaining));
    entry.response = response;
    emit('model-output', { callId, audience, response });
    if (tokenCeiling.settle) {
      const settlement = tokenCeiling.settle(ticket, { inputBound, outputCap: outputTokenLimit, response });
      entry.budgetSettlement = settlement;
      emit('budget-settlement', { callId, audience, reservation,
        serializedInputBytes: entry.serializedInputBytes, estimatedInputTokens: entry.estimatedInputTokens,
        reportedInputTokens: response.metadata?.inputTokens ?? null,
        reportedOutputTokens: response.metadata?.outputTokens ?? null, ...settlement });
      if (settlement.status === 'invalid-usage') return { stop: 'budget-accounting-failure' };
    }
    if (!response.ok) {
      return { stop: response.category === 'invalid-provider-response' &&
        response.metadata?.responseShape?.rejectionReason ? 'provider-boundary-failure' : 'provider-error' };
    }
    if (Date.now() - started >= MODEL_LIMITS.trialMs) return { stop: 'time-limit' };
    const invalid = validationCode => { entry.validationCode = validationCode;
      return { stop: 'protocol-abort', validationCode }; };
    let action;
    try { action = decode(response.outputText); }
    catch (error) { return invalid(error instanceof SyntaxError ? 'MODEL_JSON_INVALID' : 'MODEL_VALUE_INVALID'); }
    if (!action || typeof action !== 'object' || Array.isArray(action)) return invalid('ACTION_OBJECT_REQUIRED');
    if (action.memory !== undefined && (typeof action.memory !== 'string' || action.memory.length > 512)) {
      return invalid('MEMORY_INVALID');
    }
    if (action.memory !== undefined) memory.set(audience, action.memory);
    history.push({ observation, outputText: response.outputText });
    histories.set(audience, history);
    return { action, provenance: { callId, audience, contextHash: entry.contextHash,
      responseHash: hash(response.outputText), requestedModel: response.metadata?.requestedModel ?? model } };
  }
  child.on('message', message => {
    if (message?.type === 'host-event') {
      try { emit('host-event', { event: message.event }); }
      catch { workerFailure = true; child.kill(); }
    } else if (message?.type === 'model-request') {
      answerRequest(message).then(answer => {
        if (child.connected) child.send({ type: 'decision-response', requestId: message.requestId, answer });
      }).catch(() => {
        if (child.connected) child.send({ type: 'decision-response', requestId: message.requestId,
          answer: { stop: 'model-driver-error' } });
      });
    } else if (message?.type === 'result') {
      complete = { ...message.trial, hostCredentialPresent: message.hostCredentialPresent };
    } else if (message?.type === 'host-failure') workerFailure = true;
  });
  const ended = new Promise(resolveEnd => {
    child.on('error', () => { workerFailure = true; resolveEnd(); });
    child.on('exit', code => { if (code !== 0) workerFailure = true; resolveEnd(); });
  });
  child.send({ type: 'start', config: { seed: config.seed,
    condition: config.hostCondition ?? 'distributed', fault: config.fault ?? 'primary-failure',
    openChoice: config.openChoice ?? false, directoryVisibility: config.directoryVisibility,
    activationLimit: config.activationLimit ?? 18 } });
  await ended; clearTimeout(deadline);
  if (workerFailure || !complete) return { interrupted: true, modelCalls, reservedTokens: reservedHere };
  complete.modelCalls = modelCalls;
  complete.reservedTokens = reservedHere;
  complete.evaluation = evaluatePhase3Trial(complete);
  emit('trial-end', { stop: complete.stop, evaluation: complete.evaluation, reservedTokens: reservedHere });
  return complete;
}
