import { Job } from './job.js';

export interface JobStore {
  create(job: Job): Promise<Job>;

  get(id: string): Promise<Job | undefined>;

  list(): Promise<Job[]>;

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

  async list(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async update(job: Job): Promise<Job> {
    if (!this.jobs.has(job.id)) {
      throw new Error(`Job not found: ${job.id}`);
    }

    this.jobs.set(job.id, job);

    return job;
  }
}

export const jobStore = new InMemoryJobStore();