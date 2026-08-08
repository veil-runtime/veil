import { JobStep } from '../jobs/job-step.js';

export interface ExecutionPlan {
  steps: JobStep[];
}

export interface Planner {
  plan(goal: string): Promise<ExecutionPlan>;
}