---
title: Governed value model compatibility decision
---
# Governed value model compatibility decision

Decision: **STOP before implementation: semantic breaking change confirmed.**
ADR-0011 is approved in direction, not Accepted. This report reconciles the
maintainer's constraints against the current code; it does not introduce an
exported type, change ExecutionPlan v1, or claim the ownership gap is fixed.

## Compatibility evidence

`ExecutionStep.input?: unknown` permits absent input; `Capability<TInput,
TResult>` has no passive-value bound. Accepted ADR-0008 explicitly preserves
nested sharing, result identity and mutability. `test/result-reference.test.ts`
requires identity (line 17), undefined/NaN/bigint terminals (64), getter execution
(75) and Proxy traps (88). These are stronger evidence than permissive TypeScript
alone. A copy only at runtime dispatch could preserve the internal resolver's
unit tests but still break observable producer/consumer identity at public
capability entry. The new security semantics intentionally supersede these
behaviors; directional approval does not override the explicit stop condition.

| Value | Current behavior | Proposed treatment / compatibility consequence |
| --- | --- | --- |
| undefined | Optional root input; no-schema and optional fields pass; references preserve it; JSON omits object properties or uses null in arrays | Reject as data; root absence needs an explicit exception or migration. Never replace with null/{} |
| NaN, Infinity, -Infinity | Declared numeric fields reject; no-schema leaves and references pass; JSON writes null | Reject everywhere at receiving boundary; narrows accepted execution |
| Finite numbers, signed zero | Runtime preserves represented Number; SQLite/JSON converts -0 to +0 | Preserve finite IEEE-754 values including signed zero; reject no finite value solely for unsafe integer range. Storage parity for -0 unresolved |
| bigint | Literal/reference leaves can execute; SQLite/JSON throws | Reject before receiving authorization; behavior/timing change |
| Date | Literal becomes {}; referenced Date retains identity; JSON calls toJSON | Reject without coercion or calling toJSON |
| Buffer, Uint8Array | Literal numeric-key record; reference retains typed value; Buffer JSON uses type/data | Reject as governed data; byte encoding must be explicit at producer/integration |
| Map, Set | Literal enumerable record (usually empty); reference retains object | Reject; no implicit entries conversion |
| Symbols | Symbol leaf can pass; symbol keys ignored by ordinary traversal/JSON | Reject symbol values and own symbol keys, without silently dropping |
| Functions | Leaves can pass; JSON drops/nulls | Reject, including callable objects |
| Classes/custom prototypes | Literal loses prototype; reference retains it | Reject; ordinary Object.prototype and null-prototype records only |
| Getters/setters | Enumeration/path reads can invoke getters; tests require own getters | Reject accessors by descriptors before reading; do not execute getter as normalization |
| Proxy | Current enumeration, ownership and reads invoke traps | Reject before reflection using Node util.types.isProxy; includes revoked proxies |
| Cycles | Literal reference discovery overflows; referenced cycle executes in memory; JSON throws | Deterministic path diagnostic; reject before receiving authorization |
| Sparse arrays | map preserves holes; JSON converts holes to null; reference selection allows length/owned indices | Reject selected whole sparse array; primitive selection such as length needs safe path rules |
| Shared references/identity | Literals duplicate aliases; references preserve producer identities | Expand acyclic shared subtrees into equivalent detached values; identity ceases to be contractual |
| Hidden/extra properties | Literal enumeration drops nonenumerables; reference path can select nonenumerable own data | Reject unsupported properties on selected governed graphs rather than drop them; selected-path rules need explicit reconciliation |

Frozen/sealed passive records are compatible: copy descriptors' data values
without mutating the source. Own names such as __proto__, constructor and
prototype remain data. Array extra properties, symbol properties and custom
array prototypes should reject; length and dense index descriptors are structural.
Cross-realm custom-prototype acceptance is not promised. Descriptor inspection
must reject accessors even when a getter would return valid passive data.

## Runtime, persistence and integration reconciliation

Admission currently invokes Object.values during reference discovery; the
resolver uses Object.entries/map for literals and direct property reads for
selected result paths. Checking only after resolution is too late: unsupported
values may already have been transformed or getters invoked. Safe domain/path
inspection must precede those operations, and recheck values at step execution.
Plan structural getters and caller metadata are separate from the input-value
model; this proposal does not silently claim an inert whole ExecutionPlan.

Memory stores return live Job objects and retain result identity. Those remain
mutable under the selected scope. SQLite stringifies full Jobs and parses reads,
losing values before a later snapshot can inspect them. Input domain checks must
precede persistence, and selected result handling must not silently accept a
coerced persisted value as its original rich value. Solving that for arbitrary
persisted results may require defined result encoding or rejection at commit,
which changes result/error semantics and can fail after producer effects. A
whole-result restriction is **not** automatically approved by the A/B direction.

Bundled LinkedIn auth-status and profile-self capabilities explicitly use
`Capability<undefined, ...>`; strict root rejection is a concrete bundled break.
HTTP accepts body unknown and its provider JSON-stringifies it. Its optional
provider-request fields may be undefined: provider requests are outside this
input boundary and must not be inadvertently subjected to the new model.
Shell output contains strings, arrays and numbers; filesystem/web outputs are
ordinary records. Their compatibility does not establish compatibility for
public custom capabilities or arbitrary referenced results.

