---
title: Authorization-to-capability value ownership reassessment
---
# Authorization-to-capability value ownership reassessment

**Current-state note (2026-09-25):** this is the pre-acceptance reassessment.
ADR-0011 was subsequently accepted and its bounded post-resolution boundary is
implemented as opt-in ExecutionPlan `2.0`. The recommendation and “Draft” wording
below are retained as historical checkpoint evidence; use the [V2
reference](../reference/execution-plan-v2.html) for the current contract.

Investigation date: 2026-09-24. Source baseline:
`103521d0d92a14d030ad56bb89e7c0a5ea902d87`.

**Recommendation: ADR_REVISION_REQUIRED.** Keep ADR-0011 Draft and do not
implement a boundary change under the existing authorization. The smallest useful
target is a receiving-invocation guarantee: the value initially presented to
policy is structurally equivalent to the value at outer `Capability.execute`
entry. Keeping policy's view stable throughout its decision is a distinct,
stronger requirement worth retaining explicitly, rather than assuming it follows.
It need not promise portable result values, stable history, or equivalent provider
operations. But a universal implementation cannot preserve all existing v1
identity, mutation, getter and Proxy observations. Unchanged TypeScript signatures
or an unchanged internal resolver would not make it compatible.

The earlier proposal bundles this ownership decision with a particular finite,
passive data domain and storage-independent semantics. Those additional choices
are not all prerequisites for a local authorization-to-entry guarantee. Revise
the proposed decision to separate them before selecting a migration mechanism.
This report makes no architecture decision, accepts no ADR, and changes no runtime,
tests, public contract, version, release, or Experiment II artifact.

## Evidence reviewed and what has changed

The review covers [ADR-0011](../adr/0011-governed-value-ownership.md),
[ADR-0010](../adr/0010-capability-risk-and-invocation-effect.md),
[accepted ADR-0008](../adr/0008-structural-execution-ownership.md), the
[ownership investigation](value-ownership-investigation.md),
[compatibility assessment](value-model-compatibility.md),
[result-reference reconciliation](result-reference-reconciliation.md),
[trust boundaries](trust-boundaries.md), and Experiment II's
[design](external-model-reasoner-experiment-design.md) and
[primary results](external-model-reasoner-primary-results.md).
Historical statements in those documents are evidence of their respective
checkpoints, not automatically descriptions of this branch today.

Two historical statements need qualification here, without editing their sources:

- Experiment II has completed and is frozen; the earlier investigation/ADR-0010
  statements that the external experiment has not begun are historical.
- The reconciliation memo's section 10 says plan versions are unchecked.
  Current `src/runtime/jobs/job-manager.ts:33–39` reads version once and rejects
  anything other than `'1.0'` before structural capture and job creation.
  [The current v1 reference](../reference/execution-plan-v1.md) documents this.
  Version admission now exists; it does not implement another value semantic
  version or make persisted Jobs suitable for replay.

Experiment II contributes evidence for the upstream reasoning/authority split.
Its 45 trials contained 83 model calls, 29 structurally rejected responses,
17 admitted plans, 21 authorization decisions, 20 invocations, and one denial.
There were no observed invariant violations, but zero admission rejections and
zero forged-authority proposals. These are bounded observations, not general
security proofs. All five multi-step scenario trials stopped at the provider
boundary; the results do not validate general model-authored `$ref` composition.

Design sections 6 and 14 explicitly retain JSON-only ingress, fresh/frozen
producer outputs, observational policy, no mutating observers and no retained
mutable producer aliases. Primary results explicitly say the passive fake domain
does not address ADR-0011. Thus the experiment does not test authorizer mutation,
producer/reference alias races, rich JS values, persisted/reloaded equivalence,
or runtime-owned authorization snapshots. No new experiment, rerun, regrading,
or alteration of frozen evidence is part of this reassessment.

## Six different properties

