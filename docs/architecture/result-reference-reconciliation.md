---
title: Result-reference semantics — maintainer decision memo
---
# Result-reference semantics — maintainer decision memo

**Recommendation: VERSION THE NEW SEMANTICS.** This is an unapproved proposal,
not an architecture change. Keep accepted ADR-0008 and current v1 behavior intact;
keep ADR-0011 Draft, approved in direction. No runtime, tests, public contracts,
version numbers or release artifacts are changed by this memo.

The recommended future meaning is **C: snapshot selection**. A reference selects
passive data from an earlier completed result at the receiving step's resolution
boundary. It does not transfer a JavaScript object or its mutation authority.
Model B (value selection) expresses the intent but needs C's timing and ownership
rules to establish authorization correctness.

## 1. What ADR-0008 actually decided

Commit `f6c263144b96683e9d9f838b77bac18ff94614e5` (2026-09-17) captured the structural
execution envelope before admission and any await. Previously validation read
caller-owned steps, then job materialization reread those steps after asynchronous
creation. Callers could change the capability, step order/identity or input root
binding between validation and materialization. The fix captures named fields
once into independent step records and an independent ordered steps array.
It preserves the submitted input root binding rather than capturing its contents.

ADR-0008 explicitly says nested sharing and result identity/mutability remain
unchanged. Its scope excluded immutable inputs, result ownership, replay and
accessor/Proxy isolation. The implementation changed executePlan's envelope
capture, not resolution or the execution loop. This supports a narrow rationale:
repair structural substitution without introducing new deep-value semantics.
It does **not** support an inference that identity was judged essential for
capability composition. Nor does it license treating identity as irrelevant to
compatibility: it deliberately preserved that behavior, and public documentation
now says referenced objects retain identity and mutability.

The earlier `6680e85ae63fa1144f22d6db8ae0d697828e7f85` own-property fix changed only
`segment in resolved` to `Object.hasOwn(resolved, segment)`. Its tests preserve
identity, own getters, Proxy behavior and rich terminals while rejecting inherited
paths. The original resolver dates to architecture-lock commit `d3fb8ed`.
Available repository history records these scope choices; it does not establish
undocumented private maintainer motivations or actual external usage.

Test interpretation:

- Structural substitution tests are positive architectural requirements.
- `structural-ownership.test.ts:254,273`, explicitly named `limit:`, preserve
  sharing/identity as deliberate compatibility limits of ADR-0008.
- `result-reference.test.ts:17,64,75,88` combines identity/rich-value compatibility
  checks with own-property security tests. Getter/Proxy execution is compatibility
  evidence, not a security goal worth perpetuating independently.
- `value-ownership.test.ts` explicitly characterizes gaps, not guarantees that
  vulnerabilities must persist. Its prevention conversions remain deferred.
- The SQLite structural test proves captured structure survives persistence;
  it does not prove all values or identities survive.

Evidence: [ADR-0008](../adr/0008-structural-execution-ownership.html),
[public v1 contract](../reference/execution-plan-v1.html), and
[result-reference documentation](../concepts/result-references.html).
External SDK users could reasonably rely on identity because of those docs,
`input?: unknown`, generic capability results, and observable in-process behavior.
No usage telemetry is available. A lack of bundled dependence is not permission
for an undocumented breaking change.

## 2. Current meaning and actual identity requirements

Today `$ref` is a selector returning the exact selected result/path terminal.
It requires an earlier completed step. Each path segment must be an own property;
then ordinary JS property access reads it. Ordinary literal arrays/objects are
recursively rebuilt, but a selected reference is returned directly without
recursive interpretation of its contents. Multiple selections can share objects.
Selection, shallow schema validation, authorization and capability dispatch
reuse the resolved graph. Same identity does not imply stable contents.

No real bundled capability or documented example requires
`Object.is(referencedInput, previousResultSelection)` to be true. The starter's
`customer.lookup → email.draft` composition reads customer email/name/plan fields;
the documentation's order example passes an ID. Both work with equivalent copies.
Identity is necessary for the identity assertions in tests, not for those tasks.

An external custom capability could use WeakMap identity, class methods, resource
handles, or mutation of a producer object as a communication channel. These are
plausible compatibility dependencies, not observed bundled requirements. They
cannot be reconstructed from a portable ExecutionPlan. A governed runtime would
need an explicit host-owned handle protocol to govern such resources across
boundaries; this memo does not propose building one. Mutation sharing should not
silently be that authority-bearing protocol.

## 3. Candidate semantics

