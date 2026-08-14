import {
  PlannerContext,
} from './planner.js';

export interface PlannerRoutingRequest {
  goal: string;

  strategy?: string;

  planner?: string;

  context?: PlannerContext;
}

export interface PlannerSelection {
  strategy: string;

  reason?: string;
}

export interface PlannerRouter {
  select(
    request: PlannerRoutingRequest
  ): Promise<PlannerSelection>;
}