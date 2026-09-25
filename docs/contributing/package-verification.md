---
title: Package verification
---
# Package verification

`npm run verify:package` builds and packs the package, asserts the expected
`@veil-runtime/core@0.3.0` contents and exclusions, installs it into the consumer
fixture, typechecks it, and runs its verification script. It verifies the public
consumer surface rather than repository internals; a local tarball does not imply
that v0.3.0 has been published.
