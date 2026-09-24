---
title: Governed value ownership implementation readiness
---
# Governed value ownership implementation readiness

Date: 2026-09-24. Investigated source HEAD:
`103521d0d92a14d030ad56bb89e7c0a5ea902d87`, with the preceding documentation-only
reassessment/revision and the maintainer's acceptance of
[ADR-0011](../adr/0011-governed-value-ownership.html).

**Outcome: READY_TO_IMPLEMENT_VERSIONED_BOUNDARY**, for the accepted
**post-resolution** boundary only, in a separately authorized implementation task.
Propose exact plan version **`'2.0'`**, with legacy-only defaults and explicit
host opt-in. Neither that version nor any behavior is introduced by this report.
A new guarantee that `$ref` selection never invokes getters or Proxy traps would
require an additional ADR/amendment; it is not a prerequisite of, or silently
included in, this readiness conclusion.

The maintainer's clarification resolves the former domain-classification blocker:
eligibility is the safely inspectable governed representation. Veil does not
attempt to attest hidden/private/native state, construction provenance, custom
iterator state or complete source-object semantics. A source object is accepted
when the complete representation being governed can be derived through the
approved passive procedure; otherwise it is rejected.

## Accepted scope and smallest migration

ADR-0011 now requires both `A0 ≡ C0` (initial policy input versus outer capability
entry) and stability of policy input during its awaited decision. A private
snapshot of the fully resolved receiving input, a detached frozen policy view,
and a detached mutable invocation copy are sufficient. Keep existing result
production, assignment, public Job reads, storage encoding, selector grammar and
reference resolution. No global result-domain migration or new public value type
is needed. The accepted domain applies to the **resolved** graph, not necessarily
the submitted graph or a producer's whole result.

The minimum concrete implementation consists of:

1. Host-owned version admission policy on the existing OperatorRuntime options,
   with one immutable per-submission semantic selection passed internally through
   JobManager's existing execution path.
2. One internal governed-value capture/copy facility and the new-version branch
   surrounding existing receiving-step validation/authorization/invocation.
3. Version-specific tests and current-contract documentation, keeping existing
   v1 characterizations and frozen Experiment II untouched.

No Job schema, result serializer, provider contract, middleware API, authority
primitive or alternate execution entrance is required. The public runtime-options
extension below is a proposed implementation of ADR-0011's trusted version policy;
its exact API must be reviewed in the implementation diff, not exported here.

## Current evidence and affected components

| Component | Observed behavior | Smallest future change |
| --- | --- | --- |
| `src/runtime/operator-runtime.ts:47,106` | Options contain only authorizer; executePlan passes caller, authorizer and private admission owner into JobManager. | Copy/validate host version allowlist at construction; pass it privately with each submission. Keep caller projection and foreign-diagnostic containment. |
| `src/runtime/jobs/job-manager.ts:33–101` | Reads version once and accepts only `'1.0'`; owns structural envelope; persists Job; delegates to execute without retaining version. | Admit exact implemented and host-enabled versions before structural capture; derive immutable internal semantics from that single read; forward it to execute. |
| `src/runtime/jobs/job-manager.ts:163–303` | Reloads Job, resolves input, validates, awaits policy, publishes started, invokes, assigns result. | Require explicit internal semantics for this execution; branch only the receiving input boundary. No inference from loaded Job or mutable global mode. |
| Proposed `src/runtime/execution/governed-value.ts` | Does not exist. | Private domain inspection, snapshot materialization, frozen policy copy and mutable entry copy. No root-package export. |
| `src/runtime/execution/result-reference.ts:6–79` | Recognition/enumeration and path reads can execute getters/traps; own-property terminal returned directly; literals rebuilt. | No change in the minimum migration. Apply capture to its returned value, including every selected subtree. |
| `src/runtime/execution/plan-validator.ts` | Admission reference discovery uses ordinary reads; receiving validation returns diagnostics with shallow field checks. | Reuse unchanged checks against private captured S for new semantics; do not broaden schema or label post-Job failures as admission errors. |
| `src/runtime/permissions/execution-authorizer.ts` | `input: unknown`, shallow readonly declaration; explicit allow/deny protocol. | Keep signatures/decision vocabulary. New-version context gives input a nonwritable/nonconfigurable root binding; A is deeply frozen. |
| `src/runtime/jobs/job.ts`, `job-step.ts`, `job-store.ts`; `src/providers/storage/sqlite-job-store.ts` | Jobs have no plan semantic version; memory returns live Jobs, SQLite stores full JSON. | No schema or encoding change. Carry version privately across the active load, not in persisted Job data. No resume/replay feature. |
| `src/sdk/capability/create-capability.ts` and middleware | Outer execute precedes middleware; execution.input may be replaced before definition callback. | No change. Test entry separately from middleware/provider consumption. |
| API/MCP/planners/starter constructors | Emit `'1.0'`; `/jobs/execute-plan` forwards externally supplied plan to runtime. | Keep defaults. Explicit adapter/planner migration is later, not automatic version rewriting. |
| `src/index.ts`, packaging/governance controls | Existing runtime options type is already exported; internal modules are private. | No new value/helper/error exports. New internal source must remain inaccessible through package exports. Review governance findings without self-approving controls. |

