---
title: OperatorRuntime
---
# OperatorRuntime

The [v0.6.0 unified development specification](../release/v0.6.0-development.md)
records integrated lifecycle guarantees, governance review and qualification limits.

## Construction

`new OperatorRuntime(options?)` accepts:

```ts
interface OperatorRuntimeOptions {
  readonly authorizer?: ExecutionAuthorizer;
  readonly planVersions?: readonly string[];
  readonly maxPlanSteps?: number;
  readonly maxActiveExecutions?: number;
}
```

Without an authorizer, `defaultExecutionAuthorizer` allows read capability risk
and denies write/destructive. `operatorRuntime` is a module-level default instance.

`planVersions` is trusted host admission policy. Veil currently implements exact
versions `1.0` and `2.0`. Omission defaults to `['1.0']`; V2 is never enabled by a
plan, caller or model field. `['2.0']` creates a V2-only boundary, while
`['1.0', '2.0']` deliberately admits both semantics. The list must be nonempty,
contain only implemented versions and contain no duplicates. Invalid constructor
configuration throws.

At submission, a version that is not implemented or not enabled rejects with
`UNSUPPORTED_PLAN_VERSION` before structural capture, Job creation, authorization
or invocation. There is no automatic upgrade, downgrade or fallback. See the
[V1](execution-plan-v1.html) and [V2](execution-plan-v2.html) contracts.

## Admission and capacity limits (v0.6.0 development)

`maxPlanSteps` and `maxActiveExecutions` are optional trusted host construction
options. Both accept nonnegative safe integers, including zero; negative,
fractional, nonfinite, unsafe and non-number values throw at construction.
`undefined` leaves the corresponding limit unconfigured. Options are captured
at construction; plan fields, metadata and per-call options cannot override them.

`maxPlanSteps` bounds the captured step-array length, including sparse holes.
After version admission, an oversized array rejects before element traversal,
structural copying, input validation, Job creation, authorization or capability
invocation. Zero rejects every nonempty plan; empty plans retain their existing
admission diagnostic. Sparse arrays within the limit retain existing malformed
plan behavior. The limit does not bound nested input size or traversal cost.

`maxActiveExecutions` bounds reservations on this `OperatorRuntime` instance.
`executePlan` checks and reserves synchronously before reading the plan or caller
and before creating a supervision scope. A full runtime rejects immediately,
without a queue, Job or execution events. Zero rejects every submission.
Capacity rejection takes precedence over plan validation, cancellation and timeout
validation when the instance is full. `run` plans first, then submits to the same
boundary; planning itself does not reserve a slot.

An admitted reservation is held through setup, authorization, capability work and
final persistence. Cancellation/deadline expiry can return a failed Job while
the reservation remains held: it releases only after the submission and **all
actual authorization/capability promises** settle. Fulfillment and rejection both
release ownership; repeated aborts, racing terminal outcomes and late results
cannot double-release or revive a Job. A pre-aborted submission still follows
normal admission and Phase 2 failed-Job semantics when capacity is available.

Limit rejections are ordinary Errors (`Execution plan step limit exceeded` or
`Active execution capacity exceeded`), outside ADR-0012 structured diagnostics.
No new diagnostic code, Job status, result or event shape is introduced. Omitting
the limits preserves unbounded admission/capacity. Capacity alone adds no context
signal and does not enable cancellation or deadlines.

Other runtime instances, processes and services have independent reservations.
Registries, Job storage, event bus and providers may still be shared globally;
these limits cannot establish an aggregate provider, tenant or process budget.
Unsettled work can hold a slot indefinitely. Detached provider work outside a
returned promise is not observable. Hosts need their own shared admission policy
for cross-instance guarantees. Cancellation does not roll back or guarantee
termination of external effects. See the [Phase 3 review](../release/v0.6.0-phase3.md).

## Public methods

use(module) checks that every supplied module capability name appears in module.manifest.capabilities, then globally registers each capability. executePlan(plan, { caller? }) validates and runs a direct plan. run(goal, { planner?, strategy?, caller? }) performs internal routing/strategy planning then executes its plan. getJob(id), listJobs(filter?), listCapabilities(), and listPlanners() are read APIs over internal global services.

## Caller

