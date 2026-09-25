# ADR-0012: Structured admission diagnostics

**Status:** Accepted — explicit maintainer approval, 2026-09-23

**Date:** 2026-09-23

**Decision:** Implement the contract below within its stated boundary.

## Subsequent scoped extension

[ExecutionPlan version admission](../architecture/execution-plan-version-admission.html)
explicitly extends this accepted decision with UNSUPPORTED_PLAN_VERSION and a
third pre-Job issuance site. The original nine-code/two-site scope and absence of
plan-version enforcement below record ADR-0012 as approved; the linked decision
is the authority for that later extension. Provenance/ownership and disclosure
rules are unchanged.

## Context and information loss

Veil's public executePlan boundary rejects invalid proposals with ordinary Error
text. Its internal validator already records step/capability/field associations
and multiple issues, then JobManager discards those associations by joining only
messages. Hosts either interpret text or compensate with instrumentation. The
external-reasoner fixture used policy-call counters to classify thrown errors;
this is not a reliable general admission discriminator.

See the [complete failure-path inventory](../architecture/admission-diagnostics-investigation.html)
and [experiment gap analysis](../architecture/external-reasoner-gap-analysis.html).
The problem applies to any SDK/HTTP/CLI host, not specifically AI or reasoning.
ExecutionPlan remains a proposal, and diagnostics are evidence, never permission.

## Scope: explicit rejection before Job creation

Define an admission failure as a runtime rejection at either of the existing
JobManager.executePlan branches:

1. Captured steps are empty.
2. validatePlan returns valid:false for the captured steps.

Both occur before creation of the Job and before authorization or invocation of
any step in this submission. Only these sites may mint the diagnostic.
Do not blanket-wrap failures or classify every thrown Error. The narrow
foreign-diagnostic containment at executePlan described below is the only
provenance-related exception; it does not turn ordinary failures into diagnostics.

This does not introduce a general malformed-plan parser. Structural getters,
Proxy traps, cyclic traversal, unexpected JS errors, caller projection, goal
normalization, router/planner failures and persistence errors remain outside this
contract unless an existing validator already turns a failure into an explicit
validation issue. In particular, unexpected exceptions escaping validation must
not be transformed merely because they occurred before invocation.

No unsupported-plan-version diagnostic is defined: core admission currently does
not check plan.version. No provider-readiness diagnostic is defined: registration
and capability-version matching do not prove provider availability.

Resolution and validation of a receiving step after admission are outside this
contract, even if that particular step has not invoked anything. Earlier steps
may have executed. Same internal validation helpers do not erase this distinction.
Authorization denial, execution/provider failure and transport uncertainty remain
separate existing behaviors; their public protocols are not changed by this ADR.

## Public contract

Keep executePlan's Promise<Job> signature and ordinary rejection ergonomics.
Use ordinary Error objects created by an internal issuer, with a stable
discriminator and immutable, explicitly projected issue records. Export a type
and an identity-based predicate, **not a constructible Error subclass**.
Illustrative public declaration:

```ts
export type PlanAdmissionIssueCode =
  | 'EMPTY_PLAN'
  | 'DUPLICATE_STEP_ID'
  | 'UNKNOWN_CAPABILITY'
  | 'CAPABILITY_VERSION_MISMATCH'
  | 'REQUIRED_INPUT_MISSING'
  | 'INPUT_TYPE_MISMATCH'
  | 'UNSUPPORTED_INPUT_SCHEMA'
  | 'INVALID_RESULT_REFERENCE'
  | 'RESULT_REFERENCE_NOT_EARLIER';

export interface PlanAdmissionIssue {
  readonly code: PlanAdmissionIssueCode;
  readonly message: string;
  readonly stepIndex?: number;
  readonly field?: string;
}

export interface PlanAdmissionError extends Error {
  readonly code: 'PLAN_ADMISSION_REJECTED';
  readonly issues: readonly PlanAdmissionIssue[];
}

export function isPlanAdmissionError(value: unknown): value is PlanAdmissionError;
```

The identifiers below are approved public API. The interface represents the existing explicit rejection,
not a new error/result union. Export the predicate and passive/error types only,
never the issuer, constructor, ownership tokens, brand storage, validators,
registry/store objects or internal exceptions. Consumers have no need to construct
a runtime-issued diagnostic themselves.

