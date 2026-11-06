---
title: Veil developer documentation
description: Understand Veil, install published Core 0.6.0 or UI 0.4.2, and explore their independent contracts.
---
# Veil developer documentation

Veil comprises independent tools for governed execution and expressive interfaces. Start with the [ecosystem map](ecosystem.html), the published [Core installation](getting-started/installation.html), or the separate [UI stable release](ui.html). Core and UI can be adopted independently; application code may connect them.

Veil Core is a governed, capability-driven execution runtime. It separates deciding what should happen from performing it. A human, application, deterministic program, or planner can produce an ExecutionPlan; Core validates and executes that plan through registered capabilities. Veil UI independently composes bounded interfaces and emits host-controlled events.

## Published products

**Core 0.6.0** is on [npm](https://www.npmjs.com/package/@veil-runtime/core/v/0.6.0), with a [GitHub Release](https://github.com/veil-runtime/veil/releases/tag/v0.6.0). **UI 0.4.2** is on [npm](https://www.npmjs.com/package/@veil-runtime/ui/v/0.4.2). Read the [UI guide](ui.html) for its independent interface APIs. Core needs no model or UI;
[local planning](guides/local-planning.html) is optional source-server infrastructure.
Emergence and autonomous repository-task applications are separate components.
Linux is the qualified execution platform; Windows and macOS are unqualified.
Local Ollama/Qwen planning is experimental and opt-in.

## Explore Veil UI

[Try the Agent Monitor showcase](showcase/) to follow a deterministic simulated investigation, inspect its actual interface definition and host code, and understand the integration boundary. It runs on published UI 0.4.2 without Core. Start smaller in the [editable playground](playground/).

## Your learning path

1. **What is Veil?** Read the [overview](getting-started/overview.html), or start
   with the [business evaluation guide](getting-started/evaluate.html).
2. **Mental model.** Understand [the boundary between a request and permission](#the-mental-model).
3. **Run in five minutes.** Install `@veil-runtime/core@0.6.0` from npm and run
   [one complete example](getting-started/five-minutes.html), without a model.
4. **Core concepts.** Learn [plans, capabilities and authorization](concepts/reasoning-and-execution.html).
5. **Build.** [Create a capability](guides/build-a-capability.html), compose a module
   and protect write operations.
6. **Architecture.** Review [the execution lifecycle and boundaries](architecture/overview.html).
7. **API reference.** Use [the supported public exports](reference/public-exports.html).

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

Start with [overview](getting-started/overview.html) and
[run Core in five minutes](getting-started/five-minutes.html). For the same example
split into TypeScript files, build a [first capability](getting-started/first-capability.html),
[plan](getting-started/first-plan.html), and [runtime](getting-started/first-runtime.html).

## Using Veil

If your application already knows the work, submit an [ExecutionPlan](concepts/execution-plans.html) to [OperatorRuntime](reference/operator-runtime.html). V1 remains the default; use the [V2 reference](reference/execution-plan-v2.html) and [migration guide](guides/migrate-to-execution-plan-v2.html) for opt-in governed receiving values. For multiple dependent operations, read [result references](concepts/result-references.html). Before allowing writes, implement [runtime-scoped authorization](guides/protect-write-actions.html).

## Understanding Veil

Read [reasoning and execution](concepts/reasoning-and-execution.html), the canonical [execution lifecycle](architecture/execution-lifecycle.html), and [trust boundaries](architecture/trust-boundaries.html). Then learn the distinct roles of [capabilities](concepts/capabilities.html), [modules](concepts/capability-modules.html), and [providers](concepts/providers.html).

## Extending Veil

The Core consumer surface is documented in [public exports](reference/public-exports.html). Build capabilities and modules; use an authorizer; create plans directly. [MCP inbound](guides/inbound-mcp.html) exposes registered work through the same governed path. Planner implementation and outbound MCP integration APIs remain internal.

## Reference and contributing

Use [ExecutionPlan V1](reference/execution-plan-v1.html), [ExecutionPlan V2](reference/execution-plan-v2.html), [authorization API](reference/authorization-api.html), [job model](reference/job-model.html), and [planner API](reference/planner-api.html). Contributors should read [development setup](contributing/development-setup.html), [testing](contributing/testing.html), [package verification](contributing/package-verification.html), and [architecture rules](contributing/architecture-rules.html).

## Current limits

Core 0.6.0 runs a plan's steps sequentially. It supports cooperative cancellation, optional deadlines and per-instance bounded capacity. It has no ExecutionPlan syntax for DAGs, parallel work, conditionals or retries, and no idempotency enforcement. Cancellation does not guarantee external operations have stopped or rolled back.

### Explore complete UI integrations

The [interactive integration lab](showcase/lab.html) adds three browser-local examples alongside the [Agent Monitor](showcase/) and [Backend Lab](backend-lab/): authored simulated LLM output, an operations console, and a request workflow. Each offers the live Veil UI interface, its accepted descriptor and state, the actual bundled host source, and the runtime/host boundary. Choose a scenario before generating the LLM descriptor. The examples do not contact a model or operate real infrastructure.

For a first integration, install `@veil-runtime/ui@0.4.2`, define a built-in descriptor, validate it with `validateInterfaceDefinition`, mount with `createMountedInterface`, declare and allowlist each action, and handle emitted events in your host. The [editable playground](playground/) is the smallest starting point. The [Backend Lab](backend-lab/) shows a separate local HTTP service; GitHub Pages runs its browser simulation without a backend.
