---
title: Execution context
---
# Execution context

Capability execution receives an optional context with `jobId`, `stepId`, `logger`, and optional `caller`. A caller may include `subject`, `tenant`, readonly `scopes`, and readonly metadata.

When passed to `executePlan` or `run`, Veil shallow-copies and freezes the caller, its scopes array, and its metadata object before execution. The same immutable snapshot is given to authorization and capability context. Nested metadata values are not deep-frozen.
