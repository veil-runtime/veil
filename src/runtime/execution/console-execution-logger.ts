import {
  ExecutionLogEntry,
  ExecutionLogger,
  ExecutionLogLevel,
} from './execution-logger.js';

export class ConsoleExecutionLogger
  implements ExecutionLogger
{
  constructor(
    private readonly jobId: string,
    private readonly stepId: string
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

    const output = JSON.stringify({
      type: 'execution_log',
      ...entry,
    });

    switch (level) {
      case 'debug':
        console.debug(output);
        break;

      case 'warn':
        console.warn(output);
        break;

      case 'error':
        console.error(output);
        break;

      default:
        console.info(output);
    }
  }
}