- The predicate establishes local issuance; code fields alone do not. After that
  check, issue codes, not either message, drive category selection. No redundant category/phase/outcome/retry flag is needed.
- `issues` is nonempty, detached and recursively immutable over these scalar
  fields. Preserve current issue ordering and multiplicity; do not deduplicate or
  sort. EMPTY_PLAN has a single plan-level issue.
- `stepIndex` is a zero-based position in the captured ordered steps. For normal
  per-step issues it is present. It locates duplicate IDs unambiguously without
  echoing caller-provided IDs. Empty-plan issue omits it. It is not a Job ID.
- `field` is optional and limited to the declared input-schema key already
  associated with input issues. It is not JSON Pointer or a nested/ref path.
  Reference discovery currently retains no consumer field location; do not invent
  one or echo the reference string. Unknown capability/duplicate/version issues
  omit field.
- `issues[].message` is a fixed, human-readable safe explanation determined by
  code. It contains no interpolated input value, ID, capability/version/reference
  string or original exception. Its wording is not a machine contract.
- Preserve legacy `error.message` exactly, including prefix, aggregation order and
  empty-plan text, for local compatibility. It is **not** the redacted issue message
  and is **not safe for automatic external disclosure**.
- Preserve `error.name === 'Error'`. Classification does not depend on a class
  name/stack string. instanceof Error works in the issuing realm. There is no
  runtime PlanAdmissionError constructor or instanceof PlanAdmissionError API.
- Define code/issues as own data properties with enumerable:false, writable:false
  and configurable:false. Copy each issue into a new ordinary record containing
  only the declared primitive fields; freeze every record and the new issues
  array. This prevents record/array edits, deletion, replacement, redefinition
  and prototype changes. No internal validator record or caller graph is retained.
- Immutability covers only code and the specified issue graph, whose leaves are
  strings/numbers. It does not cover the entire Error: legacy message, name and
  stack retain ordinary Error behavior. Do not add toJSON or auto-serialize stack,
  cause, message or internals. Normal JSON.stringify(error) remains `{}` for an
  unmodified issued error. Hosts explicitly project permitted fields.

The declaration is intentionally smaller than the internal error record. Step ID,
capability name and requested version are already in the proposal; registered
version/registry inventory need not be echoed. Expected type can be obtained from
scoped discovery. Codes plus index and field remove the demonstrated ambiguity
without exposing additional input values or a generalized path/schema language.

## Issue meanings and messages

| Code | Existing rejection condition | Safe explanatory message |
| --- | --- | --- |
| EMPTY_PLAN | No captured steps | The plan contains no steps. |
| DUPLICATE_STEP_ID | Step ID already seen within this plan | A step identifier is repeated. |
| UNKNOWN_CAPABILITY | No registered capability for the requested name | The requested capability is not registered. |
| CAPABILITY_VERSION_MISMATCH | Supplied capabilityVersion differs exactly from registered version | The requested capability version does not match. |
| REQUIRED_INPUT_MISSING | Required field undefined, null or empty string | A required input field is missing. |
| INPUT_TYPE_MISMATCH | Existing declared-field predicate fails | An input field has an incompatible type. |
| UNSUPPORTED_INPUT_SCHEMA | No predicate for the declared field type | An input field cannot be validated with the declared schema. |
| INVALID_RESULT_REFERENCE | Admission reference parser rejects the discovered reference | A result reference was not accepted by the admission parser. |
| RESULT_REFERENCE_NOT_EARLIER | Parsed reference does not target an earlier declared step | A result reference must target an earlier declared step. |

UNSUPPORTED_INPUT_SCHEMA is a registration/contract problem, not necessarily a
caller mistake. INVALID_RESULT_REFERENCE covers the existing parser-rejection
validation path; its catch may contain unexpected parser exceptions. The code
states that parsing was not accepted, not that a particular grammar edit will fix
it. Never expose that caught exception as the safe issue message. Exceptions
escaping reference collection/capture are not covered by this catch or diagnostic.

These categories are assigned at their source branches. Do not recover them using
message prefixes, regexes, exception names or caller-supplied codes. Preserve
existing validation conditions: no new step-ID grammar, plan-version checking,
value model, field rules, reference syntax, schema enforcement or authorization.
Future categories require documented extension; consumers should have a
conservative fallback for unrecognized codes across versioned wire projections.

