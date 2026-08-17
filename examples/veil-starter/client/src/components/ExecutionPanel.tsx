import type { ReactNode } from 'react';

import type { ScenarioDefinition } from '../scenarios/scenarios.js';

interface ExecutionPanelProps {
  isRunning: boolean;
  response: unknown;
  error: string | undefined;
  mode: 'experience' | 'learn';
  scenario: ScenarioDefinition;
  onRun: () => void;
  onTryInvalidInput: () => void;
}

function experienceResult(
  scenario: ScenarioDefinition,
  response: unknown,
): ReactNode {
  if (!response || typeof response !== 'object') {
    return <p className="empty-state">Run the scenario to see its result.</p>;
  }

  const job = (response as {
    job?: {
      result?: unknown;
      steps?: Array<{ result?: unknown }>;
    };
  }).job;
  const result = scenario.domain === 'support'
    ? job?.steps?.at(-1)?.result
    : job?.result;
  if (!result || typeof result !== 'object') {
    return <pre className="result">{JSON.stringify(response, null, 2)}</pre>;
  }

  if (scenario.capabilityName === 'notes.create') {
    const note = result as { title: string; content: string };
    return <div className="output-card"><strong>Note created</strong><p>Title: {note.title}</p><p>Content: {note.content}</p></div>;
  }

  if (scenario.domain === 'support') {
    const draft = result as { to: string; subject: string; body: string };
    return <div className="output-card"><strong>Draft Ready</strong><p>To: {draft.to}</p><p>Subject: {draft.subject}</p><p>{draft.body}</p></div>;
  }

  const service = result as { serviceName: string; status: string };
  return <div className="output-card"><strong>{service.serviceName}</strong><p>{service.status}</p></div>;
}

export function ExecutionPanel({
  isRunning,
  response,
  error,
  mode,
  scenario,
  onRun,
  onTryInvalidInput,
}: ExecutionPanelProps) {
  return (
    <section className="panel execution-panel">
      <p className="eyebrow">Execution</p>
      <h2>{mode === 'experience' ? scenario.label : 'Veil resolves the capability and executes the plan.'}</h2>
      <div className="actions">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
        >
          {isRunning ? 'Running with Veil...' : scenario.domain === 'support' ? 'Prepare Response' : 'Run with Veil'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onTryInvalidInput}
          disabled={isRunning}
        >
          Try invalid input
        </button>
      </div>
      <p className="field-hint">
        Invalid input is sent to Veil; the browser does not simulate the result.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {mode === 'experience' ? experienceResult(scenario, response) : response ? (
        <pre className="result">{JSON.stringify(response, null, 2)}</pre>
      ) : (
        <p className="empty-state">Run the plan to inspect Veil&apos;s Job, events, and result.</p>
      )}
    </section>
  );
}
