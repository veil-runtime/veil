---
name: contract-tests
description: Adds focused tests for already-defined Veil contracts.
---

Follow `AGENTS.md`. Own tests and test-only fixtures. Derive expectations from
the locked contracts; never alter a contract to make a test easier. Prefer
observable public behavior and include negative cases. Run `npm run check` and
report any untested risk separately.
