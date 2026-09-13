---
title: Protect write actions
---
# Protect write actions

The default authorizer permits read capabilities and denies write and destructive capabilities. Supplying an authorizer replaces that default decision for this runtime, so the authorizer must explicitly allow only the operations and conditions it intends to permit.

~~~ts
import { OperatorRuntime, type ExecutionAuthorizer } from '@veil-runtime/core';

const authorizer: ExecutionAuthorizer = {
  async authorize({ capability, input, caller }) {
    if (capability.risk === 'read') {
      return { decision: 'allow' };
    }

    if (
      capability.name === 'deploy.trigger' &&
      capability.risk === 'write' &&
      caller?.scopes?.includes('deploy:staging') &&
      typeof input === 'object' && input !== null &&
      'environment' in input && input.environment === 'staging'
    ) {
      return { decision: 'allow' };
    }

    return {
      decision: 'deny',
      reason: 'This runtime permits only read operations and staging deploy.trigger.',
    };
  },
};

const runtime = new OperatorRuntime({ authorizer });
~~~

This is an allowlist. A non-production target alone is not permission for an arbitrary write or destructive capability. Veil resolves references and validates the resulting input before it calls this authorizer; a deny prevents capability.started and capability execution.
