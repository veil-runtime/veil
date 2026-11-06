import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterfaceController, validateInterfaceDefinition } from '@veil-runtime/ui/interface';
import { createAgent, ACTIONS } from '../../docs/assets/showcase/agent.mjs';
import { agentDefinition, present } from '../../docs/assets/showcase/definition.mjs';

function harness() {
  const callbacks = [], snapshots = [];
  const agent = createAgent({ publish: value => snapshots.push(value), schedule: fn => { callbacks.push(fn); return callbacks.length; }, unschedule() {} });
  const next = () => callbacks.shift()?.();
  return { agent, callbacks, snapshots, next };
}
test('failure, retry, approval and completion are deterministic', () => {
  const { agent, next } = harness();
  assert.equal(agent.handle('start', { scenario: 'failure' }), true);
  next(); next(); assert.equal(agent.snapshot().phase, 'failed');
  agent.handle('retry'); next(); assert.equal(agent.snapshot().phase, 'approval');
  agent.handle('approve'); next();
  const end = agent.snapshot(); assert.equal(end.phase, 'completed');
  assert.equal(end.steps.filter(step => step.status === 'Complete').length, 4);
  assert.equal(end.attempt, 2); assert.ok(end.timeline.some(row => row.event === 'tool.failed'));
});
test('rejection ends the run without preparing a handoff', () => {
  const { agent, next } = harness(); agent.handle('start', { scenario: 'success' }); next(); next();
  agent.handle('reject'); next(); assert.equal(agent.snapshot().phase, 'rejected');
  assert.equal(agent.snapshot().steps[3].status, 'Queued'); assert.equal(agent.handle('approve'), false);
});
test('late callbacks cannot mutate cancelled, reset, restarted or disposed runs', () => {
  for (const action of ['cancel', 'reset', 'restart', 'dispose']) {
    const { agent, callbacks, snapshots } = harness(); agent.handle('start', { scenario: 'success' });
    const old = callbacks.shift();
    if (action === 'dispose') agent.dispose();
    else if (action === 'restart') { agent.handle('cancel'); agent.handle('start', { scenario: 'failure' }); }
    else agent.handle(action);
    const before = agent.snapshot(), count = snapshots.length; old();
    assert.deepEqual(agent.snapshot(), before, action); assert.equal(snapshots.length, count, action);
  }
});
test('pause invalidates pending callbacks and manual steps preserve pause', () => {
  const { agent, callbacks } = harness(); agent.handle('start', { scenario: 'success' });
  const old = callbacks.shift(); agent.handle('pause'); old(); assert.equal(agent.snapshot().cursor, 0);
  agent.handle('advance'); assert.equal(agent.snapshot().cursor, 1); assert.equal(agent.snapshot().paused, true);
  agent.handle('pause'); callbacks.shift()(); assert.equal(agent.snapshot().phase, 'approval');
});
test('host checks action, scenario and phase independently of controls', () => {
  const { agent } = harness();
  for (const action of ['approve', 'retry', 'advance', 'delete-all', '__proto__']) assert.equal(agent.handle(action), false);
  assert.equal(agent.handle('start', { scenario: '<script>' }), false);
  assert.equal(agent.snapshot().phase, 'idle');
  agent.handle('start', { scenario: 'success' });
  assert.equal(agent.handle('start', { scenario: 'failure' }), false);
  assert.equal(agent.snapshot().scenario, 'success');
});
test('published runtime validates and accepts the host data contract at every transition', () => {
  const h = harness(), definition = agentDefinition(h.agent.snapshot()); validateInterfaceDefinition(definition);
  const events = [];
  const ui = createInterfaceController(definition, { allowedActions: ACTIONS, onEvent: event => events.push(event) });
  ui.dispatch('start', 'start'); assert.equal(events[0].action, 'start');
  h.agent.handle('start', events[0].state); h.next(); h.next(); h.agent.handle('retry'); h.next(); h.agent.handle('approve'); h.next();
  for (const model of h.snapshots) assert.equal(ui.updateData(present(model), ui.snapshot().revision), true);
  const accepted = ui.snapshot(); assert.equal(ui.updateData({ ...accepted.data, status: 'bad' }, accepted.revision - 1), false);
  assert.throws(() => ui.updateData({ ...accepted.data, steps: 'invalid' })); assert.deepEqual(ui.snapshot(), accepted);
  assert.throws(() => ui.dispatch('fetch', 'start'));
  const malicious = JSON.parse('{"id":"x","screen":{"key":"x","component":"Text","text":"ok"},"state":{"__proto__":{}}}');
  assert.throws(() => validateInterfaceDefinition(malicious));
  assert.throws(() => validateInterfaceDefinition({ ...definition, screen: { key: 'x', component: 'Script' } }));
  assert.throws(() => validateInterfaceDefinition({ ...definition, data: { value: 'a'.repeat(1048577) } }));
  ui.dispose();
});

test('bounded timeline retains distinct increasing sequence numbers', () => {
  const { agent } = harness(); agent.handle('start', { scenario: 'success' });
  for (let n = 0; n < 60; n++) agent.handle('pause');
  const rows = agent.snapshot().timeline;
  assert.equal(rows.length, 40); assert.equal(new Set(rows.map(row => row.sequence)).size, 40);
  assert.equal(Number(rows.at(-1).sequence), 62);
});
