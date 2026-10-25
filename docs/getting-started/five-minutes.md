---
title: Run Core in five minutes
description: Install the Linux-qualified Core v0.4.0 release from npm and run a complete deterministic JavaScript example without an AI model.
---
# Run Core in five minutes

This example runs one governed read operation using only the public package root.
It needs no AI account, model, UI or external service. Use **Linux and Node 24 or
newer**; v0.4.0 was qualified on Linux x86_64/WSL2 with Node 24. Windows and macOS
are unqualified.

## 1. Check the published release

Use [Core v0.4.0 on npm](https://www.npmjs.com/package/@veil-runtime/core/v/0.4.0).
The [GitHub Release](https://github.com/veil-runtime/veil/releases/tag/v0.4.0)
records the published scope. See [installation](installation.html) for prerequisites
and optional source builds from the permanent `v0.4.0` tag.

## 2. Install in a small consumer project

```bash
mkdir veil-core-demo
cd veil-core-demo
npm init -y
npm install @veil-runtime/core@0.4.0
npm ls @veil-runtime/core --depth=0
```

The listing should contain `@veil-runtime/core@0.4.0`. Dependencies may need
registry access and native build tools if no matching SQLite binary is available.

## 3. Save this as `demo.mjs`

```js
import { createCapability, OperatorRuntime } from '@veil-runtime/core';

const echo = createCapability({
  name: 'example.echo',
  version: '1.0.0',
  description: 'Return the supplied value',
  risk: 'read',
  inputSchema: {
    value: { type: 'string', required: true, description: 'Text to return' },
  },
  async execute({ input }) {
    return input.value;
  },
});

const runtime = new OperatorRuntime();
runtime.use({
  manifest: {
    name: 'example', version: '1.0.0', capabilities: [echo.name],
  },
  capabilities: [echo],
});

const job = await runtime.executePlan({
  version: '1.0',
  steps: [{
    id: 'echo',
    capability: echo.name,
    capabilityVersion: echo.version,
    input: { value: 'Hello from Veil' },
  }],
});

if (job.status !== 'completed') {
  throw new Error(`Execution failed: ${job.error ?? job.status}`);
}
console.log(job.status, job.result);
```

## 4. Run it and inspect the result

```bash
node demo.mjs
```

After lifecycle logs, the final line is:

```text
completed Hello from Veil
```

The default authorizer allows this read-risk operation. Your application must
label operations correctly. To allow writes, supply an explicit
[runtime-scoped authorizer](../guides/protect-write-actions.html). Caller scopes
are trusted host assertions, not identities authenticated by Core.

This example uses ExecutionPlan V1, the default. The package version `0.4.0`,
capability version `1.0.0` and plan version `1.0` are separate contracts.
[V2](../reference/execution-plan-v2.html) requires trusted-host opt-in.

## 5. Build on the same mental model

Continue through [core concepts](../concepts/reasoning-and-execution.html),
[build a capability](../guides/build-a-capability.html),
[architecture](../architecture/overview.html) and
[API reference](../reference/public-exports.html).
The [developer portal](../developer.html) links the full learning path.
