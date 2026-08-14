import {
  ExecutionPlan,
  PlannerContext,
} from '../planner.js';

export interface PlannerStrategyRequest {
  goal: string;

  planner?: string;

  context?: PlannerContext;
}

export interface PlannerStrategy {
  readonly id: string;
  readonly type: string;

  execute(
    request: PlannerStrategyRequest
  ): Promise<ExecutionPlan>;
}