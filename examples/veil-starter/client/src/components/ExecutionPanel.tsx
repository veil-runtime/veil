interface ExecutionPanelProps {
  isRunning: boolean;
  response: unknown;
  error: string | undefined;
  onRun: () => void;
  onTryInvalidInput: () => void;
}

export function ExecutionPanel({
  isRunning,
  response,
  error,
  onRun,
  onTryInvalidInput,
}: ExecutionPanelProps) {
  return (
    <section className="panel execution-panel">
      <p className="eyebrow">Execution</p>
      <h2>Veil resolves the capability and executes the plan.</h2>
      <div className="actions">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
        >
          {isRunning ? 'Running with Veil...' : 'Run with Veil'}
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
      {response ? (
        <pre className="result">{JSON.stringify(response, null, 2)}</pre>
      ) : (
        <p className="empty-state">Run the plan to inspect Veil&apos;s response.</p>
      )}
    </section>
  );
}
