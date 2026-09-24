import { FastifyInstance, FastifyRequest } from 'fastify';

import { jobManager } from '../../runtime/jobs/job-manager.js';
import { OperatorRuntime, operatorRuntime } from '../../runtime/operator-runtime.js';
import { executionLogStore } from '../../runtime/logging/execution-log-store.js';
import { ExecutionPlan } from '../../runtime/planner/planner.js';
import { ExecutionCaller } from '../../runtime/execution/execution-context.js';

interface CreateJobBody {
  goal: string;
  planner?: string;
}

interface JobParams {
  id: string;
}

interface JobListQuery {
  status?: string;
  planner?: string;
  capability?: string;
  goal?: string;
  limit?: string;
}

interface ReviewJobBody {
  outcome:
    | 'success'
    | 'inconclusive'
    | 'failed';

  notes?: string;
}

interface JobsRoutesOptions {
  runtime?: OperatorRuntime;
  // Trusted host configuration; never copy identity from proposed plan/body fields.
  resolveCaller?: (request: FastifyRequest) => ExecutionCaller | undefined | Promise<ExecutionCaller | undefined>;
}

export async function jobsRoutes(
  app: FastifyInstance,
  options: JobsRoutesOptions = {},
) {
  const runtime = options.runtime ?? operatorRuntime;
  app.post<{
    Body: CreateJobBody;
  }>('/jobs', async (request, reply) => {
    try {
      const job = await jobManager.create(
        request.body?.goal,
        request.body?.planner
      );

      return reply.status(201).send(job);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create job';

      return reply.status(400).send({
        error: message,
      });
    }
  });

  app.post<{
    Body: ExecutionPlan;
  }>(
    '/jobs/execute-plan',
    async (request, reply) => {
      try {
        const job =
          await runtime.executePlan(
            request.body,
            { caller: await options.resolveCaller?.(request) }
          );

        return reply
          .status(201)
          .send(job);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to execute plan';

        return reply.status(400).send({
          error: message,
        });
      }
    }
  );

  app.post<{
    Params: JobParams;
    Body: ReviewJobBody;
  }>(
    '/jobs/:id/review',
    async (request, reply) => {
      try {
        const job =
          await jobManager.review(
            request.params.id,
            request.body.outcome,
            request.body.notes
          );

        return job;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to review job';

        return reply.status(400).send({
          error: message,
        });
      }
    }
  );

  app.get<{
    Params: JobParams;
  }>(
    '/jobs/:id/logs',
    async (request, reply) => {
      const job = await jobManager.get(
        request.params.id
      );

      if (!job) {
        return reply.status(404).send({
          error: 'Job not found',
        });
      }

      return {
        logs:
          executionLogStore.listByJob(
            request.params.id
          ),
      };
    }
  );

  app.get<{
    Querystring: JobListQuery;
  }>('/jobs', async (request) => {
    const limit =
      request.query.limit
        ? Number.parseInt(
            request.query.limit,
            10
          )
        : undefined;

    return {
      jobs: await jobManager.list({
        status:
          request.query.status,
        planner:
          request.query.planner,
        capability:
          request.query.capability,
        goal:
          request.query.goal,

        limit:
          Number.isFinite(limit) &&
          limit! > 0
            ? limit
            : undefined,
      }),
    };
  });

  app.get<{
    Params: JobParams;
  }>('/jobs/:id', async (request, reply) => {
    const job =
      await jobManager.get(
        request.params.id
      );

    if (!job) {
      return reply.status(404).send({
        error: 'Job not found',
      });
    }

    return job;
  });

  app.get<{
    Querystring: JobListQuery;
  }>('/jobs/history', async (request) => {
    const limit =
      request.query.limit
        ? Number.parseInt(
            request.query.limit,
            10
          )
        : undefined;

    const jobs =
      await jobManager.list({
        status:
          request.query.status,
        planner:
          request.query.planner,
        capability:
          request.query.capability,
        goal:
          request.query.goal,

        limit:
          Number.isFinite(limit) &&
          limit! > 0
            ? limit
            : undefined,
      });

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        goal: job.goal,
        planner: job.planner,
        status: job.status,

        capabilities:
          job.steps.map(
            (step) =>
              step.capability
          ),

        createdAt:
          job.createdAt,

        startedAt:
          job.startedAt,

        completedAt:
          job.completedAt,
      })),
    };
  });

  // Retired: a stored Job is an execution record, not a resumable proposal.
  app.post('/jobs/:id/execute', async (_request, reply) => {
    return reply.status(410).send({
      error: 'Stored-job execution is retired. Submit a new ExecutionPlan to /api/jobs/execute-plan.',
    });
  });

  app.post<{
    Body: CreateJobBody;
  }>(
    '/jobs/run',
    async (request, reply) => {
      try {
        const job =
          await runtime.run(
            request.body.goal,
            {
              planner:
                request.body.planner,
              caller: await options.resolveCaller?.(request),
            }
          );

        return reply
          .status(201)
          .send(job);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to run job';

        return reply.status(400).send({
          error: message,
        });
      }
    }
  );
}
