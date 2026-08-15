import {
  Capability,
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
  provider: McpProvider
): Capability<
  McpCapabilityInput,
  unknown
> {
  return {
    name,

    version: '1.0.0',

    description,

    risk: 'read',

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
