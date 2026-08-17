import {
  useEffect,
  useState,
} from 'react';

import { CapabilityPanel } from './components/CapabilityPanel.js';
import { ExecutionPanel } from './components/ExecutionPanel.js';
import { PlanPanel } from './components/PlanPanel.js';

interface CapabilityResponse {
  capabilities: Array<{
    name: string;
    version: string;
    description: string;
    risk: string;
    inputSchema: Record<string, {
      type: string;
      required: boolean;
      description: string;
    }>;
  }>;
  plan: unknown;
}

export function App() {
  const [name, setName] = useState('Mustapha');
  const [preview, setPreview] = useState<CapabilityResponse>();
  const [response, setResponse] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetch(
          `/api/capabilities?name=${encodeURIComponent(name)}`,
          { signal: controller.signal },
        );

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
  }, [name]);

  async function execute(requestedName: string) {
    setIsRunning(true);
    setError(undefined);
    setResponse(undefined);

    try {
      const result = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: requestedName }),
      });
      const body = await result.json() as unknown;

      setResponse(body);
      if (!result.ok) {
        setError('Veil rejected this execution plan.');
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

  return (
    <main>
      <header>
        <p className="eyebrow">Veil Starter · Lesson 01</p>
        <h1>Hello, Veil.</h1>
        <p>
          Browser UI → Application Server → Veil OperatorRuntime → Capability
          → Execution Result
        </p>
      </header>
      <div className="panel-grid">
        <CapabilityPanel
          capability={preview?.capabilities[0]}
          name={name}
          onNameChange={setName}
        />
        <PlanPanel plan={preview?.plan ?? { loading: true }} />
        <ExecutionPanel
          isRunning={isRunning}
          response={response}
          error={error}
          onRun={() => void execute(name)}
          onTryInvalidInput={() => void execute('')}
        />
      </div>
    </main>
  );
}
