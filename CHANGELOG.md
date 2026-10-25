# Changelog

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
