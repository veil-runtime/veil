---
title: Execution plans
---
# Execution plans

## What it is

ExecutionPlan is the explicit handoff from reasoning to governed execution. Its current TypeScript shape has a version, a nonempty readonly step list, and optional id, goal, metadata, and idempotencyKey. A step has id, capability, optional capabilityVersion/input/reason/idempotencyKey.

## How Veil uses it

executePlan validates every step before it creates a job. It then creates a job, turns steps into pending job steps, and executes them in their array order. The goal is stored after trimming; absent/blank goal becomes"��y��y�External execution plan��y��y�. On success job.result is one value for one step or an ordered result array for many steps.

## Validation and failure

The validator resolves capability names against the global registry. If a capabilityVersion is present it must equal the registered version exactly. It checks declared input fields, permits result references initially, and requires a reference to name an earlier step. An invalid plan throws before job creation. Execution-time reference failures, resolved-schema failures, denials, and capability errors produce a failed job.

## What a plan does not do

The runtime records plan and step idempotency keys but does not deduplicate or enforce them. plan.id, metadata, and reason are not execution-control features. v0.1.3 has no dependencies other than earlier result references, no graph/parallel semantics, no conditional branching, retry, or cancellation.

## Example

~~~ts
const plan = {
  version: '1.0',
  goal: 'Create and inspect an order',
  steps: [
    { id: 'create', capability: 'orders.create', input: { sku: 'book' } },
    { id: 'read', capability: 'orders.read',
      input: { id: { $ref: 'steps.create.result.id' } } },
  ],
};
~~~

See [ExecutionPlan v1](../reference/execution-plan-v1.html) and [result references](result-references.html).
