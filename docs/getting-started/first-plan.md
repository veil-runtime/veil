---
title: Your first plan
---
# Your first plan

An `ExecutionPlan` is the handoff from reasoning to execution. v0.2.0 uses `version: '1.0'` and runs the step array in order.

```ts
import type { ExecutionPlan } from '@veil-runtime/core';

export const plan: ExecutionPlan = {
  version: '1.0', goal: 'Echo a greeting',
  steps: [{
    id: 'echo', capability: 'example.echo', capabilityVersion: '1.0.0',
    input: { value: 'Hello from Veil' },
  }],
};
```

Before a job is created, Veil rejects empty plans, unknown capabilities, requested version mismatches, invalid declared fields, malformed references, and forward references. See [ExecutionPlan v1](../reference/execution-plan-v1.html).
