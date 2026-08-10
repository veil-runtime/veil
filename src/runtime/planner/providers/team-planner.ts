import { PlannerProvider } from '../planner-provider.js';
import {
  ExecutionPlan,
  PlannerContext,
} from '../planner.js';

export class TeamPlanner
  implements PlannerProvider
{
  readonly name = 'team-local';

  constructor(
    private readonly proposer: PlannerProvider,
    private readonly reviewer: PlannerProvider
  ) {}

  async plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan> {
    const proposal =
      await this.proposer.plan(
        goal,
        context
      );

    const reviewContext: PlannerContext = {
      ...context,
      previousJobs: [
        ...(context?.previousJobs ?? []),
        {
          goal:
            `Candidate plan for current goal: ${JSON.stringify(
              proposal.steps.map((step) => ({
                capability:
                  step.capability,
                input:
                  step.input,
                reason:
                  step.reason,
              }))
            )}`,
          status:
            'candidate-plan',
          capabilities:
            proposal.steps.map(
              (step) =>
                step.capability
            ),
        },
      ],
    };

    return this.reviewer.plan(
      goal,
      reviewContext
    );
  }
}