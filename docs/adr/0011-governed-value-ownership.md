# ADR-0011 proposal: Governed value ownership

**Status:** Draft — approved in direction; compatibility reconciliation blocks implementation; not Accepted

**Date:** 2026-09-23

## Problem

The runtime resolves input, validates it, authorizes it, and passes the same
mutable graph to Capability.execute. Object identity is not value stability.
Authorizers, retained producer results, public memory job handles, and trusted
observers can change that graph. Capability code and SDK middleware can further
transform it before provider consumption. See the
[ownership investigation](../architecture/value-ownership-investigation.html)
and `test/value-ownership.test.ts` for deterministic reproductions.

The public contracts use unknown/generics. Ordinary input traversal, direct
result references, memory storage and JSON persistence disagree about supported
values and identity. ADR-0008 explicitly preserved result/nested identity.
Consequently neither JSON conversion nor universal cloning/freezing is authorized
as an incidental implementation fix.

## Proposed first property: A plus B

For a defined supported input domain, the runtime owns a stable resolved value V.
Authorization reads an immutable view of V. Following explicit allow, the outer
Capability.execute invocation receives a detached value C equivalent to V at
entry. Changes through any previously supplied plan/result/job/observer/policy
handle must not alter C. Equality means data-value equality, not JS identity.

