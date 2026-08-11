import {
  Capability,
} from '../../runtime/registry/capability.js';

import {
  CapabilityDefinition,
  CapabilityExecution,
} from './capability-definition.js';

import {
  CapabilityNext,
} from './capability-middleware.js';

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
      const execution: CapabilityExecution<
        TInput,
        TResult
      > = {
        input,
        context,
      };

      const middleware =
        definition.middleware ?? [];

      let next: CapabilityNext<TResult> =
        () =>
          definition.execute(
            execution
          );

      for (
        let index =
          middleware.length - 1;
        index >= 0;
        index -= 1
      ) {
        const current =
          middleware[index];

        const previousNext =
          next;

        next = () =>
          current.execute(
            execution,
            previousNext
          );
      }

      return next();
    },
  };
}