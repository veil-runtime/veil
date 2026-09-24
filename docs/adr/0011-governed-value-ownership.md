# ADR-0011: Authorization-to-capability value ownership

**Status:** Accepted — explicit maintainer architecture decision; v2 boundary implemented

**Date:** 2026-09-23

**Revised:** 2026-09-24

**Accepted:** 2026-09-24

## Decision

For a **new, explicitly identified ExecutionPlan semantic version**, establish
two receiving-invocation properties: structural equivalence between the input
initially presented to authorization and the input at outer capability entry,
and structural stability of the authorization input throughout the policy call.
Use a detached snapshot of the already-resolved input, not a general immutable
plan/result architecture. Unsupported resolved values fail the receiving step
before authorization and invocation; there is no legacy fallback in this version.

**This cannot be introduced compatibly as a universal guarantee for existing
ExecutionPlan `1.0`. Versioned semantics are required.** Existing v1 meaning must
remain unchanged wherever v1 is supported. A package bump or unchanged TypeScript
signatures would not identify this change in a saved or submitted plan. This
decision defines the accepted semantics, but assigns no new version identifier,
enables no version, changes no supported-version list and schedules no release.

The maintainer explicitly approved this revised decision as proposed, including
the versioned compatibility break and limited ADR-0008 amendment below. This
acceptance replaces the earlier directional approval; it authorizes architecture,
not runtime implementation, a new supported version, or release work.

## Problem and evidence

Current `JobManager.execute` resolves input, validates it, awaits authorization
on that same graph, emits `capability.started`, and passes the graph to
`Capability.execute` (`src/runtime/jobs/job-manager.ts:200–293`). Same identity
does not mean same contents over time. Validation returns diagnostics rather
than an owned value. Referenced subtrees can alias producer results and live
memory Jobs; authorizers and observers can mutate them before entry.

Evidence is the [ownership investigation](../architecture/value-ownership-investigation.html),
[compatibility assessment](../architecture/value-model-compatibility.html),
[reference reconciliation](../architecture/result-reference-reconciliation.html),
and [authorization-entry reassessment](../architecture/authorization-entry-ownership-reassessment.html),
with these existing characterizations:

| Evidence | Architectural consequence |
| --- | --- |
| `test/result-reference.test.ts:17` and `test/structural-ownership.test.ts:274` preserve root/nested result identity through resolution and execution. | Cloning only at dispatch is still a public semantic change, even if resolver tests and exported signatures remain unchanged. |
| `test/value-ownership.test.ts:122,144` demonstrates a started subscriber changing a referenced value before entry, and an authorizer changing a validated string to a number. | A shared graph and explicit allow do not establish either proposed value property. Schema revalidation alone would also allow a different schema-valid value. |
| `test/result-reference.test.ts:64,75,87` covers undefined, NaN, bigint, signed zero, own getters and Proxy traps. | JSON conversion and general deep cloning are not compatible substitutes for current values or active reads. |
| `test/value-ownership.test.ts:60,87,249` covers retained aliases during awaits and SDK middleware replacement. | Distinguish pre-entry isolation from later capability/middleware consumption. |
| `test/value-ownership.test.ts:160,179,299,329,350` covers independent provider requests, HTTP normalization, typed values, cycles and SQLite transformations. | Entry equivalence does not establish provider binding, a universal JS domain or storage-independent values. |

Experiment II is frozen evidence. Its [design, sections 6 and 14](../architecture/external-model-reasoner-experiment-design.html)
uses passive frozen/fresh values, observational policy and no mutating observers
or retained mutable producer aliases. Its [primary results](../architecture/external-model-reasoner-primary-results.html)
explicitly do not address ADR-0011 ownership. They motivate the importance of
the governed boundary, but neither test nor establish the properties below.
No historical experiment, characterization, or earlier decision is rewritten.

## Five distinct properties

Let `A0` be the input value at the instant policy is called, `A(t)` its presented
input during that awaited call, and `C0` the value at entry to the outer registered
`Capability.execute`, before any capability or SDK middleware code runs.

