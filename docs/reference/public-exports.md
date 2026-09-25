---
title: Public exports
---
# Public exports

This page summarizes the root src/index.ts and package root export for v0.2.0, including capability introspection.

## Runtime values

- OperatorRuntime: public execution facade; construct it with an optional
  authorizer and trusted-host `planVersions` admission policy. Omission remains
  V1-only; V2 requires explicit opt-in.
- operatorRuntime: default OperatorRuntime instance.
- isPlanAdmissionError: identity-based local admission evidence predicate; see [direct-call provenance](operator-runtime.html).
- McpAdapter: inbound MCP adapter that maps exposed tools to governed one-step plans.

## Runtime and planning types

- ExecutePlanOptions, RunJobOptions, OperatorRuntimeOptions: options for runtime
  construction and calls. `OperatorRuntimeOptions.planVersions` accepts a
  nonempty unique subset of implemented versions `1.0` and `2.0`.
- ExecutionPlan, ExecutionStep, ResultReference: plan and reference contracts.
- Planner, PlannerContext: minimal planner contract and prior-job context shape.
- ExecutionCaller, ExecutionContext: caller snapshot and capability execution context.

## Capability and module types

- Capability, CapabilityInputField, CapabilityRisk: operation contract, field descriptors, and read/write/destructive classification.
- CapabilityDescriptor (v0.2.0): detached mutable execution metadata returned by listCapabilities and exact describeCapability; introspection is not authorization.
- CapabilityModule, CapabilityModuleManifest: module packaging and manifest metadata.

## Admission diagnostic types

- PlanAdmissionError: ordinary Error with immutable code/issues; type only, no public constructor.
- PlanAdmissionIssue, PlanAdmissionIssueCode: sanitized issue records and ten admission rejection categories (including plan-version enforcement).

The issuer, ownership context and containment helpers are not root exports.

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

The V2 governed-value capture/copy implementation and its error class remain
internal. Enabling V2 does not add package export paths or expose registries,
stores, providers or validators.
