import Database from 'better-sqlite3';

import { ExecutionLogEntry } from '../execution/execution-logger.js';
import { ExecutionLogSink } from './execution-log-sink.js';

export class SQLiteLogSink
  implements ExecutionLogSink
{
  private readonly db: Database.Database;

  constructor(path = './data/operator.db') {
    this.db = new Database(path);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        job_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        metadata TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_execution_logs_job_id
      ON execution_logs(job_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_execution_logs_step_id
      ON execution_logs(step_id)
    `);
  }

  write(entry: ExecutionLogEntry): void {
    const statement = this.db.prepare(`
      INSERT INTO execution_logs (
        timestamp,
        level,
        message,
        job_id,
        step_id,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      entry.timestamp,
      entry.level,
      entry.message,
      entry.jobId,
      entry.stepId,
      entry.metadata
        ? JSON.stringify(entry.metadata)
        : null
    );
  }
}