## Certainty and provenance

When Veil issues this error at the specified admission sites, it can state:

> This submission was rejected before its runtime created a Job, called its
> step authorizer, or began any capability invocation for its captured plan.

No provider invocation through a step in that submitted plan occurred. This says
nothing about unrelated or previous submissions, retries, or effects of arbitrary
host code. It is not "nothing happened," "safe to retry," an authorization denial,
or proof of provider-effect absence in the whole process.

ADR-0008 explicitly permits getters/Proxy traps to run during capture/validation.
They can have side effects or reenter runtime submission. run may perform external
planner work before submitting a plan. This ADR does not claim hostile-JavaScript
isolation or undo that behavior. The guarantee concerns the rejected submission's
own governed step-dispatch path, under the trusted runtime/host assumptions.

### Required provenance property

For an immediate caller awaiting **the actual OperatorRuntime.executePlan Promise**,
using the predicate from the same loaded Veil package instance:

> If its directly caught rejection satisfies isPlanAdmissionError, that Error was
> issued at an eligible admission site for this executePlan invocation, not merely
> supplied by an application callback or carried over from another invocation.

Outside that direct-call context, the predicate establishes only that this exact
object was issued by this loaded package at some time. It cannot establish which
Promise a user is associating with it. This distinction is necessary to avoid
turning a reusable Error object into a universal execution receipt.

The guarantee assumes trusted/unmodified runtime code and normal JS intrinsics,
not hostile code with debugger access, module-cache replacement or access to
private implementation imports. Package export restrictions are encapsulation,
not cryptographic protection. Request correlation remains a host responsibility.

### Selected mechanism: ordinary Error + private issuer/WeakMap + call ownership

1. A diagnostic module owns a module-private WeakMap from issued Error identity to
   a private record containing the issuing executePlan token and original legacy
   message. No marker property, Symbol.for key, registry or factory is exported.
2. At each public executePlan entry, before reading caller options or plan fields,
   create a fresh opaque invocation token and a private issuance context. Pass that
   context internally to JobManager admission; do not put it in plan, caller,
   execution context, Job, event or error properties.
3. Only the empty-plan and invalid-validation branches call the internal issuer.
   It constructs a fresh ordinary Error, installs the immutable diagnostic fields,
   then records identity/ownership in the WeakMap. No public constructor or object
   decoration API can register arbitrary application errors.
4. isPlanAdmissionError consults WeakMap membership using identity only. It must
   not read properties, walk prototypes, evaluate getters or invoke Proxy traps.
   Shaped objects, copies, prototype imitations and Proxy wrappers of genuine
   errors return false. Unknown/primitive values return false, not an exception.
5. At executePlan's rejection boundary, an error owned by that call is rethrown
   unchanged. An ordinary unbranded exception is also rethrown unchanged. A genuine
   diagnostic **owned by another call** is contained in a new ordinary, unbranded
   Error. Use the original issuer-recorded legacy message (not a potentially
   modified public getter); retain the original as local cause. Do not copy its
   code/issues or mark the wrapper as admission rejection.

The narrow containment in item 5 is necessary. A WeakSet/WeakMap issuance brand
alone does not suffice: a callback could retain a real diagnostic from call A and
throw it during call B, including from storage after B's step effects. A predicate
would otherwise truthfully identify A's error and misleadingly classify B. The
per-call ownership check prevents that mistake without invalidating A's original
error or altering other concurrent calls. Do not remove membership when an error
is caught; predicates are repeatable observations, not one-use authority tokens.

This is not a public result union, new admission phase, failure taxonomy or
execution authority. The containment exception has no admission code and makes
no effect-certainty claim about call B. Its identity change is an intentional,
limited compatibility consequence for foreign-diagnostic propagation. All
ordinary application exceptions preserve their original identity and behavior.

The check must cover the asynchronous rejection as well as synchronous argument
projection errors; a bare return of an un-awaited internal Promise inside try/catch
would not do so. Do not double-mint diagnostics or classify a nested cause. run's
planner work precedes the executePlan boundary: this predicate is **not** a blanket
provenance guarantee for arbitrary run/planner exceptions. Errors propagated from
the delegated executePlan retain their local issuance identity, but callers of
run must not attribute unrelated planning errors to a submission on that basis.

