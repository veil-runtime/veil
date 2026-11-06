const seed = [
  { id: 'INC-104', title: 'Checkout latency', status: 'Investigating' },
  { id: 'INC-103', title: 'Queue backlog', status: 'Monitoring' },
  { id: 'INC-102', title: 'Cache refresh', status: 'Resolved' },
];
export const BACKEND_ACTIONS = Object.freeze(['load', 'search', 'submit', 'retry', 'cancel', 'reset']);
export function backendDefinition(data) { return { id: 'backend-lab', actions: [...BACKEND_ACTIONS], state: { query: '', title: '', detail: '' }, data,
  screen: { key: 'root', component: 'Stack', children: [
    { key: 'heading', component: 'Heading', text: 'Incident records' },
    { key: 'status', component: 'Status', text: { source: 'data', path: 'message' } },
    { key: 'error', component: 'Text', text: { source: 'data', path: 'error' } },
    { key: 'query', component: 'Input', label: 'Filter records', binding: { source: 'state', path: 'query' }, validation: { maxLength: 80 } },
    { key: 'search', component: 'Button', text: 'Search', action: 'search' },
    { key: 'retry', component: 'Button', text: 'Retry loading', action: 'retry' },
    { key: 'cancel', component: 'Button', text: 'Cancel request', action: 'cancel' },
    { key: 'reset', component: 'Button', text: 'Reload records', action: 'reset' },
    { key: 'records', component: 'Table', binding: { source: 'data', path: 'records' }, columns: [{ key: 'id', label: 'ID' }, { key: 'title', label: 'Record' }, { key: 'status', label: 'Status' }] },
    { key: 'title', component: 'Input', label: 'New incident title', binding: { source: 'state', path: 'title' }, validation: { required: true, minLength: 4, maxLength: 80 } },
    { key: 'detail', component: 'Textarea', label: 'Describe the incident', binding: { source: 'state', path: 'detail' }, validation: { required: true, minLength: 8, maxLength: 500 } },
    { key: 'submit', component: 'Button', text: 'Submit incident', action: 'submit', validate: true },
  ] } }; }
export function simulatedAdapter() { let records = structuredClone(seed); return { async list(q, signal) { await new Promise((resolve, reject) => { const id = setTimeout(resolve, 350); signal.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted', 'AbortError')); }, { once: true }); }); return records.filter(row => `${row.id} ${row.title} ${row.status}`.toLowerCase().includes(q.toLowerCase())); }, async create(input, signal) { await new Promise(resolve => setTimeout(resolve, 250)); if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); if (input.title.length < 4 || input.detail.length < 8) throw Object.assign(Error('Server validation: title or detail is too short.'), { status: 422 }); const row = { id: `SIM-${records.length + 1}`, title: input.title, status: 'Submitted (simulation)' }; records.unshift(row); return row; } }; }
