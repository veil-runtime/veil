---
title: Jobs and outcomes
---
# Jobs and outcomes

## What it is

A Job is the recorded unit of plan execution. It has ID, goal, optional planner/idempotency key, status, timestamps, steps, events, optional result/error, and optional outcome. JobStatus is created, executing, completed, or failed. JobOutcome is success, inconclusive, or failed.

## Lifecycle

executePlan creates the job and job.created event, then moves it to executing and records execution.started. Steps begin pending, then become running, completed, or failed. The first step failure ends the job; later steps remain unexecuted/pending. On success the job outcome is success and result is a scalar for one step or ordered step-result array for many steps.

## Events and persistence

Job events include creation, execution start, capability start/completion/failure/denial, job completion/failure, and internal review. The job manager publishes corresponding runtime events and persists through its internal job store. OperatorRuntime publicly exposes getJob and listJobs; it does not publicly expose job-store configuration or review mutation APIs.

## Planner context

The internal job memory obtains planner context from historical jobs. PlannerContext currently offers previousJobs entries containing goal, status, and capability names. This is planning support, not a promise that every result or event is supplied to a planner.

## Limitations

A job's idempotency key is stored but does not prevent a repeated execution. The current public model has no cancellation, retries, or live progress stream. See [events](events-and-observability.html) and [OperatorRuntime](../reference/operator-runtime.html).
