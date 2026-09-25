// Bytes/text-only fixture interface. NOT a governed-value implementation for Veil v1.
// JSON parsing creates fresh passive containers without evaluating getters/proxies.
function check(value, depth = 0, budget = { left: 4096 }) {
  if (--budget.left < 0 || depth > 24) throw new Error('Fixture value limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') throw new Error('Unsupported fixture value');
  for (const child of Object.values(value)) check(child, depth + 1, budget);
  Object.freeze(value);
}
export function decode(text) {
  if (typeof text !== 'string') throw new Error('Fixture accepts serialized JSON text only');
  if (text.length > 32768) throw new Error('Fixture message limit');
  const value = JSON.parse(text);
  check(value);
  return value;
}
// Only trusted, explicitly projected host-generated records enter here.
// This is not a validator/normalizer for arbitrary JavaScript graphs.
export const snapshot = trustedProjection => decode(JSON.stringify(trustedProjection));
