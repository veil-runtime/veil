---
title: ExecutionPlan v1
---
# ExecutionPlan v1

## Type shape

~~~ts
interface ExecutionPlan {
  readonly version: string;
  readonly id?: string;
  readonly goal?: string;
  readonly steps: readonly ExecutionStep[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
}
interface ExecutionStep {
  readonly id: string;
  readonly capability: string;
  readonly capabilityVersion?: string;
  readonly input?: unknown;
  readonly reason?: string;
  readonly idempotencyKey?: string;
}
~~~

Use version '1.0' for the current v1 contract. The TypeScript interface itself does not restrict the string, and the current runtime validator does not compare plan.version; documentation uses 1.0 because that is the supported current plan format.

## Properties

steps is required and must be nonempty at execution. id is accepted but not stored in the current Job model. goal is trimmed for the Job; blank/missing becomes"éÝyø§yÜExternal execution planéÝyø§yÝ. metadata is accepted but not used by the job manager. idempotencyKey is recorded on the job; the step key is copied to the JobStep. Neither key currently deduplicates execution. reason is copied with the step but does not alter runtime policy.

capability must resolve to a registered capability. capabilityVersion, when present, must equal that capability's registered version exactly. input may be any value, but declared input schema fields are checked. An omitted input is treated as an empty record for input-schema validation.

## References and ordering

A reference object is exactly { $ref: 'steps.<earlier-step-id>.result' } with optional dot-separated result path. All references in objects and arrays are discovered during validation and must name an earlier declared step. Steps execute in literal list order. At execution, only prior completed job steps are eligible.

## Valid example

~~~ts
{
  version: '1.0',
  goal: 'Create then inspect',
  idempotencyKey: 'request-42',
  steps: [
    { id: 'create', capability: 'orders.create',
      capabilityVersion: '1.0.0', input: { sku: 'book', quantity: 1 } },
    { id: 'inspect', capability: 'orders.read',
      input: { id: { $ref: 'steps.create.result.id' } } },
  ],
}
~~~

## Invalid examples

A missing registered capability or mismatched capabilityVersion rejects plan admission. A reference to steps.inspect.result before inspect appears rejects because it is not earlier. { $ref: 'create.result.id' } is malformed because steps. is absent. A required string field with literal number input rejects at plan validation; a reference resolving to number rejects just before that step and never reaches authorization.

## Failure semantics and limits

Admission failure throws before job creation. After creation, a missing path, failed source, invalid resolved input, denial, authorizer error, or capability error produces a failed job and stops following steps. v0.1.3 implements no DAG/dependency graph, parallelism, conditional execution, retries, cancellation, or plan-level idempotency enforcement. No roadmap syntax is defined.
