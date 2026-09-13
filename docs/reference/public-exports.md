---
title: Public exports
---
# Public exports

This page is generated from the root src/index.ts and package root export for v0.1.3.

## Runtime values

- OperatorRuntime"È›y¯ßy‘ public execution faÁade; construct it with optional authorizer.
- operatorRuntime"È›y¯ßy‘ default OperatorRuntime instance.
- McpAdapter+ßuÁ‚ùÁT inbound MCP adapter that maps exposed tools to governed one-step plans.

## Runtime and planning types

- ExecutePlanOptions, RunJobOptions, OperatorRuntimeOptions ∫w^~)ﬁt options for runtime construction and calls.
- ExecutionPlan, ExecutionStep, ResultReference"È›y¯ßy‘ plan and reference contracts.
- Planner, PlannerContext+ßuÁ‚ùÁT minimal planner contract and prior-job context shape.
- ExecutionCaller, ExecutionContext"È›y¯ßy‘ caller snapshot and capability execution context.

## Capability and module types

- Capability, CapabilityInputField, CapabilityRisk+ßuÁ‚ùÁT operation contract, field descriptors, and read/write/destructive classification.
- CapabilityModule, CapabilityModuleManifest+ßuÁ‚ùÁT module packaging and manifest metadata.

## Authorization types

- ExecutionAuthorizer"È›y¯ßy‘ async authorization contract.
- CapabilityAuthorizationContext, CapabilityAuthorizationDecision ∫w^~)ﬁt authorizer input and allow/deny result.

## Job and observation types

- Job, JobOutcome, JobStep, JobStepStatus, JobStatus, JobEvent, RuntimeEvent ∫w^~)ﬁt execution history and event types.

## SDK exports

The root re-exports everything from sdk/index. The SDK's public capability-authoring surface includes createCapability, capability definition/execution/middleware/next types, LifecycleLoggingMiddleware, and TimeoutMiddleware. createCapability builds a Capability with optional lifecycle logging, timeout, and middleware chain.

## Non-exports

Planner/router registries and strategies, capability registry, job manager/store, reference resolver, event buses, built-in providers/capabilities, storage/logging implementations, and outbound MCP helpers are not root exports. Do not import them through source or build paths.

Minimal usage: import { OperatorRuntime, createCapability } from '@veil-runtime/core'; then use a module, submit a plan, and inspect the returned Job.
