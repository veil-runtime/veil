import {
  PlannerStrategy,
} from './planner-strategy.js';

class PlannerStrategyRegistry {
  private readonly strategies =
    new Map<string, PlannerStrategy>();

  register(
    strategy: PlannerStrategy
  ): void {
    if (
      this.strategies.has(
        strategy.id
      )
    ) {
      throw new Error(
        `Planner strategy already registered: ${strategy.id}`
      );
    }

    this.strategies.set(
      strategy.id,
      strategy
    );
  }

  get(
    id: string
  ): PlannerStrategy | undefined {
    return this.strategies.get(
      id
    );
  }

  list() {
    return Array.from(
      this.strategies.values()
    ).map((strategy) => ({
      id: strategy.id,
      type: strategy.type,
    }));
  }
}

export const plannerStrategyRegistry =
  new PlannerStrategyRegistry();