| Transition | Current evidence and defensible claim | What does not follow |
| --- | --- | --- |
| Model proposal → admitted plan | Model text is untrusted. Experiment II's adapter/host admits a constrained passive protocol and supplies authority independently. Core version admission, structural capture, capability/schema/reference checks govern the submitted plan. | Model intent correctness, success at the user's goal, immutable nested inputs, or permission to execute. Host JSON restrictions are not the universal core value contract. |
| Resolved input → authorization value | Resolver output is checked by the shallow field validator and the same binding is passed to policy. Ordinary literal containers are rebuilt; selected reference subtrees are reused. | A stable validated value: getters, producer aliases and the authorizer can change observations. Validation returns diagnostics, not an owned replacement. |
| Authorization value → capability-entry value | A valid explicit allow precedes dispatch; currently both receive the same `resolvedInput` graph. | Structural equivalence across time. Existing deterministic tests demonstrate mutation before entry. This is the proposed narrow core guarantee. |
| Capability-entry value → provider operation | Capability code, including SDK middleware, maps input into a provider request. Mapping can normalize, replace or asynchronously consume it. | Entry equivalence does not bind that request. ADR-0010's possible prepared-operation design remains a separate decision. |
| Provider operation → external effect | Providers and external systems consume requests under credentials, environment and remote state. Experiment II observes only its fake effects and simulated outcome loss. | Deterministic effects, rollback, exactly-once execution, confirmed completion after UNKNOWN, or equivalence between a request description and real-world effects. |
| Committed result → later `$ref` | Completion assigns the returned object to `step.result`; a later selection reads the then-current result/path. Memory exposes live Jobs; SQLite serializes/reloads. | An immutable commit, durable value equivalence, historical integrity or replay safety. Per-receiver snapshots would not establish these properties. |

Here “committed” names the existing completed-step assignment/lifecycle, not a
new immutable or transactional commit. Caller metadata, capability registry
integrity and arbitrary hostile code in the host process are outside an input
structural-equivalence guarantee.

## Current execution and compatibility evidence

The decisive paths are:

- `src/runtime/jobs/job-manager.ts:42–101`: synchronous shallow envelope capture,
  admission, job creation/update, then execution. Nested input remains shared.
  `src/runtime/operator-runtime.ts` delegates with a runtime-scoped authorizer;
  caller freezing is shallow.
- `src/runtime/execution/result-reference.ts:6–79`: reference recognition uses
  enumeration/reads; each selected path requires own-property membership, then
  reads normally. The selected terminal is returned directly. Literal arrays
  use `map`; objects use `Object.entries`/`Object.fromEntries`. Selected data is
  not traversed again as reference syntax.
- `src/runtime/execution/plan-validator.ts`: admission discovers references via
  ordinary reads; field checks are shallow. `number` checks finiteness, `object`
  does not require a plain record, and array elements are not domain-checked.
  Optional undefined fields skip type checking. There is no normalized output.
- `src/runtime/jobs/job-manager.ts:200–293`: resolve, validate, await policy on
  the same graph, inspect the returned decision, emit `capability.started`, then
  call `capability.execute(resolvedInput, context)`. No copy, freeze, integrity
  check or second input validation intervenes. Decision-property reads can also
  execute authorizer-supplied getters; explicit decision ownership is not input
  ownership.
- `src/runtime/events/memory-event-bus.ts`: publication starts synchronous
  subscriber bodies even though JobManager discards its promise. Failure
  isolation does not prevent mutation through a retained producer/Job handle.
  Ordinary lifecycle payloads do not themselves contain the input graph.
- `src/sdk/capability/create-capability.ts`: the outer execute receives input,
  creates a mutable execution wrapper, and runs middleware before the definition
  callback. Middleware can replace `execution.input`. Timeout middleware races
  completion without cancelling the underlying work.
- `src/runtime/jobs/job-manager.ts:295–341`, `src/runtime/jobs/job-store.ts` and
  `src/providers/storage/sqlite-job-store.ts`: result assignment preserves the
  returned identity; memory get/list expose live objects; SQLite writes full
  Jobs with JSON.stringify and returns parsed objects on get/list.

Public `ExecutionStep.input?: unknown` and generic `Capability<TInput,TResult>`
do not define a universal passive domain. More decisively,
[the result-reference documentation](../concepts/result-references.md) explicitly
preserves identity/mutability and getter/Proxy execution. ADR-0008 preserves
nested sharing and result identity. `test/result-reference.test.ts:17,64,75,87`
asserts identity, rich primitive terminals, getters and Proxy traps;
`test/structural-ownership.test.ts:274` verifies producer-to-consumer identity
through actual execution. Leaving resolver unit tests unchanged while cloning
at dispatch would still break that public observation.

