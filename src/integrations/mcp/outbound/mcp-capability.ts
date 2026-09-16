import {
  Capability,
  CapabilityRisk,
} from '../../../runtime/registry/capability.js';

import {
  McpProvider,
} from './mcp-provider.js';

interface McpCapabilityInput {
  arguments?: Record<
    string,
    unknown
  >;
}

export function createMcpCapability(
  name: string,
  description: string,
  downstreamToolName: string,
  provider: McpProvider,
  risk: CapabilityRisk
): Capability<
  McpCapabilityInput,
  unknown
> {
  if (risk !== 'read' && risk !== 'write' && risk !== 'destructive') {
    throw new TypeError('Outbound MCP capability requires an explicit valid CapabilityRisk');
  }

  return {
    name,

    version: '1.0.0',

    description,

    risk,

    inputSchema: {
      arguments: {
        type: 'object',
        required: false,
        description:
          'Arguments passed to the downstream MCP tool',
      },
    },

    async execute(
      input,
      context
    ) {
      context?.logger.info(
        'Calling downstream MCP tool',
        {
          capability: name,
          tool:
            downstreamToolName,
        }
      );

      const result =
        await provider.callTool(
          downstreamToolName,
          input.arguments ?? {}
        );

      context?.logger.info(
        'Downstream MCP tool completed',
        {
          capability: name,
          tool:
            downstreamToolName,
        }
      );

      return result;
    },
  };
}
