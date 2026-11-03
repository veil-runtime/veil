---
title: Execution context
---
# Execution context

Capability execution receives an optional context with `jobId`, `stepId`, `logger`, and optional `caller`. A caller may include `subject`, `tenant`, readonly `scopes`, and readonly metadata.

When passed to `executePlan` or `run`, Veil shallow-copies and freezes the caller, its scopes array, and its metadata object before execution. The same immutable snapshot is given to authorization and capability context. Nested metadata values are not deep-frozen.

In v0.6.0 development, host execution options `signal` or `timeoutMs` opt into
cooperative supervision. Only then does context include `signal?: AbortSignal`.
The runtime owns this combined signal; capabilities can pass it to provider APIs
that accept AbortSignal. It signals a host abort or runtime deadline, without
undoing completed effects or proving that external actions did not occur.
Capabilities must return a promise covering all work that uses their Job logger.
See [OperatorRuntime](../reference/operator-runtime.html) for option bounds,
failure semantics and ownership limits.
