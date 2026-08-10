import { JobStep } from '../jobs/job-step.js';

export interface PlannerContext {
  previousJobs?: Array<{
    goal: string;
    status: string;
    capabilities: string[];
  }>;
}

export interface ExecutionPlan {
  steps: JobStep[];
}

export interface Planner {
  plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan>;
}