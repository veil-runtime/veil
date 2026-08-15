# ADR-001: MCP Interoperability Boundary

## Status

Accepted

## Context

Veil separates reasoning and intent from governed execution.

Its core execution path is based on existing Veil contracts such as:

- `ExecutionPlan`
- `OperatorRuntime`
- capabilities
- providers
- the existing execution result and event model

The Model Context Protocol (MCP) provides a standard way for AI systems and tools to expose and invoke external capabilities.

Veil should interoperate with MCP without allowing MCP-specific concepts to redefine or leak into the core execution architecture.

## Decision

MCP is an interoperability layer around Veil, not a new execution path inside Veil.

### Inbound

An MCP client may invoke a Veil-native capability through an adapter:

```text
MCP Client
   ↓
McpAdapter
   ↓
ExecutionPlan
   ↓
OperatorRuntime
   ↓
Native Capability

McpAdapter is responsible for translating an MCP tool invocation into an existing Veil ExecutionPlan.
Once translated, execution proceeds through the normal Veil runtime.
The runtime must not need to know that the request originated from MCP.
Outbound
Veil may execute capabilities backed by an external MCP server through a provider:
ExecutionPlan
   ↓
OperatorRuntime
   ↓
MCP-backed Capability
   ↓
McpProvider
   ↓
External MCP Server
McpProvider is responsible for translating between Veil's existing provider/capability contract and MCP.
The runtime must not need to know that the provider uses MCP.
Architectural Constraint
MCP must not require MCP-specific changes to:
ExecutionPlan
OperatorRuntime
the existing capability contract
the existing execution result model
the existing execution event model
MCP-specific execution types such as the following should not be introduced into Veil Core:
McpExecutionPlan
McpExecutionStep
McpRuntime
McpExecutionResult
MCP protocol-specific concerns belong at the interoperability boundary.
Phase 1 Proofs
The initial implementation must prove both directions.
Proof 1 — Inbound
Translate one MCP tool invocation into a normal Veil ExecutionPlan and execute an existing native capability through the normal OperatorRuntime.
Success means:
MCP tool invocation
   ↓
McpAdapter
   ↓
ordinary ExecutionPlan
   ↓
ordinary OperatorRuntime
   ↓
ordinary native capability
   ↓
ordinary Veil result
Proof 2 — Outbound
Expose one external MCP tool to Veil as an ordinary provider-backed capability.
Success means:
ordinary ExecutionPlan
   ↓
ordinary OperatorRuntime
   ↓
ordinary capability
   ↓
McpProvider
   ↓
external MCP tool
   ↓
ordinary Veil result
Phase 1 Non-Goals
The first MCP implementation will not introduce:
MCP-specific runtime execution paths
MCP-specific result models
MCP-specific execution events
MCP gateway functionality
multi-server routing
dynamic MCP server installation
authentication federation
OAuth architecture
secret management
approval or HITL workflows
schema redaction
MCP resource support
MCP prompt support
enterprise policy architecture
These may be considered separately after the interoperability boundary has been proven.
Consequences
MCP remains replaceable infrastructure rather than becoming part of Veil's core architecture.
External MCP ecosystems can be consumed without changing Veil's execution model.
Veil-native capabilities can eventually be exposed to MCP clients without creating an alternative runtime.
The architecture can be validated against a real external interoperability standard.
Positioning
MCP connects tools. Veil governs execution across those tools.

## Validation Result

Phase 1 interoperability has been successfully validated.

### Inbound proof

Confirmed:

```text
MCP Client
   ↓
McpAdapter
   ↓
ExecutionPlan
   ↓
OperatorRuntime
   ↓
Native Capability
   ↓
Standard Veil result/event lifecycle