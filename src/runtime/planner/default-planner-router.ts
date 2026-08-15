import {
  PlannerRouter,
  PlannerRoutingRequest,
  PlannerSelection,
} from './planner-router.js';

export class DefaultPlannerRouter
  implements PlannerRouter
{
  constructor(
    private readonly defaultStrategy: string,
    private readonly directStrategy: string
  ) {}

  async select(
    request: PlannerRoutingRequest
  ): Promise<PlannerSelection> {
    if (request.strategy) {
      return {
        strategy: request.strategy,
        reason: 'Explicit strategy requested',
      };
    }

    if (request.planner) {
      return {
        strategy: this.directStrategy,
        reason: 'Explicit planner requested',
      };
    }

    return {
      strategy: this.defaultStrategy,
      reason: 'Using default strategy',
    };
  }
}
