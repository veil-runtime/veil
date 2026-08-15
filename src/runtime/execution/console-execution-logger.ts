import {
  ExecutionLogEntry,
  ExecutionLogger,
  ExecutionLogLevel,
} from './execution-logger.js';

import { ExecutionLogSink } from '../logging/execution-log-sink.js';

export class ConsoleExecutionLogger
  implements ExecutionLogger
{
  constructor(
    private readonly jobId: string,
    private readonly stepId: string,
    private readonly sink: ExecutionLogSink
  ) {}

  debug(
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.write('debug', message, metadata);
  }

  info(
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.write('info', message, metadata);
  }

  warn(
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.write('warn', message, metadata);
  }

  error(
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.write('error', message, metadata);
  }

  private write(
    level: ExecutionLogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const entry: ExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      jobId: this.jobId,
      stepId: this.stepId,
      metadata,
    };

    void this.sink.write(entry);
  }
}