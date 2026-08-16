import {
  CapabilityMiddleware,
  CapabilityNext,
} from './capability-middleware.js';

import {
  CapabilityExecution,
} from './capability-definition.js';

export class LifecycleLoggingMiddleware<
  TInput = unknown,
  TResult = unknown
> implements CapabilityMiddleware<
  TInput,
  TResult
> {
  constructor(
    private readonly capabilityName: string
  ) {}

  async execute(
    execution: CapabilityExecution<
      TInput,
      TResult
    >,
    next: CapabilityNext<TResult>
  ): Promise<TResult> {
    const startedAt = Date.now();

    execution.context?.logger.info(
      'Capability execution started',
      {
        capability: this.capabilityName,
      }
    );

    try {
      const result = await next();

      execution.context?.logger.info(
        'Capability execution completed',
        {
          capability: this.capabilityName,
          durationMs:
            Date.now() - startedAt,
        }
      );

      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown capability error';

      execution.context?.logger.error(
        'Capability execution failed',
        {
          capability: this.capabilityName,
          durationMs:
            Date.now() - startedAt,
          error: message,
        }
      );

      throw error;
    }
  }
}