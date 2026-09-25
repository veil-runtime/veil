---
title: OperatorRuntime
---
# OperatorRuntime

## Construction

`new OperatorRuntime(options?)` accepts:

```ts
interface OperatorRuntimeOptions {
  readonly authorizer?: ExecutionAuthorizer;
  readonly planVersions?: readonly string[];
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

## Public methods

use(module) checks that every supplied module capability name appears in module.manifest.capabilities, then globally registers each capability. executePlan(plan, { caller? }) validates and runs a direct plan. run(goal, { planner?, strategy?, caller? }) performs internal routing/strategy planning then executes its plan. getJob(id), listJobs(filter?), listCapabilities(), and listPlanners() are read APIs over internal global services.

## Caller

ExecutePlanOptions and RunJobOptions allow caller with subject, tenant, scopes, and metadata. OperatorRuntime makes a frozen shallow copy; its scopes array and metadata object are copied/frozen too. That snapshot is supplied to authorizer and execution context.

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