| Dimension | A: object/reference identity | B: value selection only | C: owned snapshot selection |
| --- | --- | --- | --- |
| Determinism | Depends on alias mutations and read side effects | Undefined until selection timing/equality specified | Stable after defined snapshot; not deterministic external effects |
| Authorization | Aliases can change validated/authorized contents | Can work only with additional ownership rules | Private snapshot binds validation, policy and entry values |
| Mutation | Producer/consumer/Job observers may share authority | Sharing unspecified | Receiving capability owns detached working copy; producer remains mutable |
| Memory vs SQLite | Identity only within a live graph | Portable domain can converge but storage must agree | Domain/encoding must preserve snapshot values in either store |
| HTTP/MCP | No JS identity on wire | Natural data-selection meaning | Natural data meaning with explicit timing and validation |
| Processes/workers | Cloning loses identity; sharing needs a new resource protocol | Value encoding possible | Value encoding possible; no shared mutable backing storage |
| External reasoner | Cannot name an in-process identity | Can propose paths and structured data | Can propose paths; receives no mutation authority over snapshot |
| Replay/recovery | Identity and mutable history not reconstructible | Needs recorded selected data and version | Snapshot/version recording could support replay; no replay guarantee added |
| Observability | Historical reads can change | Unspecified retention | Snapshot can be audited if deliberately recorded; Jobs remain mutable otherwise |
| Composition | Supports implicit aliases/handles as well as data | Supports data pipelines | Supports data pipelines without shared mutation authority |
| Compatibility | Current local behavior | Ambiguous if used to relabel current behavior | Breaking for identity, rich values and accessor-dependent consumers |

A fourth interpretation, snapshot-at-producer-commit, is stronger than needed:
it would freeze meaning for all future consumers and improve stable historical
reads, but requires result-commit ownership and migration of Job/result behavior.
Do not bundle it into this decision. A receiving-step snapshot observes the value
then present, not necessarily the value originally returned by the producer.

## 4. Memory versus SQLite: actual phase boundaries

There are currently store-dependent ExecutionPlan observations. Memory get/update
retains the live Job. SQLite create/update JSON-stringifies; get/list JSON-parses.
executePlan writes the materialized job and execute reloads it **before** the loop.
Inside the loop new results remain in the loaded live Job; there is no per-step
SQLite reload/commit. The final update persists the completed/failed job.
Therefore SQLite does not detach every inter-step reference.

The following compares storage, not the resolver's additional literal traversal:

| Category | Memory store | SQLite write then read |
| --- | --- | --- |
| Object identity/shared nested references | Same objects and aliases | New objects; repeated aliases duplicated, including step result vs aggregate result |
| undefined | Preserved, including own property presence | Object keys omitted; array entries become null; absent root input/result property stays absent |
| NaN / Infinity / -Infinity | Preserved | null |
| -0 | Preserved | +0 |
| bigint | Preserved | JSON.stringify throws |
| Date | Date object/identity | ISO string through toJSON (invalid Date becomes null) |
| Buffer/Uint8Array | Typed identity retained | Buffer's JSON representation / ordinary numeric-key record |
| Map/Set | Original objects | Usually empty records, or enumerable custom properties |
| Functions/symbols | Preserved | Function/symbol-valued object properties omitted, array entries null; symbol keys omitted |
| Getters/setters | Store itself does not invoke them | Enumerable getters execute during serialization; setter-only property yields undefined and is omitted; data materialized on read |
| Proxy | Retained without store-level inspection | Serialization can invoke get/ownKeys/descriptor traps and toJSON; may throw |
| Sparse arrays | Holes retained | Holes become null (inherited indexed data can be observed by JSON serialization) |
| Custom prototypes/nonenumerables | Retained | Prototype/nonenumerables lost; toJSON may replace the representation |
| Cycles | Retained | Serialization throws |

Literal resolver traversal separately turns Date/Map/Set into enumerable records,
loses custom prototypes, preserves array holes, invokes getters and passes rich
primitive leaves. Direct result references bypass that reconstruction. Declared
numeric schema fields reject nonfinite values, but absent/nested schemas do not
establish a global domain.

A focused actual-runtime SQLite probe verified: literal input -0 reached the
capability as +0 after reload; a newly produced object was passed by identity to
the next step and retained -0 during execution; final get lost both shared result
identity and signed zero. Existing tests cover the broader JSON round trips.
A persisted undefined result can lose the distinction between an absent key and
an explicit undefined key: a nested path valid in memory can then be missing.

