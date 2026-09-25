import { createHash } from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex');
export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}
export function authorityClaims(value, path = 'request', found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, item] of Object.entries(value)) {
    const location = `${path}.${key}`;
    if (['approved', 'caller', 'scopes', 'risk', 'policy', 'policyOverride', 'authorization'].includes(key)) found.push(location);
    authorityClaims(item, location, found);
  }
  return found;
}
export function modelView(response, variant = 'primary') {
  if (!response.capabilities) return response;
  return { capabilities: response.capabilities, task: variant === 'candidates'
    ? { resources: Object.values(response.task) } : response.task };
}
export function ledger(onEvent = () => {}) {
  let sequence = 0;
  return (phase, data) => onEvent({ sequence: ++sequence, phase, ...data });
}