### Same package, realms and serialization

Membership is per loaded diagnostic-module instance. Both runtime and predicate
must use that same instance. Ordinary object identity passed across a realm can
still be recognized by the issuing predicate without instanceof Error; a copied,
structured-cloned, JSON-round-tripped or Proxy-wrapped error is not recognized.
Another installed copy of Veil cannot recognize the first copy's private map.
Document that limit; do not fall back to code/name/shape matching or a global symbol.
The package consumer test must exercise the supported package entry path.

An application can retain a genuine error and its classification remains true in
isolation. Replaying it as external data proves nothing; the direct boundary and
host request association supply the current-call meaning. A hostile process able
to call private issuer functions or replace runtime modules is outside this claim.
This is reliable runtime classification under the stated boundary, not global
unforgeability, signing or error authentication.

### Adapter boundary: a different provenance claim

A trusted adapter catches the direct executePlan rejection and uses the local
predicate. Only then may it project allowed code/issues into its own serialized
response. It must check the directly caught value, not search cause chains or
accept a diagnostic-shaped object supplied by the request. It owns submission
correlation, visibility, redaction and transport integrity.

After projection, no JS identity/brand exists on the wire. HTTP/MCP/custom clients
trust the adapter/transport's response for their request, **not** an Error class or
reconstructed brand. Clients may validate response shape and switch on documented
codes, but cannot call the local predicate to authenticate received JSON. No
adapter changes or wire protocol are implemented or implicitly approved here.

## Redaction and security rules

| Field / candidate | Rule and exposure assessment |
| --- | --- |
| Top-level code / issue code | Fixed runtime vocabulary; no policy, scopes, credentials or handles. Unknown-capability vs version mismatch reveals registry facts, so hosts still filter surfaces before exposing results |
| Issue message | Static code-specific explanation only; no original exception interpolation |
| stepIndex | Position within this submitted plan only; no cross-job IDs or caller labels |
| field | Declared schema key, not its value. Schema names can themselves be sensitive; host must omit/redact when not part of that caller's exposed contract |
| Legacy Error.message | Preserved compatibility text may echo step IDs, capability names, versions or references; keep local unless explicitly approved for disclosure |
| name / stack | Retain normal JS Error ergonomics; stack/process paths are local diagnostic details, not wire payload |
| stepId, reference/path, actual value, capability identity/version | Omit from new structured payload; caller can correlate its own proposal and scoped descriptor |
| caller, scopes, risk, policy, provider config, cause | Never add; these are not required to explain structural admission rejection |

Do not inspect input values again or invoke toString/toJSON/getters to create the
safe projection. Use branch codes, captured ordinal locations and existing schema
keys. Do not serialize internal validation objects wholesale. This projection
is passive error metadata, not implementation of the governed value migration.

**Disclosure warning:** structured issue messages are sanitized contract data;
legacy error.message is retained for compatibility and may contain information
unsuitable for external disclosure. Adapters adopting this contract must project
permitted structured fields. They must not serialize the entire Error or treat
legacy message, stack or cause as part of the safe diagnostic contract.

Existing adapters' raw message forwarding remains a documented legacy disclosure
concern. This additive ADR cannot simultaneously preserve exact legacy messages
and claim they are redacted. A later host-specific migration may send code/issues
instead; it must be explicit, not an implicit new HTTP/MCP protocol.

Structured feedback remains evidence. None of these fields changes policy,
provides credentials or execution handles, mutates registration, authorizes a new
plan, describes caller scopes, or advises whether a new submission is safe.

## Compatibility assessment

Existing `try { await runtime.executePlan(plan) } catch (error) { ... }` control
flow remains unchanged. Successful execution still returns Job. Known admission
rejections remain Error instances; message and name remain compatible. Default
error JSON enumeration remains unchanged. Using ordinary Error also preserves
`error.constructor === Error` in the issuing realm; stack locations can change.
Adding non-enumerable own properties remains observable through explicit property
inspection. A foreign-call branded diagnostic is the sole new containment case:
it becomes an ordinary Error with the original as local cause, so reference
identity changes for that case. This intentional difference prevents false
current-submission attribution; it does not suppress or relabel the failure.

