export interface PlannerContext {
  previousJobs?: Array<{
    goal: string;
    status: string;
    capabilities: string[];
  }>;
}

export interface ResultReference {
  readonly $ref: string;
}

export interface ExecutionStep {
  readonly id: string;
  readonly capability: string;
  readonly capabilityVersion?: string;
  readonly input?: unknown;
  readonly reason?: string;
  readonly idempotencyKey?: string;
}

export interface ExecutionPlan {
  readonly version: string;

  readonly id?: string;

  readonly goal?: string;

  readonly steps: readonly ExecutionStep[];

  readonly metadata?: Readonly<Record<string, unknown>>;

  readonly idempotencyKey?: string;
}

export interface Planner {
  plan(
    goal: string,
    context?: PlannerContext
  ): Promise<ExecutionPlan>;
}
