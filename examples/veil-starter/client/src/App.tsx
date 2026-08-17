import {
  useEffect,
  useState,
} from 'react';

import { ExecutionPanel } from './components/ExecutionPanel.js';
import { PlanPanel } from './components/PlanPanel.js';
import { ScenarioPanel } from './components/ScenarioPanel.js';
import {
  scenarioForDomain,
  scenariosForDomain,
  type ScenarioDomain,
} from './scenarios/scenarios.js';

interface CapabilityResponse {
  plan: unknown;
}

function executionFailure(
  response: unknown,
  capabilityName: string,
): string | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const job = (response as { job?: { error?: unknown } }).job;
  if (typeof job?.error !== 'string') {
    return undefined;
  }

  if (capabilityName === 'deploy.trigger') {
    return undefined;
  }

  return capabilityName === 'github.repo.get'
    ? `Repository lookup failed: ${job.error}`
    : job.error;
}

export function App() {
  const [domain, setDomain] = useState<ScenarioDomain>('personal');
  const [scenarioId, setScenarioId] = useState('save-note');
  const [mode, setMode] = useState<'experience' | 'learn'>('experience');
  const scenario = scenarioForDomain(domain, scenarioId);
  const domainScenarios = scenariosForDomain(domain);
  const [input, setInput] = useState<Record<string, string>>(
    scenario.exampleInput,
  );
  const [preview, setPreview] = useState<CapabilityResponse>();
  const [response, setResponse] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setInput(scenario.exampleInput);
    setResponse(undefined);
    setError(undefined);
  }, [scenario]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          capabilityName: scenario.capabilityName,
          input: JSON.stringify(input),
        });
        const result = await fetch(`/api/capabilities?${query}`, {
          signal: controller.signal,
        });

        if (!result.ok) {
          throw new Error('Unable to load the Veil runtime.');
        }

        setPreview(await result.json() as CapabilityResponse);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load the Veil runtime.',
          );
        }
      }
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [input, scenario]);

  async function execute(executionInput: Record<string, string>) {
    setIsRunning(true);
    setError(undefined);
    setResponse(undefined);

    try {
      const result = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityName: scenario.capabilityName,
          input: executionInput,
        }),
      });
      const body = await result.json() as unknown;

      setResponse(body);
      if (!result.ok) {
        setError('Veil rejected this execution plan.');
      } else {
        setError(executionFailure(body, scenario.capabilityName));
      }
    } catch (executionError) {
      setError(
        executionError instanceof Error
          ? executionError.message
          : 'Unable to reach the local Veil server.',
      );
    } finally {
      setIsRunning(false);
    }
  }

  function selectDomain(nextDomain: ScenarioDomain) {
    setDomain(nextDomain);
    setScenarioId(scenariosForDomain(nextDomain)[0]?.id ?? '');
  }

  return (
    <main>
      <header>
        <p className="eyebrow">Veil Starter · Lesson 05</p>
        <h1>A valid execution can still be denied before a capability starts.</h1>
        <p>Personal, Developer, Support, and Operations are Starter presentation categories. Veil executes each request through an ExecutionPlan.</p>
        <div className="toggle-group" aria-label="Domain">
          {(['personal', 'developer', 'support', 'operations'] as const).map((entry) => (
            <button key={entry} type="button" className={domain === entry ? '' : 'secondary'} onClick={() => selectDomain(entry)}>
              {entry === 'personal' ? 'Personal' : entry === 'developer' ? 'Developer' : entry === 'support' ? 'Support' : 'Operations'}
            </button>
          ))}
        </div>
        {domainScenarios.length > 1 ? (
          <div className="toggle-group" aria-label={`${domain} scenarios`}>
            {domainScenarios.map((entry) => (
              <button key={entry.id} type="button" className={scenario.id === entry.id ? '' : 'secondary'} onClick={() => setScenarioId(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="toggle-group" aria-label="Presentation mode">
          {(['experience', 'learn'] as const).map((entry) => (
            <button key={entry} type="button" className={mode === entry ? '' : 'secondary'} onClick={() => setMode(entry)}>
              {entry === 'experience' ? 'Experience' : 'Learn'}
            </button>
          ))}
        </div>
      </header>
      {mode === 'learn' ? (
        <p className="mental-model">Scenario → ExecutionPlan → Validation → ExecutionAuthorizer → Capability → Job / Events / Result</p>
      ) : null}
      <div className="panel-grid">
        <ScenarioPanel
          scenario={scenario}
          input={input}
          onInputChange={(field, value) => setInput((current) => ({ ...current, [field]: value }))}
        />
        <PlanPanel plan={preview?.plan ?? { loading: true }} />
        <ExecutionPanel
          isRunning={isRunning}
          response={response}
          error={error}
          mode={mode}
          scenario={scenario}
          onRun={() => void execute(input)}
          onTryInvalidInput={() => void execute({ ...input, [Object.keys(input)[0] as string]: '' })}
        />
      </div>
    </main>
  );
}