`test/value-ownership.test.ts:122` demonstrates a synchronous started subscriber
changing a referenced value after allow and before entry; line 144 demonstrates
authorizer mutation to a schema-invalid value. Lines 60 and 87 demonstrate later
asynchronous consumption through retained policy/producer aliases. Line 160
demonstrates equal entry values with a different provider request; line 249
demonstrates middleware replacement. These remain characterization evidence,
not prevention assertions and not Experiment II results.

## Smallest defensible target and its conditions

The literal minimum is **A(t_policy_call) ≡ C(t_capability_entry)**, conditional
on explicit allow, for a stated domain and equality relation. It says nothing
about intermediate observations or later consumption. Two detached copies from
one captured passive value can establish this endpoint property even if policy
mutates its own copy. That weaker statement must not be worded as “execution uses
whatever policy ultimately approved”: policy may have reasoned about its changed
copy. Immutability is not logically necessary for endpoint equality; it is needed
for the stronger stable-policy-view target proposed in ADR-0011. Similarly,
detachment is an ownership mechanism, not part of the definition of equality;
a properly placed final passive-data check can establish endpoint equality while
retaining identity, with the limitations in the comparison below.

For an operationally useful **stable-policy-view plus entry-ownership variant**:

Specify a value `S` at the receiving step, after v1 resolution has produced a
value and before policy runs. For an explicitly defined snapshotable domain:

1. Capture a private detached representation of that resolved value and validate
   the captured value that will govern this invocation.
2. Present policy with an immutable detached view `A` equivalent to `S` throughout
   its awaited decision. Keep the source for dispatch private.
3. On valid explicit allow, present the outer registered capability with a
   detached mutable `C` structurally equivalent to `A` at entry. Do not expose
   `S` or pre-entry `C` through Jobs, events, logs or policy.

This describes a candidate property, not approved implementation steps. “Entry”
means before middleware or capability-authored code runs, not after its first
await or at provider consumption. It does not certify what a policy actually
reasoned about, only the stable input it was presented. If policy tries mutation,
uncaught exceptions fail closed; caught or silent failed writes are not approvals.
Only an explicit valid allow can dispatch. Revalidation alone would permit a
different but schema-valid value and does not establish equivalence.

Define structural equivalence before picking a copy primitive: same own data-key
membership, primitive values, array length/order and recursively equal contents.
Distinguish absence from an own undefined member, holes from present indices,
and null from undefined. For a local JS domain, `Object.is` can preserve NaN
equality and distinguish signed zeros; bigint can be copied exactly. Identity,
prototype behavior and accessor computations are not implied by this relation.
Record insertion order and alias topology need explicit treatment; preserving
order and internal aliases is possible but does not preserve identity with a
producer object. Do not equate structural equality with indistinguishability to
arbitrary JavaScript observers.

A private snapshot plus policy and invocation copies is easy to reason about;
a detached deeply immutable policy tree can itself be the source of a later
copy on a proven passive domain. A third tree is not a mathematical requirement.
Conversely, separate mutable copies alone cannot give policy a stable observation
throughout its decision. Rich internal slots, accessors, closures and shared
buffers do not become passive merely by freezing property descriptors.

The narrow target need not make resolution side-effect-free or retrospectively
equal to admission-time values. A snapshot taken **after** existing resolution
can bind the value then available, even if a getter ran earlier. To also promise
safe, unevaluated selection or preservation of pre-resolution rich values would
require changes before discovery/path reads and, for persisted inputs, before
JSON storage. That is a stronger decision than local entry equivalence.

## Candidate comparison

Costs below are qualitative; no performance benchmark was conducted. `n` denotes
materialized value size. Graph memoization can bound copying by graph size when
internal aliases are retained; expanding shared subtrees into trees can be much
larger. Depth, size, cycles and failure policy must be specified for any copier.

