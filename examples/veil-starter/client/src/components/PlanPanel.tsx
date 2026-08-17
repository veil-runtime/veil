interface PlanPanelProps {
  plan: unknown;
}

export function PlanPanel({
  plan,
}: PlanPanelProps) {
  return (
    <section className="panel">
      <p className="eyebrow">Execution Plan</p>
      <h2>A deterministic description of what should happen.</h2>
      <p>
        The local server creates this plan with the public Veil contract.
      </p>
      <pre>{JSON.stringify(plan, null, 2)}</pre>
    </section>
  );
}
