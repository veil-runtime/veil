---
title: Trust boundaries
---
# Trust boundaries

## The boundary

Veil distinguishes intent from authority. Reasoning produces requested work. An ExecutionPlan represents structured requested work. OperatorRuntime decides whether registered capability work may start for each resolved step.

~~~text
planner/application intent
        -> requested plan
        -> runtime-owned structural envelope
        -> plan validation
        -> resolved input
        -> authorization decision
        -> capability execution
        -> provider interaction
~~~

## What is not authority

Planner output is not permission: a planner returns a plan, and planning failure never gives it access to providers. Capability registration is not permission: registration only makes a capability resolvable in the process. The default authorizer still denies write and destructive risk.

## Trusted host code is not authorization

Veil governs whether proposed capability work may start; it does not isolate
arbitrary hostile JavaScript inside the host process. Installed capability,
middleware and provider implementations execute as trusted host code unless a
separate documented isolation mechanism says otherwise. “Trusted” here describes
code/process placement, not permission ownership: these components do not authorize
themselves. The configured host authorizer remains the authority for each governed
capability invocation.

A capability or provider can return a live in-process JavaScript graph containing
accessors, Proxies, aliases or custom prototypes. When a later step selects
`steps.<stepId>.result.<path>`, own getters and Proxy reflection/read traps may run
before receiving-step validation, authorization and ADR-0011 governed capture. Such
code can mutate host/producer state, throw or reenter a runtime using a handle it
already retained. Traversal supplies no caller, scopes, capability or provider
authority; a reentrant submission still has its own admission and authorization.
A traversal failure prevents the receiving capability from starting, but does not
roll back behavior that already occurred.

Model-authored or otherwise serialized JSON does not itself encode executable
JavaScript accessors, Proxies or closures. An in-process host integration must
introduce an active value. Memory storage retains live graphs. SQLite does not
serialize/reload newly produced results between active steps; a later JSON reload
can yield lossy ordinary data, while serialization may itself invoke behavior.
Materialization is therefore not a security/isolation guarantee or a promise of
stable committed results. See the
[pre-capture result-reference investigation](pre-capture-result-reference-boundary.html)
for the detailed evidence and alternatives.

## Structural ownership

Before admission, JobManager.executePlan synchronously captures a runtime-owned
structural execution envelope: goal, plan key, ordered step membership and the
consumed step fields, including input root bindings. Validation and job
materialization use that same envelope without rereading caller structure.
Caller structural mutations after capture cannot redirect admitted execution.
Capture may invoke getters/proxy traps; it is not an atomic snapshot of hostile
JavaScript objects. Caller objects are neither mutated nor frozen.

Nested input contents, arrays and reference objects intentionally remain shared;
exact values validated at admission may change before resolution. Result
ownership and mutability are unchanged. This boundary does not cover stored-job
execution/replay, registry mutation, or authorization-to-invocation mutation.
See the [ExecutionPlan reference](../reference/execution-plan-v1.html).

## Two validation points

At plan admission, Veil validates known capability, requested version, declared field requirements/types, and reference ordering. A reference object is allowed at this point because its value is not available yet. Immediately before a step, Veil resolves references from completed earlier steps and validates the actual input again. This prevents a reference that resolves to a wrong type from reaching either authorization or the capability.

## Authorization sees the real request

ExecutionAuthorizer receives capability identity/risk, job ID, step ID, shallow-frozen caller, and fully resolved input. This lets a policy decide on properties such as target environment or generated identifier instead of trusting plan text. A denied action records capability.denied and never emits capability.started. Tests also show an authorizer exception fails the job before capability execution.

## Core-hardening cycle closure (2026-09-17)

The following scoped guarantees are **v0.2.0 work**, established in `develop` at
`d671669afd8d63319aeb70c3fe4daf5dae73b57c`:

- **Observer failure isolation:** MemoryEventBus contains synchronous subscriber
  throws and asynchronous rejections, continues delivery to other subscribers,
  and does not turn those failures into execution failures. Publication still
  awaits subscribers; this is not observer timeout or mutation isolation.
- **Explicit/owned authorization:** execution requires a non-null, non-array
  object with an own `decision` property, read once, equal to `allow`. A valid
  `deny` prevents execution; malformed decisions and authorizer failures fail
  closed. Denial reasons, if present, must be strings; reason ownership is not
  required. Authorizers are runtime-scoped, with the default allowing reads and
  denying writes/destructive work. This owns the decision boundary, not the
  authorized input values.
- **Owned result-reference traversal:** every result-path segment must be an own
  property of the current object. Inherited properties are rejected. Own special
  names remain legitimate data; own getters and proxy traps may run. Returned
  objects retain identity and mutability: traversal is not value isolation.
