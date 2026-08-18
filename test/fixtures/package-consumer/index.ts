import {
  createCapability,
  McpAdapter,
  OperatorRuntime,
  type CapabilityAuthorizationDecision,
  type CapabilityAuthorizationContext,
  type CapabilityModule,
  type ExecutionAuthorizer,
  type ExecutionPlan,
  type OperatorRuntimeOptions,
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

const authorizer: ExecutionAuthorizer = {
  async authorize(
    context: CapabilityAuthorizationContext,
  ): Promise<CapabilityAuthorizationDecision> {
    return context.capability.risk === 'read'
      ? { decision: 'allow' }
      : { decision: 'deny', reason: 'fixture only allows reads' };
  },
};

const runtimeOptions: OperatorRuntimeOptions = { authorizer };
const runtime = new OperatorRuntime(runtimeOptions);
runtime.use(fixtureModule);
export const mcpAdapter = new McpAdapter(runtime);

export async function validateConsumer(): Promise<void> {
  if (!mcpAdapter.server) {
    throw new Error('MCP adapter did not expose an MCP server.');
  }

  const job = await runtime.executePlan(plan);
  if (job.status !== 'completed') {
    throw new Error(`Unexpected status: ${job.status}: ${job.error ?? 'unknown error'}`);
  }
}