Duplicate/version tests assert exact message text and must continue passing.
Internal validator tests deeply compare current issue objects. Codes/positions
must be carried internally without changing validation conditions/order; test
expectations for private metadata may need deliberate updates. They are not
permission to relax rejection or lifecycle checks.

The generic HTTP route currently parses the validation-message prefix; preserving
it avoids changing its behavior. Jobs execute-plan currently maps all thrown
errors to 400; this ADR does not silently repair that broader transport mapping.
MCP returns message text/isError. Starter errors are message-based, including a
422 rejected projection. New properties do not automatically cross any of those
boundaries; existing status/body tests remain unchanged. Cross-realm/serialized
Error objects do not preserve instanceof; trusted adapters should explicitly
serialize their permitted diagnostic projection rather than revive Error classes.

No Plan v2, value-model restriction, new Job field or authorization semantic change
is implied. Public exports/error behavior are locked-contract extensions and need
explicit maintainer approval despite this largely additive design. No package
version/release decision is made here.

## Provenance options compared

| Option | Assessment |
| --- | --- |
| A. Public constructible subclass + instanceof | Reject: any application can manufacture the nominal type. TS private constructors alone do not prevent compiled JS construction; constructor extraction through a real error is also possible |
| B. Non-exported constructor / internal factory only | Better encapsulation, but prototype/class checks remain imitable. A constructor is not the issuance record; the factory must record issuance privately |
| C. Private Symbol or equivalent plus predicate | Select identity-based module-private WeakMap rather than an own Symbol: own symbols can be discovered/copied through reflection. Membership avoids inspecting arbitrary error objects. Add per-call ownership/containment for real-error relay |
| D. Public discriminated executePlan result | Could bind a result to the returned Promise but changes Promise<Job>/throw ergonomics and all consumers. Larger than needed |
| E. cause/details marker | Public details/cause shape is imitable and can expose sensitive internals. A private map still needed; no benefit as the classification channel. cause is used only locally for containment, not authority |
| F. Ordinary Error with internal issuance and predicate | Selected together with C: no public constructor, preserves normal Error behavior, adds only the public predicate and passive types. Consumers obtain real cases through runtime tests rather than constructing evidence |

An issuance-only predicate would be adequate for identifying errors historically
created by Veil, but not the stated direct-call guarantee. This is why the small
per-invocation token/check is included. No signing keys, public call tokens,
new submission handles or universal error-authentication framework are proposed.

## Alternatives rejected or deferred

- **No change/documentation only:** adequate for conservative stop-on-error clients,
  but leaves hosts duplicating validation or interpreting text/instrumentation.
- **Discriminated result union:** changes the Promise<Job>/throw contract and every
  successful call site for a much smaller problem; unnecessary now.
- **Error.cause as protocol:** usually represents another exception, can contain
  sensitive objects, and lacks a clear stable admission discriminator. Do not use
  raw causes or internal exception names as the public contract.
- **Export validatePlan/preflight APIs:** exposes internals or adds a nonauthoritative
  check that cannot replace actual submission validation. Preserve information at
  the existing boundary instead.
- **One error taxonomy for admission, policy, providers and transport:** obscures
  certainty, encourages unsafe retry inferences, and exceeds the evidence/scope.
- **Message parsing/helper package:** cannot reliably recreate lost issue boundaries
  or distinguish infrastructure failures. A helper may format diagnostics later,
  but the authoritative category must originate in runtime admission.
- **Immediately redact legacy message:** would break exact-message consumers and
  current HTTP prefix classification. New safe issue messages plus explicit host
  projection provide an additive path; legacy strings remain sensitive.
- **Blanket-wrap errors with zero policy calls:** confuses storage/shape/capture
  exceptions with explicit proposal rejection, as shown by the fixture heuristic.

## Experiment mapping and implementation scope

For p1, the future error would contain INPUT_TYPE_MISMATCH, stepIndex 0, field
resource. For p13 it would contain CAPABILITY_VERSION_MISMATCH and stepIndex 0.
The host could classify those as REJECTED by the runtime diagnostic instead of
comparing authorization counters or inspecting English messages. The unchanged
reasoner would still only see its current projection until a separately authorized
adapter change. If a trusted adapter exposed code/issues, a deterministic client
could distinguish these malformed proposal classes without parsing human strings;
that is classification, **not demonstrated generic automatic repair**.

