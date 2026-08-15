import {
  ExecutionPlan,
  PlannerContext,
} from './planner.js';

export interface PlannerHealthResult {
  healthy: boolean;
  available: boolean;
  reason?: string;
}

export interface PlannerProvider {
  readonly name: string;

  plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan>;

  healthCheck?(): Promise<PlannerHealthResult>;
}