| Property | Decision scope |
| --- | --- |
| **Entry equivalence:** `A0 ≡ C0`, for every invocation following valid explicit allow. | Accepted requirement for the new semantics, not yet implemented. If safe capture, validation, policy or dispatch preparation fails, there is no invocation. |
| **Authorization-view stability:** `A(t) ≡ A0` from presentation until the authorization promise settles. | Separate accepted requirement, not yet implemented. Policy receives a recursively immutable data view and a nonreplaceable input root binding. |
| Capability-entry → provider-operation equivalence | Not guaranteed. Middleware and capability code may normalize, replace, mutate or independently construct a provider operation. |
| Provider-operation → external-effect equivalence | Not guaranteed. Provider implementation, ambient state, credentials and external systems determine effects and their certainty. |
| Committed-result → later `$ref` stability | Not guaranteed. Completion records a mutable result; each receiving step captures its own then-resolved value. History, persistence parity and replay remain separate. |

Entry equality alone is the logical minimum: separate copies of one snapshot
can establish it even if policy changes its own copy. This decision also selects
authorization-view stability because otherwise policy can reason about a changed
value that will not be dispatched. It does not claim immutability is logically
necessary for endpoint equality, or certify policy reasoning and correctness.
The guarantee concerns structural input data, not every possible JavaScript
observation or the whole authorization context.

## Capture boundary and required lifecycle

Keep the existing version admission, structural plan capture, plan validation,
job materialization/storage and per-step reference resolution ordering. Add
governed capture **immediately after synchronous resolution returns and before
receiving-step schema validation**, with no await or user callback between
resolution and capture. Capture the complete returned input root and reachable
data graph, including every selected reference subtree, into a private snapshot
`S`. Do not reread the plan, Job, result source or policy graph for dispatch.

Current sequence:

```text
version admission → structural capture → plan validation → job storage/load
  → per-step resolution → resolved-input validation
  → await authorization(shared input) → explicit allow
  → capability.started observers → outer Capability.execute(shared input)
```

Required sequence, only under the new semantic version once implemented:

```text
version admission → structural capture → plan validation → job storage/load
  → per-step resolution
  → synchronous governed capture into private S
  → receiving-step schema validation of S
  → detached recursively frozen authorization view A, where A ≡ S
  → await authorization(A)
  → validate decision; require explicit allow
  → construct detached mutable capability value C from S, where C ≡ S
  → mark running / capability.started observers / execution context
  → outer Capability.execute(C)
  → capability + middleware → provider operation → possible external effects

capture/validation/policy/decision/copy failure ──→ no capability invocation
```

Construct `C` before marking the step running/emitting `capability.started`, so
failed dispatch copying does not announce an invocation ready to start. Neither
those observers nor a logger receives `S` or pre-entry `C`. The existing ordinary
event payloads need no input field. Changes through producer, plan, Job, policy
or observer handles cannot alter these detached graphs. `JobStep.input` continues
to record its current original-input meaning; it is not replaced with `S`.

The snapshot point is **after resolution**, not at admission, producer completion
or persistence commit. Earlier mutations may change what gets captured. Existing
reference grammar, ordering, own-property traversal and getter/Proxy reads in
admission/resolution are not redesigned here. Selected result data containing
`$ref` stays data; capture never runs reference resolution again.

This placement deliberately does not promise side-effect-free selection. A path
getter can run and return passive data before capture. A literal Date may already
have become an empty record through existing resolution; capture governs that
record, not the original Date. A Proxy may likewise have been read earlier. No
claim is made that the original submitted graph passed the capture domain. Safe
pre-resolution traversal would require another explicitly scoped decision.

## Resolved-value domain and equivalence

The domain is deliberately local to this boundary, not a new universal input,
result or persistence format. Accept exactly:

- `undefined`, null, booleans, strings, all JavaScript Number values, and bigint.
  Number includes NaN, both infinities and signed zeros. Existing schema rules
  still reject nonfinite values in declared numeric fields; capture does not
  weaken validation.
- Finite acyclic graphs of dense ordinary arrays and ordinary/null-prototype
  records. Record own properties must be enumerable, string-keyed data
  properties. Array own properties must be the normal length and enumerable
  index data properties for every index below length, with no additional keys.
  Accept only the ordinary Array prototype for arrays and the ordinary Object
  prototype or null for records in the runtime's realm. Eligibility is this
  inspectable representation; it does not attest to hidden state, construction
  provenance, private fields, iterator state or other source-object semantics.
- Repeated acyclic aliases, frozen/sealed records and arrays, and data keys such
  as `__proto__`, `constructor` and `prototype`. Create these keys as data without
  prototype setters. Preserve the allowed record prototype, own key order and
  internal alias topology within each copy; do not share containers across
  `S`, `A`, `C` or the source graph. A repeated node is not a cycle.

