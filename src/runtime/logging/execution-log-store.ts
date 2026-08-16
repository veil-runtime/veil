import Database from 'better-sqlite3';

import { ExecutionLogEntry } from '../execution/execution-logger.js';

export class ExecutionLogStore {
  private readonly db: Database.Database;

  constructor(path = './data/operator.db') {
    this.db = new Database(path);
  }

  listByJob(jobId: string): ExecutionLogEntry[] {
    const rows = this.db
      .prepare(`
        SELECT
          timestamp,
          level,
          message,
          job_id,
          step_id,
          metadata
        FROM execution_logs
        WHERE job_id = ?
        ORDER BY id ASC
      `)
      .all(jobId) as Array<{
        timestamp: string;
        level: ExecutionLogEntry['level'];
        message: string;
        job_id: string;
        step_id: string;
        metadata: string | null;
      }>;

    return rows.map((row) => ({
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      jobId: row.job_id,
      stepId: row.step_id,
      metadata: row.metadata
        ? JSON.parse(row.metadata)
        : undefined,
    }));
  }
}

export const executionLogStore =
  new ExecutionLogStore();