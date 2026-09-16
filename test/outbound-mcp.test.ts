import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OperatorRuntime } from '../src/index.js';
import { createMcpCapability } from '../src/integrations/mcp/outbound/mcp-capability.js';
import { type CapabilityRisk } from '../src/runtime/registry/capability.js';
import { capabilityRegistry } from '../src/runtime/registry/registry.js';

function providerSpy() {
  const calls: Array<{ name: string; input: unknown }> = [];
  const provider = {
    async callTool(name: string, input: unknown) {
      calls.push({ name, input });
      return { content: [{ type: 'text', text: 'executed' }] };
    },
  } as Parameters<typeof createMcpCapability>[3];
  return { provider, calls };
}

function plan(capability: string) {
  return {
    version: '1.0' as const,
    steps: [{
      id: 'step',
      capability,
      capabilityVersion: '1.0.0',
      input: { arguments: { message: 'hello' } },
    }],
  };
}

for (const risk of ['read', 'write', 'destructive'] as const) {
  test(`outbound MCP preserves declared ${risk} risk`, () => {
    const { provider, calls } = providerSpy();
    const capability = createMcpCapability('test.mcp', 'Echo', 'echo', provider, risk);
    assert.equal(capability.risk, risk);
    assert.deepEqual(calls, []);
  });

  test(`default authorization governs outbound MCP ${risk}`, async () => {
    const { provider, calls } = providerSpy();
    const name = `test.mcp.default.${risk}`;
    capabilityRegistry.register(createMcpCapability(name, 'Echo', 'echo', provider, risk));
    const job = await new OperatorRuntime().executePlan(plan(name));
    assert.equal(job.status, risk === 'read' ? 'completed' : 'failed');
    assert.equal(calls.length, risk === 'read' ? 1 : 0);
    if (risk !== 'read') {
      assert.ok(job.events.some(event => event.type === 'capability.denied'));
      assert.ok(!job.events.some(event => event.type === 'capability.started'));
    }
  });

  test(`custom authorization receives and permits outbound MCP ${risk}`, async () => {
    const { provider, calls } = providerSpy();
    const name = `test.mcp.custom.${risk}`;
    const received: CapabilityRisk[] = [];
    capabilityRegistry.register(createMcpCapability(name, 'Echo', 'echo', provider, risk));
    const runtime = new OperatorRuntime({
      authorizer: {
        async authorize(context) {
          received.push(context.capability.risk);
          return { decision: 'allow' };
        },
      },
    });
    const job = await runtime.executePlan(plan(name));
    assert.equal(job.status, 'completed');
    assert.deepEqual(received, [risk]);
    assert.deepEqual(calls, [{ name: 'echo', input: { message: 'hello' } }]);
  });
}

test('outbound MCP refuses missing risk before provider execution', () => {
  const { provider, calls } = providerSpy();
  assert.throws(() => {
    // @ts-expect-error Risk is required even when an untyped caller omits it.
    createMcpCapability('test.mcp.missing', 'Echo', 'echo', provider);
  }, /explicit valid CapabilityRisk/);
  assert.deepEqual(calls, []);
});

test('outbound MCP refuses invalid risks before provider execution', () => {
  const { provider, calls } = providerSpy();
  for (const risk of [undefined, null, '', 'unknown', 'READ', 1, {}, ['read']]) {
    assert.throws(() => {
      // @ts-expect-error Exercise invalid classifications from untyped callers.
      createMcpCapability('test.mcp.invalid', 'Echo', 'echo', provider, risk);
    }, /explicit valid CapabilityRisk/);
  }
  assert.deepEqual(calls, []);
});
