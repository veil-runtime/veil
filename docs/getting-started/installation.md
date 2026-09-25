---
title: Installation
---
# Installation

`@veil-runtime/core` requires Node.js **24 or newer**. **v0.2.0 remains the latest
published package until v0.3.0 is published.** These docs target the
[v0.3.0 release candidate](v0.3.0.html). The registry install below currently
installs v0.2.0 and does not include the candidate's ExecutionPlan V2 or later
admission and execution hardening.

```bash
npm install @veil-runtime/core
```

## Install the release candidate locally

From a checkout of the v0.3.0 candidate, build and pack without publishing:

```bash
npm ci
npm run build
npm pack
```

In a consumer project, install the generated tarball by its actual path:

```bash
npm install /path/to/veil/veil-runtime-core-0.3.0.tgz
```

Package version `0.3.0`, capability versions such as `1.0.0`, and ExecutionPlan
formats `version: '1.0'` and `version: '2.0'` are independent. V1 remains the
default; V2 requires explicit trusted-host configuration. No npm publication is
implied by a local pack.

Consumers import only from the root entry point:

```ts
import { OperatorRuntime, createCapability } from '@veil-runtime/core';
```

Do not import from `src/`, `dist/`, internal registries, providers, or storage paths. They are not package entry points. See [public API boundary](../architecture/public-api-boundary.html).
