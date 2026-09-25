---
title: Veil developer documentation
---
# Veil developer documentation

Veil is a governed, capability-driven execution runtime. It separates deciding what should happen from performing it. A human, application, deterministic program, or planner can produce an ExecutionPlan; Veil validates and executes that plan through registered capabilities.

## v0.2.0 release candidate

These docs describe the **v0.2.0 release candidate**. v0.1.3 remains the latest
published package until publication. Read [v0.2.0](getting-started/v0.2.0.html)
for governed-execution hardening, deterministic capability introspection, and their limits.

## The mental model

~~~text
Reasoning / application
          |
     ExecutionPlan
          |
    OperatorRuntime
          |
validate plan -> create job -> for each step in order:
resolve prior result -> validate resolved input -> authorize -> execute capability
          |
 capability -> provider -> external system
          |
 job result, job events, runtime events
~~~

The boundary matters. A plan requests work; it is not permission. A registered capability is executable work available to the process; it is not permission either. The runtime authorizer evaluates the actual resolved input before Veil starts the capability.

## New to Veil

Start with [overview](getting-started/overview.html), [installation](getting-started/installation.html), then build a [first capability](getting-started/first-capability.html), [plan](getting-started/first-plan.html), and [runtime](getting-started/first-runtime.html).

## Using Veil

If your application already knows the work, submit an [ExecutionPlan](concepts/execution-plans.html) to [OperatorRuntime](reference/operator-runtime.html). V1 remains the default; use the [V2 reference](reference/execution-plan-v2.html) and [migration guide](guides/migrate-to-execution-plan-v2.html) for opt-in governed receiving values. For multiple dependent operations, read [result references](concepts/result-references.html). Before allowing writes, implement [runtime-scoped authorization](guides/protect-write-actions.html).

## Understanding Veil

Read [reasoning and execution](concepts/reasoning-and-execution.html), the canonical [execution lifecycle](architecture/execution-lifecycle.html), and [trust boundaries](architecture/trust-boundaries.html). Then learn the distinct roles of [capabilities](concepts/capabilities.html), [modules](concepts/capability-modules.html), and [providers](concepts/providers.html).

## Extending Veil

The supported consumer surface is documented in [public exports](reference/public-exports.html). Build capabilities and modules; use an authorizer; create plans directly. [MCP inbound](guides/inbound-mcp.html) exposes registered work through the same governed path. Planner implementation and outbound MCP integration APIs are internal in v0.2.0.

## Reference and contributing

Use [ExecutionPlan V1](reference/execution-plan-v1.html), [ExecutionPlan V2](reference/execution-plan-v2.html), [authorization API](reference/authorization-api.html), [job model](reference/job-model.html), and [planner API](reference/planner-api.html). Contributors should read [development setup](contributing/development-setup.html), [testing](contributing/testing.html), [package verification](contributing/package-verification.html), and [architecture rules](contributing/architecture-rules.html).

## Current limits

v0.2.0 runs a plan's steps sequentially. It has no ExecutionPlan syntax or runtime implementation for DAGs, parallel work, conditionals, retries, cancellation, or idempotency enforcement. Plan and step idempotency keys are recorded, not enforced.
