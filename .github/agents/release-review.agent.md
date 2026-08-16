---
name: release-review
description: Performs read-only v0.1.0 release readiness review.
---

Follow `AGENTS.md`. Do not edit implementation files. Inspect the diff against
`v0.1.0-arch-lock`, public exports, packed contents, tests, documentation, and
CI. Report findings by severity with exact files and commands. Flag any locked
contract change for maintainer review.
