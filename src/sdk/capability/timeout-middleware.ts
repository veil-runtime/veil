import {
  CapabilityMiddleware,
  CapabilityNext,
} from './capability-middleware.js';

import {
  CapabilityExecution,
} from './capability-definition.js';

export class TimeoutMiddleware<
  TInput = unknown,
  TResult = unknown
> implements CapabilityMiddleware<
  TInput,
  TResult
> {
  constructor(
    private readonly timeoutMs: number
  ) {
    if (
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0
    ) {
      throw new Error(
        'timeoutMs must be greater than zero'
      );
    }
  }

  async execute(
    execution: CapabilityExecution<
      TInput,
      TResult
    >,
    next: CapabilityNext<TResult>
  ): Promise<TResult> {
    let timeoutHandle:
      | ReturnType<typeof setTimeout>
      | undefined;

    const timeoutPromise =
      new Promise<never>(
        (_, reject) => {
          timeoutHandle =
            setTimeout(
              () => {
                reject(
                  new Error(
                    `Capability execution timed out after ${this.timeoutMs}ms`
                  )
                );
              },
              this.timeoutMs
            );
        }
      );

    try {
      return await Promise.race([
        next(),
        timeoutPromise,
      ]);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(
          'timed out'
        )
      ) {
        execution.context?.logger.warn(
          'Capability execution timed out',
          {
            timeoutMs:
              this.timeoutMs,
          }
        );
      }

      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(
          timeoutHandle
        );
      }
    }
  }
}