`test/plan-version.test.ts:28` explicitly treats `'2.0'` as unsupported on today's
runtime; `test/structural-ownership.test.ts:296` exercises SQLite reload;
`test/execution-contract.test.ts:644` exercises runtime-scoped authorizers.
These provide existing version, storage and instance-policy regression seams.
Repository search found no direct `jobManager.execute(...)` caller outside its
own `executePlan` delegation. Stored-job execution routes remain retired. This
makes a required private execution-semantic argument feasible without a public
Job contract change.

## Version admission, dispatch and coexistence

Use exact **`'2.0'`**, not `'1.1'`, `'1.0.0'`, a boolean feature flag or package
version: identity, policy mutability and rejection behavior are breaking plan
semantics. The two recognized versions in the future implementation would be
`'1.0'` and `'2.0'`; unknown versions still reject. The currently deployed code
continues to recognize only `'1.0'`.

Propose an optional readonly `planVersions` array on `OperatorRuntimeOptions`:

| Trusted constructor policy | Proposed future behavior |
| --- | --- |
| Omitted, or `['1.0']` | Exact existing v1 admission and semantics. `'2.0'` still rejects; default singleton and existing adapters remain legacy. |
| `['2.0']` | Governed-only instance. Reject v1 before Job creation; no reasoner-selected downgrade. |
| `['1.0', '2.0']` | Deliberate mixed compatibility instance. Version determines semantics per submission. This endpoint cannot advertise universal ownership for all admitted plans. |

Copy and freeze configuration during construction. Reject empty, duplicate,
unknown or non-string entries as host configuration errors; do not retain the
caller's mutable array or infer defaults after invalid configuration. The array
is never read from a plan, metadata, caller claims or per-request execute options.
The allowlist controls admissibility; it does not grant execution permission.

At JobManager.executePlan, read `plan.version` once in the existing position.
Check both implementation support and that instance's allowlist without coercion,
trimming or negotiation. Keep the existing `UNSUPPORTED_PLAN_VERSION` category,
private issuance/provenance and pre-Job rejection. Preserve the exact legacy
error text for legacy-only policy; new policies can use fixed messages describing
host-enabled versions without echoing submitted values. No new admission code
or change to ADR-0012's evidence meaning is needed.

Derive an internal discriminant from the admitted read and forward it in the
same call to the internal execute method. Make semantics required, with no
implicit default on that delegated path. Do not reread `plan.version`, store it
in a global flag, infer it from capability version, or recover it from mutable
Job properties. It survives the awaited SQLite load because it is an invocation
local argument. Every step in that invocation uses the same semantics, even if
another runtime instance concurrently executes the other version.

Two versions can therefore coexist unambiguously in one instance or process for
**fresh executePlan submissions**. Shared registry/store architecture remains a
trusted-host limitation, not tenant isolation. Authorizers see their appropriate
input representation; no new plan-version authority field is needed in policy.
If a host requires the guarantee, it uses the governed-only instance and must not
expose a parallel legacy fallback to the same untrusted proposal channel.

Persisted Jobs lack sufficient semantic provenance for later re-execution. This
migration does not add it. Existing get/list remain historical projections, not
commands to run a Job; missing version is never inferred as permission to replay
under either mode. Durable restart/recovery would require a separate contract
for versioned execution state. Current structural reload inside a fresh active
call is different and is covered by its private semantic argument.

## Proposed lifecycle

