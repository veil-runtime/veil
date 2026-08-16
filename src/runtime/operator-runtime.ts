import { Job } from './jobs/job.js';
import { JobListFilter } from './jobs/job-store.js';
import { jobManager } from './jobs/job-manager.js';
import { jobMemory } from './jobs/job-memory.js';
import { ExecutionCaller } from './execution/execution-context.js';

import {
  CapabilityModule,
} from './modules/capability-module.js';

import {
  capabilityRegistry,
} from './registry/registry.js';

import {
  plannerRegistry,
} from './planner/planner-registry.js';

import {
  ExecutionPlan,
} from './planner/planner.js';

import {
  plannerRouterRegistry,
} from './planner/planner-router-registry.js';

import {
  plannerStrategyRegistry,
} from './planner/strategies/planner-strategy-registry.js';

export interface RunJobOptions {
  planner?: string;
  strategy?: string;
  caller?: ExecutionCaller;
}

export interface ExecutePlanOptions {
  caller?: ExecutionCaller;
}

function immutableCaller(
  caller?: ExecutionCaller
): ExecutionCaller | undefined {
  if (!caller) return undefined;

  return Object.freeze({
    ...caller,
    scopes: caller.scopes
      ? Object.freeze([...caller.scopes])
      : undefined,
    metadata: caller.metadata
      ? Object.freeze({ ...caller.metadata })
      : undefined,
  });
}

export class OperatorRuntime {
  use(
    module: CapabilityModule
  ): void {
    const declared =
      new Set(
        module.manifest.capabilities
      );

    for (
      const capability
      of module.capabilities
    ) {
      if (
        !declared.has(
          capability.name
        )
      ) {
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
    plan: ExecutionPlan,
    options: ExecutePlanOptions = {}
  ): Promise<Job> {
    return jobManager.executePlan(
      plan,
      immutableCaller(options.caller)
    );
  }

  async run(
    goal: string,
    options: RunJobOptions = {}
  ): Promise<Job> {
    const router =
      plannerRouterRegistry.getDefault();

    if (!router) {
      throw new Error(
        'No default planner router registered'
      );
    }

    const selection =
      await router.select({
        goal,
        strategy:
          options.strategy,
        planner:
          options.planner,
      });

    const strategy =
      plannerStrategyRegistry.get(
        selection.strategy
      );

    if (!strategy) {
      throw new Error(
        `Planner strategy not found: ${selection.strategy}`
      );
    }

    const plan =
      await strategy.execute({
        goal,
        planner:
          options.planner,
        context:
          await jobMemory.getPlannerContext(goal),
      });

    return this.executePlan(
      plan,
      { caller: options.caller }
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
    return jobManager.list(
      filter
    );
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
