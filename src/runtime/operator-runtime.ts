import { Job } from './jobs/job.js';
import { JobListFilter } from './jobs/job-store.js';
import { jobManager } from './jobs/job-manager.js';
import { CapabilityModule } from './modules/capability-module.js';
import { capabilityRegistry } from './registry/registry.js';
import { plannerRegistry } from './planner/planner-registry.js';
import { ExecutionPlan } from './planner/planner.js';

export interface RunJobOptions {
  planner?: string;
}

export class OperatorRuntime {
  use(module: CapabilityModule): void {
    const declared =
      new Set(
        module.manifest.capabilities
      );

    for (const capability of module.capabilities) {
      if (!declared.has(capability.name)) {
        throw new Error(
          `Capability ${capability.name} is not declared in module manifest ${module.manifest.name}`
        );
      }

      capabilityRegistry.register(
        capability
      );
    }
  }

  async executePlan(
    plan: ExecutionPlan
  ): Promise<Job> {
    return jobManager.executePlan(
      plan
    );
  }

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