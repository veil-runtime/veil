import {
  PlannerStrategy,
  PlannerStrategyRequest,
} from './planner-strategy.js';

import {
  ExecutionPlan,
} from '../planner.js';

import {
  plannerRegistry,
} from '../planner-registry.js';

export class DirectStrategy
  implements PlannerStrategy
{
  readonly type = 'direct';

  constructor(
    readonly id: string,
    private readonly plannerId: string
  ) {}

  async execute(
    request: PlannerStrategyRequest
  ): Promise<ExecutionPlan> {
    await plannerRegistry.refreshHealth(
      this.plannerId
    );

    const eligibility =
      plannerRegistry.getEligibility(
        this.plannerId
      );

    if (!eligibility.eligible) {
      throw new Error(
        `Planner ${this.plannerId} is not eligible: ${eligibility.reasons.join('; ')}`
      );
    }

    const planner =
      plannerRegistry.get(
        this.plannerId
      );

    if (!planner) {
      throw new Error(
        `Planner not found: ${this.plannerId}`
      );
    }

    return planner.plan(
      request.goal,
      request.context
    );
  }
}