interface PlanPanelProps {
  plan: unknown;
}

function capabilityFlow(plan: unknown): string[] {
  if (!plan || typeof plan !== 'object') {
    return [];
  }

  const steps = (plan as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.flatMap((step) => (
    step && typeof step === 'object'
      && typeof (step as { capability?: unknown }).capability === 'string'
      ? [(step as { capability: string }).capability]
      : []
  ));
}

export function PlanPanel({
  plan,
}: PlanPanelProps) {
  const flow = capabilityFlow(plan);

  return (
    <section className="panel">
      <p className="eyebrow">Execution Plan</p>
      <h2>A deterministic description of what should happen.</h2>
      <p>
        The local server creates this plan with the public Veil contract.
      </p>
      {flow.length > 1 ? (
        <p className="plan-flow">{flow.join(' → ')}</p>
      ) : null}
      <pre>{JSON.stringify(plan, null, 2)}</pre>
    </section>
  );
}
