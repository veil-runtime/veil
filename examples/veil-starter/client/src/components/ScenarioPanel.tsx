import type { ScenarioDefinition } from '../scenarios/scenarios.js';

interface ScenarioPanelProps {
  scenario: ScenarioDefinition;
  input: Record<string, string>;
  onInputChange: (field: string, value: string) => void;
}

function labelFor(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

export function ScenarioPanel({
  scenario,
  input,
  onInputChange,
}: ScenarioPanelProps) {
  return (
    <section className="panel">
      <p className="eyebrow">{scenario.domain}</p>
      <h2>{scenario.label}</h2>
      <p>{scenario.description}</p>
      <div className="capability-name">
        <strong>{scenario.capabilityName}</strong>
        <span>Registered by Veil</span>
      </div>
      {Object.keys(scenario.exampleInput).map((field) => (
        <label key={field} htmlFor={field}>
          {labelFor(field)}
          {field === 'content' ? (
            <textarea
              id={field}
              value={input[field] ?? ''}
              onChange={(event) => onInputChange(field, event.target.value)}
            />
          ) : (
            <input
              id={field}
              value={input[field] ?? ''}
              onChange={(event) => onInputChange(field, event.target.value)}
            />
          )}
        </label>
      ))}
    </section>
  );
}
