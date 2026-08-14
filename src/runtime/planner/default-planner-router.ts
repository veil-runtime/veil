import {
  PlannerRouter,
  PlannerRoutingRequest,
  PlannerSelection,
} from './planner-router.js';

export class DefaultPlannerRouter
  implements PlannerRouter
{
  constructor(
    private readonly defaultStrategy: string
  ) {}

  async select(
    request: PlannerRoutingRequest
  ): Promise<PlannerSelection> {
    return {
      strategy:
        request.strategy ??
        this.defaultStrategy,

      reason:
        request.strategy
          ? 'Explicit strategy requested'
          : 'Using default strategy',
    };
  }
}