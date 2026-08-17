import {
  OperatorRuntime,
  type CapabilityModule,
  type ExecutionPlan,
} from '@veil-runtime/core';

import {
  createNoteCapability,
  greetCapability,
  serviceHealthCapability,
} from './capabilities.js';

const capabilities: CapabilityModule['capabilities'] = [
  greetCapability,
  createNoteCapability,
  serviceHealthCapability,
];

const demoModule: CapabilityModule = {
  manifest: {
    name: 'veil-starter',
    version: '1.0.0',
    description: 'Capabilities used by Veil Starter lessons.',
    capabilities: capabilities.map((capability) => capability.name),
  },
  capabilities,
};

export const runtime = new OperatorRuntime();

runtime.use(demoModule);

export function createGreetingPlan(
  name: string,
): ExecutionPlan {
  return createDemoPlan('demo.greet', { name });
}

export function createDemoPlan(
  capabilityName: string,
  input: Record<string, unknown>,
): ExecutionPlan {
  const capability = capabilities.find(
    (entry) => entry.name === capabilityName,
  );

  if (!capability) {
    throw new Error(`Unknown Veil Starter capability: ${capabilityName}`);
  }

  return {
    version: '1.0',
    goal: `Run ${capability.name}`,
    steps: [{
      id: capability.name.replace('.', '-'),
      capability: capability.name,
      capabilityVersion: capability.version,
      input,
      reason: capability.description,
    }],
  };
}