Inbound MCP serializes `step.result ?? null`; outbound MCP passes argument
records to its SDK. HTTP and the starter parse/stringify JSON, so they cannot
transport rich JS identities, but they still allow absent input and JSON signed
zero can change on serialization. Starter examples do not require rich data.
These transports do not define the in-process public runtime contract. Existing
rich result serialization errors may occur after effects; the new guarantee can
only prevent the receiving invocation, not undo the producer's earlier effects.

## Reconciled candidate, not implemented

Domain: null, booleans, strings, finite IEEE-754 numbers, dense arrays, and
ordinary/null-prototype records with own enumerable string data properties.
No implicit conversion. Root absence is still a separate unresolved envelope
case, not secretly added to GovernedValue. Unreferenced results remain outside
this first input-boundary restriction.

Equivalence: equal primitive values (Object.is for finite numbers, preserving
signed zero), exact string/key content, equal array lengths/order and recursively
equivalent record members. Record insertion order, descriptor flags and graph
identity are irrelevant. No Unicode normalization. Capability/authorizer code
can still observe JS enumeration order: the policy contract must not derive
authority from it, or a later implementation must explicitly canonicalize owned
record insertion order. No claim is made that arbitrary JavaScript observers
cannot distinguish structurally equivalent representations.

Candidate lifecycle:

1. Inspect proposal data safely before legacy traversal/persistence; reject
   unsupported nodes rather than transform them. Preserve reference grammar.
2. Resolve references using safe own-data descriptors, then construct a detached
   receiving-step tree. Selected result data containing $ref is not reinterpreted.
3. Validate; retain a private runtime-owned authorization snapshot.
4. Give policy a separately copied/frozen view. Mutation cannot affect the private
   snapshot even if freeze is ineffective or a mutation is caught by policy.
5. After valid explicit allow, copy from the private snapshot for capability entry.
   Denial, malformed decisions and exceptions continue to fail closed.
6. Never expose private snapshot/pre-entry invocation copy through Job, event or
   log projections. Capability owns its mutable copy after entry.

Select explicit descriptor-based validation/copying over structuredClone (accepts
rich types and does not itself define safe inspection), serialization (coercion,
getters/toJSON, signed-zero loss), or freeze alone (alias/internal-state problems).
A small internal helper is sufficient in principle; no immutable-value framework
or public type export is needed. Bound depth and expanded materialized size;
cycles differ from harmless shared acyclic subtrees. Exact limits and error
wording remain implementation decisions after migration approval.

Unsupported literal inputs should diagnose a path/reason before job effects;
unsupported selected references fail the receiving step before its authorization
or invocation. Earlier steps may have already performed effects. Never log the
unsupported graph while diagnosing it. No new public error class is required
merely to explain the failure through existing error channels.

## Scope and next decision

No ownership lifecycle changed in this pass. The 14 characterization tests remain
characterizations; converting them to prevention assertions without an approved
implementation would be misleading. After migration approval, convert pre-entry
alias/authorizer/subscriber cases. Preserve post-entry capability/middleware and
logging alias cases as trust-boundary evidence: a capability that exposes its own
working copy to a sink can change its subsequent consumption, outside entry
equivalence. Denial tests must still show zero invocation. Committed result
immutability, provider-operation equivalence, caller metadata ownership and
ambient host-process isolation remain separate decisions.

Required next decision: explicitly authorize superseding ADR-0008's relevant
input/reference identity behavior and migrating accepted rich values; specify
root absence and signed-zero/persisted-reference semantics. Then implement the
small internal snapshot boundary. No version bump, publication, release or
external-reasoner experiment is performed here.

## Verification and changed files

This pass changes only this report and ADR-0011. Existing source, tests, ADR-0010
and earlier hardening remain unchanged. ADR-0010 already distinguishes input
stability from provider-operation binding; no further change is necessary.
No characterization was converted, because implementation is stopped.

- `npm run check`: passed typechecking, all 254 functional tests, build and
  package verification (`veil-runtime-core-0.2.0.tgz`, 102 files).
- `npm run test:quality`: all 216 tests passed.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`:
  exit 1, verification-control review required; no unapproved execution references
  or unsupported accesses. Fixed-base deltas remain source +113/-254 (net -141),
  tests +916/-1 (net +915), harness +56/-8 (net +48), all from preceding work.
  This documentation-only pass adds no source/test/harness delta.
- Initial sandbox check failed in `tools/verify-package.mjs:24` with
  `SyntaxError: Unexpected end of JSON input`; initial quality test subprocesses
  reported `test failed`. Authorized outside-sandbox reruns passed without
  relaxing checks.
- `git diff --check`: exit 2 for preserved CRLF lines in earlier source edits;
  no whitespace controls or source formatting changed.
- Reviewed cumulative tracked diff and this pass's full new/revised documents;
  prior uncommitted changes remain distinct from this decision. Existing
  characterization evidence was rechecked against source and rerun in the suite.

The Proxy probe detected ordinary and revoked proxies with zero observed traps;
structuredClone preserved -0. These probes inform a candidate mechanism, not a
claim that an implemented safe snapshot exists.
