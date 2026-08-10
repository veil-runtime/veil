import {
  ExecutionPlan,
  PlannerContext,
} from './planner.js';

export interface PlannerProvider {
  readonly name: string;

  plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan>;
}