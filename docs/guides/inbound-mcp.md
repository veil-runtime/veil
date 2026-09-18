---
title: Inbound MCP
---
# Inbound MCP

`McpAdapter` is a root public export. Construct it with an `OperatorRuntime` after registering modules. At construction it exposes the runtime's then-current capabilities as MCP tools. Each tool call becomes a one-step `ExecutionPlan` and calls `runtime.executePlan`; MCP does not bypass validation, authorization, jobs, or capability execution.

`npm run mcp:stdio` starts the repository stdio server with built-in capabilities. The adapter does not pass MCP caller identity into `executePlan` in v0.2.0, so an authorizer cannot identify an MCP caller through `ExecutionCaller` without an application-owned wrapper.
