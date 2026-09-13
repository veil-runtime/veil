---
title: Installation
---
# Installation

`@veil-runtime/core` requires Node.js **24 or newer**.

```bash
npm install @veil-runtime/core
```

Consumers import only from the root entry point:

```ts
import { OperatorRuntime, createCapability } from '@veil-runtime/core';
```

Do not import from `src/`, `dist/`, internal registries, providers, or storage paths. They are not package entry points. See [public API boundary](../architecture/public-api-boundary.html).
