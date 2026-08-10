import { Job } from './jobs/job.js';
import { JobListFilter } from './jobs/job-store.js';
import { jobManager } from './jobs/job-manager.js';
import { capabilityRegistry } from './registry/registry.js';
import { plannerRegistry } from './planner/planner-registry.js';

export interface RunJobOptions {
  planner?: string;
}

export class OperatorRuntime {
  async run(
    goal: string,
    options: RunJobOptions = {}
  ): Promise<Job> {
    return jobManager.run(
      goal,
      options.planner
    );
  }

  async getJob(
    id: string
  ): Promise<Job | undefined> {
    return jobManager.get(id);
  }

  async listJobs(
    filter?: JobListFilter
  ): Promise<Job[]> {
    return jobManager.list(filter);
  }

  listCapabilities() {
    return capabilityRegistry.list();
  }

  listPlanners() {
    return plannerRegistry.list();
  }
}

export const operatorRuntime =
  new OperatorRuntime();