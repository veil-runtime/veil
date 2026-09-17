---
title: Installation
---
# Installation

`@veil-runtime/core` requires Node.js **24 or newer**. **v0.1.3 remains the latest
published package.** The install command below does not include the
[unreleased v0.1.4 hardening and introspection contract](upcoming-v0.1.4.html).

```bash
npm install @veil-runtime/core
```

Consumers import only from the root entry point:

```ts
import { OperatorRuntime, createCapability } from '@veil-runtime/core';
```

Do not import from `src/`, `dist/`, internal registries, providers, or storage paths. They are not package entry points. See [public API boundary](../architecture/public-api-boundary.html).
