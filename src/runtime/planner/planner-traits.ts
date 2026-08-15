export type PlannerCostClass =
  | 'free'
  | 'low'
  | 'standard'
  | 'premium';

export type StructuredOutputSupport =
  | 'none'
  | 'json'
  | 'schema';

export interface PlannerTraits {
  local?: boolean;

  costClass?: PlannerCostClass;

  coding?: boolean;

  structuredOutput?: StructuredOutputSupport;

  toolReasoning?: boolean;

  contextWindow?: number;
}