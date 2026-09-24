// Provider-neutral public-output contract. No Veil imports or execution handles.
export const LIMITS = Object.freeze({ turns: 12, proposals: 8, exchanges: 64,
  outputTokens: 2048, contextTokens: 16384, callMs: 60000, trialMs: 600000 });
export const ERROR_CATEGORIES = Object.freeze(['authentication', 'rate-limit', 'transport',
  'timeout', 'refusal', 'truncation', 'invalid-provider-response']);
// UTF-8 byte count plus a conservative allowance for one message's framing.
export const inputTokenBound = text => Buffer.byteLength(text, 'utf8') + 1024;
export function tokenBudget(maxTokens) {
  if (!Number.isSafeInteger(maxTokens) || maxTokens <= 0) throw new Error('Explicit positive token budget required');
  let reserved = 0;
  return {
    reserve(tokens) {
      if (reserved + tokens > maxTokens) return false;
      reserved += tokens; return true;
    },
    get reserved() { return reserved; },
  };
}
export async function callModel(adapter, contextText, timeoutMs = LIMITS.callMs) {
  let timer;
  try {
    const result = await Promise.race([adapter.reason(contextText), new Promise(resolve => {
      timer = setTimeout(() => resolve({ ok: false, category: 'timeout' }), timeoutMs);
    })]);
    if (!result || typeof result !== 'object') return { ok: false, category: 'invalid-provider-response' };
    // Only the adapter's explicit safe projection is retained, never arbitrary response objects.
    const source = result.metadata ?? {};
    const metadata = {};
    for (const key of ['requestedModel', 'reportedModel', 'requestId', 'finish']) {
      if (typeof source[key] === 'string') metadata[key] = source[key];
    }
    for (const key of ['inputTokens', 'outputTokens', 'latencyMs']) {
      if (Number.isFinite(source[key]) && source[key] >= 0) metadata[key] = source[key];
    }
    if (result.ok === true && typeof result.outputText === 'string') {
      return { ok: true, outputText: result.outputText, metadata };
    }
    return { ok: false, category: ERROR_CATEGORIES.includes(result.category)
      ? result.category : 'invalid-provider-response', metadata };
  } catch { return { ok: false, category: 'transport' }; }
  finally { clearTimeout(timer); }
}