```text
trusted OperatorRuntime version policy + existing host caller/authorizer
  → read proposed plan.version once
  → supported AND host-enabled? otherwise existing pre-Job rejection
  → capture structural envelope → existing plan validation → job storage/load
  → per-step existing $ref resolution returns R
      ├─ v1: validate R → authorize R → allow → started → execute(R)
      └─ v2: synchronous governed capture R → private S
             → validate S with existing field schema
             → create/freeze detached A; protect context.input binding
             → await authorizer(A)
             → validate decision and require explicit allow
             → copy private S into detached mutable C
             → running / started observers / logger context
             → outer Capability.execute(C)
  → existing result assignment and job completion/persistence
```

Resolution and capture must be contiguous synchronous operations, without a
user callback or await in between. No capture helper may evaluate a property
getter or serialize the graph. Original input/result/Job objects remain mutable;
the guarantee begins only when capture succeeds. Never expose S or pre-entry C
through context, events or logs. Construct C before `capability.started`, so a
copy failure has no start event. Decision-property getters can mutate source
objects after policy settles; isolation of S/C must survive this too.

## Exact domain, equivalence and compatibility matrix

The following restates the accepted ADR, not a new JSON-only contract. Capture
is applied to R, after existing resolution and any prior persistence transform.
Existing schema validation can still reject an otherwise captureable value.

| Value or observation | Existing v1 | New receiving boundary under accepted ADR-0011 |
| --- | --- | --- |
| Strings / booleans | Preserved as primitives. | Preserve exact string code units and boolean values, without coercion or normalization. |
| null | Preserved except schema requirements may reject. | Preserve as null; distinct from undefined. |
| Missing input / explicit root undefined | Both become undefined input binding; validation may view empty field source. | Preserve undefined; never substitute `{}` or null. |
| Own undefined member / selected undefined terminal | Valid terminal; missing path fails. | Preserve own membership and undefined, including root selection. No NoInput/NoResult state. Missing path still fails before capture. |
| Finite numbers / unsafe-range integer Numbers | Preserve represented value. | Preserve exactly; no new rounding or safe-integer restriction. |
| NaN / ±Infinity | Can reach no-schema input; declared number fields reject. | Copyable; Object.is leaf equality. Existing numeric schema still rejects nonfinite values. |
| -0 / +0 | Distinct in memory; JSON erases sign. | Distinct at capture and both views. Do not restore a sign already lost to storage or canonicalize at this boundary. |
| bigint | Can reach memory execution; JSON persistence may fail. | Copyable exact bigint. No conversion to string or portable encoding added. |
| Dense ordinary arrays | Literals rebuilt, references preserve identity. | Every index must be own enumerable data; normal length allowed; no extra own keys/symbols. Detached mutable C; frozen A. |
| Sparse arrays / inherited indices / extra properties | Resolver has mixed copying/selection observations. | Reject if still present in R. Do not fill holes or drop extras during capture. Earlier literal resolution may already have dropped extras; no original-graph guarantee. |
| Ordinary/null-prototype records | Literal enumeration rebuilds records; reference identity retained. | Accept own enumerable string data members only, with the runtime realm's Object.prototype or null; arrays require that realm's Array.prototype. Preserve allowed prototype and own key order across copies. Own special names stay data. |
| Frozen/sealed passive values | Can flow through references. | Copy without changing source; A frozen, C mutable regardless of source descriptor writability. |
| Repeated nested object/array aliases | Literal traversal may split them; references preserve them. | Preserve R's internal alias topology in each detached graph. Do not preserve identity with R, producer, Job or another graph. |
| Cycles | Literal admission may overflow; referenced cycles can execute in memory. | Existing earlier failures unchanged; any cycle remaining in R fails capture. Repeated acyclic aliases are not cycles. |
| Getters/setters | Admission, literal reads and selected paths can execute them. | Reject accessor descriptors still reachable in R without calling them. Earlier getter output that is passive can be captured; no retrospective prohibition on getter execution. |
| Proxy / revoked Proxy | Ordinary recognition/path/reflection may run traps or throw. | Reject Proxy nodes remaining in R before reflecting on them. Earlier path/literal traps are outside capture. |
| Symbols / symbol-keyed properties | Some literal traversal ignores keys; symbol leaves can flow. | Reject symbol leaves/own keys remaining in R; do not stringify or drop them. |
| Functions | Can flow without schema; JSON may omit them. | Reject, including callable proxies; no invocation/serialization. |
| Date, Map, Set, RegExp, boxed primitives, Buffer, typed arrays, backing buffers, custom/cross-realm prototypes, other rich objects | Literal projection versus reference identity varies. | Reject unsupported brands/prototypes remaining in R. An otherwise eligible visible own-data representation is accepted without attesting hidden state or provenance; literal Date already resolved to `{}` remains governed as that representation. |
| Nonenumerable own record properties | Path selection may read them; whole result retains them. | Whole selected graph rejects; a path selecting its passive terminal may succeed, because capture governs the selected value, not path descriptors. |
| `$ref` data inside a selected result | Selected value returned without resolving it again. | Copy as data; do not run a second reference pass. |
| Producer/result/Job mutations after capture | May affect shared input. | Cannot affect S, A or C. Later receiving steps still snapshot later source contents. |
| Authorizer mutation | Can change what executes. | Frozen A/nonreplaceable input binding; failed writes throw or no-op; uncaught error fails closed; valid explicit allow still required after caught attempts. |
| Middleware mutation / capability await | Can change later consumed data. | C is equivalent at outer entry only. Middleware can replace it; capability can mutate or expose its copy during awaits. |
| Persisted/reloaded results | JSON transforms values and aliases. | Capture the value actually loaded/resolved; do not claim equality to the original committed result or parity across backends. |