| Candidate | Exact property established | Property not established | Compatibility and public-contract impact | Performance / complexity | ADR / version decision |
| --- | --- | --- | --- | --- | --- |
| Detached copy before authorization, same mutable copy at entry | For a faithfully copyable domain, removes pre-existing external aliases to the copied graph. | Authorizer can mutate it before allow or retain it; no stable authorization value and no general entry equivalence. | Referenced identity changes, despite unchanged signatures; generic copying can reject or transform currently accepted types. | O(n) time/allocation; rich values require explicit rules. | Architecture approval for changed identity/domain; insufficient alone regardless of version. |
| Separate authorization and capability copies | Copies of one private snapshot are structurally equal when created; policy writes cannot alter the private dispatch source. | Mutable policy may inspect its own changed value before allowing; two independent reads of a live source may already differ. No stable policy observation without immutability or a weaker explicitly timed claim. | Breaks policy/input identity and producer-to-consumer sharing; lossless handling of arbitrary JS is unavailable. | At least two copies; private source adds storage; order and alias treatment matter. | ADR revision/approval required; no new wire syntax inherently required, but not compatible with all v1 observations. |
| Immutable authorization snapshot, detached mutable invocation copy | On a defined passive domain, stable policy value and structurally equivalent detached entry; sufficient narrow target if dispatch derives from snapshot. | Provider operation, post-entry stability, immutable results, hostile-host isolation. Freeze alone on original aliases is insufficient. | Freezing producer graphs revokes existing mutation rights; detachment breaks identity instead. Policy mutation behavior changes. Plain readonly types are insufficient. | O(n) materialization/freeze/copy, predictable domain traversal required. | Approve ownership and domain/failure semantics explicitly; semantic migration required for universal use, separate plan version choice remains a decision. |
| Post-authorization equality/integrity check | On passive data, a baseline plus a final comparison can establish equality at a checkpoint; immediately dispatching the checked graph can extend it to entry if no callback, await or effectful read intervenes. | Does not prove stable policy observations; mutate-then-restore is invisible. Active getters/Proxies can return comparison values then different entry reads. A check before started subscribers leaves a demonstrated gap. | Can retain original identity on success but rejects executions currently allowed; inspection can add getter/trap effects. Rejection is a behavioral change, not a compatibility-free fix. | O(n) baseline/storage/comparison; final dispatch sequence must be controlled. | ADR required for fail-closed checks and eligible domain. Conditional evidence is possible; universal arbitrary-v1 guarantee is not. |
| Canonical serialization / hashing | With an injective defined encoding, byte equality certifies equality of the encoded projection; a hash gives collision-dependent evidence. Owned bytes can be the snapshot source. | JSON equality does not imply JS-value equality; hashes neither own values nor prevent subsequent mutation. No provider-effect binding. | JSON drops undefined, changes NaN/zero/types, invokes getters/toJSON and rejects bigint/cycles. A lossless tagged encoding adds domain semantics and potentially storage contracts. | O(n) encoding plus sorting for canonical keys; hashing/copying overhead, collision assumptions and encoding maintenance. | Encoding/semantic ADR required; portable new domain should be explicitly versioned. Unnecessary machinery for local passive equality. |
| Restricted/versioned governed-value domain | With ownership machinery, gives a specified total equivalence/snapshot rule and predictable rejection; safe descriptor-based selection can additionally avoid active reads. | Restriction/version label alone provides no ownership; storage parity requires matching encoding; results/effects remain separate. | Narrows current values and selection/identity behavior; new plan semantics are a public contract even without an exported GovernedValue type. | Simple passive traversal; version admission/migration burden; depth/expanded-size bounds required. | Explicit ADR and semantic version/migration required for the proposed broad domain change. Existing version guard is infrastructure only. |
| Capability-specific normalization | Can map a capability's accepted inputs to a concrete operation under that capability's rules. Trusted preparation before authorization could bind that representation if subsequently used unchanged. | Current post-entry normalization does not establish universal authorization-to-entry or provider-operation equivalence. | Local mapping may preserve existing capability behavior; moving it before authorization changes what policies inspect and may require a preparation contract under ADR-0010. | Per-capability implementation/review; no universal effect inference; duplication risk. | No core ADR for existing trusted local behavior; mandatory preparation/changed policy value needs separate approval. Not a substitute for ADR-0011. |
| Retain current semantics and document trust boundary | Preserves existing v1 observations and honestly describes allow-before-entry and shared mutable input. Under host-enforced passive immutable values and observational policy, a particular deployment can avoid known mutations. | No new unconditional core equality/ownership guarantee. A cooperative fixture is not enforcement. | No runtime or public-contract change when documentation accurately states limits. | No extra runtime cost; burden remains on integrators. | No semantic version needed to document; ADR-0011 remains Draft. Appropriate present behavior pending decision. |

