import {
  PlannerTraits,
} from './planner-traits.js';

export interface PlannerDefinition {
  id: string;

  type: string;

  enabled: boolean;

  required?: boolean;

  traits?: PlannerTraits;

  config?: Record<string, unknown>;
}