Structural equivalence is precisely: primitive type and Object.is equality;
record own data-key membership with recursively equivalent values; array kind,
length and ordered element equivalence. Arrays are distinct from records.
Missing members differ from own undefined. Descriptor writable/configurable
flags, object identity, allowed record prototype and key order are not part of
this relation. The copier nevertheless preserves allowed prototypes, key order
and internal aliases as ADR-0011 separately requires. A and C differ deliberately
in mutability. This is not arbitrary JavaScript observational equivalence.

## Capture and copy mechanics

Use a private helper, not a public immutable-data abstraction. A concrete approach:

1. Classify primitives without coercion. For object/function candidates detect
   Proxy before any reflective inspection; reject functions and unsupported
   brands. Read descriptors and prototype only after that check. Reject own
   symbols/accessors/nonenumerable members and unsupported prototypes instead of reading
   their values through ordinary property access.
2. Traverse iteratively with a per-capture source-to-copy map and an active-path
   state. An edge to an active ancestor is a cycle; an edge to an already captured
   node reuses that copy. Create data properties explicitly, including special
   names, without setters. Do not call map, iterators, toJSON or constructors
   supplied by the input. Preserve array order/density and supported prototypes.
3. Keep S private. Validate it with existing schema rules, then copy S to A and
   recursively freeze all its containers using memoized traversal. Define the
   context's input property as nonwritable/nonconfigurable, including for
   primitive roots. Do not freeze unrelated caller metadata or original objects.
4. Await the existing authorizer. After a valid allow, copy S to a distinct
   mutable C, normalizing writable/configurable data descriptors while keeping
   ordinary array length semantics. Never derive C from A, R or a loaded Job.
   Release references to temporary graphs when the invocation no longer needs
   them; do not add a global graph cache keyed by Job ID.

Prototype equality alone is not a sufficient rich-type check: Date/Map objects
can have their prototype replaced. Use trusted native brand checks for excluded
built-ins, with specific tests, rather than `constructor`, `instanceof` alone or
`Object.prototype.toString` on untrusted values (which may read Symbol.toStringTag).
After excluded-brand checks, accept the visible record/array representation when
its passive descriptors satisfy the domain. Do not attempt to distinguish hidden
private state, construction provenance or custom iterator state; those semantics
are outside the governed representation. Implementation review must ensure that
classification and copying themselves do not call user code. There is no
guarantee about an untrusted native addon or tampered built-ins.

A local read-only Node v24.18.1 probe detected ordinary and revoked proxies with
`util.types.isProxy` and zero observed traps. `util.types.isDate` and `isMap`
detected instances whose prototypes were replaced with Object.prototype.
Descriptors preserved bigint values without conversion. This validates these
mechanism choices only, not an implemented general copier or proof of ownership.
The prior investigations already demonstrate why JSON and structuredClone alone
are not the accepted copier.

The maintainer's structural clarification resolves the former iterator/private-
state blocker. A prototype-replaced iterator that passively appears as an empty
null-prototype record is governed as that representation; Veil does not call its
`next` method or attempt to detect its iterator state. An object with private
fields and an otherwise eligible visible record is governed by that visible
record. Hidden state, construction provenance and complete source semantics are
outside the guarantee. These examples therefore do not require provenance
attestation or a new brand mechanism.

