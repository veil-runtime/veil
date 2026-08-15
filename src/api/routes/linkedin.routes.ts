import { FastifyInstance } from 'fastify';
import { linkedinAuthStatusCapability } from '../../capabilities/linkedin/auth-status.js';

export async function linkedinRoutes(app: FastifyInstance) {
  app.get('/linkedin/status', async () => {
    return linkedinAuthStatusCapability.execute(undefined);
  });
}