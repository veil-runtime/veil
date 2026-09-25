import { LIMITS } from '../model-adapter.mjs';
export const API_VERSION = '2023-06-01';

export function anthropicAdapter({ apiKey, model, temperature, fetchImpl = fetch, timeoutMs = LIMITS.callMs }) {
  if (!apiKey || !model) throw new Error('Model access is not configured');
  if (temperature !== undefined && temperature !== 0) throw new Error('Only temperature 0 or omission is supported');
  return {
    async reason(contextText) {
      const start = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const metadata = { requestedModel: model };
      try {
        const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
          body: JSON.stringify({ model, max_tokens: LIMITS.outputTokens,
            ...(temperature === undefined ? {} : { temperature }),
            messages: [{ role: 'user', content: contextText }] }),
        });
        if (!response.ok) {
          // Do not read or persist provider error bodies, which may contain secrets.
          await response.body?.cancel();
          return { ok: false, category: [401, 403].includes(response.status) ? 'authentication'
            : response.status === 429 ? 'rate-limit' : 'transport', metadata };
        }
        // Bound response bytes before parsing; hidden/private blocks never reach the driver.
        let bytes = 0; const chunks = [];
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > 262144) { controller.abort(); return { ok: false, category: 'invalid-provider-response', metadata }; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof body.model === 'string') metadata.reportedModel = body.model;
        if (typeof body.id === 'string') metadata.requestId = body.id;
        if (typeof body.stop_reason === 'string') metadata.finish = body.stop_reason;
        if (Number.isFinite(body.usage?.input_tokens)) metadata.inputTokens = body.usage.input_tokens;
        if (Number.isFinite(body.usage?.output_tokens)) metadata.outputTokens = body.usage.output_tokens;
        if (body.stop_reason === 'max_tokens') return { ok: false, category: 'truncation', metadata };
        if (body.stop_reason === 'refusal') return { ok: false, category: 'refusal', metadata };
        if (body.stop_reason !== 'end_turn' || !Array.isArray(body.content) || !body.content.length ||
            body.content.some(block => block.type !== 'text' || typeof block.text !== 'string')) {
          return { ok: false, category: 'invalid-provider-response', metadata };
        }
        return { ok: true, outputText: body.content.map(block => block.text).join(''), metadata };
      } catch {
        return { ok: false, category: controller.signal.aborted ? 'timeout' : 'transport', metadata };
      } finally { clearTimeout(timer); metadata.latencyMs = Math.round(performance.now() - start); }
    },
  };
}