The exact passive procedure is: classify primitive type; reject Proxy before
reflection; use non-effectful trusted brand predicates for excluded built-ins;
read the prototype only after Proxy rejection; enumerate own keys; read own
property descriptors; and inspect descriptor values only for data descriptors.
Accept string enumerable data keys for records, reject symbol keys and
nonenumerable record keys, and accept only the ordinary Object prototype or null.
For arrays, use the array brand and ordinary Array prototype, inspect dense own
indexed data descriptors plus structural length, reject holes, symbols and extra
own keys, and never use the object's iterator. Accessors, functions, coercion,
serialization hooks, methods and custom iteration are never invoked. Cycles are
rejected; repeated noncyclic references are memoized and preserved within each
detached copy. This procedure governs the representation it can inspect, not
inaccessible source state.

Proposed concrete resource defaults for implementation review: at most 128
container levels along any path, 10,000 distinct containers, 100,000 own data
edges, and 1,048,576 total UTF-16 code units of keys and string leaves. Count
strings per distinct container edge (plus a primitive root), not expanded alias
paths; ignore array length metadata for edge count. Memoized subtree heights can
check the longest path through a DAG without expanding every path. Copies from
validated S obey the same logical budgets; limits count data, not three copies
against one input budget. Immutable primitive bigint is retained as a primitive,
not expanded into decimal text for accounting or diagnostics.

These numerical limits are new implementation proposals, not amendments to the
accepted equivalence/domain; ADR-0011 explicitly delegates numerical resource
limits to implementation review. Test exact thresholds and predictable failure.
Allocation of descriptor/key lists and process-wide memory exhaustion cannot be
made transactional by these limits. No benchmark or throughput claim is made.
Expected algorithmic cost is linear in unique nodes, edges and inspected/copied
data per graph, without exponential alias expansion or recursive stack reliance.

## Safe reference selection: investigated, not included

Current `isResultReference` enumerates and reads `$ref`; admission recursively
uses Object.values; literal resolution uses Object.entries/map; each selected
path performs Object.hasOwn followed by ordinary property access. All can execute
user code. A Proxy check or descriptor read only at the final terminal does not
make preceding traversal safe. A post-resolution snapshot cannot undo those
reads or their effects. Resolution and admission therefore remain trusted
pre-capture behavior under accepted ADR-0011.

A future no-getter/no-trap selector would need all of the following:

- Detect Proxy before reference-object recognition, container inspection and
  every path step, including revoked proxies.
- Recognize reference syntax using safe own descriptors and choose explicit
  membership/enumerability rules; never read `$ref` through a getter.
- Traverse paths through own **data** descriptors only, reject accessors before
  reading, and explicitly reconcile nonenumerable selections, array indices,
  length, holes, special-name keys and allowed prototypes.
- Replace effectful admission discovery and literal traversal as well as path
  traversal; recheck at execution because nested plan/reference inputs remain
  mutable before capture. Do not re-resolve selected `$ref` data.
- Decide whether pre-storage inspection is also required: SQLite stringify can
  invoke getters/toJSON before runtime step resolution. A no-side-effects-before-
  capture promise is stronger still and would reach admission/storage behavior.

This would intentionally reject a path getter that currently returns a safe
primitive, despite that returned primitive satisfying ADR-0011. It would change
selection/error timing that the accepted ADR explicitly preserves. Therefore it
requires an additional architecture decision, not an incidental helper change.
The minimum implementation must retain limit tests demonstrating earlier getter/
Proxy reads, alongside prevention tests proving capture itself invokes none.
If safe traversal becomes a required launch criterion, readiness for that larger
scope is **ADDITIONAL_ADR_REQUIRED**; do not broaden the present implementation.

## Failure timing, diagnostics and asynchronous behavior

| Stage | Required behavior / diagnostic boundary |
| --- | --- |
| Unsupported or host-disabled plan version | Existing pre-Job issuance with `UNSUPPORTED_PLAN_VERSION`; zero Job/storage/lifecycle/policy/invocation effects for that submission, subject to existing host-callback limitations. |
| Existing admission or resolution error | Preserve current meaning and timing; getters may already have run. Missing result/path does not become undefined. |
| Governed capture/domain/budget failure | Existing receiving `capability.failed` → `job.failed` path; no authorizer, started event or receiving invocation. Earlier completed steps/effects remain. |
| Schema-invalid S | Same receiving failure path; no authorization. Finite numeric field rules remain unchanged. |
| Authorizer mutation/exception | Deep view cannot change. Uncaught exception fails before invocation; caught/no-op attempt neither grants nor revokes permission by itself. Keep current valid explicit decision protocol. |
| Deny or malformed decision | Existing denial/failure semantics and zero invocation. A decision getter may run, but cannot alter private S. |
| C-copy failure after allow | Failed step/job; no started event and no invocation. No partial C escapes. |
| Capability/middleware/provider error | Existing post-entry behavior; not repaired by ownership, and no rollback promise. |
| SQLite update/serialization failure | Existing storage failure can follow effects and can prevent a failed Job from being returned/persisted. Do not advertise durable diagnostics or rollback. |

