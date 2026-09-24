import { LIMITS } from '../model-adapter.mjs';

export const API_VERSION = 'responses-v1';
export const WIRE_OUTPUT = Object.freeze({ mode: 'json_object', schemaRevision: 'experiment-protocol-v1-json-object' });
const SAFE_NON_PROPOSAL_TYPES = new Set(['reasoning']);

function textFromOutput(output) {
  if (!Array.isArray(output)) return undefined;
  const messages = output.filter(item => item?.type === 'message' && item?.role === 'assistant');
  if (messages.length !== 1) return undefined;
  const [item] = messages;
  if (!Array.isArray(item.content) || item.content.length !== 1) return undefined;
  const [part] = item.content;
  if (!part || part.type !== 'output_text' || typeof part.text !== 'string') return undefined;
  return part.text;
}

function responseShape(output) {
  const shape = { outputItemCount: Array.isArray(output) ? output.length : 0,
    outputItemTypes: {}, assistantMessageCount: 0, assistantMessageIndexes: [],
    contentPartCounts: [], outputTextPartCount: 0, nonTextContentTypes: {}, refusalPresent: false,
    nonProposalItemTypes: {}, textLengths: [], rejectionReason: undefined };
  if (!Array.isArray(output)) { shape.rejectionReason = 'output-not-array'; return shape; }
  for (const [index, item] of output.entries()) {
    const type = typeof item?.type === 'string' ? item.type : 'missing';
    shape.outputItemTypes[type] = (shape.outputItemTypes[type] ?? 0) + 1;
    if (type !== 'message' || item.role !== 'assistant') {
      shape.nonProposalItemTypes[type] = (shape.nonProposalItemTypes[type] ?? 0) + 1;
      continue;
    }
    shape.assistantMessageCount++;
    shape.assistantMessageIndexes.push(index);
    const content = Array.isArray(item.content) ? item.content : [];
    shape.contentPartCounts.push({ outputIndex: index, count: content.length });
    for (const part of content) {
      const partType = typeof part?.type === 'string' ? part.type : 'missing';
      if (partType === 'output_text' && typeof part.text === 'string') {
        shape.outputTextPartCount++;
        shape.textLengths.push(Math.min(Buffer.byteLength(part.text, 'utf8'), 262144));
      } else {
        shape.nonTextContentTypes[partType] = (shape.nonTextContentTypes[partType] ?? 0) + 1;
        if (partType === 'refusal') shape.refusalPresent = true;
      }
    }
  }
  if (shape.refusalPresent) shape.rejectionReason = 'refusal-content';
  else if (shape.assistantMessageCount === 0) shape.rejectionReason = 'assistant-message-cardinality';
  else if (shape.assistantMessageCount !== 1) shape.rejectionReason = 'ambiguous-assistant-messages';
  else if (shape.contentPartCounts[0]?.count !== 1) shape.rejectionReason = 'content-part-cardinality';
  else if (shape.outputTextPartCount !== 1) shape.rejectionReason = 'output-text-cardinality';
  else if (Object.keys(shape.nonTextContentTypes).length) shape.rejectionReason = 'unsupported-content';
  else if (Object.keys(shape.nonProposalItemTypes).some(type => !SAFE_NON_PROPOSAL_TYPES.has(type))) shape.rejectionReason = 'unsupported-output-item';
  return shape;
}

export function openaiAdapter({ apiKey, model, temperature, fetchImpl = fetch, timeoutMs = LIMITS.callMs }) {
  if (!apiKey || !model) throw new Error('Model access is not configured');
  if (temperature !== undefined && temperature !== 0) throw new Error('Only temperature 0 or omission is supported');
  return {
    async reason(contextText) {
      const start = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const metadata = { requestedModel: model };
      try {
        const response = await fetchImpl('https://api.openai.com/v1/responses', {
          method: 'POST', signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, input: contextText, max_output_tokens: LIMITS.outputTokens,
            store: false, text: { format: { type: 'json_object' } },
            ...(temperature === undefined ? {} : { temperature }) }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          return { ok: false, category: [401, 403].includes(response.status) ? 'authentication'
            : response.status === 429 ? 'rate-limit' : 'transport', metadata };
        }
        let bytes = 0; const chunks = [];
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > 262144) { controller.abort(); return { ok: false, category: 'invalid-provider-response', metadata }; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const shape = responseShape(body.output);
        metadata.responseShape = shape;
        if (typeof body.model === 'string') metadata.reportedModel = body.model;
        if (typeof body.id === 'string') metadata.requestId = body.id;
        if (typeof body.status === 'string') metadata.finish = body.status;
        if (Number.isFinite(body.usage?.input_tokens)) metadata.inputTokens = body.usage.input_tokens;
        if (Number.isFinite(body.usage?.output_tokens)) metadata.outputTokens = body.usage.output_tokens;
        if (body.status === 'incomplete' || body.incomplete_details?.reason === 'max_output_tokens') {
          return { ok: false, category: 'truncation', metadata };
        }
        if (body.status !== 'completed') return { ok: false, category: 'invalid-provider-response', metadata };
        if (shape.refusalPresent) return { ok: false, category: 'refusal', metadata };
        if (shape.rejectionReason) return { ok: false, category: 'invalid-provider-response', metadata };
        const outputText = textFromOutput(body.output);
        if (outputText === undefined) return { ok: false, category: 'invalid-provider-response', metadata };
        return { ok: true, outputText, metadata };
      } catch {
        return { ok: false, category: controller.signal.aborted ? 'timeout' : 'transport', metadata };
      } finally { clearTimeout(timer); metadata.latencyMs = Math.round(performance.now() - start); }
    },
  };
}
