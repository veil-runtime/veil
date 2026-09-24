import { readFile } from 'node:fs/promises';
import { decode } from '../external-reasoner/passive.mjs';
import { startHost } from './host-client.mjs';
import { callModel, inputTokenBound, LIMITS, tokenBudget } from './model-adapter.mjs';
import { hash, ledger, modelView } from './trace.mjs';
import { evaluateTrial } from './evaluate.mjs';

export async function runTrial({ scenario, prefix = 'fixture.records', adapter, maxTokens,
  trialId = 'offline', evidenceClass = 'offline-plumbing', variant = 'primary',
  onEvent, limits: overrides = {} }) {
  // Tests may tighten limits; they cannot relax production bounds.
  const limits = Object.fromEntries(Object.entries(LIMITS).map(([key, value]) =>
    [key, Math.min(value, overrides[key] ?? value)]));
  const budget = tokenBudget(maxTokens);
  const emit = ledger(onEvent);
  const prompt = await readFile(new URL('./prompts/reasoner.txt', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('./protocol.md', import.meta.url), 'utf8');
  const started = Date.now();
  const result = { schemaVersion: 1, trialId, scenario: scenario.id, prefix, evidenceClass, variant,
    startedAt: new Date(started).toISOString(), promptHash: hash(prompt), protocolHash: hash(protocol),
    turns: [], hostTrace: [], terminal: null, stop: 'turn-limit', reservedTokens: 0, limits };
  const history = [];
  let host;
  let proposals = 0;
  try {
    host = await startHost(prefix, Math.min(limits.callMs, limits.trialMs));
    for (let turn = 1; turn <= limits.turns; turn++) {
      const remainingMs = limits.trialMs - (Date.now() - started);
      if (remainingMs <= 0) { result.stop = 'time-limit'; break; }
      const contextText = JSON.stringify({ protocolVersion: 1, instructions: prompt, protocol,
        goal: scenario.goal, task: scenario.task, history });
      const inputBound = inputTokenBound(contextText);
      if (inputBound > limits.contextTokens) { result.stop = 'context-limit'; break; }
      const reservation = inputBound + limits.outputTokens;
      if (!budget.reserve(reservation)) { result.stop = 'budget-limit'; break; }
      emit('budget', { turn, reserved: reservation });
      const record = { turn, contextText, contextHash: hash(contextText) };
      result.turns.push(record);
      emit('model-observation', { turn, contextText, contextHash: record.contextHash });
      const response = await callModel(adapter, contextText, Math.min(limits.callMs, remainingMs));
      record.model = response;
      emit('model-output', { turn, response });
      if (!response.ok) {
        const structural = response.category === 'invalid-provider-response' &&
          typeof response.metadata?.responseShape?.rejectionReason === 'string';
        result.stop = structural ? 'provider-boundary-failure' : 'provider-error';
        break;
      }
      // An output arriving after the trial deadline is evidence, never a late execution.
      if (Date.now() - started >= limits.trialMs) { result.stop = 'time-limit'; break; }
      let request;
      try { request = decode(response.outputText); }
      catch { result.stop = 'protocol-abort'; break; }
      record.request = request;
      history.push({ outputText: response.outputText });
      if (request?.method === 'finish') {
        if (!['complete', 'blocked', 'uncertain'].includes(request.status) ||
            typeof request.summary !== 'string' || request.summary.length > 4096 ||
            !Array.isArray(request.evidence) || request.evidence.some(id => typeof id !== 'string')) {
          result.stop = 'protocol-abort'; break;
        }
        result.terminal = request; result.stop = 'finished'; break;
      }
      if (request?.method === 'submit' && ++proposals > limits.proposals) {
        result.stop = 'proposal-limit'; break;
      }
      if (result.hostTrace.length >= limits.exchanges) { result.stop = 'exchange-limit'; break; }
      // Forward exact model text. No proposal correction, action selection or authority construction.
      const exchange = await host.request(response.outputText, Math.max(1, Math.min(limits.callMs,
        limits.trialMs - (Date.now() - started))));
      const visible = modelView(exchange.response, variant);
      record.exchange = result.hostTrace.length;
      record.feedback = visible;
      result.hostTrace.push(exchange.entry);
      emit('host-exchange', { turn, entry: exchange.entry, modelFeedback: visible });
      history.push({ feedback: visible });
      // Detect violations immediately, before any subsequent model call.
      if (evaluateTrial(result).securityViolations.length) { result.stop = 'security-failure'; break; }
    }
  } catch { result.stop = 'host-error'; }
  finally {
    if (host) {
      try { result.world = await host.close(); }
      catch { host.kill(); result.stop = 'host-error'; }
    }
    result.reservedTokens = budget.reserved;
    result.endedAt = new Date().toISOString();
  }
  result.evaluation = evaluateTrial(result);
  if (result.evaluation.securityViolations.length) result.stop = 'security-failure';
  emit('trial-end', { stop: result.stop, evaluation: result.evaluation, reservedTokens: budget.reserved });
  return result;
}
