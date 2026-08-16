import { JobEventType } from '../jobs/job-event.js';

export type RuntimeEventType = JobEventType;

export interface RuntimeEvent<
  TData extends Record<string, unknown> =
    Record<string, unknown>
> {
  id: string;
  type: RuntimeEventType;
  timestamp: string;

  jobId?: string;
  stepId?: string;

  data?: TData;
}