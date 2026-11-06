// Host-owned deterministic simulation. No agent framework or service is connected.
export const ACTIONS = Object.freeze(['start', 'pause', 'advance', 'approve', 'reject', 'cancel', 'retry', 'probe', 'reset']);
const names = ['Inspect request', 'Gather evidence', 'Human review', 'Prepare handoff'];
const active = new Set(['running', 'approval']);

export function createAgent({ publish, schedule = fn => setTimeout(fn, 1000), unschedule = clearTimeout }) {
  let generation = 0, ticket = 0, sequence = 0, timer, disposed = false, model;
  function fresh() {
    return { phase: 'idle', paused: false, scenario: 'failure', cursor: 0, attempt: 1,
      message: 'Ready to investigate a simulated service incident.',
      steps: names.map(name => ({ name, status: 'Queued', detail: '—' })),
      timeline: [], ignored: 0, diagnostics: 'Host policy ready. No external effects.' };
  }
  model = fresh();
  function record(event, detail) {
    model.timeline.push({ sequence: String(++sequence).padStart(2, '0'), event, detail });
    model.timeline = model.timeline.slice(-40);
  }
  function stop() { ticket++; if (timer !== undefined) unschedule(timer); timer = undefined; }
  function snapshot() { return structuredClone(model); }
  function emit() { if (!disposed) publish(snapshot()); }
  function queue() {
    stop();
    if (disposed || model.phase !== 'running' || model.paused) return;
    const run = generation, expected = ticket;
    timer = schedule(() => {
      // Both execution identity and pending-work identity must still match.
      if (disposed || run !== generation || expected !== ticket) return;
      timer = undefined;
      advance();
    });
  }
  function advance() {
    if (disposed || model.phase !== 'running') return;
    stop();
    switch (model.cursor) {
      case 0:
        model.steps[0] = { name: names[0], status: 'Complete', detail: 'Incident scope: checkout latency' };
        model.steps[1] = { name: names[1], status: 'Running', detail: 'metrics.read · awaiting result' };
        record('tool.result', 'inventory.read → 3 services found (simulated)');
        record('tool.started', 'metrics.read · read-only · attempt 1');
        model.message = 'Gathering evidence from simulated metrics.';
        model.cursor = 1;
        break;
      case 1:
        if (model.scenario === 'failure' && model.attempt === 1) {
          model.phase = 'failed';
          model.steps[1].status = 'Failed';
          model.steps[1].detail = 'SIM_TIMEOUT · no result accepted';
          model.message = 'Simulated metrics timeout. Retry resumes the failed step.';
          record('tool.failed', 'SIM_TIMEOUT · retry available');
        } else {
          model.steps[1] = { name: names[1], status: 'Complete', detail: 'p95 latency: 840 ms · queue: 12' };
          model.steps[2].status = 'Awaiting decision';
          model.steps[2].detail = 'Approve a simulated handoff; no production action';
          model.phase = 'approval';
          model.message = 'Your decision is needed. May the simulation prepare a handoff?';
          record('tool.result', 'metrics.read → elevated latency, no service changes');
          record('approval.requested', 'Prepare an incident handoff. No real permission is granted.');
          model.cursor = 2;
        }
        break;
      case 2:
        model.steps[3] = { name: names[3], status: 'Complete', detail: 'Local handoff draft ready · nothing sent' };
        model.phase = 'completed';
        model.message = 'Investigation complete. A simulated handoff is ready; nothing was sent.';
        record('tool.result', 'handoff.prepare → local draft with 2 observations');
        record('execution.completed', 'All 4 steps complete. No external side effects.');
        model.cursor = 3;
        break;
      default: return;
    }
    emit(); queue();
  }
  function deny() {
    model.ignored++;
    model.diagnostics = 'Ignored an invalid, stale or out-of-phase action. Execution unchanged.';
    emit(); return false;
  }
  function handle(action, state = {}) {
    if (disposed) return false;
    if (!ACTIONS.includes(action)) return deny();
    if (action === 'reset') {
      stop(); generation++; sequence = 0; model = fresh(); emit(); return true;
    }
    if (action === 'start') {
      if (active.has(model.phase) || !['failure', 'success'].includes(state.scenario)) return deny();
      stop(); generation++; sequence = 0; model = fresh(); model.scenario = state.scenario;
      model.phase = 'running'; model.message = 'Inspecting the incident with a simulated read-only tool.';
      model.steps[0] = { name: names[0], status: 'Running', detail: 'inventory.read · awaiting result' };
      record('execution.started', `Deterministic ${model.scenario} scenario`);
      record('tool.started', 'inventory.read · read-only');
      emit(); queue(); return true;
    }
    if (action === 'pause' && model.phase === 'running') {
      model.paused = !model.paused;
      record(model.paused ? 'execution.paused' : 'execution.resumed', 'Host scheduler updated');
      emit(); queue(); return true;
    }
    if (action === 'advance' && model.phase === 'running' && model.paused) { advance(); return true; }
    if (action === 'cancel' && active.has(model.phase)) {
      stop(); generation++; model.phase = 'cancelled'; model.paused = false;
      for (const step of model.steps) if (['Running', 'Awaiting decision'].includes(step.status)) step.status = 'Cancelled';
      model.message = 'Execution cancelled. Pending callbacks cannot update this run.';
      record('execution.cancelled', 'Host invalidated the run identity and cleared its timer');
      emit(); return true;
    }
    if (action === 'retry' && model.phase === 'failed') {
      stop(); generation++; model.attempt++; model.phase = 'running';
      model.steps[1].status = 'Running'; model.steps[1].detail = `metrics.read · attempt ${model.attempt}`;
      model.message = 'Retrying the failed tool. The deterministic retry will succeed.';
      record('tool.retried', `metrics.read · attempt ${model.attempt}`);
      emit(); queue(); return true;
    }
    if (['approve', 'reject'].includes(action) && model.phase === 'approval') {
      const approved = action === 'approve';
      model.steps[2].status = approved ? 'Complete' : 'Rejected';
      model.steps[2].detail = approved ? 'Local approval recorded' : 'Local rejection recorded';
      record(`approval.${approved ? 'approved' : 'rejected'}`, 'Host checked the current phase before accepting the decision');
      model.phase = approved ? 'running' : 'rejected';
      model.message = approved ? 'Preparing a simulated incident handoff.' : 'Request rejected. No handoff will be prepared.';
      if (approved) {
        model.steps[3] = { name: names[3], status: 'Running', detail: 'handoff.prepare · local simulation' };
        record('tool.started', 'handoff.prepare · local only');
      }
      emit(); queue(); return true;
    }
    return deny();
  }
  return { handle, snapshot, diagnostic(message) { if (!disposed) { model.diagnostics = message; emit(); } },
    dispose() { disposed = true; generation++; stop(); } };
}