Use an ordinary internal capture error handled by the existing step catch, not a
new public PlanAdmissionIssueCode or an exported value-validation class. Propose
bounded diagnostics such as `Governed input rejected at $["payload"]: accessor`.
Choose reasons from a fixed internal vocabulary: unsupported kind/prototype,
proxy, accessor, symbol key, hidden member, sparse/extra array member, cycle,
budget or copy failure. Encode keys as escaped data, never by object coercion;
cap the displayed path (for example 256 code units) and indicate truncation.
Do not print values, call their formatting hooks, inspect a Proxy to derive its
name, or pass the rejected graph into a logger. These messages are diagnostics,
not new authority or automatic retry evidence. Existing transport projection
rules still apply; no new safe public structured execution-error protocol is
claimed. Gate-time fixed messages remain separate from per-step diagnostics.

A delayed authorizer sees the same structural A before and after await while
producer/Job handles may change independently. After allow, started observers
may still mutate those sources; C derives only from S. Retained policy handles
remain frozen after settlement and share no containers with C. The capability
itself may then await and mutate or publish C: subsequent provider consumption
belongs to the capability/middleware trust boundary, even if an inert test sink
happens to observe unchanged data. Timeout does not cancel that consumption.

## Persistence and adapter migration

No global result restriction is necessary: a producer may return an unsupported
rich result; an unreferenced result remains unrestricted, while a later whole
selection fails capture and a selected passive child may succeed. The producer's
completed result remains mutable. The Job may retain input/result graphs that
the new boundary neither freezes nor makes JSON-serializable.

SQLite materialization occurs before step resolution. A loaded undefined object
key may be missing, an array undefined may be null, NaN may be null, and -0 may
be +0. Accept/capture or reject the **loaded value** using the same domain rules.
During a single active execution, producer results are still assigned directly
to the active Job and can alias later R; capture must detach them in either
backend. Final JSON persistence can fail on bigint/cycles after effects. No
codec or pre-commit restriction is needed for A0 ≡ C0; neither property asserts
original-result versus reloaded-result equality.

The first useful rollout can be the direct public executePlan API on an explicit
v2-only instance with passive in-process or JSON plans. Existing built-in
planners, HTTP capability and LinkedIn routes, MCP adapter, starter and singleton
continue to emit/admit v1 by default. Injecting a v2-only runtime into an adapter
that still emits v1 must produce an admission failure, not a silent upgrade.
A later trusted adapter/planner change must construct v2 deliberately; never
rewrite arbitrary model/saved-plan versions or infer a version from input shape.
POST /jobs/execute-plan can already carry an explicit plan envelope to a supplied
runtime, so no new execution endpoint is required.

Experiment I/II hosts, protocol, manifests, results and historical tests remain
frozen legacy evidence. Use new isolated tests outside experiment directories for
new semantics. Package releases, deprecation dates, schema provenance for durable
Jobs and any migration of stored plans are separate work.

## Exact test strategy

Keep `test/value-ownership.test.ts`, `test/result-reference.test.ts` and existing
v1 structural tests as legacy characterizations. Conversion means adding paired
v2 prevention cases, not erasing their v1 evidence. Proposed new files:
`test/governed-value.test.ts` for the domain/copy primitive,
`test/governed-value-execution.test.ts` for runtime behavior, and focused extensions
to `test/plan-version.test.ts` for opt-in admission. All providers are inert;
use explicit promise gates and synchronous subscriber callbacks, not sleeps.
No such files/assertions are added in this investigation.

