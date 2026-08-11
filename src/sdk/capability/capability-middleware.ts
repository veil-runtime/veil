import { CapabilityExecution } from './capability-definition.js';

export type CapabilityNext<TResult> =
  () => Promise<TResult>;

export interface CapabilityMiddleware<
  TInput = unknown,
  TResult = unknown
> {
  execute(
    execution: CapabilityExecution<
      TInput,
      TResult
    >,
    next: CapabilityNext<TResult>
  ): Promise<TResult>;
}