import { JobStep } from '../jobs/job-step.js';

export interface PlannerContext {
  previousJobs?: Array<{
    goal: string;
    status: string;
    capabilities: string[];
  }>;
}

export interface ExecutionPlan {
  version: string;

  id?: string;

  goal?: string;

  steps: JobStep[];

  metadata?: Record<string, unknown>;
}

export interface Planner {
  plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan>;
}