ExecutePlanOptions and RunJobOptions allow caller with subject, tenant, scopes, and metadata. OperatorRuntime makes a frozen shallow copy; its scopes array and metadata object are copied/frozen too. That snapshot is supplied to authorizer and execution context.

## Cooperative execution supervision (v0.6.0 development)

Both execution option types add `signal?: AbortSignal` and `timeoutMs?: number`.
These are trusted host options, never plan or caller-metadata fields. For example:

```ts
const controller = new AbortController();
const pending = runtime.executePlan(plan, {
  signal: controller.signal,
  timeoutMs: 30_000,
});
// A host event may call controller.abort().
const job = await pending;
```

`timeoutMs` must be an integer from 0 through 2147483647; invalid configuration
rejects before submission work. Its monotonic budget begins when `executePlan`
is entered, including admission and Job setup, and is checked before scheduling
and after awaited work. Zero permits admission but prevents capability entry.
`run` forwards these options after planning; neither option interrupts planning.
Persisting an admitted Job is still awaited and is outside the interruptible wait.
There is no hard bound on response latency when the event loop or storage blocks.

When configured, the capability context has a runtime-owned `signal`. Either host
abort or deadline expiry aborts it. Capabilities must pass it to cooperative
provider APIs themselves. The authorization contract is unchanged; pending
authorization is observed but cannot grant capability entry after a stop.

Admission still runs for a pre-aborted submission. A valid admitted Job terminates
using existing `status: 'failed'`, `outcome: 'failed'` and `job.failed`, with
`error: 'Execution cancelled'` or `'Execution deadline exceeded'`. This phase
does not introduce a new event or use the pre-existing `cancelled` status. If a
step is being authorized or executed, it uses the existing failed-step path;
later steps remain pending. Earlier completed steps retain their results.

The first observed stop reason wins. Late fulfillment/rejection cannot update
runtime lifecycle state or start another step, and rejections are observed.
After successful or failed logical termination, later aborts cannot change that
decision. Logging ownership remains with unsettled capability promises until
settlement, even if the Job has already returned as failed.

Cancellation does not undo completed effects. A timeout is not proof that an
external action did not occur. JavaScript and external effects cannot be forcibly
stopped by this API. A capability that never settles can retain its logger
indefinitely. Detached background work (including work hidden by middleware's
own early-return timeout) is outside the returned capability promise's ownership
boundary. Input/result identity and mutability remain unchanged for V1 and V2;
supervision does not isolate shared values or hostile same-process code.

Omitting both options preserves the existing execution path and omits context
`signal`. There are no retries, rollback or idempotency guarantees. See the
[Phase 2 design and race table](../release/v0.6.0-phase2.md).

## Failure model

executePlan throws for empty or invalid plans before creating a job. Once a valid job starts, execution failures are represented by a Job with status/outcome failed. run may reject earlier for planning/routing failures. use throws if a supplied capability is omitted from its manifest.

## Important scope detail

Authorizers are runtime instance state, so two runtimes sharing a capability can make different decisions. The capability registry and job services are not runtime-instance isolated in this release. Do not assume use creates a private runtime sandbox.

Related: [execution lifecycle](../architecture/execution-lifecycle.html), [authorization](../concepts/authorization.html), [jobs](../concepts/jobs-and-outcomes.html).

## Deterministic capability introspection (v0.2.0)

`listCapabilities(): CapabilityDescriptor[]` returns the process-global registered
inventory in registration order. `describeCapability(name: string, version?: string):
CapabilityDescriptor | undefined` performs exact, case-sensitive name lookup.
Omitting version describes the sole registered implementation. A supplied version
must match exactly, including an empty string; unknown names or mismatches return
`undefined`. Duplicate names are rejected even for different versions.

Both methods return fresh, mutable detached snapshots: the array, descriptors,
input schema records and individual field records can be changed without affecting
registered validation or later calls. Results are not frozen. Later registration
appears in later calls across runtime instances; prior snapshots remain unchanged.
There is no registry replacement, unregister or subscription API.

Descriptors expose only `name`, `version`, `description`, `risk`, and `inputSchema`.
An absent schema is represented as `{}`. This is a limited Veil field contract,
not full JSON Schema or necessarily every requirement imposed by capability code.
Descriptions and schema metadata are passive author-supplied metadata.