| Existing evidence / area | Exact new assertion required |
| --- | --- |
| `value-ownership.test.ts:32` literal control | Caller/Job original input remains mutable and separately recorded; captured A/C stay equal despite post-capture mutation. |
| `:60` retained policy view | Root/nested object and array writes through A cannot change it, during awaited policy and after settlement; C shares no container with A; uncaught failure invokes nothing. Test caught attempts followed by valid allow. |
| `:87` producer alias | R/source result remains mutable; S/A/C detach every selected object and array. Producer change during policy await or after capability entry cannot mutate C through that old handle. Assert only this alias isolation, not general provider equivalence. |
| `:122` started subscriber | Change referenced producer through synchronous started callback after allow; C at outer entry still equals initial A. Repeat through a retained live memory Job handle. |
| `:144` authorizer mutation | Attempt schema-valid and schema-invalid substitutions and input-root reassignment/deletion. Uncaught error fails; caught/no-op plus explicit allow invokes original captured data; malformed/deny never invokes. |
| Decision-return edge | Own decision getter mutates source after policy settles; valid allow still dispatches S-derived C. Retain single decision read, malformed decision, denial and exception regressions. |
| `:160,179` provider mapping | At entry A0 ≡ C0, yet capability can construct a different provider operation; HTTP normalization remains post-entry. Preserve the counterexample, not a false prevention assertion. |
| `:204` memory Job callback | Async callback changes source while policy/capability is gated; capture ownership remains detached, but public Job/result history still changes. |
| `:237` event data | Shared event-data mutability remains a documented limit; do not claim immutable audit history. No S/pre-entry C reachable from runtime event data. |
| `:249` middleware | Instrument outer registered execute entry, then let middleware replace execution.input. Assert equality at outer entry and divergence at definition/provider; no SDK redesign. |
| `:271` logger alias | Capability can expose its C after entry and a sink can mutate later consumption. Preserve this limit while verifying runtime never emits private S/pre-entry C. |
| `:299,329` rich values/cycles | Reject unsupported referenced graphs before receiving policy/invocation. Literal normalization/earlier cycle failure still occurs in existing resolver. Reject active back-edges; allow repeated acyclic aliases with correct identity topology in each detached graph. |
| `:350` SQLite | Repeat the actual runtime storage seam, not just direct store helpers. Verify version remains governed across awaited get, correct loaded-value capture, no added result restrictions, retained JSON transformations/failures, and no durable-commit claim. |
| `result-reference.test.ts:17,64,75,87` | v1 resolver observations unchanged. v2 accepts selected undefined/NaN/bigint/-0 as defined, detaches objects, preserves embedded `$ref` as data, permits earlier own getter/Proxy reads but rejects active nodes still in R. |
| `structural-ownership.test.ts:255,274,296` | Both versions preserve structural capture and pre-capture nested sharing; only v2 receiving identities detach. Include SQLite materialization, no mutation of source by freeze, and source changes between two receiving steps producing two independently valid snapshots. |
| Version policy | Default v1 tests including future `'2.0'` rejection retain exact behavior. Opt-in v2 succeeds; v2-only rejects v1; mixed selects by captured read. Unknown/malformed values reject before any Job/storage/event/auth/invocation. Config array mutation/invalid entries cannot change policy. |
| Concurrent instances/submissions | Interleave v1 and v2 with gated Job creation and policy awaits; same shared JobManager must not leak mode or authorizer across invocations. Version getter read once; mutate submitted version after capture without changing execution mode. |
| Failure lifecycle | Unsupported graph/budget/schema produces failed receiving JobStep, no started event or authorization; earlier completed effects remain. Inject C-copy failure and assert allow occurred but no started/invocation. Keep ordinary execution errors distinct from owned admission evidence. |
| Package boundary | No new helper/validator/registry export; default consumer remains v1; an explicit governed-only consumer uses the existing executePlan path. Review new runtime-options declaration in the package type check. |

Domain tests must additionally cover: missing versus own undefined, null, all
Number edge cases with Object.is (do not use JSON snapshots for numeric/undefined
assertions), exact bigint, dense arrays and holes, symbol leaves/keys, functions,
accessor descriptors with counters, revoked/nested proxies with trap counters,
nonenumerable fields, special names, null prototypes, frozen/sealed sources,
custom/cross-realm prototypes, disguised Date/Map and other excluded native
brands, and toJSON hooks that must not run during capture. Verify every graph's
mutability and disjoint container identity, internal repeated aliases, property
order, descriptor rules, C's ordinary mutable array length, and budget thresholds
including a deep path reached through an already memoized DAG node.

Distinguish helpers from integration: zero capture traps does not imply zero
admission/resolution traps. Tests for earlier getters returning passive terminals
must continue to succeed and record those reads. New no-trap selection tests
would specify an unapproved property and must not be slipped into this migration.

