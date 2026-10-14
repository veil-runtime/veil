import { openaiAdapter } from '../../external-model-reasoner/providers/openai.mjs';
import { callModel, LIMITS } from '../../external-model-reasoner/model-adapter.mjs';

const MAX_ERROR_BYTES = 8192;
const SAFE_CODE = /^[a-z][a-z0-9_]{0,63}$/;
const HTTP_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function retryAfter(headers) {
  const value = headers?.get?.('retry-after')?.trim();
  if (!value) return {};
  if (/^\d{1,8}$/.test(value)) {
    const seconds = Number(value);
    return seconds <= 31536000 ? { retryAfterSeconds: seconds } : {};
  }
  if (!HTTP_DATE.test(value)) return {};
  const at = Date.parse(value);
  return Number.isFinite(at) ? { retryAfterAt: new Date(at).toISOString(),
    retryAfterSeconds: Math.max(0, Math.ceil((at - Date.now()) / 1000)) } : {};
}

async function errorCode(response) {
  if (!response.body) return undefined;
  let bytes = 0;
  const chunks = [];
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_ERROR_BYTES) return undefined;
      chunks.push(chunk);
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const code = parsed?.error?.code;
    return typeof code === 'string' && SAFE_CODE.test(code) ? code : undefined;
  } catch { return undefined; }
}

// Phase 2 alone reads a bounded error body. The historical provider adapter
// still owns the successful Responses wire contract and never receives a key
// from the Veil host worker.
export function phase2OpenaiAdapter({ fetchImpl = fetch, outputTokenCap = LIMITS.outputTokens, ...options }) {
  if (!Number.isSafeInteger(outputTokenCap) || outputTokenCap < 1 || outputTokenCap > LIMITS.outputTokens) {
    throw new Error('Invalid output token cap');
  }
  let lastHttpError = null;
  const baseline = openaiAdapter({ ...options, fetchImpl: async (url, request) => {
    const boundedRequest = outputTokenCap === LIMITS.outputTokens ? request : {
      ...request, body: JSON.stringify({ ...JSON.parse(request.body), max_output_tokens: outputTokenCap }),
    };
    const response = await fetchImpl(url, boundedRequest);
    if (response.ok) return response;
    lastHttpError = { httpStatus: response.status, ...retryAfter(response.headers) };
    const code = await errorCode(response);
    if (code) lastHttpError.providerErrorCode = code;
    // The baseline adapter needs only status after an HTTP error. Do not pass
    // the provider body, headers, or request credentials into model evidence.
    return { ok: false, status: response.status, body: null };
  } });
  return {
    async reason(contextText) { lastHttpError = null; return baseline.reason(contextText); },
    takeHttpError() { const value = lastHttpError; lastHttpError = null; return value; },
  };
}

export async function callPhase2Model(adapter, contextText, timeoutMs) {
  const result = await callModel(adapter, contextText, timeoutMs);
  const httpError = adapter.takeHttpError?.();
  if (httpError && !result.ok) {
    result.metadata = { ...result.metadata, ...httpError };
    if (result.category === 'rate-limit' && httpError.providerErrorCode === 'insufficient_quota') {
      result.category = 'insufficient-quota';
    }
  }
  return result;
}