**Introspection is not authorization.** Presence exposes registered execution
metadata only. Do not infer permission from risk, registration, module metadata
or provider presence. Neither API calls authorization, executes capabilities,
performs provider I/O or emits execution lifecycle events. Health, provider
readiness and successful execution are not implied. No execution functions,
middleware, providers, connection settings, environment variables, credentials,
transport configuration or unrelated implementation properties are exposed.

Relevance selection occurs **outside Veil**. For example, an application can use:

```text
inventory
→ application selects capability name(s)
→ exact descriptor lookup
→ external reasoning/tool conversion
→ version-pinned ExecutionPlan
→ normal governed execution
```

```ts
const inventory = runtime.listCapabilities();
const selectedName = applicationSelectsName(inventory);
const descriptor = runtime.describeCapability(selectedName);
if (!descriptor) throw new Error('Capability is not registered');
const input = await externalReasoning(descriptor); // application-owned conversion
const job = await runtime.executePlan({
  version: '1.0',
  steps: [{
    id: 'selected',
    capability: descriptor.name,
    capabilityVersion: descriptor.version,
    input,
  }],
});
```

The selection and reasoning functions above belong to the application, not Veil.
The inbound `McpAdapter` still captures inventory at construction time; later
registration does not update an existing adapter's tools. See
[capability metadata contract](capability-api.html).

## Structured admission diagnostics (ADR-0012)

Import `isPlanAdmissionError` from `@veil-runtime/core`. Apply it to the rejection
caught directly from `await runtime.executePlan(...)`, using the same loaded
package instance. A recognized rejection means this call was rejected at unsupported-version, empty
plan or explicit validation admission, before Job creation, step authorization or
its governed capability invocation sequence. It is not authorization, retry
advice, or a claim that unrelated host code had no effects.

The diagnostic is an ordinary Error (`name === 'Error'`) with compatible legacy
`message`. Its non-enumerable `code` is `PLAN_ADMISSION_REJECTED`; `issues` contains
fixed messages and issue codes with optional captured zero-based `stepIndex` and
schema `field`. Both properties are non-writable/non-configurable. The detached
issue records and array are frozen; the whole Error is not.

Codes: `UNSUPPORTED_PLAN_VERSION`, `EMPTY_PLAN`, `DUPLICATE_STEP_ID`, `UNKNOWN_CAPABILITY`,
`CAPABILITY_VERSION_MISMATCH`, `REQUIRED_INPUT_MISSING`, `INPUT_TYPE_MISMATCH`,
`UNSUPPORTED_INPUT_SCHEMA`, `INVALID_RESULT_REFERENCE`,
`RESULT_REFERENCE_NOT_EARLIER`.

```ts
import { isPlanAdmissionError } from '@veil-runtime/core';

try {
  await runtime.executePlan(plan, { caller: trustedHostCaller });
} catch (error) {
  if (!isPlanAdmissionError(error)) throw error;
  // Host must still filter schema fields against the caller's exposed surface.
  const feedback = {
    code: error.code,
    issues: error.issues.map(({ code, message, stepIndex }) => ({ code, message, stepIndex })),
  };
  sendHostFeedback(feedback);
}
```

Never serialize the whole Error or automatically disclose legacy `message`, stack
or cause. Fixed issue messages are sanitized; legacy messages may contain submitted
identifiers/references. JSON feedback is trusted through the adapter/transport,
not JS branding. Do not classify by public fields or search cause chains.

The predicate tests private issuance identity without inspecting properties. A
lookalike, clone, proxy wrapper or error from another loaded package copy is not
recognized. A genuine diagnostic replayed through another executePlan call is
contained in an unbranded ordinary Error with the original as local cause. Outside
the direct caught-call boundary, predicate success means historical issuance only;
it does not bind an arbitrary object to a submission. This is trusted-runtime
classification, not hostile-process isolation or cryptographic authentication.

Capture, storage and other unexpected exceptions remain ordinary failures;
authorization denial, post-admission resolution and provider failures are not
admission diagnostics. Persistence failures can still reject after invocation.
`run` planning errors precede this boundary and must not be classified as current
submission evidence merely by applying the predicate.