## Implementation phases and acceptance gates

1. **Establish version policy and execution threading.** Review the additive
   constructor option, default legacy behavior, exact fixed diagnostics and
   required private discriminant. Prepare paired admission/concurrency/SQLite
   tests. Do not ship or advertise support for v2 until the boundary and its
   prevention tests are complete; intermediate scaffolding must not enable a
   version whose semantics are absent.
2. **Build the internal domain/copy facility.** Implement descriptor/brand checks,
   iterative DAG capture, immutable A, mutable C, root-binding protection and
   bounded diagnostics. Exercise the exact domain, budgets and exotic-value
   cases before wiring it into execution. No result-store or resolver changes.
3. **Integrate per-step v2 capture.** Preserve v1 code behavior; validate S, await
   policy on A, derive C only from S after explicit allow, then publish started
   and invoke through the existing governed site. Complete mutation/failure and
   post-entry-limit tests. Verify no private graph escapes.
4. **Verify and review the complete migration.** Run focused new tests, the entire
   unchanged v1/experiment suite, `npm run check`, package consumer verification
   and quality against the fixed implementation-start base. New copier reflection
   and changed JobManager anchors may trigger governance review; never adjust
   controls or comparison base just to pass. Required trusted approval is separate
   from architecture acceptance. Document supported versions and limits accurately.
5. **Explicit adoption, separately scoped.** Opt a chosen trusted host into v2-only
   operation and migrate its plan constructors deliberately. Do not change
   Experiment II, silently rewrite v1 proposals or broaden to persistence/replay,
   safe reference selection, provider binding or release work.

The architecture is already approved. A separate implementation instruction is
still required before any of these phases changes source or tests. The proposed
option name, resource thresholds and wording are concrete reviewable engineering
choices, not another acceptance event or changes made by this report.

## Non-goals, trust assumptions and readiness limit

No provider-operation binding, external-effect equivalence, committed-result
immutability, exactly-once execution, safe retries, rollback, cancellation,
immutable history, authentication, caller-metadata deep ownership, registry
isolation, storage parity, portable rich-value encoding or durable replay.
No general immutable-data framework. No guarantee inferred solely from
Experiment II. Runtime, authorizer, capability/provider registration, Node
built-ins and host code remain trusted; this is not a hostile-JavaScript sandbox.

The accepted boundary can be implemented independently of result production and
persistence. There is no unresolved v1 compatibility blocker if the new semantics
are opt-in/versioned and v1 remains legacy. The version-loss problem in today's
Job shape has a concrete private-call solution for fresh submissions, without
inventing persistence provenance. Safe no-getter/no-Proxy selection remains a
separate architectural extension, explicitly excluded from this ready scope.

## Documentation changes and verification

This task records the maintainer's inspectable-structural clarification in
ADR-0011 and this readiness report, resolves the former domain blocker, and keeps
the current trust-boundary summary accurate about acceptance versus runtime
support. The earlier reassessment and historical ADR/experiment records are
unchanged; the blocker report is retained as resolved historical evidence.

- `npm run check`: exit 0, run outside the sandbox under the existing approval
  because the offline experiment subprocess suites previously failed inside it.
  Typecheck, all 294 tests, build and package-consumer verification passed
  (104 packaged files). No live experiment trials or external model calls ran.
- `npm run quality -- --base 103521d0d92a14d030ad56bb89e7c0a5ea902d87`:
  exit 0. Same source baseline as the preceding documentation work; source,
  tests and harness each +0/-0, dependencies/lockfile unchanged, no changed
  verification controls, no unapproved execution references/unsupported accesses.
- `git diff --check` and local documentation whitespace/fence/link-source checks
  passed. HTML documentation links were checked against their Markdown sources;
  no site-build script is defined in package.json, and no site configuration
  was changed. The prior reassessment's SHA-256 is unchanged from task start.
- Scoped `git diff --exit-code` confirms no changes to src, test, experiments,
  package manifests/lockfile, tools, CI, ADR-0008 or ADR-0010. Only ADR-0011 and
  the current trust-boundary document are additionally modified, with this new
  report; the prior untracked reassessment remains as it was.

No verification failures remain. Implementation and any expanded safe-selector
decision remain future work; no code, behavioral test, plan-version admission,
release artifact or governance control changed in this task.

Final outcome: **READY_TO_IMPLEMENT_VERSIONED_BOUNDARY**.
