---
title: Execution plans
---
# Execution plans

## What it is

ExecutionPlan is the explicit handoff from reasoning to governed execution. Its current TypeScript shape has a version, a nonempty readonly step list, and optional id, goal, metadata, and idempotencyKey. A step has id, capability, optional capabilityVersion/input/reason/idempotencyKey.

## How Veil uses it

`OperatorRuntime` first admits the exact plan version enabled by trusted host
configuration. It then captures and validates every step before it creates a job,
turns steps into pending job steps, and executes them in array order. The goal is
stored after trimming; absent/blank goal becomes `External execution plan`. On
success `job.result` is one value for one step or an ordered result array for many
steps.

Veil implements two semantic versions:

- `1.0` is the default legacy behavior. Authorization and capability entry use
  the legacy resolved value and may share object identity.
- `2.0` is opt-in through trusted-host `planVersions`. It captures the resolved
  value, validates that capture, gives authorization a frozen detached copy,
  requires explicit allow, constructs a detached capability copy, and only then
  starts the capability.

There is no automatic version upgrade or downgrade. See the [V2
reference](../reference/execution-plan-v2.html) and [migration
guide](../guides/migrate-to-execution-plan-v2.html).

## Validation and failure

The validator resolves capability names against the global registry. If a capabilityVersion is present it must equal the registered version exactly. It checks declared input fields, permits result references initially, and requires a reference to name an earlier step. An invalid plan throws before job creation. Execution-time reference failures, resolved-schema failures, denials, and capability errors produce a failed job.

## What a plan does not do

The runtime records plan and step idempotency keys but does not deduplicate or enforce them. plan.id, metadata, and reason are not execution-control features. v0.2.0 has no dependencies other than earlier result references, no graph/parallel semantics, no conditional branching, retry, or cancellation.

## Example

~~~ts
const plan = {
  version: '1.0',
  goal: 'Create and inspect an order',
  steps: [
    { id: 'create', capability: 'orders.create', input: { sku: 'book', quantity: 1 } },
    { id: 'read', capability: 'orders.read',
      input: { id: { $ref: 'steps.create.result.id' } } },
  ],
};
~~~

See [ExecutionPlan V1](../reference/execution-plan-v1.html), [ExecutionPlan
V2](../reference/execution-plan-v2.html), and [result references](result-references.html).
