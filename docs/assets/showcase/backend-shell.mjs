import { mountBackend } from './backend-integration.mjs';
import { backendSources } from 'backend:sources';
const tabs = [...document.querySelectorAll('[role="tab"]')], panels = [...document.querySelectorAll('[role="tabpanel"]')];
function select(tab, focus = false) { tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; }); panels.forEach(panel => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); }); if (focus) tab.focus(); }
tabs.forEach((tab, index) => { tab.addEventListener('click', () => select(tab)); tab.addEventListener('keydown', event => { const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key]; if (next !== undefined) { event.preventDefault(); select(tabs[next], true); } }); });
const feedback = document.querySelector('#feedback'), choices = new Map(Object.entries(backendSources)), sourceSelect = document.querySelector('#source-file');
for (const name of choices.keys()) { const option = document.createElement('option'); option.value = name; option.textContent = name; sourceSelect.append(option); }
sourceSelect.addEventListener('change', () => { document.querySelector('#host-source').textContent = choices.get(sourceSelect.value) || 'Unavailable'; });
sourceSelect.dispatchEvent(new Event('change'));
const mode = new URLSearchParams(location.search).get('mode') === 'http' ? 'http' : 'simulation';
document.body.dataset.mode = mode; document.querySelector('#mode-label').textContent = mode === 'http' ? 'Real local HTTP' : 'Pages simulation';
if (mode === 'http') {
  document.querySelector('.boundary h2').textContent = 'Real local HTTP';
  document.querySelector('.boundary p').textContent = 'This interface uses your same-origin Node service. Search and submission send real HTTP requests to a session-isolated demonstration backend.';
}
let mounted;
try { mounted = mountBackend(document.querySelector('#backend-interface'), { mode, trace:(stage,detail)=>window.__backendTrace?.({at:performance.now(),stage,detail}), onError: message => { feedback.textContent = message; } });
mounted.subscribe(snapshot => { if (!snapshot.data.error && !snapshot.data.loading) feedback.textContent = '';  window.__backendTrace?.({at:performance.now(),stage:'ui.snapshot',detail:{revision:snapshot.revision,query:snapshot.state.query,message:snapshot.data.message,records:snapshot.data.records.length}}); document.querySelector('#definition-json').textContent = JSON.stringify(snapshot.definition, null, 2); document.querySelector('#snapshot-json').textContent = JSON.stringify({ revision: snapshot.revision, state: snapshot.state, data: snapshot.data }, null, 2); });
document.querySelector('#definition-json').textContent = JSON.stringify(mounted.snapshot().definition, null, 2);
document.querySelector('#snapshot-json').textContent = JSON.stringify(mounted.snapshot(), null, 2);
} catch { feedback.textContent = 'The interface could not be mounted. Reload to retry.'; }
window.addEventListener('pagehide', () => mounted?.dispose());
