import { ACTIONS } from './agent.mjs';
const data = path => ({ source: 'data', path });
const allowed = action => ({ binding: data(`controls.${action}`), equals: true });
const button = (action, text) => ({ key: action, component: 'Button', action, text, disabled: { not: allowed(action) } });

export function present(model) {
  const running = model.phase === 'running', approval = model.phase === 'approval';
  const complete = model.steps.filter(step => step.status === 'Complete').length;
  return {
    status: `${model.phase.toUpperCase()}${model.paused && running ? ' · PAUSED' : ''} — ${model.message}`,
    progress: `${complete} of 4 steps complete · ${complete * 25}% · attempt ${model.attempt}`,
    steps: model.steps, timeline: model.timeline, diagnostics: model.diagnostics,
    pauseLabel: model.paused ? 'Resume' : 'Pause',
    controls: { start: !running && !approval, pause: running, advance: running && model.paused,
      approve: approval, reject: approval, cancel: running || approval, retry: model.phase === 'failed', probe: true, reset: true },
  };
}

export function agentDefinition(model) {
  return { id: 'agent-monitor', actions: [...ACTIONS], state: { scenario: 'failure' }, data: present(model),
    screen: { key: 'monitor', component: 'Stack', children: [
      { key: 'overview', component: 'Stack', children: [
        { key: 'title', component: 'Heading', text: 'Incident investigator' },
        { key: 'progress', component: 'Text', text: data('progress') },
        { key: 'status', component: 'Status', text: data('status') },
      ] },
      { key: 'setup', component: 'Stack', visible: allowed('start'), children: [
        { key: 'scenario', component: 'Select', label: 'Scenario for the next run', binding: { source: 'state', path: 'scenario' },
          options: [{ value: 'failure', label: 'Tool timeout → retry → approval' }, { value: 'success', label: 'Successful tools → approval' }], validation: { required: true } },
      ] },
      { key: 'controls', component: 'Row', children: [
        button('start', 'Start simulation'), button('pause', data('pauseLabel')), button('advance', 'Advance one step'),
        button('retry', 'Retry tool'), button('cancel', 'Cancel execution'),
      ] },
      { key: 'approval', component: 'Stack', visible: allowed('approve'), children: [
        { key: 'approval-title', component: 'Heading', text: 'A human decision, before the next step.' },
        { key: 'approval-help', component: 'Text', text: 'Review the evidence below. This decision only controls the local simulation; it grants no production permission.' },
        { key: 'decisions', component: 'Row', children: [button('approve', 'Approve handoff'), button('reject', 'Reject request')] },
      ] },
      { key: 'steps-title', component: 'Heading', text: 'Execution steps' },
      { key: 'steps', component: 'Table', ariaLabel: 'Execution steps', binding: data('steps'), columns: [
        { key: 'name', label: 'Step' }, { key: 'status', label: 'Status' }, { key: 'detail', label: 'Tool / result' },
      ] },
      { key: 'timeline-title', component: 'Heading', text: 'Event timeline' },
      { key: 'timeline', component: 'Table', ariaLabel: 'Event timeline', binding: data('timeline'), columns: [
        { key: 'sequence', label: '#' }, { key: 'event', label: 'Agent event' }, { key: 'detail', label: 'Host observation' },
      ] },
      { key: 'diagnostics-title', component: 'Heading', text: 'Integration diagnostics' },
      { key: 'diagnostics', component: 'Status', text: data('diagnostics') },
      { key: 'utilities', component: 'Row', children: [button('probe', 'Test update safeguards'), button('reset', 'Reset simulation')] },
    ] } };
}