Reject any node whose governed representation cannot be determined by these
passive operations: accessors, Proxy objects (including revoked proxies),
functions, symbols/symbol keys, custom or cross-realm prototypes, Date/Map/Set/
RegExp, Buffer/typed arrays/shared backing storage, cycles, sparse arrays,
nonenumerable record properties and extra array properties. A source object with
otherwise admissible own data and an allowed prototype is accepted as that
representation even if it has inaccessible/private/native state or unusual
construction provenance. That state is neither preserved nor governed. Reject
instead of invoking accessors/toJSON, coercing, dropping keys or falling back to
v1. Off-path result siblings are outside this graph and need not be inspected.
A nonenumerable own result path may still be selected by the existing resolver;
it is the selected value, not the path descriptor, that is captured. Whole-object
selection with such a property rejects.

Capture must classify each node using only type/brand predicates, Proxy detection,
prototype reads after Proxy rejection, own-key enumeration, and own-property
descriptor reads. These operations must not invoke user-controlled behavior for
an admitted node. Reject a Proxy before any reflective operation; reject an
accessor descriptor before reading its value; reject symbols, hidden members and
unsupported native brands. Do not call getters, setters, iterators, coercion
hooks, instance methods, `toJSON` or custom serializers. Prototype behavior is
not copied into the governed representation. `Array.isArray` and trusted
`node:util` brand predicates classify the representation; `instanceof`, a
constructor property, `Object.prototype.toString` on untrusted objects, or a
matching prototype alone is not proof of a richer semantic type.

An iterative descriptor-based copier is sufficient: it copies only the accepted
own data representation, preserves internal aliases, rejects cycles and creates
ordinary governed containers. The iterator and private-state probes are therefore
accepted as their visible empty/data record representation when they pass these
rules; their hidden state and custom behavior are outside the guarantee. Neither
JSON serialization nor generic structuredClone defines this contract. Capture is
synchronous under trusted host execution and ordinary built-ins, with no shared
mutable backing storage. This is not isolation from arbitrary malicious code in
the same process.

For captured values, define `≡` recursively:

1. Primitive leaves have the same type and satisfy `Object.is`. Thus NaN is
   equivalent to NaN, -0 is distinct from +0, bigint is exact, and undefined is
   distinct from null. No rounding, string conversion or Unicode normalization.
2. Records have exactly the same own data-key membership and equivalent values
   for each key. Arrays have the same length and equivalent values at each index.
   Arrays and records are distinct kinds. An own undefined member differs from
   a missing member. Holes are not admitted.
3. Object identity, property writability/configurability, record key order and
   allowed record prototype are not part of structural equality. Copying still
   preserves order, allowed prototype and internal aliases as specified above
   to avoid introducing unnecessary representation differences. Freeze makes
   `A` read-only; `C` has writable/configurable data members and mutable arrays.

This is equality of the governed representation, not observational equivalence
for arbitrary JavaScript. Cross-boundary identity is intentionally absent;
WeakMap keys, hidden/private state, iterator behavior and producer-to-consumer
mutation channels are not preserved. Trusted host prototype behavior is not
made immutable by this decision. Acceptance does not certify the source object's
complete semantics as safe.

Root absence is resolved here: missing input and explicit root undefined remain
undefined, not null or `{}`. A successfully selected own undefined terminal,
including whole-result undefined, also remains undefined. Missing paths still
fail. A capability may still return undefined normally. No NoInput/NoResult
state, new result restriction or canonical-zero rule is introduced. Nested
undefined, NaN, bigint and signed zero need no new wire encoding to be copied
losslessly **within this in-memory boundary**.

## Ownership, mutation and failure semantics

`S` remains private and structurally stable after capture. Authorization receives
only detached `A`; its reachable containers are recursively frozen, and the
authorization context's input root binding cannot be reassigned or deleted.
Other context data, including nested caller metadata, is outside this guarantee.
No caller/producer object is frozen. Invocation receives only detached mutable
`C`, constructed from `S` after allow. This small internal mechanism requires
no public immutable-value type, registry, validator or additional execution path.

Writes through `A`, including array changes and input-root replacement, cannot
change the presented data. JavaScript may throw or silently ignore a write.
Uncaught mutation exceptions fail closed through the existing authorizer-error
lifecycle. A caught/no-op mutation is not itself a denial or approval: dispatch
still requires a valid explicit allow. There is no mutation-attempt detector.
Later mutations through retained policy/source handles cannot alter `C`.

