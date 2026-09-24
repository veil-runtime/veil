import { JobStep } from '../jobs/job-step.js';

const REFERENCE_PREFIX = 'steps.';
const RESULT_SEGMENT = '.result';

export function isResultReference(
  value: unknown
): value is { readonly $ref: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== '$ref') {
    return false;
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, '$ref');
  return descriptor !== undefined
    && descriptor.enumerable === true
    && Object.hasOwn(descriptor, 'value')
    && typeof descriptor.value === 'string';
}

export function parseResultReference(
  reference: string
): { stepId: string; path: string[] } {
  if (!reference.startsWith(REFERENCE_PREFIX)) {
    throw new Error(`Invalid result reference: ${reference}`);
  }

  const resultIndex = reference.indexOf(RESULT_SEGMENT);
  if (resultIndex <= REFERENCE_PREFIX.length) {
    throw new Error(`Invalid result reference: ${reference}`);
  }

  const stepId = reference.slice(REFERENCE_PREFIX.length, resultIndex);
  const suffix = reference.slice(resultIndex + RESULT_SEGMENT.length);
  if (suffix && !suffix.startsWith('.')) {
    throw new Error(`Invalid result reference: ${reference}`);
  }

  return {
    stepId,
    path: suffix ? suffix.slice(1).split('.') : [],
  };
}

export function resolveResultReferences(
  value: unknown,
  completedSteps: readonly JobStep[]
): unknown {
  if (isResultReference(value)) {
    const { stepId, path } = parseResultReference(value.$ref);
    const step = completedSteps.find((candidate) => candidate.id === stepId);

    if (!step || step.status !== 'completed') {
      throw new Error(`Result reference requires completed earlier step: ${stepId}`);
    }

    let resolved = step.result;
    for (const segment of path) {
      if (!resolved || typeof resolved !== 'object' || !Object.hasOwn(resolved, segment)) {
        throw new Error(`Result reference path not found: ${value.$ref}`);
      }
      resolved = (resolved as Record<string, unknown>)[segment];
    }
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveResultReferences(item, completedSteps));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveResultReferences(item, completedSteps),
      ])
    );
  }

  return value;
}
