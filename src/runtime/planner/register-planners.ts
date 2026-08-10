import { deterministicPlanner } from './deterministic-planner.js';
import { plannerRegistry } from './planner-registry.js';
import { OpenAICompatiblePlannerProvider } from './providers/openai-compatible-planner.js';
import { TeamPlanner } from './providers/team-planner.js';

const qwenLocalPlanner =
  new OpenAICompatiblePlannerProvider(
    'qwen-local',
    'http://localhost:12434/engines/v1',
    'docker.io/ai/qwen3:0.6B-Q4_K_M'
  );

const llamaMacPlanner =
  new OpenAICompatiblePlannerProvider(
    'llama-mac',
    'http://10.0.0.111:11434/v1',
    'llama3.2:3b'
  );

const teamLocalPlanner =
  new TeamPlanner(
    qwenLocalPlanner,
    llamaMacPlanner
  );

export function registerPlanners(): void {
  plannerRegistry.register(
    deterministicPlanner,
    {
      default: true,
    }
  );

  plannerRegistry.register(
    qwenLocalPlanner
  );

  plannerRegistry.register(
    llamaMacPlanner
  );

  plannerRegistry.register(
    teamLocalPlanner
  );
}