After outer entry, the capability can mutate, replace locally, retain or expose
its working value. Middleware is inside that boundary. A capability that awaits,
hands input to a logger, or reconstructs a provider request controls subsequent
consumption; the timeout middleware does not cancel it. This decision neither
prohibits those behaviors nor claims their requests remain equivalent to `A`.

Unsafe capture or schema-invalid `S` fails the receiving step before policy,
`capability.started` and invocation. Use the existing failed-step/job lifecycle
with a bounded path/type diagnostic; do not serialize the offending graph or
invoke its formatting hooks. Existing admission failures still precede job
creation; a resolved-domain failure is a per-step execution failure, not a newly
invented admission error. It may occur after earlier steps have caused effects.
There is no rollback or successful-serialization promise for unrelated Job data.

Denial, malformed authorization decisions and authorizer exceptions continue
to prevent invocation. A dispatch-copy failure after allow also fails without
starting the capability. No partial copy is exposed or invoked. Catchable
resource/copy failures fail closed; process-level exhaustion is not a recoverable
transaction guarantee. Implementations must bound traversal resources, avoid
recursive stack dependence, and diagnose budget exhaustion without fallback.
Numerical resource limits and diagnostic wording belong to implementation review;
they must be documented and cannot redefine value equivalence or permit bypass.

With memoized copying of the admitted acyclic graph, time and allocation are
O(nodes + edges + copied data) per view/copy; internal aliases need not expand
into exponentially larger trees. There is additional copying/freezing overhead,
not a performance improvement. No generic immutable-data framework or hash
infrastructure is justified by this property.

## Persistence and result limits

The source for capture is exactly the value resolved in the current execution,
including any transformations that have already occurred during storage/load.
Memory Jobs expose live objects. SQLite writes full Jobs with JSON.stringify and
reloads with JSON.parse; JobManager loads the materialized job before execution,
but does not reload each producer result between steps of that active execution.
Thus SQLite does not remove all live reference aliases.

JSON can omit undefined record fields, convert array undefined/holes and
nonfinite numbers to null, erase signed zero, invoke toJSON, and reject bigint
or cycles. A snapshot cannot reconstruct the pre-storage value. For example,
both policy and capability may correctly see +0 after reload even though a
producer originally returned -0; a vanished undefined path can fail before
capture. Bigint may be snapshotable in memory while a Job containing it cannot
be persisted. Earlier effects can precede a persistence failure.

These are retained storage limitations, not new normalization rules or a breach
of equality between `A0` and `C0` in a successful invocation. This decision does
not require backend parity, new storage encoding, immutable result commits,
detached public Job reads, replay or migration of historical Jobs. Result
assignment remains as today; receiving input values, including selected result
subtrees, are detached at each step. Unreferenced results are not newly
domain-checked. A future
durable-result/value contract must be decided separately.

## Compatibility decision and version boundary

**No universal compatible v1 implementation is available.** v1 permits observable
producer/consumer identity and authorizer mutation, plus values that cannot be
passively snapshotted without rejection or changed behavior. Detaching only
references still breaks that identity. Freezing originals revokes producer
mutation rights. Freezing a separate policy view changes policy behavior. A
final comparison may retain identity on success but rejects formerly allowed
executions, cannot stabilize intermediate policy observations, and cannot safely
compare arbitrary getters/Proxies. Unchanged generic types hide none of this.

The compatible alternative is retaining current v1 behavior and stating its
limits. A host using already-immutable passive values can meet a conditional
deployment assumption, as the experiments did; that is not an unconditional
Veil-core guarantee. Best-effort capture with legacy fallback would likewise
not meet this decision.

Therefore the accepted guarantees must be mandatory for every invocation under
a new plan/value semantic version, with rejection for nonparticipating resolved
values. They are not a new capability risk, authority-bearing plan field or
request-controlled optional safety flag. An explicit semantic version distinguishes
new execution meaning from legacy v1; a package version alone is insufficient.
The current strict version-admission guard already rejects unsupported versions;
this decision does not change it. An old runtime will not provide these semantics
merely because a caller writes a new version string.

