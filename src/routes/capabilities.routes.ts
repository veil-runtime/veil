import { FastifyInstance } from 'fastify';
import { capabilityRegistry } from '../core/registry.js';

export async function capabilitiesRoutes(app: FastifyInstance) {
  app.get('/capabilities', async () => {
    return {
      capabilities: capabilityRegistry.list(),
    };
  });
}