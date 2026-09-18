import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpAdapter, OperatorRuntime, type Capability } from '../src/index.js';

test('inbound MCP preserves construction-time inventory and governed invocation', async t => {
  let authorizations = 0;
  let executions = 0;
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize() { authorizations += 1; return { decision: 'allow' }; },
  } });
  function register(name: string): void {
    const capability: Capability = { name, version: '1.0.0', description: 'MCP fixture', risk: 'read',
      inputSchema: { value: { type: 'string', required: true, description: 'Value' } },
      async execute(input) { executions += 1; return input; },
    };
    runtime.use({ manifest: { name, version: '1', capabilities: [name] }, capabilities: [capability] });
  }
  register('introspection.mcp.first');
  const adapter = new McpAdapter(runtime);
  register('introspection.mcp.later');
  assert.ok(runtime.describeCapability('introspection.mcp.later'));
  const client = new Client({ name: 'introspection-test', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await adapter.server.close(); });
  await adapter.server.connect(serverTransport);
  await client.connect(clientTransport);
  const inventory = await client.listTools();
  assert.deepEqual(inventory.tools.map(tool => tool.name), ['introspection.mcp.first']);
  assert.equal(inventory.tools[0].description, 'MCP fixture');
  assert.deepEqual(inventory.tools[0].inputSchema.required, ['value']);
  assert.deepEqual([authorizations, executions], [0, 0]);
  const result = await client.callTool({ name: 'introspection.mcp.first', arguments: { value: 'hello' } });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.content, [{ type: 'text', text: JSON.stringify({ value: 'hello' }, null, 2) }]);
  assert.deepEqual([authorizations, executions], [1, 1]);
});
