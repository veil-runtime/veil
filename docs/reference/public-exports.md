---
title: Public exports
---
# Public exports

This page summarizes the root src/index.ts and package root export for v0.1.3 plus unreleased v0.1.4 introspection.

## Runtime values

- OperatorRuntime: public execution facade; construct it with an optional authorizer.
- operatorRuntime: default OperatorRuntime instance.
- McpAdapter: inbound MCP adapter that maps exposed tools to governed one-step plans.

## Runtime and planning types

- ExecutePlanOptions, RunJobOptions, OperatorRuntimeOptions: options for runtime construction and calls.
- ExecutionPlan, ExecutionStep, ResultReference: plan and reference contracts.
- Planner, PlannerContext: minimal planner contract and prior-job context shape.
- ExecutionCaller, ExecutionContext: caller snapshot and capability execution context.

## Capability and module types

- Capability, CapabilityInputField, CapabilityRisk: operation contract, field descriptors, and read/write/destructive classification.
- CapabilityDescriptor: detached mutable execution metadata returned by listCapabilities and exact describeCapability; introspection is not authorization.
- CapabilityModule, CapabilityModuleManifest: module packaging and manifest metadata.

## Authorization types

- ExecutionAuthorizer: async authorization contract.
- CapabilityAuthorizationContext, CapabilityAuthorizationDecision: authorizer input and allow/deny result.

## Job and observation types

- Job, JobOutcome, JobStep, JobStepStatus, JobStatus, JobEvent, RuntimeEvent: execution history and event types.

## SDK exports

The root re-exports everything from sdk/index. The SDK's public capability-authoring surface includes createCapability, capability definition/execution/middleware/next types, LifecycleLoggingMiddleware, and TimeoutMiddleware. createCapability builds a Capability with optional lifecycle logging, timeout, and middleware chain.

## Non-exports

Planner/router registries and strategies, capability registry, job manager/store, reference resolver, event buses, built-in providers/capabilities, storage/logging implementations, and outbound MCP helpers are not root exports. Do not import them through source or build paths.

Minimal usage: import { OperatorRuntime, createCapability } from '@veil-runtime/core'; then use a module, submit a plan, and inspect the returned Job.
