import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publicApi from '../src/index.js';
import { OperatorRuntime, type Capability, type CapabilityDescriptor } from '../src/index.js';
import { validatePlan } from '../src/runtime/execution/plan-validator.js';
import { runtimeEventBus } from '../src/runtime/events/memory-event-bus.js';

function register(runtime: OperatorRuntime, capability: Capability): void {
  runtime.use({
    manifest: { name: capability.name, version: '1', capabilities: [capability.name] },
    capabilities: [capability],
  });
}

function fixture(name: string, version = '1.0.0'): Capability {
  return { name, version, description: 'Passive metadata', risk: 'write',
    inputSchema: Object.fromEntries(['string', 'number', 'boolean', 'object', 'array']
      .map(type => [type, { type, required: true, description: `${type} field` }])),
    async execute(input) { return input; },
  };
}

test('exact lookup, complete projection, missing schema and ordinary JSON descriptors', () => {
  const runtime = new OperatorRuntime();
  const capability = fixture('introspection.Exact');
  register(runtime, capability);
  const expected: CapabilityDescriptor = {
    name: capability.name, version: capability.version, description: capability.description,
    risk: capability.risk, inputSchema: capability.inputSchema!,
  };
  assert.deepEqual(runtime.describeCapability(capability.name), expected);
  assert.deepEqual(runtime.describeCapability(capability.name, '1.0.0'), expected);
  assert.deepEqual(runtime.listCapabilities().find(item => item.name === capability.name), expected);
  for (const name of ['introspection.exact', 'introspection.Unknown', ' introspection.Exact']) {
    assert.equal(runtime.describeCapability(name), undefined);
  }
  for (const version of ['', '1.0', '1.0.0 ', '2.0.0']) {
    assert.equal(runtime.describeCapability(capability.name, version), undefined);
  }
  const emptyVersion = fixture('introspection.empty-version', '');
  delete emptyVersion.inputSchema;
  register(runtime, emptyVersion);
  assert.deepEqual(runtime.describeCapability(emptyVersion.name, '')?.inputSchema, {});
  assert.equal(runtime.describeCapability(emptyVersion.name)?.version, '');
  assert.deepEqual(runtime.listCapabilities().find(item => item.name === emptyVersion.name)?.inputSchema, {});
  assert.equal(runtime.describeCapability(emptyVersion.name, '1'), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.describeCapability(capability.name))), expected);
});

for (const source of ['list', 'describe'] as const) {
  test(`${source} snapshots isolate list, descriptor, schema and field mutation from validation`, () => {
    const runtime = new OperatorRuntime();
    const capability = fixture(`introspection.mutation.${source}`);
    register(runtime, capability);
    const steps = [{ id: 'one', capability: capability.name, input: {} }];
    const invalidBefore = validatePlan(steps);
    assert.equal(invalidBefore.errors.length, 5);
    const valid = [{ ...steps[0], input: {
      string: 'value', number: 1, boolean: false, object: {}, array: [],
    } }];
    assert.equal(validatePlan(valid).valid, true);
    const snapshot = runtime.describeCapability(capability.name)!;
    const list = runtime.listCapabilities();
    const result = source === 'list'
      ? list.find(item => item.name === capability.name)!
      : runtime.describeCapability(capability.name)!;
    assert.notEqual(result, capability);
    assert.notEqual(result.inputSchema, capability.inputSchema);
    assert.notEqual(result.inputSchema.string, capability.inputSchema!.string);
    assert.equal(Object.isFrozen(result), false);
    assert.equal(Object.isFrozen(result.inputSchema), false);
    assert.equal(Object.isFrozen(result.inputSchema.string), false);
    result.inputSchema.string.required = false;
    result.inputSchema.string.type = 'number';
    result.inputSchema.string.description = 'changed';
    delete result.inputSchema.number;
    result.inputSchema.extra = { type: 'string', required: true, description: 'extra' };
    result.name = 'changed';
    result.version = 'changed';
    result.risk = 'read';
    result.description = 'changed';
    assert.deepEqual(validatePlan(steps), invalidBefore);
    assert.equal(validatePlan(valid).valid, true);
    assert.deepEqual(runtime.describeCapability(capability.name), snapshot);
    result.inputSchema = {};
    list.splice(0, list.length);
    assert.deepEqual(runtime.describeCapability(capability.name), snapshot);
    assert.deepEqual(runtime.listCapabilities().find(item => item.name === capability.name), snapshot);
  });
}

