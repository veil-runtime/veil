import { ExecutionLogger } from './execution-logger.js';

export interface ExecutionCaller {
  readonly subject?: string;
  readonly tenant?: string;
  readonly scopes?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionContext {
  readonly jobId: string;
  readonly stepId: string;
  readonly logger: ExecutionLogger;
  readonly caller?: ExecutionCaller;
}
