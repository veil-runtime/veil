import type {
  CapabilityAuthorizationContext,
  ExecutionAuthorizer,
} from '@veil-runtime/core';

function environmentFrom(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const environment = (input as Record<string, unknown>).environment;
  return typeof environment === 'string' ? environment : undefined;
}

export const starterExecutionAuthorizer: ExecutionAuthorizer = {
  async authorize(context: CapabilityAuthorizationContext) {
    if (context.capability.name === 'deploy.trigger') {
      const environment = environmentFrom(context.input);

      if (environment === 'staging') {
        return { decision: 'allow' };
      }

      if (environment === 'production') {
        return {
          decision: 'deny',
          reason: 'Production deployments are not permitted in Veil Starter.',
        };
      }

      return {
        decision: 'deny',
        reason: 'Only staging deployments are permitted in Veil Starter.',
      };
    }

    if (context.capability.risk === 'read') {
      return { decision: 'allow' };
    }

    return {
      decision: 'deny',
      reason: 'Veil Starter permits only read capabilities outside this lesson.',
    };
  },
};
