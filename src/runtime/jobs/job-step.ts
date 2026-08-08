export type JobStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface JobStep {
  id: string;

  capability: string;

  input?: unknown;

  status: JobStepStatus;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  result?: unknown;
  error?: string;
}