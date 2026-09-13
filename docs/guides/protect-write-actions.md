---
title: Protect write actions
---
# Protect write actions

The default authorizer already denies write and destructive capabilities. Supply an authorizer to allow selected work and inspect resolved input.

```ts
import { OperatorRuntime, type ExecutionAuthorizer } from '@veil-runtime/core';
const authorizer: ExecutionAuthorizer = {
  async authorize({ capability, input }) {
    if (capability.risk === 'read') return { decision: 'allow' };
    if (capability.name === 'deploy.trigger' &&
        typeof input === 'object' && input !== null &&
        'environment' in input && input.environment === 'production') {
      return { decision: 'deny', reason: 'Production deployment is not allowed.' };
    }
    return { decision: 'allow' };
  },
};
const runtime = new OperatorRuntime({ authorizer });
```

Do not authorize based on unresolved reference syntax. Veil supplies its resolved value. A deny stops execution before the capability starts.
