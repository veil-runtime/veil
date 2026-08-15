import { randomUUID } from 'node:crypto';

import { PlannerProvider } from './planner-provider.js';
import { ExecutionPlan } from './planner.js';

export class DeterministicPlannerProvider
  implements PlannerProvider
{
  readonly name = 'deterministic';

  async plan(goal: string): Promise<ExecutionPlan> {
    const urlMatch = goal.match(/https?:\/\/[^\s]+/i);

    if (!urlMatch) {
      throw new Error(
        'Deterministic planner could not identify a supported action.'
      );
    }

    const rawUrl = urlMatch[0];

    const cleanedUrl = rawUrl.replace(/[.,;!?]+$/, '');

    return {
      version: '1.0',
      goal,
      steps: [
        {
          id: randomUUID(),
          capability: 'web.page.read',
          input: {
            url: cleanedUrl,
          },
        },
      ],
    };
  }
}

export const deterministicPlanner =
  new DeterministicPlannerProvider();
