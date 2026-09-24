import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isResultReference,
  parseResultReference,
  resolveResultReferences,
} from '../src/runtime/execution/result-reference.js';

const REFERENCE = 'steps.source.result';

function resolve(result: unknown, path?: string): unknown {
  return resolveResultReferences({
    $ref: `steps.source.result${path === undefined ? '' : `.${path}`}`,
  }, [{ id: 'source', capability: 'source', status: 'completed', createdAt: '', result }]);
}

function assertMissing(result: unknown, path: string): void {
  assert.throws(() => resolve(result, path), {
    message: `Result reference path not found: steps.source.result.${path}`,
  });
}

test('reference wrappers use the exact own enumerable string data shape', () => {
  class ClassReference {
    readonly $ref = REFERENCE;
  }

  const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
    $ref: REFERENCE,
  });
  const customPrototype = Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, {
    $ref: REFERENCE,
  });

  for (const value of [
    { $ref: REFERENCE },
    Object.freeze({ $ref: REFERENCE }),
    Object.seal({ $ref: REFERENCE }),
    nullPrototype,
    customPrototype,
    new ClassReference(),
  ]) {
    assert.equal(isResultReference(value), true);
  }
});

test('reference wrappers reject inherited, accessor, hidden, symbol, array and non-string shapes', () => {
  let accessorCalls = 0;
  const accessor = Object.defineProperty({}, '$ref', {
    enumerable: true,
    get() {
      accessorCalls += 1;
      return REFERENCE;
    },
  });
  const nonenumerable = Object.defineProperty({}, '$ref', { value: REFERENCE });
  const hiddenExtra = Object.defineProperty({ $ref: REFERENCE }, 'hidden', { value: true });
  const symbolExtra = { $ref: REFERENCE, [Symbol('extra')]: true };
  const hiddenSymbolExtra = Object.defineProperty(
    { $ref: REFERENCE }, Symbol('hidden-extra'), { value: true }
  );
  const array = Object.assign([], { $ref: REFERENCE });

  for (const value of [
    Object.assign(Object.create({ $ref: REFERENCE }), { other: true }),
    Object.create({ $ref: REFERENCE }),
    accessor,
    nonenumerable,
    { $ref: REFERENCE, extra: true },
    hiddenExtra,
    symbolExtra,
    hiddenSymbolExtra,
    array,
    {},
    { $ref: 1 },
    { $ref: new String(REFERENCE) },
    Object.assign(() => undefined, { $ref: REFERENCE }),
  ]) {
    assert.equal(isResultReference(value), false);
  }
  assert.equal(accessorCalls, 0);
});

test('an accessor rejected as a reference remains subject to ordinary input recursion', () => {
  let accessorCalls = 0;
  const accessor = Object.defineProperty({}, '$ref', {
    enumerable: true,
    get() {
      accessorCalls += 1;
      return REFERENCE;
    },
  });

  assert.equal(isResultReference(accessor), false);
  assert.equal(accessorCalls, 0);
  assert.deepEqual(resolveResultReferences(accessor, []), { $ref: REFERENCE });
  assert.equal(accessorCalls, 1);
});

test('shape recognition remains separate from result-reference parsing', () => {
  const malformed = { $ref: 'not-a-result-reference' };
  assert.equal(isResultReference(malformed), true);
  assert.throws(() => parseResultReference(malformed.$ref), {
    message: 'Invalid result reference: not-a-result-reference',
  });
});

