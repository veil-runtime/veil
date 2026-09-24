import { types as nodeTypes } from 'node:util';

const MAX_DEPTH = 128;
const MAX_CONTAINERS = 10_000;
const MAX_EDGES = 100_000;
const MAX_STRING_UNITS = 1_048_576;

export class GovernedValueError extends Error {
  constructor() {
    super('Value is not a supported governed representation');
    this.name = 'GovernedValueError';
  }
}

type GovernedContainer = Record<string, unknown> | unknown[];

interface Entry {
  readonly key: string;
  readonly value: unknown;
}

interface Frame {
  readonly source: object;
  readonly target: GovernedContainer;
  readonly entries: readonly Entry[];
  index: number;
}

function reject(): never {
  throw new GovernedValueError();
}

function primitive(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  switch (typeof value) {
    case 'boolean':
    case 'string':
    case 'number':
    case 'bigint':
      return true;
    default:
      return false;
  }
}

function excludedBrand(value: object): boolean {
  if (nodeTypes.isProxy(value)) return true;
  if (
    nodeTypes.isDate(value) ||
    nodeTypes.isMap(value) ||
    nodeTypes.isSet(value) ||
    nodeTypes.isRegExp(value) ||
    nodeTypes.isBoxedPrimitive(value) ||
    nodeTypes.isAnyArrayBuffer(value) ||
    nodeTypes.isArrayBufferView(value) ||
    nodeTypes.isDataView(value) ||
    nodeTypes.isWeakMap(value) ||
    nodeTypes.isWeakSet(value) ||
    nodeTypes.isPromise(value)
  ) return true;
  const iteratorTypes = [
    nodeTypes.isMapIterator,
    nodeTypes.isSetIterator,
    nodeTypes.isGeneratorObject,
  ];
  return iteratorTypes.some((check) => check?.(value) === true);
}

function inspect(value: object, counters: Counters): {
  target: GovernedContainer;
  entries: Entry[];
} {
  if (excludedBrand(value)) reject();

  const prototype = Object.getPrototypeOf(value);
  const isArray = Array.isArray(value);
  if (isArray && prototype !== Array.prototype) reject();
  if (!isArray && prototype !== Object.prototype && prototype !== null) reject();

  const keys = Reflect.ownKeys(value);
  const entries: Entry[] = [];
  let length = 0;

  if (isArray) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      !lengthDescriptor ||
      lengthDescriptor.enumerable ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) reject();
    length = lengthDescriptor.value;
  }

  for (const key of keys) {
    if (typeof key !== 'string') reject();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) reject();

    if (isArray && key === 'length') {
      if (descriptor.enumerable || typeof descriptor.value !== 'number' || descriptor.value !== length) reject();
      continue;
    }

    if (!descriptor.enumerable) reject();
    if (typeof descriptor.value === 'string') counters.stringUnits += descriptor.value.length;
    counters.stringUnits += key.length;
    if (counters.stringUnits > MAX_STRING_UNITS) reject();

    if (isArray) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || String(index) !== key || index >= length) reject();
    }
    entries.push({ key, value: descriptor.value });
  }

  if (isArray) {
    if (!Number.isSafeInteger(length) || length < 0) reject();
    for (let index = 0; index < length; index += 1) {
      if (!entries.some((entry) => entry.key === String(index))) reject();
    }
    counters.edges += entries.length;
    if (counters.edges > MAX_EDGES) reject();
    return { target: new Array(length), entries };
  }

  counters.edges += entries.length;
  if (counters.edges > MAX_EDGES) reject();
  return {
    target: Object.create(prototype === null ? null : Object.prototype) as Record<string, unknown>,
    entries,
  };
}

interface Counters {
  containers: number;
  edges: number;
  stringUnits: number;
}

function clone(value: unknown, freeze: boolean): unknown {
  const counters: Counters = { containers: 0, edges: 0, stringUnits: 0 };
  const memo = new Map<object, GovernedContainer>();
  const active = new Set<object>();
  const stack: Frame[] = [];

  const make = (candidate: unknown, depth: number): unknown => {
    if (primitive(candidate)) {
      if (typeof candidate === 'string') {
        counters.stringUnits += candidate.length;
        if (counters.stringUnits > MAX_STRING_UNITS) reject();
      }
      return candidate;
    }
    if (typeof candidate !== 'object' || candidate === null) reject();
    if (depth > MAX_DEPTH) reject();
    const source = candidate as object;
    const existing = memo.get(source);
    if (existing) {
      if (active.has(source)) reject();
      return existing;
    }
    counters.containers += 1;
    if (counters.containers > MAX_CONTAINERS) reject();
    const inspected = inspect(source, counters);
    memo.set(source, inspected.target);
    active.add(source);
    stack.push({ source, target: inspected.target, entries: inspected.entries, index: 0 });
    return inspected.target;
  };

  const root = make(value, 0);
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.entries.length) {
      active.delete(frame.source);
      stack.pop();
      continue;
    }
    const entry = frame.entries[frame.index++];
    const child = make(entry.value, stack.length);
    Object.defineProperty(frame.target, entry.key, {
      value: child,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  if (freeze && typeof root === 'object' && root !== null) {
    const pending: object[] = [root];
    const seen = new Set<object>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const key of Object.keys(current)) {
        const child = (current as Record<string, unknown>)[key];
        if (typeof child === 'object' && child !== null) pending.push(child);
      }
      Object.freeze(current);
    }
  }

  return root;
}

export function captureGovernedValue(value: unknown): unknown {
  return clone(value, false);
}

export function copyGovernedValue(value: unknown, frozen = false): unknown {
  return clone(value, frozen);
}
