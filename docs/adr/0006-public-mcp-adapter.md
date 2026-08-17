# ADR-0006: Public MCP Adapter Boundary

**Status:** Accepted

**Date:** 2026-08-18

---

# Context

Veil supports inbound Model Context Protocol (MCP) interoperability by exposing
registered Veil capabilities as MCP tools. `McpAdapter` is part of the public
package surface, so its dependency on the governed runtime must be explicit and
must not introduce another way to execute capabilities.

The architecture locked at `v0.1.0-arch-lock` requires reasoning to produce an
`ExecutionPlan`, `OperatorRuntime` to govern execution, and capabilities to
perform work.

---

# Decision

`McpAdapter` is a public interoperability boundary. Its constructor is:

```ts
new McpAdapter(runtime: OperatorRuntime)
```

The caller supplies the `OperatorRuntime` whose registered capabilities the
adapter exposes and whose execution policy governs every MCP invocation. The
adapter translates an MCP tool call into an ordinary `ExecutionPlan` and calls
`runtime.executePlan(plan)`.

The required execution path remains:

```text
MCP tool call
    -> McpAdapter
    -> ExecutionPlan
    -> OperatorRuntime
    -> Capability
```

`McpAdapter` must not call capabilities or providers directly, use an internal
global runtime instead of the supplied runtime, or define MCP-specific plan,
result, job, or event contracts. There is no alternate MCP execution path.

---

# Consequences

- Runtime selection and authorization remain explicit for embedders.
- An injected `ExecutionAuthorizer` governs MCP-originated execution through the
  same `OperatorRuntime` path as other plans.
- Capability discovery and execution use the same supplied runtime.
- Constructing `McpAdapter` without an `OperatorRuntime` is not supported.
- Future MCP work must preserve the `ExecutionPlan` -> `OperatorRuntime` ->
  `Capability` boundary.
