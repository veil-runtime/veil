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

`capability` contains name, version, and risk. `input` is resolved and input-validated. See [authorization](../concepts/authorization.html).
