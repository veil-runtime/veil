---
title: Installation
---
# Installation

`@veil-runtime/core` requires Node.js **24 or newer**. **v0.1.3 remains the latest
published package until v0.2.0 is published.** These docs target the
[v0.2.0 release candidate](v0.2.0.html). The registry install below currently
installs v0.1.3 and does not include the new hardening or introspection API.

```bash
npm install @veil-runtime/core
```

## Install the release candidate locally

From a checkout of the v0.2.0 candidate, build and pack without publishing:

```bash
npm ci
npm run build
npm pack
```

In a consumer project, install the generated tarball by its actual path:

```bash
npm install /path/to/veil/veil-runtime-core-0.2.0.tgz
```

Package version `0.2.0`, capability versions such as `1.0.0`, and ExecutionPlan
format `version: '1.0'` are independent. No npm publication is implied by a local pack.

Consumers import only from the root entry point:

```ts
import { OperatorRuntime, createCapability } from '@veil-runtime/core';
```

Do not import from `src/`, `dist/`, internal registries, providers, or storage paths. They are not package entry points. See [public API boundary](../architecture/public-api-boundary.html).
