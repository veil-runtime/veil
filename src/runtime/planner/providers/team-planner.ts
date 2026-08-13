import {
  ExecutionPlan,
  PlannerContext,
} from '../planner.js';

import {
  PlannerHealthResult,
  PlannerProvider,
} from '../planner-provider.js';

import {
  plannerRegistry,
} from '../planner-registry.js';

export class TeamPlanner
  implements PlannerProvider
{
  readonly name = 'team-local';

  constructor(
    private readonly proposerId: string,
    private readonly proposer: PlannerProvider,

    private readonly reviewerId: string,
    private readonly reviewer: PlannerProvider
  ) {}

  async healthCheck(): Promise<PlannerHealthResult> {
    await plannerRegistry.refreshHealth(
      this.proposerId
    );

    await plannerRegistry.refreshHealth(
      this.reviewerId
    );

    const proposer =
      plannerRegistry.getRegistered(
        this.proposerId
      );

    if (!proposer) {
      return {
        healthy: false,
        available: false,
        reason:
          `Proposer planner not registered: ${this.proposerId}`,
      };
    }

    const proposerEligibility =
      plannerRegistry.getEligibility(
        this.proposerId
      );

    if (!proposerEligibility.eligible) {
      return {
        healthy: false,
        available: false,
        reason:
          `Required proposer is unavailable: ${proposerEligibility.reasons.join(
            '; '
          )}`,
      };
    }

    const reviewer =
      plannerRegistry.getRegistered(
        this.reviewerId
      );

    if (!reviewer) {
      return {
        healthy: true,
        available: true,
        reason:
          `Optional reviewer not registered: ${this.reviewerId}`,
      };
    }

    const reviewerEligibility =
      plannerRegistry.getEligibility(
        this.reviewerId
      );

    if (!reviewerEligibility.eligible) {
      return {
        healthy: true,
        available: true,
        reason:
          `Optional reviewer unavailable: ${reviewerEligibility.reasons.join(
            '; '
          )}`,
      };
    }

    return {
      healthy: true,
      available: true,
    };
  }

  async plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan> {
    const proposal =
      await this.proposer.plan(
        goal,
        context
      );

    await plannerRegistry.refreshHealth(
      this.reviewerId
    );

    const reviewerEligibility =
      plannerRegistry.getEligibility(
        this.reviewerId
      );

    if (!reviewerEligibility.eligible) {
      return {
        ...proposal,

        metadata: {
          ...(proposal.metadata ?? {}),

          team: {
            proposer:
              this.proposerId,

            reviewer:
              this.reviewerId,

            reviewerUsed:
              false,

            degraded:
              true,

            reason:
              reviewerEligibility.reasons.join(
                '; '
              ),
          },
        },
      };
    }

    const reviewContext: PlannerContext = {
      ...context,

      previousJobs: [
        ...(context?.previousJobs ?? []),

        {
          goal:
            `Candidate plan for current goal: ${JSON.stringify(
              proposal.steps.map(
                (step) => ({
                  capability:
                    step.capability,

                  input:
                    step.input,

                  reason:
                    step.reason,
                })
              )
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

    try {
      const reviewedPlan =
        await this.reviewer.plan(
          goal,
          reviewContext
        );

      return {
        ...reviewedPlan,

        metadata: {
          ...(reviewedPlan.metadata ?? {}),

          team: {
            proposer:
              this.proposerId,

            reviewer:
              this.reviewerId,

            reviewerUsed:
              true,

            degraded:
              false,
          },
        },
      };
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Unknown reviewer failure';

      return {
        ...proposal,

        metadata: {
          ...(proposal.metadata ?? {}),

          team: {
            proposer:
              this.proposerId,

            reviewer:
              this.reviewerId,

            reviewerUsed:
              false,

            degraded:
              true,

            reason,
          },
        },
      };
    }
  }
}