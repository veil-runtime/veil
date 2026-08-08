import Fastify from 'fastify';
import { linkedinRoutes } from './routes/linkedin.routes.js';
import { capabilitiesRoutes } from './routes/capabilities.routes.js';
import { registerCapabilities } from './core/register-capabilities.js';
import { executionRoutes } from './routes/execution.routes.js';

const app = Fastify({
  logger: true,
});

registerCapabilities();

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'browser-operator',
  };
});

app.register(linkedinRoutes, {
  prefix: '/api',
});

app.register(capabilitiesRoutes, {
  prefix: '/api',
});

app.register(executionRoutes, {
  prefix: '/api',
});

async function start() {
  try {
    await app.listen({
      port: 3333,
      host: '127.0.0.1',
    });

    console.log('Browser Operator running on http://127.0.0.1:3333');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();