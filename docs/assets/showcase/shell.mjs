import { mountAgent } from './integration.mjs';
import { mountBackend } from './backend-integration.mjs';
import { sources } from 'showcase:sources';

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
function select(tab, focus = false) {
  for (const item of tabs) { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; }
  for (const panel of panels) panel.hidden = panel.id !== tab.getAttribute('aria-controls');
  if (focus) tab.focus();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', event => {
    const target = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (target !== undefined) { event.preventDefault(); select(tabs[target], true); }
  });
}
const feedback = document.querySelector('#feedback');
const sourceSelect = document.querySelector('#source-file');
const sourceFiles = new Map(Object.entries(sources));
for (const name of sourceFiles.keys()) {
  const option = document.createElement('option'); option.value = name; option.textContent = name; sourceSelect.append(option);
}
function showSource() { document.querySelector('#host-source').textContent = sourceFiles.get(sourceSelect.value) ?? 'Source unavailable.'; }
sourceSelect.addEventListener('change', showSource); showSource();
let mounted;
function inspect(snapshot) {
  document.querySelector('#definition-json').textContent = JSON.stringify(snapshot.definition, null, 2);
  document.querySelector('#snapshot-json').textContent = JSON.stringify({ revision: snapshot.revision, state: snapshot.state, data: snapshot.data }, null, 2);
  document.querySelector('#revision').textContent = `UI revision ${snapshot.revision}`;
}
try {
  const target = document.querySelector('#agent-interface');
  mounted = target ? mountAgent(target, { onError(message) { feedback.textContent = message; } }) : mountBackend(document.querySelector('#backend-interface'), { mode: document.body.dataset.mode, base: document.body.dataset.api || '', onError(message) { feedback.textContent = message; } });
  inspect(mounted.snapshot()); mounted.subscribe(inspect);
} catch { feedback.textContent = 'The simulation could not load. Reload the page to try again.'; }
document.querySelector('#export').addEventListener('click', () => {
  if (!mounted) return;
  const snapshot = mounted.snapshot();
  const output = { ...snapshot.definition, data: snapshot.data, state: snapshot.state };
  const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'agent-interface.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  feedback.textContent = 'Exported the definition with current data and state. Host code is still required to run actions.';
});
window.addEventListener('pagehide', () => mounted?.dispose());
// A restored back/forward-cache document has already disposed its controller.
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
