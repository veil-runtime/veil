---
title: Your first plan
---
# Your first plan

An `ExecutionPlan` is the handoff from reasoning to execution. V1 remains the
default, so this first example uses `version: '1.0'` and runs the step array in
order. ExecutionPlan V2 is available only when a trusted host explicitly enables
it; see the [V2 reference](../reference/execution-plan-v2.html).

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

Before a Job is created, Veil rejects unsupported or host-disabled plan versions,
empty plans, unknown capabilities, requested capability-version mismatches,
invalid declared fields, malformed references, and forward references. See
[ExecutionPlan V1](../reference/execution-plan-v1.html).