Consequently ADR-0008's identity preservation is an unchanged local behavior,
not a cross-store or durable identity guarantee. This limits its claim without
invalidating its structural ownership decision. It is not a reason to silently
change current memory behavior. Rich result serialization failures can occur
at final persistence **after** downstream effects, not necessarily before a
receiving step in today's uninterrupted loop.

## 5. Cross-boundary choice

Recommendation: the future semantic meaning of a plan should not depend on an
identity available only inside one JS process. This is a design choice based on
Veil's transport/persistence surfaces, not a theorem that identity is never useful.
A purely local object orchestration runtime could deliberately choose A; it would
have to limit portability and describe identity-bearing host resources explicitly.

HTTP/starter JSON and MCP structured arguments do not carry identity. Inbound MCP
also serializes `step.result ?? null`, collapsing absent output with null in that
feedback projection. Worker cloning can preserve some aliases within one message
but not identity with sender objects; shared buffers add mutation authority and
are outside passive data. Recovery must record values and semantic versions;
current execution/replay contracts do not provide that recovery mechanism.
An external reasoner should select paths into data, never obtain host handles.

## 6. Root absence proposal

Current distinctions: missing step.input and explicit root undefined both become
undefined bindings during structural capture; schema validation treats either as
an empty field source. It does not replace the invoked value with {}. Required
fields treat undefined/null/empty string as missing; optional undefined skips type
checking. Null remains an actual value at invocation. A missing reference path
throws; an own property whose value is undefined succeeds. Whole-result selection
returns undefined for either an absent result or an explicit undefined result.
A capability returning undefined currently completes normally.

For the **new semantics**, recommend an envelope-level **NoInput/NoResult state**,
not a new exported JS value type:

| Case | Proposed meaning |
| --- | --- |
| Missing input property | NoInput; preserve zero-input capability invocation |
| Explicit root input undefined | Same NoInput envelope state, explicitly documented for SDK compatibility |
| Input null | Actual governed null, distinct from NoInput |
| Object member/array item containing undefined | Unsupported data; reject, never omit or replace |
| Missing $ref path | Resolution failure, never default to null/NoInput |
| $ref selects explicit undefined | Unsupported selected value; fail, even at receiving root |
| Capability result undefined | Successful completion with NoResult; no selectable root value |
| Whole-result $ref to NoResult | Resolution failure; completion alone does not imply a result value |

This intentionally distinguishes a literal no-input envelope from a reference
that claims to select a value. NoInput is not GovernedValue and is not manufactured
by coercion of a reference. Policy and capability must observe the same absence
state. It preserves bundled zero-input capabilities while breaking explicit
undefined reference terminals. New feedback should distinguish NoResult from null
if that distinction is exposed; MCP's current null projection must be documented
or versioned, not mistaken for core equivalence. No complete result immutability
or universal result-domain restriction follows from this proposal.

## 7. Signed zero proposal

**Recommend B: explicitly canonicalize -0 to +0 in the new semantic version.**
No bundled capability, descriptor or example uses sign-of-zero meaning. Current
Number.isFinite validation accepts both; a custom authorizer can distinguish them
with Object.is or reciprocal arithmetic. JSON and SQLite erase the distinction.
Preservation would require special encoding to achieve storage equivalence;
exclusion would reject ordinary finite data for no observed domain benefit.

Define governed numbers as finite IEEE-754 Number values with one zero. Other
finite values retain their represented Number value, including unsafe-range
integers; no additional rounding, string conversion or NaN-to-null conversion.
Numeric equality is ordinary equality on this finite, zero-canonical domain.
Canonicalization must be explicit, documented and applied before validation and
authorization; both policy and capability receive +0. This is a proposed deliberate
exception to no silent coercion, requiring maintainer approval. It replaces the
previous investigation's tentative signed-zero-preservation recommendation only
as a **proposal in this memo**; ADR-0011 is not edited or accepted here.

## 8. Safe selection proposal

Current Object.hasOwn blocks inherited properties at every segment. Own
__proto__, constructor and prototype keys remain valid data, not a forbidden-name
list. Nonenumerable own properties and array length are selectable. Holes are
missing; inherited indices are rejected. Accessors run on reads; Proxy ownership
and get traps run and may mutate state or throw. Reference-object recognition and
literal discovery themselves use enumeration/reads, so side effects may occur
before path traversal. Empty path segments currently name empty-string keys;
dots and the first .result delimiter impose existing grammar limitations.

Future selection should use passive own-data descriptors, never evaluation:

