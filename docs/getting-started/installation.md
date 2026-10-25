---
title: Installation
---
# Installation

`@veil-runtime/core` requires Node.js **24 or newer**. **v0.4.0 is published**
and is the npm `latest` release. Install the explicit version:

```bash
npm install @veil-runtime/core@0.4.0
npm ls @veil-runtime/core --depth=0
```

See the [npm package](https://www.npmjs.com/package/@veil-runtime/core/v/0.4.0),
[GitHub Release](https://github.com/veil-runtime/veil/releases/tag/v0.4.0) and
[release notes](v0.4.0.html).

The v0.4.0 execution target is **Linux**, qualified on x86_64/WSL2 with Node 24.
**Windows and macOS are unqualified**; this release makes no native execution or
filesystem security qualification claim for those platforms.

## Build the published source locally

For source-server development or a local build, use the permanent **`v0.4.0` tag**:

```bash
git clone --branch v0.4.0 https://github.com/veil-runtime/veil.git veil-core
cd veil-core
git rev-parse HEAD
npm ci
npm run check
npm pack
```

The tag resolves to `8cfd8002cf9a7b3db1d615e6c322165aee46c83a`, the merged
release source. Source builds require development/native build tools.

In a consumer project, install the generated tarball by its actual path:

```bash
npm install /path/to/veil/veil-runtime-core-0.4.0.tgz
npm ls @veil-runtime/core --depth=0
```

Package version `0.4.0`, capability versions such as `1.0.0`, and ExecutionPlan
formats `version: '1.0'` and `version: '2.0'` are independent. V1 remains the
default; V2 requires explicit trusted-host configuration. No npm publication is
implied by a local pack.

The historical qualification record is preserved in the tagged
[integration release evidence](https://github.com/veil-runtime/veil/blob/v0.4.0/docs/release/v0.4.0-integration-evidence.json).
A local pack is a source build; use npm for the published artifact.

Continue with [run Core in five minutes](five-minutes.html) for a complete example.

Consumers import only from the root entry point:

```ts
import { OperatorRuntime, createCapability } from '@veil-runtime/core';
```

Do not import from `src/`, `dist/`, internal registries, providers, or storage paths. They are not package entry points. See [public API boundary](../architecture/public-api-boundary.html).