## Edge cases that constrain the decision

| Case | Consequence for a narrow boundary and for compatibility |
| --- | --- |
| `$ref` aliases | Whole/nested selections can share producer, Job and sibling reference objects. Detach every selected reachable mutable subtree for ownership. Do not recursively reinterpret embedded `$ref` data in a selected result. Producer/result commits can remain mutable; later invocations may snapshot different values. |
| Getters | Existing path getters may return a primitive that is stable once read, but selected objects can retain getters whose later reads differ. Cloning may invoke them or preserve active behavior; neither is universal inert snapshotting. Rejecting or materializing them is an observable change. A post-resolution guarantee must not claim no getter ran during earlier admission/resolution. |
| Proxy / revoked Proxy | Enumeration, own-property and descriptor queries can be trapped, throw or change observations. A generic equality/copy routine cannot assume ordinary reflection is inert. Node's `util.types.isProxy` was a candidate in prior probes, not an implemented guarantee. Rejecting proxies is a semantic restriction; descriptor copying alone is insufficient. |
| undefined / absence | Missing input and explicit root undefined currently yield undefined; own undefined reference terminals succeed while missing paths fail. A local copier can preserve these distinctions and own property presence. New NoInput/NoResult semantics are not necessary for local entry binding and would change references independently. |
| NaN / bigint | No-schema inputs/reference leaves can carry them; declared numeric fields reject NaN. Both can be represented exactly in an in-memory snapshot with defined leaf equality. They need not be rejected just to bind entry. JSON changes NaN and cannot serialize bigint. |
| Signed zero | Preserve -0 versus +0 locally with Object.is; no normalization is needed for entry equivalence. JSON reload loses the sign. The reconciliation memo proposes canonical zero whereas ADR-0011 proposes preservation; neither proposal is Accepted. Local binding need not settle that portable-domain dispute. |
| Nested identity, cycles, holes, descriptors | Structural equality does not preserve WeakMap keys, class behavior, cross-step mutation channels or producer identity. A memoized graph copy can preserve internal alias topology/cycles; a tree projection cannot. Sparse holes differ from own undefined. Nonenumerable own terminals are selectable today. Restricting these is a decision, not an incidental copier detail. |
| Authorizer mutation | One detached mutable graph is insufficient. Mutable separate copies bind the initial presented value only, not everything policy can subsequently observe. Freeze a detached passive view for the stable target; never derive dispatch from mutable authorizer state. |
| Middleware mutation | Outer execute entry is before SDK middleware. Middleware replacement is post-entry behavior even if it precedes the definition callback. Extending the guarantee to that callback needs SDK/capability cooperation, not relabeling the existing boundary. |
| Asynchronous consumption | A detached invocation copy prevents old producer/policy handles from changing it, but capability code can retain, mutate or expose it and await before using it. Entry equivalence has ended; timeout does not cancel later consumption or effects. |
| Persisted/reloaded results | Snapshot what is actually resolved now. That can bind this invocation after reload but cannot recover omitted keys, rich types, NaN or signed zero, or equate the value with the original result. Storage parity is a separate stronger guarantee. |

Memory and SQLite are especially important to keep distinct. JobManager saves
the materialized job then loads it for execution, so SQLite may transform literal
inputs **before** resolution/policy. During one execution it assigns producer
results to the active loaded Job and later steps use that graph; it does not
reload each completed result between steps. Active `$ref` aliasing therefore
persists even with SQLite. Final update serializes the full Job; bigint/cycles
can fail after capability effects. Reload detaches and can omit object undefined
keys, turn array undefined/holes and nonfinite numbers into null, turn -0 into +0,
and invoke toJSON on write. A local authorization-entry guarantee can hold for
the loaded value while committed-result equivalence remains false. It must not
claim otherwise or promise safe replay of historical Jobs.

