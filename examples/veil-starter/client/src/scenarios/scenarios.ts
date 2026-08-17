export type ScenarioDomain = 'personal' | 'developer' | 'support' | 'operations';

export interface ScenarioDefinition {
  id: string;
  domain: ScenarioDomain;
  label: string;
  description: string;
  capabilityName: string;
  capabilityNames?: readonly string[];
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
  {
    id: 'fetch-repository',
    domain: 'developer',
    label: 'Fetch Repository',
    description: 'Fetch public GitHub repository metadata through the Veil runtime.',
    capabilityName: 'github.repo.get',
    exampleInput: {
      owner: 'octocat',
      repo: 'Hello-World',
    },
  },
  {
    id: 'prepare-customer-response',
    domain: 'support',
    label: 'Prepare Customer Response',
    description: 'Look up a customer, then prepare a support email draft without sending it.',
    capabilityName: 'email.draft',
    capabilityNames: ['customer.lookup', 'email.draft'],
    exampleInput: {
      customerId: 'CUST-001',
      issue: 'Cannot access account',
    },
  },
  {
    id: 'trigger-deployment',
    domain: 'operations',
    label: 'Trigger Deployment',
    description: 'Trigger a simulated deployment through Veil governance.',
    capabilityName: 'deploy.trigger',
    exampleInput: {
      service: 'payments-api',
      environment: 'staging',
    },
  },
];

export function scenariosForDomain(
  domain: ScenarioDomain,
): readonly ScenarioDefinition[] {
  return scenarios.filter((entry) => entry.domain === domain);
}

export function scenarioForDomain(
  domain: ScenarioDomain,
  id?: string,
): ScenarioDefinition {
  const scenario = scenariosForDomain(domain).find(
    (entry) => id === undefined || entry.id === id,
  );
  if (!scenario) {
    throw new Error(`No scenario is configured for domain '${domain}'.`);
  }

  return scenario;
}
