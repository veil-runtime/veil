import { deterministicPlanner } from './deterministic-planner.js';
import { plannerRegistry } from './planner-registry.js';
import { OpenAICompatiblePlannerProvider } from './providers/openai-compatible-planner.js';

const qwenLocalPlanner =
  new OpenAICompatiblePlannerProvider(
    'qwen-local',
    process.env.QWEN_BASE_URL ??
      'http://localhost:12434/engines/v1',
    process.env.QWEN_MODEL ??
      'docker.io/ai/qwen3:0.6B-Q4_K_M'
  );

const llamaMacPlanner =
  new OpenAICompatiblePlannerProvider(
    'llama-mac',
    process.env.LLAMA_MAC_BASE_URL ??
      'http://127.0.0.1:11434/v1',
    process.env.LLAMA_MAC_MODEL ??
      'llama3.2:3b'
  );

export function registerPlanners(): void {
  plannerRegistry.register(
    {
      id: 'deterministic',
      type: 'deterministic',
      enabled: true,
      required: true,

      traits: {
        local: true,
        costClass: 'free',
        structuredOutput: 'schema',
      },
    },
    deterministicPlanner
  );

  plannerRegistry.register(
    {
      id: 'qwen-local',
      type: 'openai-compatible',
      enabled: true,
      required: true,

      traits: {
        local: true,
        costClass: 'free',
        structuredOutput: 'json',
        toolReasoning: true,
      },

      config: {
        baseUrl:
          process.env.QWEN_BASE_URL ??
          'http://localhost:12434/engines/v1',

        model:
          process.env.QWEN_MODEL ??
          'docker.io/ai/qwen3:0.6B-Q4_K_M',
      },
    },
    qwenLocalPlanner
  );

  plannerRegistry.register(
    {
      id: 'llama-mac',
      type: 'openai-compatible',
      enabled: true,
      required: false,

      traits: {
        local: true,
        costClass: 'free',
        structuredOutput: 'json',
        toolReasoning: true,
      },

      config: {
        baseUrl:
          process.env.LLAMA_MAC_BASE_URL ??
          'http://127.0.0.1:11434/v1',

        model:
          process.env.LLAMA_MAC_MODEL ??
          'llama3.2:3b',
      },
    },
    llamaMacPlanner
  );
}
