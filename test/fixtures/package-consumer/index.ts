import {
  createCapability,
  OperatorRuntime,
  type CapabilityModule,
  type ExecutionPlan,
} from '@veil-runtime/core';

const capability = createCapability<{ value: string }, string>({
  name: 'fixture.echo',
  version: '1.0.0',
  description: 'Echo fixture input',
  risk: 'read',
  async execute({ input }) {
    return input.value;
  },
});

const fixtureModule: CapabilityModule = {
  manifest: {
    name: 'fixture',
    version: '1.0.0',
    capabilities: [capability.name],
  },
  capabilities: [capability],
};

const plan: ExecutionPlan = {
  version: '1.0',
  steps: [{
    id: 'echo',
    capability: capability.name,
    capabilityVersion: capability.version,
    input: { value: 'ok' },
  }],
};

const runtime = new OperatorRuntime();
runtime.use(fixtureModule);

export async function validateConsumer(): Promise<void> {
  const job = await runtime.executePlan(plan);
  if (job.status !== 'completed') {
    throw new Error(`Unexpected status: ${job.status}: ${job.error ?? 'unknown error'}`);
  }
}
