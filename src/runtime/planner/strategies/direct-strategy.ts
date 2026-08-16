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
    const plannerId =
      request.planner ??
      this.plannerId;

    await plannerRegistry.refreshHealth(
      plannerId
    );

    const eligibility =
      plannerRegistry.getEligibility(
        plannerId
      );

    if (!eligibility.eligible) {
      throw new Error(
        `Planner ${plannerId} is not eligible: ${eligibility.reasons.join('; ')}`
      );
    }

    const planner =
      plannerRegistry.get(
        plannerId
      );

    if (!planner) {
      throw new Error(
        `Planner not found: ${plannerId}`
      );
    }

    return planner.plan(
      request.goal,
      request.context
    );
  }
}
