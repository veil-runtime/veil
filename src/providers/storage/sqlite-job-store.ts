import Database from 'better-sqlite3';

import { Job } from '../../runtime/jobs/job.js';
import { JobListFilter, JobStore } from '../../runtime/jobs/job-store.js';

export class SQLiteJobStore implements JobStore {
  private readonly db: Database.Database;

  constructor(path = './data/operator.db') {
    this.db = new Database(path);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  async create(job: Job): Promise<Job> {
    const statement = this.db.prepare(`
      INSERT INTO jobs (
        id,
        data,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?)
    `);

    statement.run(
      job.id,
      JSON.stringify(job),
      job.createdAt,
      job.updatedAt
    );

    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    const row = this.db
      .prepare(`
        SELECT data
        FROM jobs
        WHERE id = ?
      `)
      .get(id) as { data: string } | undefined;

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.data) as Job;
  }

  async list(
    filter?: JobListFilter
  ): Promise<Job[]> {
    const rows = this.db
      .prepare(`
        SELECT data
        FROM jobs
        ORDER BY created_at DESC
      `)
      .all() as Array<{ data: string }>;

    let jobs = rows.map(
      (row) => JSON.parse(row.data) as Job
    );

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
    const statement = this.db.prepare(`
      UPDATE jobs
      SET
        data = ?,
        updated_at = ?
      WHERE id = ?
    `);

    const result = statement.run(
      JSON.stringify(job),
      job.updatedAt,
      job.id
    );

    if (result.changes === 0) {
      throw new Error(`Job not found: ${job.id}`);
    }

    return job;
  }
}