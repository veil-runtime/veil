import { createMountedInterface } from '@veil-runtime/ui/dom';
import { validateInterfaceDefinition } from '@veil-runtime/ui/interface';
import { ACTIONS, createAgent } from './agent.mjs';
import { agentDefinition, present } from './definition.mjs';

// This is the actual integration used by the showcase, not a parallel snippet.
export function mountAgent(target, { onError = () => {}, schedule, unschedule } = {}) {
  let ui, disposed = false;
  const agent = createAgent({ schedule, unschedule, publish(model) {
    if (disposed) return;
    try {
      const expected = ui.snapshot().revision;
      if (!ui.updateData(present(model), expected)) onError('An outdated display update was ignored.');
    } catch {
      agent.dispose();
      onError('The display could not be updated. Reload to restart safely.');
    }
  } });
  const definition = agentDefinition(agent.snapshot());
  if (new TextEncoder().encode(JSON.stringify(definition)).length > 32768) throw Error('Descriptor exceeds 32 KiB');
  validateInterfaceDefinition(definition);
  try {
    ui = createMountedInterface(target, definition, { allowedActions: ACTIONS,
      onError() { agent.dispose(); onError('The display could not be updated. Reload to restart safely.'); },
      onEvent(event) {
        // UI declaration/allowlist checks complement, but do not replace, host policy.
        if (disposed || event.revision !== ui.snapshot().revision || event.source !== event.action || !ACTIONS.includes(event.action)) return;
        if (event.action === 'probe') {
          const staleRejected = ui.updateData({ ...ui.snapshot().data, status: 'STALE' }, event.revision - 1) === false;
          let invalidRejected = false;
          try { ui.updateData({ ...ui.snapshot().data, steps: 'invalid table data' }); }
          catch { invalidRejected = true; }
          agent.diagnostic(staleRejected && invalidRejected
            ? 'Rejected a stale revision and invalid table data. The accepted interface was preserved.'
            : 'A safeguard probe failed. Reload and inspect the integration.');
          return;
        }
        agent.handle(event.action, event.state);
        if (event.action === 'reset') ui.setState('scenario', 'failure');
      },
    });
  } catch (error) { agent.dispose(); throw error; }
  return { snapshot: () => ui.snapshot(), subscribe: listener => ui.subscribe(listener),
    dispose() { disposed = true; agent.dispose(); ui.dispose(); } };
}
