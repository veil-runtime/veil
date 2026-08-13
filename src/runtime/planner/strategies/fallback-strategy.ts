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

export class FallbackStrategy
  implements PlannerStrategy
{
  readonly type = 'fallback';

  constructor(
    readonly id: string,
    private readonly plannerIds: string[]
  ) {}

  async execute(
    request: PlannerStrategyRequest
  ): Promise<ExecutionPlan> {
    const failures: string[] = [];

    for (const plannerId of this.plannerIds) {
      await plannerRegistry.refreshHealth(
        plannerId
      );

      const eligibility =
        plannerRegistry.getEligibility(
          plannerId
        );

      if (!eligibility.eligible) {
        failures.push(
          `${plannerId}: ${eligibility.reasons.join('; ')}`
        );

        continue;
      }

      const planner =
        plannerRegistry.get(
          plannerId
        );

      if (!planner) {
        failures.push(
          `${plannerId}: planner not registered`
        );

        continue;
      }

      try {
        return await planner.plan(
          request.goal,
          request.context
        );
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message
            : 'Unknown planner error';

        failures.push(
          `${plannerId}: ${reason}`
        );
      }
    }

    throw new Error(
      `No fallback planner succeeded: ${failures.join(' | ')}`
    );
  }
}