This proposal does not guarantee that a capability subsequently uses C honestly,
does not change it while awaiting I/O, or constructs an equivalent provider
operation. SDK middleware is part of the capability implementation. Provider
equivalence (C in the investigation's property list) is a separate responsibility
and possible future prepared-operation decision under ADR-0010.

Result stability (D) is also independent. Snapshotting selected result values for
each receiving invocation can establish A/B without immutable result commits.
It cannot promise that later references or historical job reads see the same
result. Do not bundle that stronger promise into the first implementation.

## Candidate domain — proposed, not accepted

Start with a passive, acyclic data tree: null, booleans, strings, finite numbers,
dense arrays and records with own enumerable string-keyed data properties.
Root absence/undefined is an unresolved compatibility exception: optional input and
void results are existing patterns, but undefined is outside the approved conceptual
domain. Do not collapse it into null or an empty record. Reject
nested undefined, symbols, bigint, functions, accessors, Date/Buffer/typed arrays,
Map/Set, custom classes and cycles instead of silently coercing or omitting them.
Accept ordinary/null-prototype records only, projecting data into owned records.
Own special keys remain data, consistent with existing reference semantics.

Proposed equivalence: object key order and JS identities are irrelevant; own key
membership, primitive values, array order and length matter. Propose finite
IEEE-754 numbers with signed zero preserved: -0 and +0 are
distinct (Object.is semantics for finite numeric leaves). No rounding or numeric
coercion occurs; integers outside the safe-integer range retain their existing
represented Number value. SQLite/JSON loses signed zero, requiring an explicit
persistence decision before claiming storage-independent equivalence. Repeated
acyclic aliases may become independent equal subtrees. Reject sparse arrays,
accessors, symbol-keyed data and unsupported extra array properties; do not invoke
user toJSON as a normalization mechanism. Reject Proxy objects, including revoked
proxies, before reflective inspection.
Node util.types.isProxy is a candidate for this Node-only boundary; the local
probe detected both without triggering traps. Descriptor-based traversal must
precede current getter-invoking reference discovery and path selection. This
is not a sandbox against arbitrary code already running in the host process.

These choices deliberately reject values or detach identities current tests permit.
They are a proposal for review, not evidence those values are already unsupported.
If integrations require nested undefined, typed values, identity or cycles, choose
an explicit lossless extension and storage encoding first; do not inherit the
accidental behavior of structuredClone or JSON.stringify.

Do not automatically restrict every unreferenced capability result as part of
A/B. A selected result subtree must satisfy the governed input domain before
receiving authorization. Defining a uniform result domain and failing unsupported
results at completion belongs with D/persistence compatibility decisions. That
failure can occur after external effects and cannot imply rollback.

## Candidate mechanism

Extend existing internal admission/resolution paths rather than add a public
immutable-value framework or expose a validator/registry.

1. Specify domain checks before existing object/reference traversal can silently
   erase unsupported typed values or recurse through cycles. Admission and step
   execution must have consistent behavior for values changed before resolution.
2. Materialize resolved input into a private owned data tree, including selected
   result subtrees; do not let the direct-reference branch retain producer aliases.
   Preserve existing reference grammar and ordering; a selected result is data,
   not a second proposal whose embedded `$ref` fields should be interpreted again.
3. Validate the owned resolved value and retain a private authorization snapshot.
   Give ExecutionAuthorizer a separately detached, recursively frozen policy view.
   Never derive invocation input from the authorizer-visible graph: detachment,
   not freeze alone, protects the private snapshot.
4. Denial, malformed decisions, authorizer exceptions and unsupported input all
   prevent invocation. A failed attempted mutation must not be treated as allow.
5. After allow, construct a detached equivalent mutable invocation value from the
   private stable tree. Pass it to the outer Capability.execute. Do not expose it
   in a job/event/log object before entry or derive it from those mutable records.

The exact primitive used for materialization is not selected by this draft.
Domain-aware copying is a plausible small mechanism; neither generic
structuredClone nor JSON stringify alone implements these semantics. Complexity
is O(materialized tree size) per copy. Expanding repeated aliases can be much
larger than the source graph, so bound expanded size as well as depth and define
predictable rejection. Do not claim a performance improvement.

Freezing the detached policy view discourages mutation by the policy itself.
Detaching capability
input preserves a capability's ability to manipulate its own working copy without
altering the authoritative snapshot. Returning the same clone to both parties
without freezing would leave the current authorizer mutation gap open.

## Errors, observability and persistence

Unsupported input must reject before authorization/invocation of that receiving
step, with diagnosable path/type information through the existing error lifecycle
where possible. Admission-invalid plans should fail before job creation. Invalid
referenced values discovered after earlier steps fail the receiving step; earlier
effects remain recorded. Domain checking must not silently downgrade a value.

Events and job queries must not reveal the private snapshot or invocation copy.
Detached audit projections can still be mutable without changing execution, but
audit tamper-resistance is a separate property. Existing shared event data should
not be described as immutable history. Input original-versus-resolved recording
needs an explicit decision; changing public JobStep.input semantics is not assumed.

Memory and SQLite need compatible observations for the approved data domain.
Root absence and normalization must be specified; otherwise a persisted reload
can change what policy sees. D would additionally require immutable result
materialization at completion and detached get/list projections, changing the
existing result/reference identity contracts and requiring distinct tests.

Caller context is another policy input. This proposal's A/B guarantee concerns
step input; current shallow-frozen nested caller metadata is not stabilized by
it. Decide its domain/ownership explicitly if extending the guarantee to the
entire authorization context. No authentication system is proposed.

## Alternatives and compatibility

Deep-cloning alone leaves authorizer mutation possible. Deep-freezing aliases
changes caller/producer objects and does not freeze rich-type internals. An
immutable-value library adds more machinery than current evidence requires.
JSON round trips silently change values. Hash checks require a canonical domain
and still permit later divergence. Capability-local copies begin too late to
establish a universal runtime ownership guarantee.

A/B changes documented aliasing and authorizer mutability, even if TypeScript
signatures and ExecutionPlan v1 stay unchanged. Existing result-reference and
ownership tests must be intentionally revised; passing them unchanged is not a
compatibility goal for a new semantic contract. Decide how strict-domain rejection
migrates existing consumers. A stable API would require a breaking-version
migration; Veil 0.x may use an explicitly announced breaking minor. No version
number, release, or implementation approval follows from this proposal.

## Compatibility reconciliation following directional approval

The maintainer approved passive values, structural equivalence and detached
capability entry in direction, but explicitly required stopping if implementation
would break a public contract. That condition applies. No runtime implementation
or prevention-test conversion is included. See the
[compatibility assessment](../architecture/value-model-compatibility.html).

Accepted ADR-0008 preserves nested sharing and result identity/mutability. The
public optional unknown input and generic capability contract, plus reference
tests for undefined, NaN, bigint, own getters and proxies, permit observations
the proposed domain rejects. Even retaining the internal resolver unchanged and
copying only at capability entry changes observable in-process identity. This
is a semantic breaking change despite unchanged exported TypeScript signatures.

The domain above is the reconciled candidate, not an accepted contract. Outstanding
decisions include root absence, signed-zero persistence, selected-path descriptor
semantics, and an explicit migration from current accepted values/identities.
Unreferenced results and committed Job mutability remain unchanged in scope; a
selected subtree must be detached and domain-checked before receiving-step policy.
Selecting a result must not recursively interpret its embedded $ref data.

Authorizers are observational: attempted mutation must not affect the private
snapshot. Uncaught mutation exceptions fail closed; caught/no-op attempts do not
themselves constitute approval. Only a valid explicit allow permits dispatch.
Capabilities may mutate their detached copy after entry. Logging/event consumers
must not receive the private snapshot or pre-entry invocation copy. A capability
that later hands its own mutable input to a sink has created a post-entry alias;
this proposal does not claim provider-consumption equivalence in that case.

Recommendation: retain Draft, approved in direction. It is not ready for acceptance
or implementation until the maintainer explicitly authorizes the compatibility
break and resolves the remaining domain/persistence choices. No version change
or release is made or implied.

## Decision requested

Explicitly authorize the semantic migration from accepted input/reference
behavior, and resolve root absence, numeric persistence and safe selected-path
semantics. Structural equivalence, passive values, observational policy and the
separation of D are already approved in direction; they do not need to be
reapproved as general principles. Only after the remaining compatibility decision
implement A/B with focused regressions. Retain capability/provider and ambient
host assumptions; make no end-to-end effect claim.
