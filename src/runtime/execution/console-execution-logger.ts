import { ExecutionLogger } from './execution-logger.js';

export class ConsoleExecutionLogger
  implements ExecutionLogger
{
  constructor(
    private readonly jobId: string,
    private readonly stepId: string
  ) {}

  debug(message: string): void {
    console.debug(this.format('DEBUG', message));
  }

  info(message: string): void {
    console.info(this.format('INFO', message));
  }

  warn(message: string): void {
    console.warn(this.format('WARN', message));
  }

  error(message: string): void {
    console.error(this.format('ERROR', message));
  }

  private format(
    level: string,
    message: string
  ): string {
    return [
      '[operator]',
      `[${level}]`,
      `[job:${this.jobId}]`,
      `[step:${this.stepId}]`,
      message,
    ].join(' ');
  }
}