import {
  Capability,
} from '../../runtime/registry/capability.js';

import {
  CapabilityDefinition,
} from './capability-definition.js';

export function createCapability<
  TInput = unknown,
  TResult = unknown
>(
  definition: CapabilityDefinition<
    TInput,
    TResult
  >
): Capability<TInput, TResult> {
  return {
    name: definition.name,
    description: definition.description,
    risk: definition.risk,
    inputSchema: definition.inputSchema,

    async execute(
      input,
      context
    ): Promise<TResult> {
      const startedAt = Date.now();

      context?.logger.info(
        'Capability execution started',
        {
          capability: definition.name,
        }
      );

      try {
        const result =
          await definition.execute({
            input,
            context,
          });

        context?.logger.info(
          'Capability execution completed',
          {
            capability: definition.name,
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

        context?.logger.error(
          'Capability execution failed',
          {
            capability: definition.name,
            durationMs:
              Date.now() - startedAt,
            error: message,
          }
        );

        throw error;
      }
    },
  };
}