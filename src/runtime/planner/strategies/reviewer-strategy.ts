import {
  ExecutionPlan,
  PlannerContext,
} from '../planner.js';

import {
  plannerRegistry,
} from '../planner-registry.js';

import {
  PlannerStrategy,
  PlannerStrategyRequest,
} from './planner-strategy.js';

export class ReviewerStrategy
  implements PlannerStrategy
{
  readonly type = 'reviewer';

  constructor(
    readonly id: string,
    private readonly proposerId: string,
    private readonly reviewerId: string,
    private readonly reviewerRequired = false
  ) {}

  async execute(
    request: PlannerStrategyRequest
  ): Promise<ExecutionPlan> {
    await plannerRegistry.refreshHealth(
      this.proposerId
    );

    const proposerEligibility =
      plannerRegistry.getEligibility(
        this.proposerId
      );

    if (!proposerEligibility.eligible) {
      throw new Error(
        `Proposer ${this.proposerId} is not eligible: ${proposerEligibility.reasons.join('; ')}`
      );
    }

    const proposer =
      plannerRegistry.get(
        this.proposerId
      );

    if (!proposer) {
      throw new Error(
        `Proposer planner not found: ${this.proposerId}`
      );
    }

    const proposal =
      await proposer.plan(
        request.goal,
        request.context
      );

    await plannerRegistry.refreshHealth(
      this.reviewerId
    );

    const reviewerEligibility =
      plannerRegistry.getEligibility(
        this.reviewerId
      );

    if (!reviewerEligibility.eligible) {
      if (this.reviewerRequired) {
        throw new Error(
          `Reviewer ${this.reviewerId} is required but not eligible: ${reviewerEligibility.reasons.join('; ')}`
        );
      }

      return this.withTeamMetadata(
        proposal,
        {
          reviewerUsed: false,
          degraded: true,
          reason:
            reviewerEligibility.reasons.join(
              '; '
            ),
        }
      );
    }

    const reviewer =
      plannerRegistry.get(
        this.reviewerId
      );

    if (!reviewer) {
      if (this.reviewerRequired) {
        throw new Error(
          `Reviewer planner not found: ${this.reviewerId}`
        );
      }

      return this.withTeamMetadata(
        proposal,
        {
          reviewerUsed: false,
          degraded: true,
          reason:
            `Reviewer planner not found: ${this.reviewerId}`,
        }
      );
    }

    const reviewContext =
      this.createReviewContext(
        request.context,
        proposal
      );

    try {
      const reviewedPlan =
        await reviewer.plan(
          request.goal,
          reviewContext
        );

      return this.withTeamMetadata(
        reviewedPlan,
        {
          reviewerUsed: true,
          degraded: false,
        }
      );
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Unknown reviewer failure';

      if (this.reviewerRequired) {
        throw new Error(
          `Required reviewer ${this.reviewerId} failed: ${reason}`
        );
      }

      return this.withTeamMetadata(
        proposal,
        {
          reviewerUsed: false,
          degraded: true,
          reason,
        }
      );
    }
  }

  private createReviewContext(
    context: PlannerContext | undefined,
    proposal: ExecutionPlan
  ): PlannerContext {
    return {
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
  }

  private withTeamMetadata(
    plan: ExecutionPlan,
    state: {
      reviewerUsed: boolean;
      degraded: boolean;
      reason?: string;
    }
  ): ExecutionPlan {
    return {
      ...plan,

      metadata: {
        ...(plan.metadata ?? {}),

        strategy: {
          id: this.id,
          type: this.type,

          proposer:
            this.proposerId,

          reviewer:
            this.reviewerId,

          reviewerRequired:
            this.reviewerRequired,

          reviewerUsed:
            state.reviewerUsed,

          degraded:
            state.degraded,

          reason:
            state.reason,
        },
      },
    };
  }
}