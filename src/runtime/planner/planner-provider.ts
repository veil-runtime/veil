import { ExecutionPlan } from './planner.js';

export interface PlannerProvider {
  readonly name: string;

  plan(goal: string): Promise<ExecutionPlan>;
}