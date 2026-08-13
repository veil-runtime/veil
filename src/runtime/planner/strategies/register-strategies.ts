import {
  DirectStrategy,
} from './direct-strategy.js';

import {
  FallbackStrategy,
} from './fallback-strategy.js';

import {
  ReviewerStrategy,
} from './reviewer-strategy.js';

import {
  plannerStrategyRegistry,
} from './planner-strategy-registry.js';

export function registerPlannerStrategies(): void {
  plannerStrategyRegistry.register(
    new DirectStrategy(
      'local-direct',
      'qwen-local'
    )
  );

  plannerStrategyRegistry.register(
    new FallbackStrategy(
      'local-fallback',
      [
        'qwen-local',
        'llama-mac',
      ]
    )
  );

  plannerStrategyRegistry.register(
    new ReviewerStrategy(
      'local-review',
      'qwen-local',
      'llama-mac',
      false
    )
  );
}