test('registration order, stable prior snapshots, duplicate names and process-global inventory', () => {
  const first = new OperatorRuntime();
  const second = new OperatorRuntime();
  const before = first.listCapabilities();
  const a = fixture('introspection.order.a');
  const b = fixture('introspection.order.b');
  register(first, a);
  const snapshot = second.listCapabilities();
  const description = second.describeCapability(a.name);
  register(second, b);
  assert.deepEqual(first.listCapabilities().map(item => item.name), [...before.map(item => item.name), a.name, b.name]);
  assert.deepEqual(second.listCapabilities(), first.listCapabilities());
  assert.deepEqual(snapshot.map(item => item.name), [...before.map(item => item.name), a.name]);
  assert.deepEqual(first.describeCapability(a.name), description);
  assert.throws(() => register(second, fixture(a.name, '2.0.0')), {
    message: `Capability already registered: ${a.name}`,
  });
  assert.equal(first.describeCapability(a.name)?.version, '1.0.0');
});

test('introspection has no authorization, execution, provider or lifecycle effects and leaks no implementation', t => {
  let authorizations = 0;
  let executions = 0;
  let providerCalls = 0;
  const provider = { async request() { providerCalls += 1; } };
  const runtime = new OperatorRuntime({ authorizer: {
    async authorize() { authorizations += 1; return { decision: 'deny' }; },
  } });
  const capability = { ...fixture('introspection.passive'), provider,
    middleware: ['private'], connectionSettings: { credential: 'private' },
    async execute() { executions += 1; await provider.request(); },
  };
  register(runtime, capability);
  const events: string[] = [];
  t.after(runtimeEventBus.subscribe('*', event => { events.push(event.type); }));
  for (const descriptor of [runtime.describeCapability(capability.name)!,
    runtime.listCapabilities().find(item => item.name === capability.name)!]) {
    assert.deepEqual(Object.keys(descriptor).sort(), ['description', 'inputSchema', 'name', 'risk', 'version']);
    for (const field of Object.values(descriptor.inputSchema)) {
      assert.deepEqual(Object.keys(field).sort(), ['description', 'required', 'type']);
    }
  }
  assert.equal(runtime.describeCapability('introspection.absent'), undefined);
  assert.equal(runtime.describeCapability(capability.name, 'wrong'), undefined);
  assert.deepEqual([authorizations, executions, providerCalls], [0, 0, 0]);
  assert.deepEqual(events, []);
  assert.equal('CapabilityRegistry' in publicApi, false);
  assert.equal('capabilityRegistry' in publicApi, false);
});

test('projection preserves field names and passive type strings without copying extra field properties', () => {
  const runtime = new OperatorRuntime();
  const field = { type: 'author-defined', required: false, description: 'Optional metadata',
    privateMetadata: { secret: 'not part of the field contract' },
  };
  const capability = fixture('introspection.field-projection');
  capability.inputSchema = Object.fromEntries([['__proto__', field]]);
  register(runtime, capability);
  const snapshot = runtime.describeCapability(capability.name)!;
  assert.deepEqual(Object.keys(snapshot.inputSchema), ['__proto__']);
  assert.deepEqual(snapshot.inputSchema['__proto__'], {
    type: 'author-defined', required: false, description: 'Optional metadata',
  });
  assert.equal(Object.getPrototypeOf(snapshot.inputSchema), Object.prototype);
  field.description = 'later author change';
  assert.equal(snapshot.inputSchema['__proto__'].description, 'Optional metadata');
  assert.equal(runtime.describeCapability(capability.name)!.inputSchema['__proto__'].description, 'later author change');
});
