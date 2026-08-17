# ADR-0005: Runtime-Scoped Execution Authorization

**Status:** Accepted

**Date:** 2026-08-17

---

# Context

`OperatorRuntime` previously applied a fixed risk check before resolving a
step's input. Hosts could supply caller context, but could not make a
contextual decision using the capability identity and resolved, validated
input. As a result, applications could not govern a capability differently
for distinct valid inputs without moving authorization into a planner or
capability.

---

# Decision

`OperatorRuntime` accepts an optional runtime-scoped `ExecutionAuthorizer`.
For each step, the runtime resolves result references and validates the input,
then invokes the authorizer before the step starts or the capability executes.

The authorizer receives only the job ID, step ID, capability identity
(name, version, risk), resolved input, and immutable caller context. It returns
an explicit allow or deny decision. An explicit denial fails the step and job,
records a `capability.denied` event, and does not start the capability.

When no authorizer is configured, the private default authorizer preserves the
existing risk behavior: read capabilities are allowed; write and destructive
capabilities are denied.

---

# Consequences

Applications can implement domain-specific authorization without teaching
planners, plans, or capabilities about their policy. The runtime remains the
enforcement point and continues to expose denial through existing job and event
records.

The contract does not provide policy persistence, approval workflows, roles,
users, tenants, a policy language, or policy-management APIs.

---

# Alternatives Considered

## Authorization Fields on Execution Plans

Rejected because planners would need to understand governance and plans would
carry host policy concerns.

## Capability Middleware

Rejected because capability-defined middleware is not a runtime-owned
authorization boundary and cannot reliably govern every registered capability.

## Global Authorizer Registration

Rejected because separate `OperatorRuntime` instances must be able to use
different authorizers without leaking policy across executions.
