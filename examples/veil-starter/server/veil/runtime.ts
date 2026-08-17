import {
  OperatorRuntime,
  type CapabilityModule,
  type ExecutionPlan,
} from '@veil-runtime/core';

import { greetCapability } from './capabilities.js';

const demoModule: CapabilityModule = {
  manifest: {
    name: 'veil-starter',
    version: '1.0.0',
    description: 'Capabilities used by Veil Starter Lesson 01.',
    capabilities: [greetCapability.name],
  },
  capabilities: [greetCapability],
};

export const runtime = new OperatorRuntime();

runtime.use(demoModule);

export function createGreetingPlan(
  name: string,
): ExecutionPlan {
  return {
    version: '1.0',
    goal: 'Greet a learner',
    steps: [{
      id: 'greet',
      capability: greetCapability.name,
      capabilityVersion: greetCapability.version,
      input: { name },
      reason: 'Return a greeting for the provided name.',
    }],
  };
}
