import { FastifyInstance } from 'fastify';
import { checkLinkedInAuthentication } from '../skills/linkedin/linkedin.js';

export async function linkedinRoutes(app: FastifyInstance) {
  app.get('/linkedin/status', async () => {
    return checkLinkedInAuthentication();
  });
}