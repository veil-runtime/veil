export type JobEventType =
  | 'job.created'
  | 'planning.started'
  | 'planning.completed'
  | 'approval.requested'
  | 'approval.granted'
  | 'execution.started'
  | 'capability.denied'
  | 'capability.started'
  | 'capability.completed'
  | 'capability.failed'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'job.reviewed';

export interface JobEvent {
  id: string;
  jobId: string;
  type: JobEventType;
  timestamp: string;
  data?: Record<string, unknown>;
}