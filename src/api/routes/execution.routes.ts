import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { OperatorRuntime, operatorRuntime } from '../../runtime/operator-runtime.js';
import { ExecutionPlan } from '../../runtime/planner/planner.js';
import { ExecutionCaller } from '../../runtime/execution/execution-context.js';

interface ExecuteParams {
  name: string;
}

interface ExecuteBody {
  input?: unknown;
}

interface ExecutionRoutesOptions {
  runtime?: OperatorRuntime;
  // Trusted host configuration; never copy identity from proposed plan/body fields.
  resolveCaller?: (request: FastifyRequest) => ExecutionCaller | undefined | Promise<ExecutionCaller | undefined>;
}

export async function executionRoutes(
  app: FastifyInstance,
  options: ExecutionRoutesOptions = {},
) {
  const runtime = options.runtime ?? operatorRuntime;

  app.post<{
    Params: ExecuteParams;
    Body: ExecuteBody;
  }>('/capabilities/:name/execute', async (request, reply) => {
    const capability = runtime.listCapabilities().find(
      (entry) => entry.name === request.params.name,
    );

    if (!capability) {
      return reply.status(404).send({
        error: 'Capability not found',
        capability: request.params.name,
      });
    }

    const plan: ExecutionPlan = {
      version: '1.0',
      goal: `Execute HTTP capability ${capability.name}`,
      steps: [{
        id: randomUUID(),
        capability: capability.name,
        input: request.body?.input,
      }],
    };

    try {
      const caller = await options.resolveCaller?.(request);
      const job = await runtime.executePlan(plan, { caller });

      if (job.status === 'failed') {
        const denied = job.events.some(
          (event) => event.type === 'capability.denied',
        );
        return reply.status(denied ? 403 : 500).send({
          capability: capability.name,
          risk: capability.risk,
          error: job.error,
        });
      }

      return {
        capability: capability.name,
        risk: capability.risk,
        result: job.result,
      };
    } catch (error) {
      // Plan admission currently reports validation failures as ordinary Errors.
      // Other runtime failures must remain server errors.
      if (error instanceof Error && error.message.startsWith('Execution plan failed validation:')) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });
}