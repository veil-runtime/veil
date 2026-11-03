import { ExecutionLogEntry } from '../execution/execution-logger.js';
import { ExecutionLogSink } from './execution-log-sink.js';
import { reportLoggingFailure } from './logging-diagnostic.js';
import { SQLiteLogSink } from './sqlite-log-sink.js';

// One owner per execute() invocation, never shared between jobs or runtimes.
// SQLite writes are synchronous: no pending database work remains on return.
export class JobLogSink implements ExecutionLogSink {
  private sink?: SQLiteLogSink;
  private attempted = false;
  private disposed = false;

  write(entry: ExecutionLogEntry): void {
    if (this.disposed) return; // A retained capability logger cannot reopen it.
    if (!this.attempted) {
      this.attempted = true;
      try {
        this.sink = new SQLiteLogSink();
      } catch {
        reportLoggingFailure();
      }
    }
    this.sink?.write(entry);
  }

  [Symbol.dispose](): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sink?.[Symbol.dispose]();
    this.sink = undefined;
  }
}
