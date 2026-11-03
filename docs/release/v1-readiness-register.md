# Veil Core v1 readiness register

Verified against the v0.4.0 tag and v0.5.0 integration baseline. This is an engineering register, not a promise that proposed work ships in v0.5.0.

| Area | Verified current guarantee or limit | Proposed v1 acceptance criterion |
| --- | --- | --- |
| Governed execution | ExecutionPlan separates reasoning from execution; OperatorRuntime admits plans, resolves input, authorizes each capability and records job history. V1 is default and V2 host opt-in. See `src/index.ts`, `test/execution-contract.test.ts`, `test/governed-value-v2.test.ts`. | Freeze documented public contracts with compatibility tests across the supported Node range. |
| Authorization | Default policy permits reads and denies writes/destructive work. Risk labels do not authenticate callers; the development HTTP server is unauthenticated. See `test/governance-routes.test.ts` and `docs/architecture/trust-boundaries.md`. | Define a supported production host security profile and test denial before provider I/O. |
| Isolation | Capability registry and job services are process-global; arbitrary host capability code is trusted. See `docs/reference/operator-runtime.md`. | State an explicit supported tenancy/isolation model and verify it; keep Sandbox separate. |
| Value ownership | V2 has an opt-in governed value boundary, while live in-process results, getters and Proxy traps retain documented limits. See `test/value-ownership.test.ts` and `docs/architecture/trust-boundaries.md`. | Specify stable value-domain guarantees and regression fixtures without silently changing V1. |
| Reliability | Sequential execution and admission are tested. There is no general cancellation, retry, idempotency enforcement or aggregate budget. See `docs/developer.md`. | Approve bounded work and resource semantics through an architecture decision before adding contracts. |
| Observation | Job history is retained and subscriber failures are contained; delivery has no timeout, retry or durability guarantee. See `test/memory-event-bus.test.ts` and `docs/reference/runtime-events.md`. | Define observable failure and resource behavior for supported hosts. |
| Public API | Sole root export and package exclusions are tested by `tools/verify-package.mjs`; public planner and runtime types are in `src/index.ts`. | Maintain a versioned API inventory and independent consumer compile/runtime matrix. |
| Security and supply chain | v0.4.0 was Linux-qualified. Dependency advisories can emerge after qualification; Windows/macOS remain unqualified. See `docs/release/linux-qualification-2026-10-25.json`. | Repeat production and consumer audits for each candidate, qualify every claimed platform natively, and retain artifact provenance. |

## Proposed milestones

1. **v0.5.0 hardening:** dependency remediation, candidate audits, documentation correction, regression evidence and exact-artifact consumer verification.
2. **v0.6–0.8 reliability:** decide cancellation, bounded resources and observable failures only after contract design and targeted tests.
3. **v0.9 stabilization:** API freeze candidate, migration review, platform matrix and independent consumer exercises.
4. **v1.0.0:** all accepted security, compatibility, reliability and documentation criteria pass on the exact published artifact.

Future capabilities above remain proposals. A change to a locked contract requires an explicit maintainer architecture decision.
