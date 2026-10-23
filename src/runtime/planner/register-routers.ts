import {
  DefaultPlannerRouter,
} from './default-planner-router.js';

import {
  plannerRouterRegistry,
} from './planner-router-registry.js';

export function registerPlannerRouters(): void {
  plannerRouterRegistry.register(
    'default',
    new DefaultPlannerRouter(
      'deterministic-direct',
      'local-direct'
    ),
    {
      default: true,
    }
  );
}
