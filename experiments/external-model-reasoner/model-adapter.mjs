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
    if (source.responseShape && typeof source.responseShape === 'object') {
      const shape = source.responseShape;
      metadata.responseShape = {
        outputItemCount: Number.isSafeInteger(shape.outputItemCount) ? shape.outputItemCount : 0,
        outputItemTypes: shape.outputItemTypes && typeof shape.outputItemTypes === 'object' ?
          Object.fromEntries(Object.entries(shape.outputItemTypes).filter(([key, value]) => typeof key === 'string' && Number.isSafeInteger(value) && value >= 0).slice(0, 16)) : {},
        assistantMessageCount: Number.isSafeInteger(shape.assistantMessageCount) ? shape.assistantMessageCount : 0,
        assistantMessageIndexes: Array.isArray(shape.assistantMessageIndexes) ? shape.assistantMessageIndexes.filter(Number.isSafeInteger).slice(0, 16) : [],
        contentPartCounts: Array.isArray(shape.contentPartCounts) ? shape.contentPartCounts.filter(item => Number.isSafeInteger(item?.outputIndex) && Number.isSafeInteger(item?.count)).slice(0, 16) : [],
        outputTextPartCount: Number.isSafeInteger(shape.outputTextPartCount) ? shape.outputTextPartCount : 0,
        nonTextContentTypes: shape.nonTextContentTypes && typeof shape.nonTextContentTypes === 'object' ?
          Object.fromEntries(Object.entries(shape.nonTextContentTypes).filter(([key, value]) => typeof key === 'string' && Number.isSafeInteger(value) && value >= 0).slice(0, 16)) : {},
        nonProposalItemTypes: shape.nonProposalItemTypes && typeof shape.nonProposalItemTypes === 'object' ?
          Object.fromEntries(Object.entries(shape.nonProposalItemTypes).filter(([key, value]) => typeof key === 'string' && Number.isSafeInteger(value) && value >= 0).slice(0, 16)) : {},
        refusalPresent: shape.refusalPresent === true,
        textLengths: Array.isArray(shape.textLengths) ? shape.textLengths.filter(value => Number.isSafeInteger(value) && value >= 0).slice(0, 16) : [],
        ...(typeof shape.rejectionReason === 'string' ? { rejectionReason: shape.rejectionReason } : {}),
      };
    }
    if (result.ok === true && typeof result.outputText === 'string') {
      return { ok: true, outputText: result.outputText, metadata };
    }
    return { ok: false, category: ERROR_CATEGORIES.includes(result.category)
      ? result.category : 'invalid-provider-response', metadata };
  } catch { return { ok: false, category: 'transport' }; }
  finally { clearTimeout(timer); }
}
