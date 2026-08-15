import {
  Client,
} from '@modelcontextprotocol/sdk/client/index.js';

import {
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';

export interface McpProviderOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class McpProvider {
  constructor(
    private readonly options: McpProviderOptions
  ) {}

  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const transport =
      new StdioClientTransport({
        command:
          this.options.command,

        args:
          this.options.args ?? [],

        cwd:
          this.options.cwd,

        env:
          this.options.env,
      });

    const client =
      new Client({
        name: 'veil-mcp-provider',
        version: '0.1.0',
      });

    try {
      await client.connect(
        transport
      );

      const result =
        await client.callTool({
          name: toolName,
          arguments: args,
        });

      if (result.isError) {
        throw new Error(
          `MCP tool failed: ${JSON.stringify(
            result.content
          )}`
        );
      }

      return result;
    } finally {
      await client.close();
    }
  }
}