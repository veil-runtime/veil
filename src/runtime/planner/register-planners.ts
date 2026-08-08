import { deterministicPlanner } from './deterministic-planner.js';
import { plannerRegistry } from './planner-registry.js';

export function registerPlanners(): void {
  plannerRegistry.register(deterministicPlanner, {
    default: true,
  });
}