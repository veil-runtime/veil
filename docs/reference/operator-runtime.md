---
title: OperatorRuntime
---
# OperatorRuntime

## Construction

new OperatorRuntime(options?) accepts optional { authorizer?: ExecutionAuthorizer }. Without one, defaultExecutionAuthorizer allows read capability risk and denies write/destructive. operatorRuntime is a module-level default instance.

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