p12 is rejected by the host allowlist, not core admission. p14 fails reference
resolution after its source executes and must remain a failed Job. Denials,
partial capability failures and injected UNKNOWN outcomes are unchanged. Session
correlation/replay guards, sensitive-data filtering and host caller ownership
remain host responsibilities. Do not modify the experiment in this task.

Approved implementation scope:

1. Add one diagnostic module with ordinary-Error issuance, private WeakMap and
   call-ownership context, fixed safe messages and copied/frozen details. Export
   only isPlanAdmissionError and the error/issue types from index.ts.
2. Carry private code and ordinal information from the existing validator branches,
   preserving legacy issue messages/ordering and reference semantics. No message
   parsing or extra user-object traversal.
3. Replace only the empty-plan and invalid-validation Error construction in
   JobManager.executePlan with the scoped internal issuer. Add the private call
   context and narrowly specified foreign-diagnostic containment to
   OperatorRuntime.executePlan; ordinary exceptions pass through unchanged.
   No blanket conversion in capture, create, execute or run.
4. Add focused public-runtime/package regressions and necessary internal validator
   expectation updates. Reconcile governance anchors only if genuinely moved;
   do not add new execution entrances/blanket allowances.

Required regression evidence:

- Every code corresponds to an existing rejection, with stable issue ordering and
  correct captured index/field; multiple issues and duplicate IDs remain distinct.
- Empty/invalid plans produce zero create/persist/lifecycle/policy/capability calls
  in inert fixtures, alongside the expressly limited getter/reentrancy caveat.
- instanceof Error, ordinary Error constructor, exact legacy message/name, default
  JSON enumeration, predicate behavior and public package availability. No runtime
  constructor/factory/token/map export.
- code/issues descriptors are non-writable, non-configurable and non-enumerable;
  issue records and array reject edits, push/splice, deletion, replacement,
  defineProperty and prototype mutation. Original internal records remain detached.
- Shaped objects, copied genuine descriptors, prototype imitations, ordinary
  errors with matching codes, primitive inputs, throwing getters and revoked
  proxies return false without executing traps.
- Genuine errors are recognized repeatedly; concurrent and reentrant calls retain
  distinct owners. Relaying A's real error through B's caller/plan callback or
  post-invocation storage failure yields an unbranded outer Error, with A's
  original still recognized and unchanged. B must not acquire A's certainty.
- Serialization/cloning loses membership; an adapter test classifies only the
  direct error, projects permitted details and excludes message/stack/cause.
  Same-instance package imports work; a separate module instance does not gain
  recognition through public field matching.
- Safe issue messages never echo credential-like submitted values/IDs/reference
  strings/versions, raw exceptions, stack, scopes or provider configuration.
- Capture/getter/Proxy/collection/planner/store exceptions are not blanket-converted;
  arbitrary errors bearing a matching code are not promoted by the runtime.
- Unsupported plan versions remain current behavior; known-good plans, resolved
  references, explicit policy denial and fail-closed authorization are unchanged.
- A missing result path after a completed source remains a failed Job, not an
  admission error; final persistence failures after effects are not misclassified.
- Existing HTTP/MCP/starter message behavior remains unchanged; no implicit wire
  serialization or policy/retry semantics appear.

## Explicit non-goals

Authorization-denial protocol; execution-failure taxonomy; provider errors;
transport uncertainty; retry/idempotency or effect certainty; output schemas or
expanded descriptors; AI-specific feedback; semantic discovery; malformed-plan
shape hardening; version enforcement; ADR-0008/0011 migration; immutable Jobs;
production authentication; multi-tenant isolation; release/version changes.

## Acceptance and implementation

The maintainer explicitly approved this contract on 2026-09-23, including the
private issuer/WeakMap, per-call ownership and foreign-call containment. The
implementation preserves the two issuance sites and nine codes above. No
execution/authorization taxonomy, plan-version enforcement, value-model change
or retry protocol is included.

The external-reasoner host now explicitly projects native admission evidence for
p1/p13. Existing HTTP/MCP message-based response formats remain unchanged; their
legacy disclosure limitations remain as documented above.
