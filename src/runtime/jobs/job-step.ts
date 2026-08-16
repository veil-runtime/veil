export type JobStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface JobStep extends ExecutionStep {
  status: JobStepStatus;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  result?: unknown;
  error?: string;
}
import { ExecutionStep } from '../planner/planner.js';