test('proxy wrappers use reflective traps without a passive-recognition guarantee', () => {
  let ownKeyCalls = 0;
  let descriptorCalls = 0;
  let getCalls = 0;
  const proxy = new Proxy({ $ref: REFERENCE }, {
    ownKeys(target) {
      ownKeyCalls += 1;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      descriptorCalls += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    get(target, key) {
      getCalls += 1;
      return key === '$ref' ? target.$ref : undefined;
    },
  });

  assert.equal(isResultReference(proxy), true);
  assert.ok(ownKeyCalls > 0);
  assert.ok(descriptorCalls > 0);
  assert.equal(getCalls, 0);

  const result = { value: 'resolved' };
  assert.equal(resolveResultReferences(proxy, [{
    id: 'source', capability: 'source', status: 'completed', createdAt: '', result,
  }]), result);
  assert.ok(getCalls > 0);

  assert.equal(isResultReference(new Proxy({ $ref: REFERENCE, extra: true }, {})), false);
  const error = new Error('proxy own keys failed');
  assert.throws(() => isResultReference(new Proxy({}, {
    ownKeys() {
      throw error;
    },
  })), (caught) => caught === error);
});

test('own root and nested properties preserve result and nested identity', () => {
  const nested = { value: 'owned' };
  const result = { nested, value: 'root' };
  assert.equal(resolve(result), result);
  assert.equal(resolve(result, 'nested'), nested);
  assert.equal(resolve(result, 'value'), 'root');
  assert.equal(resolve(result, 'nested.value'), 'owned');
});

test('ownership is required at the root and every nested segment', () => {
  assertMissing(Object.create({ value: 'inherited' }), 'value');
  assertMissing({ nested: Object.create({ value: 'inherited' }) }, 'nested.value');
  assertMissing({ nested: { deeper: Object.create({ value: 'inherited' }) } }, 'nested.deeper.value');
  for (const name of ['__proto__', 'constructor', 'toString']) {
    assertMissing({}, name);
    assertMissing({ nested: {} }, `nested.${name}`);
  }
});

test('JSON-owned special names are legitimate data', () => {
  const result = JSON.parse('{"__proto__":{"value":1},"constructor":{"value":2},"prototype":{"value":3}}');
  for (const name of ['__proto__', 'constructor', 'prototype']) {
    assert.equal(resolve(result, name), result[name]);
    assert.equal(resolve(result, `${name}.value`), result[name].value);
  }
});

test('arrays expose own indices and length, but not holes, inherited indices or methods', () => {
  const array = ['own', , ];
  const prototype = Object.create(Array.prototype);
  prototype[2] = 'inherited';
  Object.setPrototypeOf(array, prototype);
  assert.equal(resolve(array, '0'), 'own');
  assert.equal(resolve(array, 'length'), 2);
  for (const path of ['1', '2', 'map', 'constructor']) assertMissing(array, path);
});

test('null prototypes, shadowed hasOwnProperty and non-enumerable own data work', () => {
  const result = Object.assign(Object.create(null), { value: 'owned', hasOwnProperty: false });
  Object.defineProperty(result, 'hidden', { value: 'non-enumerable' });
  assert.equal(resolve(result, 'value'), 'owned');
  assert.equal(resolve(result, 'hasOwnProperty'), false);
  assert.equal(resolve(result, 'hidden'), 'non-enumerable');
  assertMissing(result, 'missing');
  assertMissing({ hasOwnProperty: () => true }, 'missing');
});

test('falsy and undefined terminals remain valid while intermediate guards remain intact', () => {
  for (const value of [undefined, null, false, 0, -0, NaN, '', 0n]) {
    assert.equal(resolve({ value }, 'value'), value);
    assert.equal(resolve(value), value);
    assertMissing({ value }, 'value.next');
  }
  for (const value of ['text', 1, true, Object.assign(() => {}, { next: 1 })]) {
    assertMissing({ value }, 'value.next');
  }
});

test('own getters run normally; inherited getters are rejected without invocation', () => {
  let calls = 0;
  const nested = { value: 'getter result' };
  const own = { get value() { calls += 1; return nested; } };
  assert.equal(resolve(own, 'value'), nested);
  assert.equal(calls, 1);
  assertMissing(Object.create(own), 'value');
  assert.equal(calls, 1);
  const error = new Error('getter failed');
  assert.throws(() => resolve({ get value() { throw error; } }, 'value'), (caught) => caught === error);
});

test('proxy ownership and reads use traps without promising proxy isolation', () => {
  const calls: string[] = [];
  const proxy = new Proxy({}, {
    has() { throw new Error('in must not be used'); },
    getOwnPropertyDescriptor(_target, key) {
      calls.push(`own:${String(key)}`);
      return key === 'virtual' ? { configurable: true, enumerable: true, value: 'descriptor' } : undefined;
    },
    get(_target, key) { calls.push(`get:${String(key)}`); return 'proxy read'; },
  });
  assert.equal(resolve(proxy, 'virtual'), 'proxy read');
  assertMissing(proxy, 'missing');
  assert.deepEqual(calls, ['own:virtual', 'get:virtual', 'own:missing']);
  const error = new Error('proxy ownership failed');
  assert.throws(() => resolve(new Proxy({}, {
    getOwnPropertyDescriptor() { throw error; },
  }), 'value'), (caught) => caught === error);
});
