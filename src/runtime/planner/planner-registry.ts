import {
  PlannerProvider,
} from './planner-provider.js';

import {
  PlannerDefinition,
} from './planner-definition.js';

import {
  PlannerRuntimeState,
} from './planner-runtime-state.js';

import {
  evaluatePlannerEligibility,
} from './planner-eligibility.js';

export interface RegisteredPlanner {
  definition: PlannerDefinition;

  provider: PlannerProvider;

  state: PlannerRuntimeState;
}

interface RegisterPlannerOptions {
  state?: Partial<PlannerRuntimeState>;
}

class PlannerRegistry {
  private readonly planners =
    new Map<string, RegisteredPlanner>();

  register(
    definition: PlannerDefinition,
    provider: PlannerProvider,
    options: RegisterPlannerOptions = {}
  ): void {
    if (
      this.planners.has(
        definition.id
      )
    ) {
      throw new Error(
        `Planner already registered: ${definition.id}`
      );
    }

    const entry: RegisteredPlanner = {
      definition,
      provider,
      state: {
        healthy: true,
        available: true,
        ...options.state,
      },
    };

    this.planners.set(
      definition.id,
      entry
    );

  }

  get(
      id: string
    ): PlannerProvider | undefined {
      return this.planners.get(
        id
      )?.provider;
    }

    getRegistered(
      id: string
    ): RegisteredPlanner | undefined {
      return this.planners.get(id);
    }

    getEligibility(
    id: string
  ) {
    const planner =
      this.planners.get(id);

    if (!planner) {
      throw new Error(
        `Planner not found: ${id}`
      );
    }

    return evaluatePlannerEligibility(
      planner.definition,
      planner.state
    );
  }

  list(): Array<{
    name: string;
  }> {
    return Array.from(
      this.planners.values()
    ).map((entry) => ({
      name: entry.definition.id,
    }));
  }

  async refreshHealth(
    id: string
  ): Promise<RegisteredPlanner> {
    const planner =
      this.planners.get(id);

    if (!planner) {
      throw new Error(
        `Planner not found: ${id}`
      );
    }

    const checkedAt =
      new Date().toISOString();

    if (!planner.provider.healthCheck) {
      planner.state = {
        ...planner.state,
        healthy: true,
        available: true,
        lastCheckedAt: checkedAt,
        failureReason: undefined,
      };

      return planner;
    }

    const health =
      await planner.provider.healthCheck();

    planner.state = {
      ...planner.state,
      healthy: health.healthy,
      available: health.available,
      lastCheckedAt: checkedAt,
      failureReason: health.reason,
    };

    return planner;
  }

  async refreshAllHealth(): Promise<void> {
    await Promise.all(
      Array.from(
        this.planners.keys()
      ).map((id) =>
        this.refreshHealth(id)
      )
    );
  }

  listStatus() {
    return Array.from(
      this.planners.values()
    ).map((planner) => {
      const eligibility =
        evaluatePlannerEligibility(
          planner.definition,
          planner.state
        );

      return {
        id: planner.definition.id,
        type: planner.definition.type,
        enabled:
          planner.definition.enabled,
        required:
          planner.definition.required ??
          false,
        traits:
          planner.definition.traits,
        healthy:
          planner.state.healthy,
        available:
          planner.state.available,
        lastCheckedAt:
          planner.state.lastCheckedAt,
        failureReason:
          planner.state.failureReason,
        eligible:
          eligibility.eligible,
        reasons:
          eligibility.reasons,
      };
    });
  }

  listRegistered():
    RegisteredPlanner[] {
    return Array.from(
      this.planners.values()
    );
  }

  updateState(
    id: string,
    state: Partial<PlannerRuntimeState>
  ): RegisteredPlanner {
    const planner =
      this.planners.get(id);

    if (!planner) {
      throw new Error(
        `Planner not found: ${id}`
      );
    }

    planner.state = {
      ...planner.state,
      ...state,
    };

    return planner;
  }
}

export const plannerRegistry =
  new PlannerRegistry();