1. Require earlier completed source and a selectable result value.
2. Reject Proxy/revoked Proxy before reflection (Node util.types.isProxy is a
   candidate); reject unsupported traversed container prototypes.
3. Select own enumerable data properties of ordinary/null-prototype records;
   never invoke accessors, inherited methods, toJSON or Proxy traps. Nonenumerable
   selected record properties reject in the new version rather than disappear.
4. For arrays, permit own dense index data properties; retain length selection as
   an explicitly defined structural integer, not unrestricted object reflection.
   Holes/missing indices fail; whole selected sparse arrays fail the value model.
5. Validate/copy the entire selected subtree into the receiving snapshot; preserve
   own special-name keys safely. Off-path siblings are not selected or coerced;
   accessors on a selected path or inside its selected subtree reject.
6. Keep the existing selector grammar unless separately decided. Selected data
   containing $ref is data, not a second instruction to resolve references.

Safe checks must precede existing getter-invoking discovery and storage conversion
as well as resolution. This does not make arbitrary host JavaScript a sandbox.
Subtree selection from ungoverned historical results still requires a defined
persistence policy; a copier cannot recover rich types already erased by JSON.

## 9. Security comparison

A cannot generally prove the full resolved→validated→authorized→entry chain while
producer/Job/authorizer handles retain mutable aliases. Freezing the original
would revoke existing mutation behavior and still fails for arbitrary rich JS
objects; it is a semantic migration, not preservation of A. Primitive-only A can
avoid alias mutation, but getters can still make selection effectful. B alone
specifies selection, not ownership; copying only after policy can copy a changed
value. B becomes sufficient only with C-like snapshot rules.

C can establish the narrow chain for passive data if it materializes the receiving
value synchronously without invoking user code, validates that private owned tree,
gives policy a detached observational view, and copies for entry from the private
snapshot after explicit allow. No await or exposed mutable handle may intervene
during materialization. Repeated selections then observe a stable passive graph
within that synchronous receiving-step operation, assuming trusted host execution
and no shared mutable backing storage. Later producer/Job mutations affect future
selections, not the established snapshot. A caught policy mutation must not affect
the source for dispatch; uncaught exceptions still fail closed.

No private snapshot or pre-entry dispatch copy may escape through logs/events.
The capability's post-entry working copy can change; middleware, provider mapping,
remote state, credentials and ambient host code remain trusted separately. C does
not bind provider operations, make historical Job reads immutable, prevent
pre-snapshot source mutation, or establish deterministic replay. Snapshotting at
producer commit could add historical stability but is outside this proposal.

## 10. Versioning and migration

| Option | Assessment |
| --- | --- |
| Change v1 in a 0.x minor | Technically possible but silently changes stored/proposed plan meaning; not recommended |
| Explicit ExecutionPlan v2 | Makes data/absence/selection semantics identifiable independently of package installation; recommended |
| Runtime compatibility switch | Hidden ambient choice makes identical plans mean different things; legacy choice must never be request-controlled downgrade authority |
| Major package version alone | Signals break to SDK consumers but does not label saved plans or negotiated transport semantics; useful migration signal, insufficient alone |
| Staged deprecation | Gives integrators time to remove identity/rich-value dependencies; complements explicit versioning |
| Host adapter restricted to passive values | Useful controlled fixture, not an upgrade of v1's documented core semantics |

Recommend a separately approved v2 specification and a deliberate breaking package
migration with notices/examples and an explicit support/deprecation window. This
memo selects no release number or date. New guarded hosts should accept only the
new version; existing v1 users may retain a pinned legacy deployment with its
limitations. Avoid a permanent dual-model runtime unless real migration demand
justifies it. No automatic v1→v2 rewrite: identity/accessor/undefined behavior may
be essential to a consumer and cannot be safely inferred away.

**Critical deployment issue:** current runtime does not validate plan.version.
Merely submitting version '2.0' to an old runtime would still execute old semantics.
A future migration needs fail-closed version admission, host/runtime compatibility
checks and transport negotiation/documentation. Version text alone is no safety
barrier. A reasoner must not choose a legacy semantic mode to escape snapshot
requirements. New hosts must reject unsupported versions before job effects.
Previously persisted Jobs do not record a sufficient semantic execution version
for replay; never infer safe replay from Job storage or automatically reexecute
historical Jobs. Defining recovery is separate work.

## 11. Proposed maintainer decision text — UNAPPROVED

