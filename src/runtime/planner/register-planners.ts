import { deterministicPlanner } from './deterministic-planner.js';
import { plannerRegistry } from './planner-registry.js';
import { OpenAICompatiblePlannerProvider } from './providers/openai-compatible-planner.js';

export function registerPlanners(): void {
  plannerRegistry.register({ id: 'deterministic', type: 'deterministic', enabled: true,
    required: true, traits: { local: true, costClass: 'free', structuredOutput: 'schema' } }, deterministicPlanner);

  // Source-server host opt-in only. Core import/default execution never calls a model.
  if (process.env.OPERATOR_LOCAL_PLANNERS !== '1') return;
  const qwenBase = process.env.QWEN_BASE_URL ?? 'http://127.0.0.1:11434/v1';
  const qwenModel = process.env.QWEN_MODEL ?? 'qwen3:0.6b';
  const llamaBase = process.env.LLAMA_MAC_BASE_URL ?? 'http://127.0.0.1:11434/v1';
  const llamaModel = process.env.LLAMA_MAC_MODEL ?? 'llama3.2:3b';
  plannerRegistry.register({ id: 'qwen-local', type: 'openai-compatible', enabled: true, required: false,
    traits: { local: true, costClass: 'free', structuredOutput: 'json', toolReasoning: true },
    config: { baseUrl: qwenBase, model: qwenModel } },
    new OpenAICompatiblePlannerProvider('qwen-local', qwenBase, qwenModel));
  plannerRegistry.register({ id: 'llama-mac', type: 'openai-compatible', enabled: true, required: false,
    traits: { local: true, costClass: 'free', structuredOutput: 'json', toolReasoning: true },
    config: { baseUrl: llamaBase, model: llamaModel } },
    new OpenAICompatiblePlannerProvider('llama-mac', llamaBase, llamaModel));
}
