import { PlannerDefinition } from './planner-definition.js';
import { PlannerRuntimeState } from './planner-runtime-state.js';

export interface PlannerEligibility {
  eligible: boolean;

  reasons: string[];
}

export function evaluatePlannerEligibility(
  definition: PlannerDefinition,
  state: PlannerRuntimeState
): PlannerEligibility {
  const reasons: string[] = [];

  if (!definition.enabled) {
    reasons.push(
      'Planner is disabled'
    );
  }

  if (!state.available) {
    reasons.push(
      'Planner is unavailable'
    );
  }

  if (!state.healthy) {
    reasons.push(
      state.failureReason ??
        'Planner is unhealthy'
    );
  }

  return {
    eligible:
      reasons.length === 0,
    reasons,
  };
}