---
title: Authorization API
---
# Authorization API

```ts
const authorizer: ExecutionAuthorizer = {
  async authorize({ jobId, stepId, capability, input, caller }) {
    return { decision: 'allow' };
    // or { decision: 'deny', reason: '...' }
  },
};
```

`capability` contains name, version, and risk. `input` is resolved and
input-validated. Under ExecutionPlan V2 it is also a detached recursively frozen
authorization copy; V1 retains its legacy shared-input behavior. See
[authorization](../concepts/authorization.html) and [ExecutionPlan
V2](execution-plan-v2.html).
