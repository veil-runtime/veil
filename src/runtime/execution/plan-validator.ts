import { capabilityRegistry } from '../registry/registry.js';
import { JobStep } from '../jobs/job-step.js';

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

export function validatePlan(
  steps: JobStep[]
): PlanValidationResult {
  const errors: PlanValidationError[] = [];

  for (const step of steps) {
    const capability =
      capabilityRegistry.get(step.capability);

    if (!capability) {
      errors.push({
        stepId: step.id,
        capability: step.capability,
        message: `Unknown capability: ${step.capability}`,
      });

      continue;
    }

    const schema = capability.inputSchema ?? {};

    for (const [field, definition] of Object.entries(schema)) {
      if (!definition.required) {
        continue;
      }

      const input =
        step.input &&
        typeof step.input === 'object'
          ? (step.input as Record<string, unknown>)
          : {};

      const value = input[field];

      if (
        value === undefined ||
        value === null ||
        value === ''
      ) {
        errors.push({
          stepId: step.id,
          capability: step.capability,
          field,
          message:
            `Required input '${field}' is missing for capability '${step.capability}'`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}