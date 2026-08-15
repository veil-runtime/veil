import { Job } from './job.js';
import { jobStore } from './job-store.js';
import { PlannerContext } from '../planner/planner.js';

const STOP_WORDS = new Set([
  'read',
  'write',
  'check',
  'run',
  'show',
  'tell',
  'current',
  'from',
  'with',
  'that',
  'this',
  'file',
]);

function extractKeywords(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(
      (word) =>
        word.length >= 4 &&
        !STOP_WORDS.has(word)
    )
    .slice(0, 8);
}

function scoreJob(
  currentGoal: string,
  previousJob: Job
): number {
  const normalizedCurrentGoal =
    currentGoal.toLowerCase();

  const previousGoal =
    previousJob.goal.toLowerCase();

  const keywords =
    extractKeywords(currentGoal);

  let score = keywords.reduce(
    (total, keyword) =>
      previousGoal.includes(keyword)
        ? total + 1
        : total,
    0
  );

  if (
    normalizedCurrentGoal.includes('linkedin') &&
    previousGoal.includes('linkedin')
  ) {
    score += 3;
  }

  if (
    normalizedCurrentGoal.includes('git') &&
    previousGoal.includes('git')
  ) {
    score += 3;
  }

  if (
    normalizedCurrentGoal.includes('readme') &&
    previousGoal.includes('readme')
  ) {
    score += 3;
  }

  return score;
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
      previousJobs: relevant.map(
        ({ job }) => ({
          goal: job.goal,
          status: job.status,
          capabilities: job.steps.map(
            (step) => step.capability
          ),
        })
      ),
    };
  }
}

export const jobMemory =
  new JobMemory();