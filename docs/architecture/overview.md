---
title: Architecture overview
---
# Architecture overview

## What Veil owns

Veil owns the contract between requested work and governed execution. Its public entry point is OperatorRuntime. It accepts either an application-produced ExecutionPlan or, through run(goal), a plan produced by Veil's internal planning path.

~~~text
direct application plan ------------------+
                                          v
goal -> PlannerRouter -> PlannerStrategy -> ExecutionPlan
                                          |
                                          v
                                OperatorRuntime
                                          |
                          JobManager / execution loop
                                          |
                         Capability registry lookup
                                          |
                             Capability execution
                                          |
                         Provider / external system
~~~

## Layers and responsibilities

A planner reasons from a goal to a plan. A PlannerRouter chooses a named strategy; a PlannerStrategy orchestrates planner providers. Neither directly executes a capability. ExecutionPlan is the handoff. OperatorRuntime validates plan submission and delegates job execution. The job manager owns the sequential step loop, job state, and events. A capability defines one operation, risk, declared input fields, and execution function. A provider, where a capability uses one, interacts with a local or external system.

## Why the separation exists

The same plan execution rules apply whether a plan came from deterministic code, an LLM-backed planner, or a direct application call. This keeps planner choice replaceable and gives validation and authorization one consistent enforcement point.

## Public versus internal

Consumers import OperatorRuntime, types, createCapability SDK exports, and McpAdapter only from @veil-runtime/core. Registries, job manager, planner registrations, event bus, provider implementations, built-in capabilities, and storage are internal. See [public API boundary](public-api-boundary.html).

## Determinism and governance

Plans execute in array order, and capability lookup uses registered names and
exact versions when supplied. These rules do not make capability results,
external systems, or reasoning deterministic. Validation checks Veil's declared
field contract; authorization applies the host's policy before invocation.
Veil is an execution runtime, not an autonomous reasoning engine, semantic tool
router, LLM provider abstraction, or general workflow platform.

See [v0.3.0](../getting-started/v0.3.0.html) for the candidate's opt-in V2,
admission and execution hardening, compatibility notes and limits. Introspection
describes registered metadata; applications select relevant capabilities, and
authorization remains separate.

## Current limits

The registry is process-global, plan execution is linear, and the public package has no provider SDK or planner-registration API. See [execution lifecycle](execution-lifecycle.html) and [extension model](extension-model.html).
