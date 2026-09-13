---
title: Your first runtime
---
# Your first runtime

```ts
import { OperatorRuntime } from '@veil-runtime/core';
import { exampleModule } from './example.js';
import { plan } from './plan.js';

const runtime = new OperatorRuntime();
runtime.use(exampleModule);
const job = await runtime.executePlan(plan, {
  caller: { subject: 'demo-user', scopes: ['example:read'] },
});
console.log(job.status, job.result);
```

`use` checks that each supplied capability is declared by the module manifest, then registers it. The capability registry is process-global in v0.1.3, so runtime instances share registered capabilities. `executePlan` returns the completed or failed `Job`. See [jobs](../concepts/jobs-and-outcomes.html).
