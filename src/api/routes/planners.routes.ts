import { FastifyInstance } from 'fastify';
import { plannerRegistry } from '../../runtime/planner/planner-registry.js';

export async function plannersRoutes(app: FastifyInstance) {
  app.get('/planners', async () => {
    return {
      planners: plannerRegistry.list(),
    };
  });
}