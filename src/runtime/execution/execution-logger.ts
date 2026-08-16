export type ExecutionLogLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error';

export interface ExecutionLogEntry {
  timestamp: string;
  level: ExecutionLogLevel;
  message: string;

  jobId: string;
  stepId: string;

  metadata?: Record<string, unknown>;
}

export interface ExecutionLogger {
  debug(
    message: string,
    metadata?: Record<string, unknown>
  ): void;

  info(
    message: string,
    metadata?: Record<string, unknown>
  ): void;

  warn(
    message: string,
    metadata?: Record<string, unknown>
  ): void;

  error(
    message: string,
    metadata?: Record<string, unknown>
  ): void;
}