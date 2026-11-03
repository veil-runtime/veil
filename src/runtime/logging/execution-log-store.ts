import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Database from 'better-sqlite3';

import { reportLoggingFailure } from './logging-diagnostic.js';

import { ExecutionLogEntry } from '../execution/execution-logger.js';

export class ExecutionLogStore {
  constructor(private readonly path = './data/operator.db') {}

  listByJob(jobId: string): ExecutionLogEntry[] {
    mkdirSync(dirname(resolve(this.path)), { recursive: true });
    const db = new Database(this.path);
    try {
      const rows = db
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
    } finally {
      try {
        db.close();
      } catch {
        reportLoggingFailure();
      }
    }
  }
}

export const executionLogStore =
  new ExecutionLogStore();