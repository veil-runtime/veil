export interface PlannerRuntimeState {
  healthy: boolean;

  available: boolean;

  lastCheckedAt?: string;

  failureReason?: string;
}