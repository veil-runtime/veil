import { ExecutionLogger } from './execution-logger.js';

export interface ExecutionContext {
  jobId: string;
  stepId: string;
  logger: ExecutionLogger;
}