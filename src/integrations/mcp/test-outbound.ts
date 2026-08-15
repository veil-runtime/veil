import {
  randomUUID,
} from 'node:crypto';

import {
  capabilityRegistry,
} from '../../runtime/registry/registry.js';

import {
  operatorRuntime,
} from '../../runtime/operator-runtime.js';

import {
  ExecutionPlan,
} from '../../runtime/planner/planner.js';

import {
  McpProvider,
} from './outbound/mcp-provider.js';

import {
  createMcpCapability,
} from './outbound/mcp-capability.js';

async function main(): Promise<void> {
  const provider =
    new McpProvider({
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-everything',
      ],
    });

  const capability =
    createMcpCapability(
      'mcp.everything.echo',
      'Call the Everything MCP server echo tool',
      'echo',
      provider
    );

  capabilityRegistry.register(
    capability
  );

  const plan: ExecutionPlan = {
    version: '1.0',
    goal:
      'Prove outbound MCP execution',

    steps: [
      {
        id: randomUUID(),

        capability:
          'mcp.everything.echo',

        input: {
          arguments: {
            message:
              'Hello from Veil',
          },
        },

        reason:
          'ADR-001 outbound MCP proof',

        status: 'pending',

        createdAt:
          new Date().toISOString(),
      },
    ],
  };

  const job =
    await operatorRuntime.executePlan(
      plan
    );

  console.log(
    JSON.stringify(
      job,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});