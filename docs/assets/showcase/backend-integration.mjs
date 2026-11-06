import { createMountedInterface } from '@veil-runtime/ui/dom';
import { validateInterfaceDefinition } from '@veil-runtime/ui/interface';
import { BACKEND_ACTIONS, backendDefinition, simulatedAdapter } from './backend.mjs';
export function mountBackend(target, { onError = () => {}, mode = 'simulation', base = '', fetchImpl = fetch, trace = () => {} } = {}) {
  const adapter = mode === 'http' ? {
    async session(signal) { const r = await fetchImpl(`${base}/api/session`, { method: 'POST', credentials: 'same-origin', signal }); if (!r.ok) throw Error('Could not open demo session.'); },
    async list(q, signal) { const r = await fetchImpl(`${base}/api/records?q=${encodeURIComponent(q)}`, { credentials: 'same-origin', signal }); if (!r.ok) throw Error('Records could not be loaded. Retry the request.'); return (await r.json()).records; },
    async create(body, signal) { const r = await fetchImpl(`${base}/api/records`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal }); const result = await r.json(); if (!r.ok) throw Object.assign(Error(result.error || 'Request rejected.'), { status: r.status }); return result.record; },
  } : simulatedAdapter();
  let ui, active, serial = 0, disposed = false;
  const commit = (data, revision) => { if (!disposed && revision === ui.snapshot().revision) return ui.updateData(data, revision); trace('update.rejected', {disposed, expected: revision, actual: ui?.snapshot().revision}); return false; };
  async function request(kind, query = '') {
    trace('request.start', {kind, query, nextId: serial + 1, revision: ui.snapshot().revision});
    active?.abort(); const controller = new AbortController(); active = controller; const id = ++serial, revision = ui.snapshot().revision;
    const prior = ui.snapshot().data; commit({ ...prior, loading: true, error: '', message: `${kind === 'submit' ? 'Submitting' : 'Loading'}…` }, revision);
    const acceptedRevision = ui.snapshot().revision;
    try {
      if (kind === 'submit') await adapter.create({ title: ui.snapshot().state.title.trim(), detail: ui.snapshot().state.detail.trim() }, controller.signal);
      const records = await adapter.list(query, controller.signal);
      trace('request.response', {id, activeId: serial, disposed, aborted: controller.signal.aborted, count: records.length});
      if (disposed || controller.signal.aborted || id !== serial) { trace('request.ignored', {id, activeId: serial}); return; }
      const accepted = commit({ ...ui.snapshot().data, loading: false, error: '', records, message: kind === 'submit' ? `Submitted successfully. ${mode === 'http' ? 'The refreshed records came from the service.' : 'Browser-local simulation only; nothing was sent.'}` : `${records.length} records loaded.` }, ui.snapshot().revision);
      trace('request.applied', {id, accepted, revision: ui.snapshot().revision});
    } catch (error) {
      trace('request.error', {id, name: error.name, status: error.status, activeId: serial, disposed, aborted: controller.signal.aborted});
      if (disposed || controller.signal.aborted || id !== serial) return;
      commit({ ...ui.snapshot().data, loading: false, error: String(error.status === 422 ? error.message : 'Request failed. Check the connection and retry.'), message: 'Request failed.' }, ui.snapshot().revision);
      onError('The service rejected or could not complete the request. Details are shown safely in the interface.');
    }
    if (id === serial) active = undefined;
  }
  const data = { message: 'Ready. Select Search to load records.', error: '', loading: false, records: [] };
  const definition = backendDefinition(data); if (new TextEncoder().encode(JSON.stringify(definition)).length > 32768) throw Error('Descriptor too large'); validateInterfaceDefinition(definition);
  ui = createMountedInterface(target, definition, { allowedActions: BACKEND_ACTIONS, onError: () => onError('Interface update failed.'), onEvent(event) {
    trace('ui.action', {action:event.action, source:event.source, revision:event.revision, currentRevision:ui.snapshot().revision, state:event.state});
    if (disposed || event.revision !== ui.snapshot().revision || event.source !== event.action || !BACKEND_ACTIONS.includes(event.action)) { trace('ui.action.rejected'); return; }
    if (event.action === 'cancel') { serial++; active?.abort(); active = undefined; ui.updateData({ ...ui.snapshot().data, loading: false, message: 'Request cancelled.' }, event.revision); }
    else if (event.action === 'reset') { serial++; active?.abort(); active = undefined; ui.setState('query', ''); ui.setState('title', ''); ui.setState('detail', ''); void request('load'); }
    else if (event.action === 'search' || event.action === 'retry') { const query = String(event.state.query || '').slice(0, 80); trace('search.dispatch', {query, revision:event.revision}); void request('load', query); }
    else if (event.action === 'submit') void request('submit');
  } });
  if (mode === 'http') void adapter.session(new AbortController().signal).then(() => request('load')).catch(() => onError('Local demo service unavailable. Start the service and retry.'));
  return { snapshot: () => ui.snapshot(), subscribe: fn => ui.subscribe(fn), dispose() { disposed = true; serial++; active?.abort(); ui.dispose(); } };
}
