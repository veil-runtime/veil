---
title: Package verification
---
# Package verification

`npm run verify:package` builds and packs the package, asserts expected v0.1.3 contents/exclusions, installs it into the consumer fixture, typechecks it, and runs its verification script. It verifies the public consumer surface rather than repository internals.
