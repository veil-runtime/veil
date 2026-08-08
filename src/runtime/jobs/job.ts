import { JobStatus } from './job-status.js';
import { JobEvent } from './job-event.js';
import { JobStep } from './job-step.js';

export interface Job {
  id: string;

  goal: string;

  planner?: string;

  status: JobStatus;

  createdAt: string;
  updatedAt: string;

  startedAt?: string;
  completedAt?: string;

  steps: JobStep[];

  result?: unknown;
  error?: string;

  events: JobEvent[];
}