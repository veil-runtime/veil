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

interface JobEvent {
  type?: unknown;
  data?: unknown;
}

function jobEvents(response: unknown): readonly JobEvent[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const events = (response as { job?: { events?: unknown } }).job?.events;
  return Array.isArray(events) ? events : [];
}

function deploymentDenial(response: unknown): string | undefined {
  const event = jobEvents(response).find((entry) => entry.type === 'capability.denied');
  if (!event?.data || typeof event.data !== 'object') {
    return undefined;
  }

  const reason = (event.data as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : 'Deployment was denied.';
}

function learnFlow(response: unknown): ReactNode {
  const denied = deploymentDenial(response);

  return denied ? (
    <div className="execution-flow">
      <strong>ExecutionPlan</strong><span>↓</span><strong>Validation ✓</strong><span>↓</span><strong>ExecutionAuthorizer</strong><span>↓</span><strong>✕ denied</strong><span>deploy.trigger NOT EXECUTED</span>
    </div>
  ) : (
    <div className="execution-flow">
      <strong>ExecutionPlan</strong><span>↓</span><strong>Validation ✓</strong><span>↓</span><strong>ExecutionAuthorizer ✓</strong><span>↓</span><strong>deploy.trigger</strong><span>↓</span><strong>Result</strong>
    </div>
  );
}

function plannerFlow(): ReactNode {
  return (
    <div className="execution-flow">
      <strong>Goal</strong><span>↓</span><strong>Planner</strong><span>↓</span><strong>ExecutionPlan</strong><span>↓</span><strong>OperatorRuntime</strong><span>↓</span><strong>service.health</strong><span>↓</span><strong>Result</strong>
    </div>
  );
}

function mcpFlow(): ReactNode {
  return (
    <div className="execution-flow">
      <strong>MCP Request</strong><span>↓</span><strong>McpAdapter</strong><span>↓</span><strong>ExecutionPlan</strong><span>↓</span><strong>OperatorRuntime</strong><span>↓</span><strong>service.health</strong><span>↓</span><strong>Result</strong>
    </div>
  );
}

function plannerDetails(response: unknown): ReactNode {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const { goal, planner } = response as { goal?: unknown; planner?: unknown };
  return (
    <p className="field-hint">
      Goal: {typeof goal === 'string' ? goal : 'Unavailable'}<br />
      Planner: {typeof planner === 'string' ? planner : 'Unavailable'}
    </p>
  );
}

function experienceResult(
  scenario: ScenarioDefinition,
  response: unknown,
): ReactNode {
  if (!response || typeof response !== 'object') {
    return <p className="empty-state">Run the scenario to see its result.</p>;
  }

  if (scenario.capabilityName === 'deploy.trigger') {
    const denied = deploymentDenial(response);
    if (denied) {
      return <div className="output-card denied-output"><strong>Deployment Denied</strong><p>{denied}</p></div>;
    }
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
  if (scenario.domain === 'mcp') {
    const result = (response as { result?: unknown }).result;
    if (!result || typeof result !== 'object') {
      return <pre className="result">{JSON.stringify(response, null, 2)}</pre>;
    }
    const service = result as { serviceName: string; status: string };
    return <div className="output-card"><strong>{service.serviceName}</strong><p>{service.status === 'healthy' ? 'Healthy' : service.status}</p></div>;
  }
  if (scenario.domain === 'planner') {
    if (!result || typeof result !== 'object') {
      return <pre className="result">{JSON.stringify(response, null, 2)}</pre>;
    }
    const service = result as { serviceName: string; status: string };
    return <div className="output-card"><strong>{service.serviceName}</strong><p>{service.status === 'healthy' ? 'Healthy' : service.status}</p></div>;
  }
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

  if (scenario.capabilityName === 'github.repo.get') {
    const repository = result as {
      fullName: string;
      description: string | null;
      stars: number;
      openIssues: number;
      url: string;
    };
    return <div className="output-card"><strong>{repository.fullName}</strong><p>{repository.description ?? 'No description provided.'}</p><p>Stars: {repository.stars} · Open issues: {repository.openIssues}</p><p><a href={repository.url}>{repository.url}</a></p></div>;
  }

  if (scenario.capabilityName === 'deploy.trigger') {
    const deployment = result as { service: string; environment: string };
    return <div className="output-card"><strong>Deployment Triggered</strong><p>{deployment.service}</p><p>{deployment.environment}</p></div>;
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
          {isRunning ? 'Running with Veil...' : scenario.domain === 'mcp' ? 'Run via MCP' : scenario.domain === 'planner' ? 'Plan and Run' : scenario.domain === 'support' ? 'Prepare Response' : scenario.capabilityName === 'deploy.trigger' ? 'Trigger Deployment' : 'Run with Veil'}
        </button>
        {scenario.domain !== 'planner' && scenario.domain !== 'mcp' ? <button
          type="button"
          className="secondary"
          onClick={onTryInvalidInput}
          disabled={isRunning}
        >
          Try invalid input
        </button> : null}
      </div>
      {scenario.domain !== 'planner' && scenario.domain !== 'mcp' ? <p className="field-hint">
        Invalid input is sent to Veil; the browser does not simulate the result.
      </p> : null}
      {error ? <p className="error">{error}</p> : null}
      {mode === 'experience' ? experienceResult(scenario, response) : response ? (
        <>
          {scenario.domain === 'mcp' ? mcpFlow() : scenario.domain === 'planner' ? <>{plannerFlow()}{plannerDetails(response)}</> : scenario.capabilityName === 'deploy.trigger' ? learnFlow(response) : null}
          <pre className="result">{JSON.stringify(response, null, 2)}</pre>
        </>
      ) : (
        <p className="empty-state">Run the plan to inspect Veil&apos;s Job, events, and result.</p>
      )}
    </section>
  );
}
