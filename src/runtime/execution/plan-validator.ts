import { ExecutionStep } from '../planner/planner.js';
import { Capability } from '../registry/capability.js';
import { capabilityRegistry } from '../registry/registry.js';
import { isResultReference, parseResultReference } from './result-reference.js';

export interface PlanValidationError {
  stepId: string;
  capability: string;
  field?: string;
  message: string;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: PlanValidationError[];
}

const TYPE_CHECKS: Record<string, (value: unknown) => boolean> = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  object: (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
  array: (value) => Array.isArray(value),
};

function validateInput(
  step: ExecutionStep,
  capability: Capability,
  allowReferences: boolean
): PlanValidationError[] {
  const errors: PlanValidationError[] = [];
  const input = step.input && typeof step.input === 'object' && !Array.isArray(step.input)
    ? step.input as Record<string, unknown>
    : {};

  for (const [field, definition] of Object.entries(capability.inputSchema ?? {})) {
    const value = input[field];
    if (definition.required && (value === undefined || value === null || value === '')) {
      errors.push({
        stepId: step.id,
        capability: step.capability,
        field,
        message: `Required input '${field}' is missing for capability '${step.capability}'`,
      });
      continue;
    }

    if (value === undefined || (allowReferences && isResultReference(value))) {
      continue;
    }

    const check = TYPE_CHECKS[definition.type];
    if (!check) {
      errors.push({
        stepId: step.id,
        capability: step.capability,
        field,
        message: `Unsupported schema type '${definition.type}' for capability '${step.capability}'`,
      });
    } else if (!check(value)) {
      errors.push({
        stepId: step.id,
        capability: step.capability,
        field,
        message: `Input '${field}' must be of type '${definition.type}' for capability '${step.capability}'`,
      });
    }
  }

  return errors;
}

function collectReferences(value: unknown): string[] {
  if (isResultReference(value)) return [value.$ref];
  if (Array.isArray(value)) return value.flatMap(collectReferences);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectReferences);
  }
  return [];
}

export function validateStepInput(
  step: ExecutionStep,
  input: unknown
): PlanValidationResult {
  const capability = capabilityRegistry.get(step.capability);
  if (!capability) {
    return {
      valid: false,
      errors: [{
        stepId: step.id,
        capability: step.capability,
        message: `Unknown capability: ${step.capability}`,
      }],
    };
  }

  const errors = validateInput({ ...step, input }, capability, false);
  return { valid: errors.length === 0, errors };
}

export function validatePlan(
  steps: readonly ExecutionStep[]
): PlanValidationResult {
  const errors: PlanValidationError[] = [];
  const seenStepIds = new Set<string>();

  for (const step of steps) {
    const capability = capabilityRegistry.get(step.capability);
    if (!capability) {
      errors.push({
        stepId: step.id,
        capability: step.capability,
        message: `Unknown capability: ${step.capability}`,
      });
      seenStepIds.add(step.id);
      continue;
    }

    if (step.capabilityVersion && step.capabilityVersion !== capability.version) {
      errors.push({
        stepId: step.id,
        capability: step.capability,
        message: `Capability version mismatch for '${step.capability}': requested ${step.capabilityVersion}, registered ${capability.version}`,
      });
    }

    errors.push(...validateInput(step, capability, true));

    for (const reference of collectReferences(step.input)) {
      try {
        const { stepId } = parseResultReference(reference);
        if (!seenStepIds.has(stepId)) {
          errors.push({
            stepId: step.id,
            capability: step.capability,
            message: `Result reference must target an earlier step: ${reference}`,
          });
        }
      } catch (error) {
        errors.push({
          stepId: step.id,
          capability: step.capability,
          message: error instanceof Error ? error.message : 'Invalid result reference',
        });
      }
    }

    seenStepIds.add(step.id);
  }

  return { valid: errors.length === 0, errors };
}
