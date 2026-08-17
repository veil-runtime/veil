import type {
  ExecutionPlan,
  Planner,
} from '@veil-runtime/core';

const supportedGoal = 'payments service';

export class StarterDeterministicPlanner implements Planner {
  readonly name = 'deterministic';

  async plan(goal: string): Promise<ExecutionPlan> {
    if (!goal.toLowerCase().includes(supportedGoal)) {
      throw new Error(
        'The Starter planner supports goals that check the payments service.',
      );
    }

    return {
      version: '1.0',
      goal,
      steps: [{
        id: 'check-payments-service',
        capability: 'service.health',
        capabilityVersion: '1.0.0',
        input: { serviceName: 'payments-api' },
        reason: 'Check the requested payments service.',
      }],
    };
  }
}

export const starterPlanner = new StarterDeterministicPlanner();
