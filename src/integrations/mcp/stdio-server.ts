import {
  StdioServerTransport,
} from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  registerCapabilities,
} from '../../runtime/registry/register-capabilities.js';

import {
  McpAdapter,
} from './inbound/mcp-adapter.js';

async function start(): Promise<void> {
  registerCapabilities();

  const adapter =
    new McpAdapter();

  const transport =
    new StdioServerTransport();

  await adapter.server.connect(
    transport
  );
}

start().catch((error) => {
  console.error(
    'Unable to start Veil MCP adapter',
    error
  );

  process.exit(1);
});