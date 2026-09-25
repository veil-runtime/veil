import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { OperatorRuntime, operatorRuntime } from '../../runtime/operator-runtime.js';
import { ExecutionCaller } from '../../runtime/execution/execution-context.js';

interface LinkedInRoutesOptions {
  runtime?: OperatorRuntime;
  // Trusted host configuration; never copy identity from query/body fields.
  resolveCaller?: (request: FastifyRequest) => ExecutionCaller | undefined | Promise<ExecutionCaller | undefined>;
}

export async function linkedinRoutes(
  app: FastifyInstance,
  options: LinkedInRoutesOptions = {},
) {
  const runtime = options.runtime ?? operatorRuntime;
  app.get('/linkedin/status', async (request, reply) => {
    const capability = runtime.describeCapability('linkedin.auth.status');
    if (!capability) {
      return reply.status(404).send({ error: 'Capability not found' });
    }
    const caller = await options.resolveCaller?.(request);
    const job = await runtime.executePlan({
      version: '1.0',
      goal: 'Check LinkedIn authentication status',
      steps: [{
        id: randomUUID(),
        capability: capability.name,
        capabilityVersion: capability.version,
      }],
    }, { caller });
    if (job.status === 'failed') {
      const denied = job.events.some(event => event.type === 'capability.denied');
      return reply.status(denied ? 403 : 500).send({ error: job.error });
    }
    return job.result;
  });
}
