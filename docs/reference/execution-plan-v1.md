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

ExecutionPlan v1 is the currently supported plan protocol. Supply exactly the string '1.0'. Admission rejects missing, malformed or unsupported versions with UNSUPPORTED_PLAN_VERSION before Job creation, authorization or invocation. No coercion or fallback is performed. The TypeScript field remains string; runtime admission enforces support. Future versions may define different semantics, but none are defined here. See [version admission](../architecture/execution-plan-version-admission.html).

## Properties

steps is required and must be nonempty at execution. id is accepted but not stored in the current Job model. goal is trimmed for the Job; blank/missing becomes External execution plan. metadata is accepted but not used by the job manager. idempotencyKey is recorded on the job; the step key is copied to the JobStep. Neither key currently deduplicates execution. reason is copied with the step but does not alter runtime policy.

capability must resolve to a registered capability. capabilityVersion, when present, must equal that capability's registered version exactly. input may be any value, but declared input schema fields are checked. An omitted input is treated as an empty record for input-schema validation.

In **v0.2.0**, step IDs MUST be unique within a single plan, using exact-string equality. Each ID identifies exactly one execution step in that plan. IDs may be reused across different plans. Case and whitespace differences remain distinct; validation performs no trimming, case folding, or Unicode normalization. Every occurrence after the first produces `Duplicate step ID: <id>` and rejects admission before job creation.

## Structural ownership at submission (v0.2.0)

JobManager.executePlan first reads version once and requires '1.0'. For supported
plans, synchronously before the empty-plan
check, validation, job creation, or any await, Veil captures goal, the plan
idempotency key, and an independent steps array preserving membership, order and
holes. Each present step becomes a runtime-owned shallow record of id,
capability, capabilityVersion, input root binding, reason and idempotencyKey.
Admission and job materialization consume the same captured envelope. Replacing
caller steps, changing their structural fields, or assigning a different
step.input after capture cannot change submitted execution. Plan id and metadata
are not consumed by this capture; version is consumed by the preceding admission gate.

This does not make plans or inputs generally immutable. Nested input contents
remain shared: changing input.value, an array element, or a reference object's
$ref can remain visible until resolution. Exact input values validated at
admission are not guaranteed stable. Result identity and mutability are unchanged;
stored-job execution and replay are outside this boundary.

Capture reads named fields, including inherited/non-enumerable fields, and may
invoke getters or proxy traps. It does not mutate or freeze caller objects.
Null-prototype, frozen and sealed objects work with these reads. Sparse arrays
remain sparse and fail admission before effects; they are not compacted.
Throwing capture accessors reject before job creation. Getter/trap side effects
during capture are not isolated or atomic: this is not a hostile-JavaScript
sandbox. Each consumed field is read once, and no caller structural fields are
reread after capture. Unlike the previous step spread, named capture retains
inherited/non-enumerable consumed step fields and does not retain extra fields.
Optional captured fields may be present with undefined values.

## References and ordering

A reference object is exactly { $ref: 'steps.<earlier-step-id>.result' } with optional dot-separated result path. At the JavaScript boundary it must have exactly one own key across enumerable, nonenumerable and symbol keys: an enumerable own `$ref` data property containing a primitive string. Descriptor writability/configurability and prototype identity are irrelevant; arrays, accessors, inherited `$ref` and additional own keys do not qualify. Proxies are not rejected and their reflection traps may run. All references in objects and arrays are discovered during validation and must name an earlier declared step. Steps execute in literal list order. At execution, only prior completed job steps are eligible.

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

Admission failure throws before job creation. After creation, a missing path, failed source, invalid resolved input, denial, authorizer error, or capability error produces a failed job and stops following steps. v0.2.0 implements no DAG/dependency graph, parallelism, conditional execution, retries, cancellation, or plan-level idempotency enforcement. No roadmap syntax is defined.