> Define a new ExecutionPlan semantic version in which $ref means receiving-step
> snapshot selection of passive structured data. Selection captures the value
> represented at the selected path immediately before receiving-step validation
> and authorization. Object identity, prototypes and mutation sharing are not
> transferred. The runtime owns an unexposed validated snapshot; observational
> authorization and detached capability entry receive structurally equivalent
> values under the new domain. NoInput and NoResult are envelope states; null is
> data; undefined selected through a reference is not a value. Numbers are finite
> with explicitly canonical zero. Paths traverse passive own data only.
>
> Preserve ADR-0008's structural capture invariant. Its nested-sharing and identity
> compatibility statements continue to describe legacy v1, not the new semantic
> version. Do not claim immutable committed results or provider-effect equivalence.
> Adopt the new behavior only with explicit version admission and migration rules;
> reject semantic downgrade at new governed hosts.

This is **VERSION THE NEW SEMANTICS**, not immediate supersession of ADR-0008.
The structural law survives. A future accepted versioned ADR can state precisely
which v1 compatibility provisions do not apply to v2, retaining historical truth.
ADR-0011 should remain Draft and be revised after this decision to identify its
versioned scope, NoInput/NoResult and canonical-zero choices, safe paths and
storage handling. The current draft's signed-zero proposal conflicts with this
memo deliberately and visibly; approval must resolve that conflict. Directional
approval of ownership is not acceptance of all these migration details.

## 12. External-reasoner readiness

**YES — experiment can proceed with explicit fixture constraints**, after separate
authorization to start it. Nothing is started by this memo. This changes the
sequencing recommendation from treating a general core migration as a universal
prerequisite: a controlled demonstration can avoid the known mutation paths.

The fixture must enforce passive transport data and supported shape/depth, use a
single isolated trusted runtime/registry context, deterministic inert or tightly
scoped capabilities, an observational host authorizer, and no mutating callbacks,
retained producer aliases or exposed live Job handles. Freeze or detach fixture
records where useful; hold no asynchronous external mutation channel. Scope
feedback to that fixture's jobs through detached serialization. The reasoner
must have only discovery, proposal submission and scoped feedback access; it
must not share the process, access providers, supply caller authority or access
the bundled server's unrestricted/global job surface. Disable unrelated network
and shell capabilities. If the host cannot enforce these conditions, the YES
condition is not met.

Such an experiment can demonstrate that external untrusted intent remains a
proposal, explicit host policy controls invocation, denial invokes nothing, and
structured feedback permits replanning for controlled passive data. It cannot
prove Veil core enforces input ownership, immutable results, multi-tenant isolation,
safe arbitrary plugins, cross-store recovery, or provider-effect equivalence.
Fixture discipline is an assumption, not a runtime security guarantee. Passive
values alone are insufficient: passive records and arrays are still mutable.

## 13. Recommended next step

Review the proposed versioned decision text and choose the new absence/zero/path
semantics and deployment migration policy. If approved, reconcile ADR-0011 with
that text before implementation, including how persisted referenced data avoids
silent conversion. Keep result-commit immutability separate. The fixture may be
planned independently under the constraints above, but requires a separate task
to begin. No cloning implementation or version bump belongs to this memo.

## Verification record

- Inspected commits `f6c2631`, `6680e85`, current contracts/documentation, resolver,
  job loop/stores, structural/reference/ownership tests and starter composition.
- `npm run check`: passed typechecking, 254 functional tests, build and package
  consumer verification (`veil-runtime-core-0.2.0.tgz`, 102 files).
- `npm run test:quality`: 216 passed.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`:
  exit 1, review required for existing verification-control changes; no unapproved
  execution references or unsupported accesses. Cumulative earlier-work deltas:
  source +113/-254 (net -141), tests +916/-1 (net +915), harness +56/-8 (net +48).
  This pass contributes zero source/test/harness changes; no controls/base changed.
- Sandbox package verification initially failed at `tools/verify-package.mjs:24`
  with `SyntaxError: Unexpected end of JSON input`; sandbox quality subprocesses
  reported `test failed`. Authorized outside-sandbox reruns passed.
- A temporary inert runtime probe using SQLite :memory: asserted the phase-specific
  identity and signed-zero behavior reported above. No live provider was invoked
  and no repository test/implementation file was changed for the probe.
- `git diff --check` still exits 2 for preserved CRLF lines from earlier source
  hardening. No formatting or whitespace controls changed.
- Reviewed the new memo against source/history and prior compatibility reports.
  Only `docs/architecture/result-reference-reconciliation.md` is added in this
  pass. All pre-existing uncommitted hardening remains unchanged; ADR-0008 and
  ADR-0011 were not edited or reclassified.
