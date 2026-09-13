---
title: Reasoning and execution
---
# Reasoning and execution

## What it is

Veil contains planning abstractions and an execution runtime, but treats them as different responsibilities. A Planner has one contract: plan(goal, context?) returns a Promise of ExecutionPlan. The execution runtime receives that plan only after planning is complete.

## Where it fits

An application may call executePlan with its own plan. Alternatively run(goal) asks the default PlannerRouter to select a PlannerStrategy, asks the strategy to execute planners, supplies historical planner context from job memory, and executes the returned plan. Both paths meet at executePlan, so planning does not bypass validation or authorization.

## Why it exists

This arrangement lets deterministic code, people, LLM-backed providers, and other planning systems express work without making them infrastructure executors. Veil includes deterministic and OpenAI-compatible planner implementations internally, but execution has no dependency on a particular model or any model at all.

## Current behavior

The default router selects an explicit requested strategy first. Otherwise, a requested planner selects the router's configured planner strategy; otherwise the router default applies. A direct strategy prefers an eligible requested planner to its configured planner. Fallback strategy attempts configured planners in order and reports failure only when none succeeds. Eligibility currently requires an enabled registered planner definition.

## Failure behavior and limits

Missing default router, unknown selected strategy, ineligible requested planner, or planner/strategy failure rejects run before a job is executed. Planning registries and provider configuration are internal, not root package APIs. Use direct plans in consumers that do not own repository-internal registration.

Related: [planning](planners-strategies-routing.html), [execution lifecycle](../architecture/execution-lifecycle.html), [planner API](../reference/planner-api.html).
