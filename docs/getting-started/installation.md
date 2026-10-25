---
title: Installation
---
# Installation

`@veil-runtime/core` requires Node.js **24 or newer**. **v0.3.1 is the latest
verified published package.** These docs target the unpublished
[v0.4.0 Core candidate](v0.4.0.html). A registry install does not install the candidate.

```bash
npm install @veil-runtime/core
```

The v0.4.0 execution target is **Linux**, qualified on x86_64/WSL2 with Node 24.
**Windows and macOS are unqualified**; this release makes no native execution or
filesystem security qualification claim for those platforms.

## Install the release candidate locally

Use the reviewed **`integration/v0.4.0` candidate branch**. It includes the
fresh-checkout source-server database initialization repair; the original
`release/core-v0.4.0` branch does not. From a fresh Linux checkout:

```bash
git clone --branch integration/v0.4.0 https://github.com/veil-runtime/veil.git veil-core
cd veil-core
git rev-parse HEAD
npm ci
npm run check
npm pack
```

Match the printed checkout revision to the approved PR head and its verification
record. After publication and creation of the final approved release tag, use
that tag in the clone command in place of the candidate branch. Do not assume a
release tag exists merely because a package has been published.

In a consumer project, install the generated tarball by its actual path:

```bash
npm install /path/to/veil/veil-runtime-core-0.4.0.tgz
npm ls @veil-runtime/core --depth=0
```

Package version `0.4.0`, capability versions such as `1.0.0`, and ExecutionPlan
formats `version: '1.0'` and `version: '2.0'` are independent. V1 remains the
default; V2 requires explicit trusted-host configuration. No npm publication is
implied by a local pack.

The candidate's verification record is available in the repository's
[integration release evidence](https://github.com/veil-runtime/veil/blob/integration/v0.4.0/docs/release/v0.4.0-integration-evidence.json).
Verify the SHA-256 for the exact reviewed tarball rather than assuming any file
named `0.4.0.tgz` has the same contents.

Continue with [run Core in five minutes](five-minutes.html) for a complete example.

Consumers import only from the root entry point:

```ts
import { OperatorRuntime, createCapability } from '@veil-runtime/core';
```

Do not import from `src/`, `dist/`, internal registries, providers, or storage paths. They are not package entry points. See [public API boundary](../architecture/public-api-boundary.html).
