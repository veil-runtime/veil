import { ExecutionLogEntry } from '../execution/execution-logger.js';

export interface ExecutionLogSink {
  write(
    entry: ExecutionLogEntry
  ): Promise<void> | void;
}