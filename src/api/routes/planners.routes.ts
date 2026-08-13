import { FastifyInstance } from 'fastify';
import { plannerRegistry } from '../../runtime/planner/planner-registry.js';
import { plannerStrategyRegistry } from '../../runtime/planner/strategies/planner-strategy-registry.js';

export async function plannersRoutes(app: FastifyInstance) {
  app.get('/planners', async () => {
    return {
      planners: plannerRegistry.list(),
    };
  });

  app.get(
    '/planner-strategies',
    async () => {
      return {
        strategies:
          plannerStrategyRegistry.list(),
      };
    }
  );

  app.get(
    '/planners/status',
    async () => {
      return {
        planners:
          plannerRegistry.listStatus(),
      };
    }
  );
}