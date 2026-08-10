import { Job } from './job.js';
import { SQLiteJobStore } from '../../providers/storage/sqlite-job-store.js';

export interface JobListFilter {
  status?: string;
  planner?: string;
  capability?: string;
}

export interface JobStore {
  create(job: Job): Promise<Job>;

  get(id: string): Promise<Job | undefined>;

  list(filter?: JobListFilter): Promise<Job[]>;

  update(job: Job): Promise<Job>;
}

class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();

  async create(job: Job): Promise<Job> {
    if (this.jobs.has(job.id)) {
      throw new Error(`Job already exists: ${job.id}`);
    }

    this.jobs.set(job.id, job);

    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async list(filter?: JobListFilter): Promise<Job[]> {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter(
        (job) => job.status === filter.status
      );
    }

    if (filter?.planner) {
      jobs = jobs.filter(
        (job) => job.planner === filter.planner
      );
    }

    if (filter?.capability) {
      jobs = jobs.filter((job) =>
        job.steps.some(
          (step) =>
            step.capability === filter.capability
        )
      );
    }

    return jobs;
  }

  async update(job: Job): Promise<Job> {
    if (!this.jobs.has(job.id)) {
      throw new Error(`Job not found: ${job.id}`);
    }

    this.jobs.set(job.id, job);

    return job;
  }
}

function createJobStore(): JobStore {
  const type =
    process.env.JOB_STORE?.toLowerCase() ?? 'memory';

  if (type === 'sqlite') {
    return new SQLiteJobStore();
  }

  return new InMemoryJobStore();
}

export const jobStore = createJobStore();