import { deterministicPlanner } from './deterministic-planner.js';
import { plannerRegistry } from './planner-registry.js';
import { OpenAICompatiblePlannerProvider } from './providers/openai-compatible-planner.js';

const qwenLocalPlanner = new OpenAICompatiblePlannerProvider(
  'qwen-local',
  'http://localhost:12434/engines/v1',
  'docker.io/ai/qwen3:0.6B-Q4_K_M'
);

export function registerPlanners(): void {
  plannerRegistry.register(deterministicPlanner, {
    default: true,
  });

  plannerRegistry.register(qwenLocalPlanner);
}