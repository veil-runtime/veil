---
title: Execution lifecycle
---
# Execution lifecycle

This page describes the current source execution path, including **unreleased v0.1.4 hardening**. v0.1.3 remains the published package. A caller can begin with a direct plan or ask the runtime to plan a goal. See [release scope](../getting-started/upcoming-v0.1.4.html).

## Entry points

~~~text
application ExecutionPlan -> executePlan(plan, { caller? })
goal -> run(goal, { planner?, strategy?, caller? })
     -> default PlannerRouter -> selected PlannerStrategy -> planner provider
     -> executePlan(plan, { caller? })
~~~

run fails before execution if no default router exists, a selected strategy is missing, or strategy/planner execution rejects. executePlan does not require a planner.

## Plan admission

OperatorRuntime passes the plan and a shallow-frozen caller snapshot to the internal job manager. At the beginning of JobManager.executePlan, before any await or admission check, the manager synchronously captures the consumed goal/key and step structure into runtime-owned records (including each input root binding). The captured array preserves membership, order and holes. An empty captured step list throws. The plan validator then checks each captured step: capability existence, supplied capability-version equality, declared required/type fields, unique step IDs, and reference grammar/order. Invalid plans throw before a job is created.

## Job creation

The manager creates a Job with the trimmed captured goal or External execution plan, materializes the same captured steps as pending with creation timestamps, records the captured plan idempotency key, and stores the job. The plan's optional ID and metadata are not copied into the Job model. Job creation emits job.created; execution then changes status to executing and emits execution.started.

Caller structural mutation after capture cannot alter admission or materialization, including while job creation is pending. Nested input contents remain shared until existing resolution behavior copies/resolves them; admission does not guarantee stable exact input values. Results retain existing identity/mutability semantics. Stored-job execution and replay are outside this submission decision.

## Each step, in exact order

For every step in its array position, the runtime finds the capability in the global registry. A missing capability fails the job. It collects earlier job steps only, resolves all result-reference objects recursively, and validates the resolved input against the capability input schema. A resolved-input validation error fails the step before authorization.

The runtime next calls the configured ExecutionAuthorizer with job/step IDs, capability name/version/risk, resolved input, and caller. A deny marks the step failed, records capability.denied, and fails the job. An authorizer exception also fails the job without a capability-start event.

In unreleased v0.1.4, the result must be a non-null, non-array object with a valid own `decision` property. Malformed decisions fail closed. Only after allow does Veil mark the step running, emit capability.started, construct execution context, and call capability.execute. The capability may then use a provider or perform its own I/O. Success records result, completion time, and capability.completed. Any execution error records capability.failed and ends the job; later steps are not run.

Authorization and invocation share resolved input. Deep value stability between
the approved input and the invoked input is **not guaranteed**; there is no
revalidation after authorization. See [trust boundaries](trust-boundaries.html).

## Completion

On success the job outcome is success. Its result is the sole result for a one-step plan, or the ordered array of results for a multi-step plan. It emits job.completed and persists. On any failure outcome/status become failed, the error is recorded, job.failed is emitted, and the job persists.

## Boundaries and guarantees

Only OperatorRuntime is public. Planning, job manager, registry, and event bus are internal. Tests verify earlier-result resolution, invalid-resolved-input skipping authorization/execution, default denial preventing starts, and authorizer exceptions failing closed. The lifecycle is sequential; it is not a DAG scheduler.

Related: [trust boundaries](trust-boundaries.html), [plans](../reference/execution-plan-v1.html), [jobs](../concepts/jobs-and-outcomes.html).