- **Plan-local unique step identity:** admission rejects duplicate step IDs by
  exact-string equality before job creation, persistence, runtime lifecycle
  events, authorization or invocation. IDs may be reused in separate plans.
  See [plan-local step identity](../reference/execution-plan-v1.html#properties).
- **Structural execution ownership:** synchronous capture at the start of
  JobManager.executePlan owns consumed plan/step structure and input root
  bindings for admission and materialization. Subsequent caller structural
  mutation cannot redirect execution. Nested input/reference contents remain
  shared; stored-job execution/replay is outside this guarantee.
  See [structural ownership](../reference/execution-plan-v1.html#structural-ownership-at-submission-v020).

Evidence: `test/memory-event-bus.test.ts`, `test/execution-contract.test.ts`,
`test/result-reference.test.ts`, `test/plan-validator.test.ts` and
`test/structural-ownership.test.ts`, alongside their runtime implementations.
These were scoped guarantees of the governed path. The later
[entry hardening](governance-hardening.html) migrates LinkedIn status and retires
stored-job execution; it does not expand the value-ownership guarantees.

## Invocation-value ownership: accepted v2 boundary

On 2026-09-24 the maintainer accepted
[ADR-0011](../adr/0011-governed-value-ownership.html). For a new explicit plan
semantic version, it requires capture after resolution and before validation,
an immutable authorization input, and a detached structurally equivalent value
at outer capability entry after explicit allow. Unsupported resolved values
fail closed. Existing ExecutionPlan `1.0` semantics must not be silently changed.
The limited amendment to ADR-0008's reference-identity preservation applies only
to the new semantic version; its structural ownership requirement remains intact.

ExecutionPlan `2.0`, when explicitly enabled by the trusted host, now applies
the sequence below. ExecutionPlan `1.0` retains its historical behavior.

The accepted future sequence is:

~~~text
existing resolution → governed capture → validation of captured input
→ immutable authorization view → explicit allow
→ detached equivalent capability-entry value
~~~

The guarantee starts after resolution. Existing getter/Proxy execution during
admission and reference traversal is not removed by this decision. Middleware
and capability code remain responsible for post-entry input use and provider
translation. Provider-operation/external-effect equivalence, committed-result
stability, storage parity, exactly-once execution and whole-context ownership
remain outside the guarantee. Experiment II's frozen passive fixture does not
prove these ownership properties.

See the [implementation-readiness investigation](governed-value-implementation-readiness.html)
for the migration and test basis. The boundary begins after existing resolution;
getter/Proxy-free `$ref` traversal, provider translation and persisted-result
stability remain separate trust boundaries. Governed capture owns the value that
resolution returned; it does not retroactively govern behavior used to select that
value. See the
[pre-capture boundary investigation](pre-capture-result-reference-boundary.html).

## Provider boundary

A provider is downstream code used by a capability to talk to a remote system.
Veil's runtime governance occurs before the capability starts; it does not prove
that provider credentials are correct, that an external API will honor a request,
or that provider code is safe. Provider code runs inside the trusted host boundary,
but does not own Veil's authorization decision. Capability authors and applications
remain responsible for provider-specific security, secrets and passive result
normalization where their deployment requires it.

## Limits

Caller freezing is shallow: caller, scopes, and metadata are frozen copies, but nested metadata values are not deep-frozen. The current input schema is a small field validator, not general JSON Schema. See [authorization](../concepts/authorization.html) and [result references](../concepts/result-references.html).

## Governed HTTP capability execution

`POST /api/capabilities/:name/execute` accepts `{ "input": ... }`, constructs a
version-`1.0` single-step ExecutionPlan, and executes it through OperatorRuntime.
A successful response remains `{ capability, risk, result }`; an unknown
capability retains its `404` response. Invalid declared input returns `400`
before authorization or capability execution. The adapter recognizes the
runtime's existing plan-validation error prefix; no new error contract is added.

The legacy `approved` request field is ignored. In particular, `approved: true`
no longer permits write or destructive execution. Reads are permitted by the
default runtime authorizer; writes and destructive actions are denied. Hosts can
supply an OperatorRuntime with an ExecutionAuthorizer through the internal route
registration options (`app.register(executionRoutes, { prefix: '/api', runtime })`).
This is server configuration, not request-supplied policy or an approval workflow.

Admitted plans receive normal job, step and event recording, retrievable through
the runtime's existing job APIs. Authorization denial returns `403`; authorizer
exceptions and capability failures return `500`. These responses contain
`{ capability, risk, error }` from the failed job. A denial is identified by its
`capability.denied` event; it never starts the capability. Authorizer exceptions
also never start it, and follow the runtime's existing failure events. The old
route-specific audit calls are replaced by runtime job/event recording.

Clients relying on `requiresApproval`/`reason` in the old denial response must
migrate to the new error response and host-owned authorization. This migration
originally covered only the generic capability endpoint. Subsequent
[entry hardening](governance-hardening.html) migrates LinkedIn status to a plan,
retires existing-job execution with 410, and removes both legacy allowances.
All three execution route modules now accept trusted host runtime/caller
configuration. The bundled local server remains unauthenticated; request
identity claims are not authority. `http.request` now declares conservative
`destructive` risk for its full method surface and is default-denied even for GET.
See the [governance inventory](../contributing/quality-harness.html).
