---
title: Execution lifecycle
---
# Execution lifecycle

This page describes the current execution path. A caller can begin with a direct
plan or ask the runtime to plan a goal. ExecutionPlan V1 is the default; V2
requires explicit trusted-host opt-in. See [V1](../reference/execution-plan-v1.html)
and [V2](../reference/execution-plan-v2.html).

## Entry points

~~~text
application ExecutionPlan -> executePlan(plan, { caller? })
goal -> run(goal, { planner?, strategy?, caller? })
     -> default PlannerRouter -> selected PlannerStrategy -> planner provider
     -> executePlan(plan, { caller? })
~~~

run fails before execution if no default router exists, a selected strategy is missing, or strategy/planner execution rejects. executePlan does not require a planner.

## Plan admission

`OperatorRuntime` passes the plan, a shallow-frozen caller snapshot and its copied
trusted-host version allowlist to the internal job manager. The manager reads the
plan version once and rejects unsupported or host-disabled versions before any
other plan field, structural capture, Job creation, authorization or invocation.

For an admitted version, before any await, the manager synchronously captures the
consumed goal/key and step structure into runtime-owned records, including each
input root binding. The captured array preserves membership, order and holes. An
empty captured step list throws. The plan validator then checks each captured
step: capability existence, supplied capability-version equality, declared
required/type fields, unique step IDs, and reference grammar/order. Invalid plans
throw before a Job is created.

## Job creation

The manager creates a Job with the trimmed captured goal or External execution plan, materializes the same captured steps as pending with creation timestamps, records the captured plan idempotency key, and stores the job. The plan's optional ID and metadata are not copied into the Job model. Job creation emits job.created; execution then changes status to executing and emits execution.started.

Caller structural mutation after capture cannot alter admission or materialization, including while job creation is pending. Nested input contents remain shared until existing resolution behavior copies/resolves them; admission does not guarantee stable exact input values. Results retain existing identity/mutability semantics. Stored-job execution and replay are outside this submission decision.

## Each step, in exact order

For every step in its array position, the runtime finds the capability in the
global registry. A missing capability fails the Job. It collects earlier Job
steps only and resolves all result-reference objects recursively. V1 then
validates the resolved input directly. V2 first performs governed capture of the
complete resolved value and validates that private captured representation. A
capture/domain or resolved-input validation error fails the step before
authorization.

The runtime next calls the configured `ExecutionAuthorizer` with Job/step IDs,
capability name/version/risk, input, and caller. V1 supplies the legacy resolved
input. V2 supplies a detached recursively frozen authorization copy derived from
the private capture. A deny marks the step failed, records `capability.denied`,
and fails the Job. An authorizer exception also fails the Job without a
capability-start event.

The authorization result must be a non-null, non-array object with a valid own
`decision` property. Malformed decisions fail closed. For V2, only after explicit
allow does Veil construct the detached mutable capability-entry copy. Copy failure
uses the existing failed-step/failed-Job path without marking the step running or
emitting `capability.started`. Veil then marks the step running, emits
`capability.started`, constructs execution context, and calls
`capability.execute`. V1 keeps its historical order and shared resolved input.
Success records result, completion time and `capability.completed`. Any execution
error records `capability.failed` and ends the Job; later steps are not run.

The V2 receiving-value sequence is:

```text
resolution → governed capture → validation → immutable authorization copy
→ explicit allow → detached capability copy → running/start → capability entry
```

V2 guarantees stability of the authorization view and structural equivalence at
outer capability entry for the governed representation. V1 does not. Neither
version guarantees that middleware/provider operations or external effects remain
equivalent to the authorized value. See [trust boundaries](trust-boundaries.html).

## Completion

On success the job outcome is success. Its result is the sole result for a one-step plan, or the ordered array of results for a multi-step plan. It emits job.completed and persists. On any failure outcome/status become failed, the error is recorded, job.failed is emitted, and the job persists.

## Boundaries and guarantees

Only `OperatorRuntime` is public. Planning, job manager, registry, governed-value
machinery and event bus are internal. Tests verify version admission,
earlier-result resolution, invalid-resolved-input skipping authorization/execution,
default denial preventing starts, V2 copy-before-start ordering, and authorizer
exceptions failing closed. The lifecycle is sequential; it is not a DAG scheduler.

Related: [trust boundaries](trust-boundaries.html), [plans](../reference/execution-plan-v1.html), [jobs](../concepts/jobs-and-outcomes.html).