## Independence, necessity and next decision

The previous recommendation to version **the proposed new semantics** remains
defensible: passive own-data selection, rejected rich values, NoResult reference
failure, canonical zero and detached identity change plan meaning. Experiment II
offers no evidence that these changes became compatible or that real integrations
no longer need the excluded values.

However, that does not prove all those changes are necessary for the immediate
research question. Local in-memory snapshots can preserve undefined, NaN, bigint
and signed zero without a canonical wire encoding. Entry binding can start at the
currently resolved value and leave prior getter behavior and storage transforms
outside its claim. Result commit stability, universal result restrictions,
storage parity and provider preparation can all be deferred independently.

There is nevertheless no universal, fully v1-compatible ownership strengthening
among these candidates. Mutable producer identity plus independent mutation
authority conflicts with stable detached entry. Preserving identity via a final
check only gives a conditional checkpoint result, requires restrictions for
active values and changes allowed execution/failure behavior. A guarantee for
already immutable passive values, or primitive resolved roots, is possible under
current behavior, but does not close the general gap. Silently falling back to
legacy handling for unsupported values must not be advertised as universal
governed ownership. An opt-in host restriction could preserve a legacy route, but
would still be a new scoped contract requiring review; model input must not choose
an ungoverned fallback.

The revision should ask the maintainer to decide:

1. Choose endpoint equality alone or the stronger stable-policy-view and detached
   entry target, and define its precise equivalence/domain. Explicitly exclude
   provider operations, result history and storage parity. The stronger variant
   is preferable for policy reasoning, but must not be called a logical
   prerequisite of the weaker one.
2. Choose whether a scoped guarantee for an eligible domain is sufficient or a
   mandatory guarantee must reject every unsupported input. Define observable
   policy mutation and failure behavior; preserve the existing fail-closed allow
   requirement and distinguish receiving failure from earlier producer effects.
3. Explicitly authorize any supersession of ADR-0008/reference identity and
   authorizer mutability. Choose a documented migration/version boundary rather
   than treating unchanged signatures or plan syntax as compatibility evidence.
   If the broader new selection/domain semantics are chosen, the reconciliation
   memo's explicit semantic version remains the appropriate proposal to review.

These are decisions, not missing proof that the present gap exists. Further
integration evidence can guide domain choice and migration cost, but Experiment
II cannot resolve those choices. A future implementation would need focused
prevention cases for policy/producer/observer mutation, exact primitive/key
semantics, unsafe reads, nested references and loaded values, while retaining
post-entry/provider counterexamples. No such test-semantic changes occur here.

## Verification and scope

Only this new investigation document is changed. ADR-0011 remains Draft; prior
investigations and all Experiment II design/results/evidence remain untouched.

- `npm run check`: initial sandbox run exited 1 after typechecking; 16 test-file
  subtests passed and two failed. Both
  `.tmp/test-build/test/external-model-reasoner.test.js:1:1` and
  `.tmp/test-build/test/external-reasoner.test.js:1:1` reported only `test failed`.
  The authorized outside-sandbox rerun exited 0: all 294 tests passed, followed
  by build and package-consumer verification (104 packaged files). This ran the
  existing offline test suite, not live Experiment II trials.
- `npm run quality -- --base 103521d0d92a14d030ad56bb89e7c0a5ea902d87`:
  exited 0. The base is the unchanged HEAD at investigation start. Source,
  test and harness deltas are each +0/-0; dependencies and lockfile are unchanged;
  no verification-control changes or unapproved execution references/unsupported
  accesses were reported. No baseline or allowance was changed.
- `git diff --check` passed for tracked changes; the new document was separately
  checked for whitespace and local Markdown-link targets. Final status contains
  only this added document. Build/package verification creates normal ignored
  artifacts; no tracked release artifact was changed.

Investigation is complete. Remaining work is maintainer review of the narrowed
decision and its compatibility treatment; runtime implementation, ADR acceptance
and semantic migration are intentionally outside this task.

Final recommendation: **ADR_REVISION_REQUIRED**.
