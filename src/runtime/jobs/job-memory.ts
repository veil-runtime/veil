import { Job } from './job.js';
import { jobStore } from './job-store.js';
import { PlannerContext } from '../planner/planner.js';

function extractKeywords(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .slice(0, 8);
}

function scoreJob(
  currentGoal: string,
  previousJob: Job
): number {
  const keywords = extractKeywords(currentGoal);
  const previousGoal = previousJob.goal.toLowerCase();

  return keywords.reduce(
    (score, keyword) =>
      previousGoal.includes(keyword)
        ? score + 1
        : score,
    0
  );
}

class JobMemory {
  async getPlannerContext(
    goal: string
  ): Promise<PlannerContext> {
    const jobs = await jobStore.list({
      status: 'completed',
    });

    const relevant = jobs
      .map((job) => ({
        job,
        score: scoreJob(goal, job),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      previousJobs: relevant.map(({ job }) => ({
        goal: job.goal,
        status: job.status,
        capabilities: job.steps.map(
          (step) => step.capability
        ),
      })),
    };
  }
}

export const jobMemory = new JobMemory();