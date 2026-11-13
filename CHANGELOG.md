# Changelog

## 0.6.0 — Published 2026-11-03

[GitHub release](https://github.com/veil-runtime/veil/releases/tag/v0.6.0)
at source commit `03b5ed6db25d7c1f20a98a53208d66c103abe163` records governed
execution supervision: cooperative cancellation via a host `AbortSignal`,
optional execution deadlines, trusted plan-step and active-execution limits,
per-instance capacity tracking, and more reliable logging resource handling.
Existing execution and authorization contracts and V1/V2 semantics remain
unchanged. Cancellation does not guarantee external work has stopped or rolled
back; capacity limits are per runtime instance. Requires Node 24 or newer.
Linux is the fully qualified execution platform.

## 0.5.0 — Published 2026-11-03

[GitHub release](https://github.com/veil-runtime/veil/releases/tag/v0.5.0)
at source commit `78713066cafba46b0c2f1cd40eed0e9937102002` records an MCP SDK
production dependency and development tooling refresh. Browser-session source
cleanup preserves the original page-creation error when context cleanup also
fails; the browser provider is outside the Core artifact. The sole package-root
export and execution, capability, job, result and event contracts are unchanged.
Requires Node 24 or newer. Consumers should refresh their lockfiles to obtain
fixed transitive dependencies. Linux is the fully qualified execution platform.

## Historical candidate record

## 0.4.0 — Unreleased Core candidate

Based on published v0.3.1. No new public exports or plan/job/event contracts.

- Security: confine and bound the source-tree filesystem reader; reject symbolic
  links, hard links, special files and oversized reads. Linux pins parent
  descriptors; portable checks require quiescent host directories.
- Security: update Fastify 5.12.5 to 5.12.7 and transitive Hono 4.13.7 to 4.13.13.
  Hono is a candidate lockfile update; downstream consumers must audit and refresh
  their own lockfiles. No new direct runtime dependency or override is added.
- Source-server planning: make local models opt-in and explicitly selected;
  use deterministic default routing. Bound the existing planner's requests,
  streamed responses, deadlines, requested output and step count. Generated plans
  remain subject to existing admission and host authorization.
- Verification: clean stale test artifacts, add security/planner regressions and
  a filesystem platform matrix, and assert Core-only package boundaries.
- Documentation: clarify Core independence, compatibility and deployment limits.

UI, Emergence, Caretaker and autonomous repository-task applications are excluded.
The internal local planner and built-in capabilities are not npm exports.
See `docs/getting-started/v0.4.0.md` and `docs/release/v0.4.0-readiness.md` for
verification evidence and outstanding publication prerequisites.