There is no silent v1 upgrade, automatic saved-plan conversion or automatic
downgrade. Any future deployment advertising the universal guarantee must admit
only the governed semantic version through trusted host configuration. If legacy
v1 remains available elsewhere, it retains its documented limitations and cannot
be a model-selectable fallback on that governed boundary. This ADR does not
mandate permanent dual-version machinery. Identifier allocation, rollout,
deprecation and package release require a separate implementation/release task;
the architectural choice to version rather than reinterpret v1 is settled by
this decision.

Compared with the earlier Draft and reconciliation proposal, this is narrower:
no pre-resolution passive-domain enforcement, no changed own-path selection,
no NoResult semantics, no finite-only capture rule, no zero canonicalization,
and no storage parity requirement. Preserving these primitive observations does
not eliminate the identity/mutation/rejection compatibility break.

## Relationship to ADR-0008 and ADR-0010

[ADR-0008](0008-structural-execution-ownership.html) is Accepted. Preserve its
structural envelope capture and its existing v1 compatibility statements.
Nested inputs may still change before resolution/capture; source result ownership
and mutability remain unchanged. **Acceptance of ADR-0011 explicitly amends the
scope of ADR-0008's preserved reference-identity behavior for the new semantic
version only:** selected producer identity no longer crosses the authorization
and capability-entry boundary. It does not retrospectively supersede ADR-0008,
change v1, or turn structural ownership into admission-time deep ownership.
The maintainer has explicitly approved that limited architectural amendment;
it takes effect only with implementation of the new semantic version.

[ADR-0010](0010-capability-risk-and-invocation-effect.html) is itself Draft, not
an accepted effect contract. Its distinction between static risk, a potential
prepared operation and actual effect remains valid. These two input guarantees
could support future operation binding but do not implement preparation,
canonicalization, dynamic risk or provider equivalence. No effect field or new
provider authority is authorized here. ADR-0010's historical statement that no
ExecutionPlan change was then justified is not approval to reinterpret v1; this
decision supplies a separate versioned ownership decision. Its historical
experiment timing is not current evidence. Neither ADR's history is edited.

Other explicit exclusions are immutable audit/event history, whole-context
ownership or authentication, registry tamper resistance, isolation from hostile
installed host code, cancellation, retries, exactly-once effects and rollback.
Model proposal admission remains distinct from value capture and permission.
The existing OperatorRuntime/ExecutionPlan/Capability/provider roles remain intact.

## Alternatives not selected

- One detached mutable graph for both policy and entry still permits authorizer
  mutation. Two mutable copies establish only endpoint equality; this decision
  additionally requires stable policy input.
- Equality/hash checks after policy add comparison semantics and rejection but
  do not establish stable policy observations; placement before started observers
  leaves an existing demonstrated mutation window. Canonical JSON also loses
  admitted local primitives and invokes active serialization hooks.
- Freezing source graphs breaks source ownership and does not make rich internal
  slots passive. A generic cloning or immutable-value library does not define
  this domain, timing and compatibility contract for us.
- A finite-only portable domain or capability-specific preparation is broader
  than the chosen receiving boundary. Provider-operation binding and durable
  value semantics need their own decisions, not incidental additions here.

## Maintainer approval and implementation status

The maintainer approved ADR-0011 as proposed. Approval establishes
**the architecture of a future implementation**:

1. The two stated input guarantees, the resolved-value domain/equivalence,
   capture timing, detached views, and fail-closed mutation/error behavior.
2. A new explicit plan/value semantic version, rather than a compatible v1
   patch, with no silent upgrade/downgrade and no unsafe-value fallback.
3. The limited ADR-0008 amendment for reference identity at the new receiving
   boundary, preserving accepted structural capture, existing v1 semantics,
   source result mutability and the enumerated provider/persistence exclusions.

Approval does not accept ADR-0010, schedule a release, or establish provider,
effect, result or hostile-code guarantees. The implementation task allocates the
approved semantic identifier and applies the boundary through OperatorRuntime;
v1 characterizations and post-entry middleware/provider evidence remain
unchanged. Experiment II is not ownership evidence. Existing governance review
and verification controls still apply.

Provider-operation equivalence, external-effect equivalence, committed-result
stability and exactly-once execution are not established by this approval.
Experiment II alone establishes no additional security property. Its frozen
evidence and all existing runtime behavior remain unchanged.

See the [implementation-readiness investigation](../architecture/governed-value-implementation-readiness.html)
for the migration and test basis. The approved v2 boundary is implemented; this
ADR remains limited to the two receiving-value guarantees. ADR-0008 and ADR-0010
retain their historical text; earlier investigations retain their checkpoint
conclusions.
