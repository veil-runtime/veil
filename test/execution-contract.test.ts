import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ExecutionCaller } from '../src/runtime/execution/execution-context.js';
import { validatePlan } from '../src/runtime/execution/plan-validator.js';
import { OperatorRuntime } from '../src/runtime/operator-runtime.js';
import { capabilityRegistry } from '../src/runtime/registry/registry.js';

const suffix = `${process.pid}-${Date.now()}`;
const sourceName = `test.source.${suffix}`;
const sinkName = `test.sink.${suffix}`;
let receivedCaller: ExecutionCaller | undefined;
let receivedInput: unknown;

capabilityRegistry.register({
  name: sourceName,
  version: '1.0.0',
  description: 'test source',
  risk: 'read',
  async execute() {
    return { user: { id: 'user-123' } };
  },
});

capabilityRegistry.register({
  name: sinkName,
  version: '1.0.0',
  description: 'test sink',
  risk: 'read',
  inputSchema: {
    userId: { type: 'string', required: true, description: 'user id' },
  },
  async execute(input, context) {
    receivedInput = input;
    receivedCaller = context?.caller;
    return input;
  },
});

test('external linear plans resolve earlier results and propagate immutable caller context', async () => {
  const runtime = new OperatorRuntime();
  const caller: ExecutionCaller = {
    subject: 'subject-1',
    tenant: 'tenant-1',
    scopes: ['read'],
    metadata: { source: 'test' },
  };

  const job = await runtime.executePlan({
    version: '1.0',
    idempotencyKey: 'plan-once',
    steps: [
      { id: 'source', capability: sourceName, capabilityVersion: '1.0.0' },
      {
        id: 'sink',
        capability: sinkName,
        capabilityVersion: '1.0.0',
        idempotencyKey: 'sink-once',
        input: { userId: { $ref: 'steps.source.result.user.id' } },
      },
    ],
  }, { caller });

  assert.equal(job.status, 'completed');
  assert.equal(job.idempotencyKey, 'plan-once');
  assert.deepEqual(receivedInput, { userId: 'user-123' });
  assert.deepEqual(receivedCaller, caller);
  assert.ok(Object.isFrozen(receivedCaller));
  assert.ok(Object.isFrozen(receivedCaller?.scopes));
  assert.ok(Object.isFrozen(receivedCaller?.metadata));
  assert.equal(job.steps[0].status, 'completed');
  assert.ok(job.steps[0].createdAt);
});

test('plan validation rejects incompatible versions, malformed input, and forward references', () => {
  const result = validatePlan([
    {
      id: 'sink',
      capability: sinkName,
      capabilityVersion: '2.0.0',
      input: { userId: { $ref: 'steps.source.result.user.id' } },
    },
    { id: 'source', capability: sourceName },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.message).join('\n'), /version mismatch/);
  assert.match(result.errors.map((error) => error.message).join('\n'), /earlier step/);

  const malformed = validatePlan([
    { id: 'sink-2', capability: sinkName, input: { userId: 42 } },
  ]);
  assert.equal(malformed.valid, false);
  assert.match(malformed.errors[0].message, /must be of type 'string'/);
});
