// Identical, independent policy instances. This encodes coordination and recovery;
// it is an infrastructure baseline, never evidence of emergence.
export function createScriptedPolicy() {
  const state = { raw: null, refined: null, failedPrimary: false, sent: new Set(), tried: new Set(), nextId: 1 };
  const pending = [];
  return observation => {
    for (const message of observation.inbox) {
      const body = message.body;
      if (body?.kind === 'raw' && typeof body.value === 'string') state.raw ??= body.value;
      if (body?.kind === 'refined' && typeof body.value === 'string') state.refined ??= body.value;
      if (body?.kind === 'primary-failed') state.failedPrimary = true;
    }
    for (const receipt of observation.receipts) {
      const kind = receipt.capability?.split('.').at(-1);
      if (receipt.outcome === 'SUCCESS') {
        if (kind === 'extract') {
          state.raw = receipt.result?.raw;
          if (typeof state.raw === 'string' && !state.sent.has('raw')) {
            pending.push({ kind: 'raw', value: state.raw }); state.sent.add('raw');
          }
        }
        if (kind === 'refineA' || kind === 'refineB') {
          state.refined = receipt.result?.refined;
          if (typeof state.refined === 'string' && !state.sent.has('refined')) {
            pending.push({ kind: 'refined', value: state.refined }); state.sent.add('refined');
          }
        }
      }
      if (kind === 'refineA' && receipt.outcome === 'FAILED' && !state.sent.has('primary-failed')) {
        state.failedPrimary = true;
        pending.push({ kind: 'primary-failed' }); state.sent.add('primary-failed');
      }
    }
    if (pending.length) return { type: 'send', to: 'all', body: pending.shift() };
    const cap = suffix => observation.capabilities.find(item => item.name.endsWith(`.${suffix}`));
    const propose = (descriptor, input) => {
      state.tried.add(descriptor.name);
      return { type: 'submit', proposalId: `p${state.nextId++}`, plan: {
        version: '2.0', steps: [{ id: 's', capability: descriptor.name, capabilityVersion: descriptor.version, input }],
      } };
    };
    const release = cap('release');
    if (release && state.refined && !state.tried.has(release.name)) return propose(release, { refined: state.refined });
    const primary = cap('refineA');
    if (primary && state.raw && !state.tried.has(primary.name)) return propose(primary, { raw: state.raw });
    const alternative = cap('refineB');
    if (alternative && state.raw && state.failedPrimary && !state.tried.has(alternative.name)) {
      return propose(alternative, { raw: state.raw });
    }
    const extract = cap('extract');
    if (extract && !state.tried.has(extract.name)) return propose(extract, {});
    return { type: 'idle' };
  };
}
