import {
  OperatorRuntime,
  type CapabilityModule,
  type ExecutionPlan,
} from '@veil-runtime/core';

import {
  createNoteCapability,
  customerLookupCapability,
  deployTriggerCapability,
  emailDraftCapability,
  greetCapability,
  githubRepoGetCapability,
  serviceHealthCapability,
} from './capabilities.js';
import { starterExecutionAuthorizer } from './execution-authorizer.js';

const capabilities: CapabilityModule['capabilities'] = [
  greetCapability,
  createNoteCapability,
  serviceHealthCapability,
  githubRepoGetCapability,
  customerLookupCapability,
  emailDraftCapability,
  deployTriggerCapability,
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

export const runtime = new OperatorRuntime({
  authorizer: starterExecutionAuthorizer,
});

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

export function createSupportPlan(
  input: Record<string, unknown>,
): ExecutionPlan {
  const customerLookup = capabilities.find(
    (capability) => capability.name === 'customer.lookup',
  );
  const emailDraft = capabilities.find(
    (capability) => capability.name === 'email.draft',
  );

  if (!customerLookup || !emailDraft) {
    throw new Error('Support capabilities are not registered.');
  }

  return {
    version: '1.0',
    goal: 'Prepare customer response',
    steps: [
      {
        id: 'customer',
        capability: customerLookup.name,
        capabilityVersion: customerLookup.version,
        input: { customerId: input.customerId },
        reason: customerLookup.description,
      },
      {
        id: 'draft',
        capability: emailDraft.name,
        capabilityVersion: emailDraft.version,
        input: {
          customer: { $ref: 'steps.customer.result' },
          issue: input.issue,
        },
        reason: emailDraft.description,
      },
    ],
  };
}
