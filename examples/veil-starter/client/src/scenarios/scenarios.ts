export type ScenarioDomain = 'personal' | 'developer';

export interface ScenarioDefinition {
  id: string;
  domain: ScenarioDomain;
  label: string;
  description: string;
  capabilityName: string;
  exampleInput: Record<string, string>;
}

export const scenarios: readonly ScenarioDefinition[] = [
  {
    id: 'save-note',
    domain: 'personal',
    label: 'Save a Note',
    description: 'Create a simulated note without storing anything.',
    capabilityName: 'notes.create',
    exampleInput: {
      title: 'Lesson ideas',
      content: 'Show that capabilities belong to the application.',
    },
  },
  {
    id: 'check-service',
    domain: 'developer',
    label: 'Check Service',
    description: 'Check a simulated service status without making a network request.',
    capabilityName: 'service.health',
    exampleInput: {
      serviceName: 'payments-api',
    },
  },
];

export function scenarioForDomain(
  domain: ScenarioDomain,
): ScenarioDefinition {
  const scenario = scenarios.find((entry) => entry.domain === domain);
  if (!scenario) {
    throw new Error(`No scenario is configured for domain '${domain}'.`);
  }

  return scenario;
}
