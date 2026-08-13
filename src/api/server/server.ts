import Fastify from 'fastify';
import { linkedinRoutes } from '../routes/linkedin.routes.js';
import { capabilitiesRoutes } from '../routes/capabilities.routes.js';
import { executionRoutes } from '../routes/execution.routes.js';
import { registerCapabilities } from '../../runtime/registry/register-capabilities.js';
import { jobsRoutes } from '../routes/jobs.routes.js';
import { registerPlanners } from '../../runtime/planner/register-planners.js';
import { plannersRoutes } from '../routes/planners.routes.js';
import { runtimeEventBus } from '../../runtime/events/memory-event-bus.js';
import { consoleEventSubscriber } from '../../runtime/events/console-event-subscriber.js';
import { registerPlannerStrategies } from '../../runtime/planner/strategies/register-strategies.js';

const app = Fastify({
  logger: true,
});

registerCapabilities();
registerPlanners();
registerPlannerStrategies();

runtimeEventBus.subscribe(
  '*',
  consoleEventSubscriber
);

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'operator-runtime',
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

app.register(jobsRoutes, {
  prefix: '/api',
});

app.register(plannersRoutes, {
  prefix: '/api',
});

async function start() {
  try {
    await app.listen({
      port: 3333,
      host: '127.0.0.1',
    });

    console.log('Operator Runtime running on http://127.0.0.1:3333');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();