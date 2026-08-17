import type { ScenarioDefinition } from '../scenarios/scenarios.js';

interface ScenarioPanelProps {
  scenario: ScenarioDefinition;
  input: Record<string, string>;
  mode: 'experience' | 'learn';
  onInputChange: (field: string, value: string) => void;
}

function labelFor(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

export function ScenarioPanel({
  scenario,
  input,
  mode,
  onInputChange,
}: ScenarioPanelProps) {
  const isPlannerScenario = scenario.domain === 'planner';

  return (
    <section className="panel">
      <p className="eyebrow">{scenario.domain}</p>
      <h2>{scenario.label}</h2>
      <p>{scenario.description}</p>
      {!isPlannerScenario || mode === 'learn' ? (
        <div className="capability-name">
          <strong>{isPlannerScenario ? 'Planner proposes a registered capability' : (scenario.capabilityNames ?? [scenario.capabilityName]).join(' → ')}</strong>
          <span>Registered by Veil</span>
        </div>
      ) : null}
      {Object.keys(scenario.exampleInput).map((field) => (
        <label key={field} htmlFor={field}>
          {labelFor(field)}
          {field === 'content' ? (
            <textarea
              id={field}
              value={input[field] ?? ''}
              onChange={(event) => onInputChange(field, event.target.value)}
            />
          ) : field === 'environment' ? (
            <select
              id={field}
              value={input[field] ?? ''}
              onChange={(event) => onInputChange(field, event.target.value)}
            >
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
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
