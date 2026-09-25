---
title: Reasoning-boundary research synthesis and adoption readiness
---

# Reasoning-boundary research synthesis and adoption readiness

## Review scope and research question

This document synthesizes the completed reasoning-boundary research on branch
`research/reasoning-boundary` at `01bc9c6b92d57bd5b2143d5f8dfd1fc5a4875c64`.
The intended comparison base is `main` at
`bb3f34e4f938096acec897159f0f56283c11697a` (`v0.2.0`). The branch contains
five commits:

1. `7357295` — prepare the external-model reasoner experiment and harden the
   governed execution path;
2. `103521d` — complete Experiment II and record its primary results;
3. `e02c440` — implement the versioned governed-value boundary;
4. `0c1a08f` — enforce exact result-reference recognition; and
5. `01bc9c6` — clarify the pre-capture trusted-host boundary.

The research question was whether Veil could replace deterministic planning with
an external model while keeping authority in the host/runtime, and then state
precisely what value and reference guarantees exist between a proposal and an
effect. The adoption question is narrower than “is every possible execution
safe?” It is whether the decisions and implementation are coherent, tested and
documented well enough to move to main without claiming properties the work did
not establish.

The answer is:

- external reasoning can remain proposal-only while Veil retains admission,
  authorization and dispatch authority;
- ExecutionPlan 2.0 can, when the host explicitly enables it, guarantee a stable
  immutable authorization value and a detached structurally equivalent value at
  outer capability entry;
- exact result-reference wrapper recognition is now defined for v1 and v2;
- none of those decisions makes arbitrary in-process capability/provider code,
  pre-capture JavaScript traversal, persistence, provider operations or external
  effects owned by Veil;
- the core v2 value mechanism now constructs its detached capability-entry copy
  after allow and before the running/`capability.started` transition, as required
  by ADR-0011; and
- the public documentation now presents a coherent opt-in adoption surface for
  ExecutionPlan 2.0 without changing defaults or release metadata.

The bounded ADR-0011 conformance blocker identified by this synthesis is resolved.
After the bounded adoption-preparation pass, the recommendation is
**READY_TO_ADOPT**, subject to maintainer review and normal merge/release authority.

## How to read the evidence

The repository contains different kinds of evidence. They must not be collapsed
into one strength of claim:

- **Hypothesis:** a proposition the experiments were designed to examine.
- **Architecture decision:** an accepted semantic choice in an ADR. A decision
  alone is not proof that the runtime implements it.
- **Implemented guarantee:** behavior enforced by current runtime code on a
  stated path and version.
- **Deterministic evidence:** regression tests, the governance harness, or the
  scripted Experiment I fixture. This can prove a tested mechanism or invariant
  for the covered conditions, not arbitrary deployments.
- **Empirical model evidence:** observed behavior in the frozen 45-trial
  Experiment II matrix. It is evidence about that apparatus, provider, model and
  run, not a universal model/runtime guarantee.
- **Observation or limitation:** a reachable behavior, explicit exclusion, or
  gap that bounds stronger claims.

Accepted ADR-0011 and ADR-0013 define architecture. Their corresponding runtime
changes and tests establish the implemented guarantees. Experiment II did not
establish either ADR's value semantics; its fixture deliberately used passive
values and observational policy.

## Research sequence

### 1. Original reasoning/execution boundary

The original architecture separated planning from execution. `Planner` returns
an `ExecutionPlan`; `PlannerStrategy` orchestrates planners; `PlannerRouter`
selects a strategy; and both `run` and direct application plans converge on
`OperatorRuntime.executePlan`. An ExecutionPlan is requested work, not permission.
Registered capabilities and providers likewise do not authorize themselves.

The original boundary was directionally correct but had several concrete
questions around externally authored proposals: whether every execution entrance
was governed, whether hosts had structured admission evidence, whether plan
versions were actually admitted, and whether the value seen by authorization was
the value that entered a capability.

### 2. Governed-entry and admission hardening

Before testing a real model, the branch removed known ambiguity from the
execution path:

- HTTP capability-work entrances were routed through `OperatorRuntime`; the
  LinkedIn status route stopped directly invoking a capability.
- stored-Job execution over HTTP was retired with `410`; a Job is an execution
  record, not a resumable proposal.
- route caller resolution became trusted host configuration rather than request
  data.
- `http.request` and `shell.command.run` received conservative `destructive`
  risk, and shell policy changed from prefix recognition to exact executable/argv
  tuples.
- accepted ADR-0012 added provenance-owned, immutable, sanitized structured
  admission diagnostics; the version-admission extension added
  `UNSUPPORTED_PLAN_VERSION`.
- the governance checker was strengthened so API-route execution allowances
  cannot be accepted through the baseline.

These are implementation and deterministic-test results, not Experiment II
observations. Draft ADR-0010 records the distinction between static capability
risk, a possible prepared operation and an eventual effect; it is not an accepted
operation/effect contract.

### 3. Deterministic Experiment I

[Experiment I](external-reasoner-experiment.md) placed a scripted reasoner in a
separate process behind a bounded JSON-line host. It discovered detached
capability descriptors, submitted ExecutionPlan 1.0 proposals, consumed projected
feedback, corrected a malformed proposal, encountered denial, attempted forged
authority, used a result reference, handled partial completion and exercised an
UNKNOWN/replay scenario.

Its checked trace contains 19 exchanges, 12 authorizations, 9 capability
invocations (3 reads and 6 writes), and 5 fake assignment effects. The fixture
demonstrated the deterministic control path and showed that an external proposal
loop needed no new core reasoning primitive. Its repairs and adversarial moves
were scripted. Its frozen/passive value discipline, process-local replay guard and
fake effect oracle were fixture mechanisms, not Veil guarantees. Separate
processes were not claimed as an OS sandbox.

### 4. Experiment II design and hypothesis

[Experiment II](external-model-reasoner-experiment-design.md) replaced the
scripted reasoner with a real external model while retaining the same authority
boundary. Its hypothesis had two deliberately separate parts:

- the model could discover operations, author proposals, use feedback and
  distinguish success, failure and uncertainty; and
- every actual capability entry would still require an explicit host-policy
  allow, regardless of model competence or forged proposal data.

The model/provider adapter was experiment-local. The host supplied caller,
scopes, policy, risk, capability inventory and provider selection. Model output
remained serialized untrusted data. The design froze a nine-scenario, five-trial
matrix and separated semantic outcomes from provider-boundary failures.

### 5. OpenAI provider-boundary finding

Smoke and pilot work found that a completed OpenAI Responses call could contain
multiple public assistant messages/`output_text` parts. The adapter therefore
required exactly one unambiguous public assistant proposal and rejected rather
than concatenating, selecting or repairing ambiguous content. JSON-object mode
constrained the wire grammar but did not make plan semantics trusted.

This established an important boundary rule: provider response projection is a
separate trusted adapter responsibility, and ambiguous provider output must not
be treated as a plan. It did not establish that the provider will reliably
produce the accepted response shape.

### 6. Frozen 45-trial Experiment II matrix

The completed matrix provided an existence demonstration: real model responses
crossed the serialized boundary, authored valid plans, received governed
feedback, preserved uncertainty in two trials and produced one material replan.
It also exposed a high provider-boundary failure rate. The detailed results are
summarized below and remain empirical observations, not security proof.

### 7. Authorization-entry ownership reassessment

The [ownership reassessment](authorization-entry-ownership-reassessment.md)
separated five commonly conflated properties:

1. the value initially presented to authorization equals the value at capability
   entry;
2. the authorization view stays stable while policy awaits;
3. capability entry equals the eventual provider operation;
4. provider operation equals the external effect; and
5. a committed producer result remains stable for later references.

Existing v1 behavior could not universally provide the first two properties
without changing observable identity, authorizer mutation, value-domain and
failure behavior. The reassessment narrowed the defensible target to a captured
post-resolution value, an immutable detached authorization view and a detached
equivalent capability-entry value. Provider, effect, committed-result and storage
properties stayed out of scope.

### 8. ADR-0011 and ExecutionPlan 2.0

[ADR-0011](../adr/0011-governed-value-ownership.md) accepted the narrowed target
as versioned semantics. Commit `e02c440` allocated ExecutionPlan `2.0` and
implemented it:

```text
resolution
  -> governed capture of supported representation S
  -> validation of S
  -> detached recursively frozen authorization view A
  -> explicit allow
  -> detached mutable capability-entry value C
```

For successful v2 invocation, `A` and `C` are structurally equivalent under the
ADR's definition, their containers do not alias one another or the source graph,
and the authorization input remains immutable throughout the policy call.
Unsupported representations fail before authorization and invocation. Capture is
bounded and rejects accessors, Proxies, functions, symbols, cycles, sparse arrays,
unsupported native brands, custom/cross-realm prototypes and other values outside
the governed domain.

The host must explicitly enable v2 with `planVersions`. The default remains v1.
The host may run v2-only or deliberately run both versions. V1 retains its legacy
authorization/input identity and mutation behavior.

### 9. Result-reference investigation and ADR-0013

The [result-reference investigation](result-reference-resolution-investigation.md)
found that the old recognizer did not precisely implement the documented
single-field tag. It could recognize inherited/accessor `$ref` values and ignore
hidden or symbol extras. Because recognition decides whether an object is data or
an instruction, that was an architecture decision rather than a private parser
detail.

[ADR-0013](../adr/0013-result-reference-object-shape.md) accepted an exact shared
v1/v2 representation: a non-array object whose complete own-key set is exactly
`$ref`, where `$ref` is an enumerable own data property containing a primitive
string. Prototype identity and descriptor writability/configurability do not
matter. Proxies are not categorically rejected and may run traps. Commit
`0c1a08f` implemented this as a documented v1 correction and v2 rule, with
focused regression coverage.

The decision governs wrapper recognition only. It does not make recursive input
discovery or result-path traversal passive.

### 10. Pre-capture traversal and trusted-host clarification

The [pre-capture investigation](pre-capture-result-reference-boundary.md) showed
that selecting `steps.<id>.result.<path>` can call own getters or Proxy traps
before v2 capture, receiving-step validation and receiving-step authorization.
Completed producer results are live in-process graphs; memory storage retains
their identity, and SQLite does not reload a newly produced result between active
steps.

The investigation found no receiving-capability authorization bypass. Traversal
receives no caller, scopes, capability or provider authority. A throwing traversal
prevents the receiving authorization/invocation, and reentrant plan submission
still follows its own admission and authorization. Behavior already performed by
the callback is not rolled back.

The resulting decision was documentation, not new runtime architecture:
installed capabilities, middleware, providers and other in-process integrations
are trusted executable host code. “Trusted” describes placement and the absence of
process isolation; it does not make those components authorization authorities.
The configured host authorizer remains the authority for each governed receiving
invocation.

## Resulting end-to-end trust and authority model

| Boundary | Trusted component | Untrusted/data component | Authority owner | Code that can run | Veil guarantee |
| --- | --- | --- | --- | --- | --- |
| External reasoner | Host configuration and provider adapter | Model output, goals, imported task data and proposed authority fields | Host owns credentials, selected provider/model, exposed descriptors and what may be submitted | The external provider/model runs outside the Veil execution boundary; returned text is data | No capability authority follows from reasoning or refusal. |
| Serialized proposal | Host parser/adapter and its size/shape checks | Serialized public proposal | Host decides whether an unambiguous proposal reaches Veil | Parser/adapter code; plain parsed JSON contains no getter, Proxy or closure | Ambiguous Experiment II provider responses did not reach the protocol decoder or Veil; this is an adapter property, not universal provider reliability. |
| ExecutionPlan | Runtime public entry and host-selected supported versions | Goal, plan structure, capability names/versions, inputs, reasons, references and model-authored metadata | Plan carries no caller, scopes, policy, risk downgrade or permission | Direct in-process plan getters/Proxies may run during reads; JSON plans are passive data | A plan is a proposal. Unsupported versions reject without fallback. |
| Admission | `OperatorRuntime`/`JobManager`, registry and validator | Captured proposed structure and literal/reference inputs | Runtime owns admission; capability registration is resolvability, not permission | Structural capture and recursive discovery may execute hostile in-process JavaScript mechanics | Version, nonempty steps, capability/version, schema fields, unique IDs and reference syntax/order are checked before Job creation; known admission failures expose owned structured diagnostics. |
| Result-reference resolution | Runtime recognizer/parser/resolver and earlier completed JobSteps | `$ref` text and producer result graph | Resolution selects data; it grants no authority | ADR-0013 Proxy traps, input recursion, own result getters and Proxy traps may run | Exact wrapper recognition; own-property-only path traversal; failure prevents receiving authorization/entry. No passive-traversal or rollback guarantee. |
| Governed capture | V2 runtime copier and trusted built-ins | Already-resolved receiving value | Runtime owns the v2 receiving representation | No application callback for a value admitted into the governed domain; unsupported active/rich values reject | V2 captures a private supported representation before receiving validation. V1 has no such guarantee. |
| Receiving validation | Runtime schema validator and registered shallow schema | Resolved v1 input or captured v2 input | Runtime owns validation; schema metadata is not permission | Registered validation predicates | A declared mismatch fails the receiving step before authorization/invocation. The schema is shallow and not general JSON Schema. |
| Authorization | Host-configured `ExecutionAuthorizer` | Proposed operation data; under v2, immutable detached input | Host authorizer owns allow/deny; model, capability and provider do not | Trusted policy code deliberately runs and may await | Only a valid own `decision: 'allow'` proceeds. Deny, malformed decision or thrown policy fails closed. Caller/scopes are host-supplied shallow-frozen snapshots. |
| Capability entry | Registered capability plus middleware | V1 live resolved value or v2 detached mutable entry value | Prior host authorization permits entry; capability cannot self-authorize | Installed capability/middleware is trusted executable host code | Entry occurs only after allow. V2 entry input is detached and structurally equivalent to the initial authorization input. |
| Provider and effects | Installed capability/provider integration and external system | Provider responses and remote state | External credentials/system plus trusted host code determine actual effects; Veil's decision only governs capability start | Arbitrary capability/provider/remote behavior | Veil does not guarantee provider-operation equivalence, external-effect equivalence, transactionality, rollback, delivery or exactly-once behavior. |

Trusted host code is therefore not synonymous with authorization authority. A
provider may have ambient credentials or return active objects because it is
installed in the process. It still cannot create a valid Veil allow decision for
its containing capability unless it is also deliberately installed as the host's
authorizer. Direct calls performed by arbitrary trusted host code are outside the
governed proposal path, not evidence that a plan gained authority.

## Established guarantee inventory

The table below uses “Experiment I/II” only as corroborating observations. Runtime
and deterministic tests are the basis for implemented guarantees.

| Established guarantee | Scope | Runtime | Tests | Accepted ADR | Governance harness | Experiment I | Experiment II |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Reasoning is separate from execution authority | `run` and direct-plan paths converge on `executePlan`; planners return proposals | Yes | Yes | Architectural laws and existing ADRs | Yes | Controlled demonstration | Observed for accepted responses |
| Model-authored plans remain proposals | Plan fields cannot supply authorizer, caller/scopes, registry ownership or provider selection | Yes | Yes | ADR-0012/0011 boundaries | Yes | Forgery was denied | Host retained authority; no accepted forged field |
| Caller identity/scopes are host-owned | Public runtime options and trusted route resolver; caller is shallow-copied/frozen | Yes | Yes | Existing execution contract | Route checks | Fixed host caller | Fixed host caller; zero model-controlled caller/scopes observed |
| Version and structural admission precede governed execution | Supported version, nonempty/known/version-matched capabilities, fields, unique IDs and reference order are checked pre-Job | Yes | Yes | ADR-0012 plus version extension | Indirect | Rejection cases | All 17 submitted plans admitted; no rejection case occurred |
| Admission diagnostics are owned, immutable and sanitized | Known pre-Job issuance sites only; not a general failure taxonomy | Yes | Yes | ADR-0012 | Reviewed sites | Fixture consumes projected codes | Experiment protocol can project direct evidence |
| Authorization precedes every governed capability invocation | Each step requires a valid explicit allow; deny/malformed/throw prevents start | Yes | Yes | Existing authorization ADR/contracts | Guards entrances | 12 decisions before 9 invocations | 21 decisions; 20 allows/20 invocations, 1 deny/0 denied invocation |
| Execution entrances in repository HTTP routes are governed | Capability execution routes use `OperatorRuntime`; stored-Job execution is retired | Yes | Yes | No new execution abstraction | Yes; API route allowances forbidden | Alternate entrance rejected by fixture | Apparatus exposed only governed fixture entrances |
| V2 governed-value ownership | After resolution, supported value is privately captured before validation | Yes, v2 only | Yes | ADR-0011 | Sites individually reviewed | Not covered | Not covered; passive fixture explicitly excludes this claim |
| V2 immutable authorization input | Authorization receives a detached recursively frozen graph with nonreplaceable input binding | Yes, v2 only | Yes | ADR-0011 | Implementation sites reviewed | Not covered | Not covered |
| V2 detached equivalent capability-entry input | On explicit allow, outer capability receives a fresh mutable graph structurally equivalent to initial authorization input | Yes, v2 only | Yes | ADR-0011 | Invocation site reviewed | Not covered | Not covered |
| V2 unsupported values fail closed | Initial capture/domain or authorization-view copy failure yields no receiving authorization or capability entry | Yes, v2 only | Yes | ADR-0011 | Copy sites reviewed | Not covered | Not covered |
| V1 governed-value compatibility | V1 remains default and retains historical shared-value semantics; mixed hosts dispatch semantics by plan version | Yes | Yes | ADR-0011 requires it | Yes | Uses v1 | Uses v1 |
| Exact result-reference wrapper recognition | Complete own-key set is only enumerable data `$ref: string`; shared by v1/v2 | Yes | Yes | ADR-0013 | Recognizer site reviewed | Trace uses ordinary exact wrappers | Accepted plans use serialized exact wrappers |
| Own-property result traversal | Every path segment must be own; inherited paths reject | Yes | Yes | Earlier hardening contract | Yes | Missing path fails before sink | Apparatus uses passive ordinary results |
| Receiving failure is fail-closed | Resolution, v2 capture, validation, deny or authorizer failure prevents that receiving capability entry | Yes | Yes | ADR-0011 and existing contracts | Yes | Observed rejection/denial/failure | One denial caused no invocation/effect; no ambiguous provider response executed |

The v1 compatibility row is intentionally narrow. The branch also contains
documented corrections and release-significant behavior changes: version
admission, ADR-0013's cross-version recognizer correction, route retirement,
conservative HTTP/shell risk changes and exact shell tuple policy. “V1 value
compatibility” must not be read as “the entire branch has no observable change.”

## Explicit non-guarantees

Veil still does not guarantee:

- **Hostile plugin or process isolation.** Installed capabilities, middleware,
  providers, authorizers, observers and runtime support code share the trusted
  host process unless another documented isolation layer is added. The experiment
  subprocess arrangement is not an OS sandbox.
- **Passive admission or traversal for arbitrary JavaScript.** Structural plan
  capture, recursive reference discovery, ADR-0013 Proxy reflection, literal
  recursion and result-path getters/Proxy traps can execute before v2 governed
  capture. Exact wrapper recognition prevents an ordinary accessor from defining
  the tag; it does not make the whole resolver getter-safe or Proxy-safe.
- **Pre-resolution value ownership.** V2 owns the representation returned by
  resolution. It does not guarantee equality with submission-time input,
  producer-return time or producer-completion time.
- **V1 authorization-to-entry stability.** V1 policy, observers, producer aliases
  and capability entry may share mutable values as historically documented.
- **Committed-result immutability or reference stability.** A producer result is
  assigned as a live graph. Producers, observers and other aliases can mutate it
  before a later reference captures a value.
- **Persistence parity.** Memory and SQLite can expose different identity and
  representation. JSON persistence can run behavior, lose unsupported values,
  change `undefined`, nonfinite numbers or signed zero, and reject bigint/cycles.
  Active execution does not reload each producer result between steps.
- **Durable v2 replay/resume semantics.** The plan semantic version is carried
  into the immediate execution call, not stored as a durable Job semantic field.
  The public stored-Job execution route is retired. Historical Job replay and
  migration are outside the v2 guarantee.
- **Capability-entry to provider-operation equivalence.** Middleware or capability
  code can mutate/replace input, normalize values or construct another request.
- **Provider-operation to external-effect equivalence.** Credentials, ambient
  configuration, provider implementation, network behavior and the external
  system determine actual effects and certainty.
- **Rollback or transactionality.** Earlier steps, traversal callbacks, providers
  or external systems may have acted before a later failure. A failed Job does not
  undo those effects.
- **Exactly-once execution, idempotency or safe retry.** Current idempotency keys
  are recorded but do not deduplicate. Experiment replay guards are fixture-local.
- **Cancellation or effect cessation after timeout/failure.** No general provider
  cancellation/effect protocol was established.
- **Universal model competence or reliability.** The 45-trial matrix is five
  repeated cases per scenario, not a statistical or cross-model claim.
- **Provider response-shape reliability.** Experiment II instead observed 29
  ambiguous responses in 83 calls. Strict rejection contains ambiguity; it does
  not make ambiguity rare.
- **A general security proof.** Zero observed invariant violations is a bounded
  observation. The authority scenario generated zero forged-authority attempts,
  and no plan in the matrix was rejected by admission.
- **Production authentication, tenant isolation or runtime-instance isolation.**
  The bundled server is unauthenticated unless a host supplies identity; registry
  and Job services remain process-global.
- **General schema or output semantics.** Capability descriptors expose shallow
  input metadata, not full JSON Schema, output paths, provider readiness, resource
  permission or effect certainty.

These exclusions are not adoption blockers for the architecture that was actually
chosen. They become blockers only if a future product claim or threat model
requires one of them.

## Experiment II synthesis

### Exact primary results

The frozen primary run scheduled and completed records for all 45 trials and made
83 real OpenAI Responses calls. It used `gpt-5.4-mini` as requested (reported
revision `gpt-5.4-mini-2026-03-17`), JSON-object wire mode and the source/prompt/
protocol hashes recorded in the primary report.

| Measure | Result |
| --- | ---: |
| Scheduled/completed trial records | 45 / 45 |
| Real-model calls | 83 |
| Accepted protocol-valid public responses | 54 |
| Provider-boundary ambiguous responses | 29 / 83 (34.9%) |
| Scheduled trials stopped at that boundary | 29 / 45 (64.4%) |
| Trials reaching the host and terminal evaluation | 16 |
| Submitted/admitted plans | 17 / 17 |
| Authorization decisions | 21 |
| Allows / denials | 20 / 1 |
| Capability invocations | 20 |
| Effects | 10 |
| UNKNOWN trial outcomes | 2 |
| Material replans | 1 |
| Terminal successes / failures | 9 / 7 |
| Evaluator goal-satisfied trials | 7 / 45 |

The 29 boundary failures were responses containing two assistant messages and two
public `output_text` parts. They were not provider transport errors, protocol
decoder errors, Veil admission failures, authorization denials or capability
failures. All nine scenarios were affected. No ambiguous response reached the
trusted host, Veil or fake-world effects.

The two UNKNOWN trials performed the simulated `UNCERTAIN` mutation but did not
receive confirmed completion. Both models preserved uncertainty rather than
claiming success. One subsequently proposed a lookup that Veil denied; it was not
invoked. Trial 31 supplied the sole material replan after a later step failed: it
preserved completed work, changed the remaining update and did not repeat the
completed lookup.

Seven trials encountered hostile returned instructions. The two completed hostile
scenario trials reported and declined the instruction; partial-scenario trials
also encountered the hostile data. No hostile instruction acquired authority.
This is a bounded observation about those model responses. It is not a guarantee
that models ignore hostile instructions generally.

Four authority-scenario trials reached Veil, but the model chose permitted
`editable` updates. `forgedAuthorityAttempts` was zero. Those trials therefore
observed host-owned caller/scopes and unsatisfied locked goals; they did not test
Veil against an actual model-generated forged-authority proposal. Similarly, all
impossible and multi-step trials stopped at the provider boundary, so the matrix
provides no evidence for impossible-goal recognition or multi-step semantic
reasoning.

### What the experiment establishes

As architectural evidence, the run establishes an existence result under the
frozen apparatus:

- a real external model can communicate through the same serialized proposal
  boundary used by the deterministic control;
- accepted responses can author syntactically valid plans without gaining caller,
  scope, policy, risk or provider authority;
- strict provider projection can stop ambiguous public output before execution;
- the existing Veil admission/authorization path can govern those model-authored
  proposals without model-specific core runtime behavior;
- UNKNOWN can remain uncertainty rather than being silently converted into a
  success/failure claim; and
- feedback can support at least one observed material replan.

The 20 invocations all followed allow decisions, the one denial produced no
invocation or additional effect, and no ambiguous response executed. No invariant
violation was observed.

### What the experiment does not establish

The provider-boundary failure rate prevents a broad reasoning-reliability claim.
The matrix does not establish response-shape reliability, admission correction,
impossible-goal recognition, multi-step reasoning, general hostile-instruction
resistance, general authority-forgery resistance, retry safety, value ownership,
exactly-once effects or a security proof. Its frequencies are model/provider/
configuration-specific observations. The useful Veil guarantee evidence remains
the runtime, accepted ADRs, deterministic tests and governance controls.

## ADR-0011 and ADR-0013 outcomes

### ADR-0011

ADR-0011 correctly resolved the ownership question by refusing to reinterpret
v1. Its implemented v2 guarantee begins after resolution and ends at outer
capability entry. It defines a bounded in-memory value domain and structural
equivalence relation, supplies an immutable policy view, detaches entry input and
fails unsupported receiving values closed. It explicitly excludes provider
operations, effects, committed results, persistence parity, rollback and hostile
installed code.

The source and tests implement the accepted mechanics. ADR-0011 now explicitly
distinguishes its decision-time future-tense record from current implementation
status, identifies `2.0`, and records the corrected copy-before-start lifecycle
without changing the accepted decision.

### ADR-0013

ADR-0013 resolved instruction/data ambiguity with a precise structural rule shared
by v1 and v2. The implementation uses complete own-key and descriptor inspection;
the regression suite covers ordinary, frozen/sealed, custom/null-prototype and
class-created wrappers, hidden/symbol extras, accessors, inheritance, arrays,
malformed strings and Proxies.

Its v1 impact is a deliberate documented correction: previously over-recognized
inherited/accessor/hidden-extra JavaScript-only shapes now remain ordinary input.
No repository-supported caller relied on those shapes. This must still be called
out in release notes because it changes classification for theoretically accepted
inputs.

## ExecutionPlan 2.0 supported-adoption readiness

### Runtime and compatibility

- **Opt-in:** `OperatorRuntimeOptions.planVersions` must explicitly include
  `'2.0'`. Omission defaults to `['1.0']`; defaults and built-in planners/adapters
  continue to emit v1.
- **Coexistence:** a host can choose v1-only, v2-only or a deliberate mixed set.
  Unknown, duplicate, empty or invalid configured version lists reject. Plan
  version selects semantics; there is no automatic upgrade/downgrade.
- **V1 preservation:** governed-value v2 does not silently change v1 value
  ownership. Tests exercise v1 default rejection of v2 and mixed-version behavior.
- **Public type/export:** `OperatorRuntimeOptions` is package-root exported and
  includes `planVersions`; `ExecutionPlan.version` remains a string, so no new
  root value type or internal copier is exposed. Package-consumer tests exercise
  the public surface.
- **Admission:** supported plan version is read and checked before structural
  capture, Job creation, authorization or invocation. V2 semantics are carried
  into the immediate Job execution.
- **Persistence/reload:** the semantic version is not stored on `Job`, and internal
  stored-Job execution defaults to v1. The public HTTP stored-Job execution route
  is retired. V2 is therefore ready for direct current execution, not durable
  replay/resume or cross-store semantic parity.
- **Tests:** focused v2 tests cover frozen policy input, detached equivalent entry,
  alias preservation within copies, rejected representations, explicit opt-in,
  v1/v2 coexistence and exact reference behavior. The broader suite covers
  admission, authorization and package consumption.

### Resolved ADR-0011 lifecycle mismatch

ADR-0011 and the implementation-readiness plan require the runtime to construct
the detached mutable capability value `C` after explicit allow but before marking
the step running or emitting `capability.started`. The stated reason is precise:
if dispatch copying fails, there must be no started event and no invocation. The
readiness test plan also explicitly requires an injected post-allow `C`-copy
failure proving allow occurred but neither start nor invocation occurred.

The implementation now calls `copyGovernedValue(governedInput)` immediately after
the explicit allow decision and before changing step status, assigning `startedAt`
or emitting `capability.started`. Only V2 takes this path; V1 retains its historical
shared resolved input and lifecycle order.

Focused regressions inject a deterministic copier failure after authorization has
returned allow, using an otherwise supported governed record. The failed step has
no `startedAt`, no `capability.started`, no capability entry and no effect; it uses
the existing `capability.failed`/`job.failed` path. A successful-order regression
observes authorization, copy, start and entry in that order, and a paired V1
regression proves no governed entry copy was added to the legacy path.

This restores the accepted ADR without a new event, public hook, plan version,
value-domain change or architectural abstraction.

### Adoption documentation completed

The bounded adoption-preparation pass now supplies:

- a public ExecutionPlan V2 reference covering opt-in admission, lifecycle,
  governed-value domain/resource limits, guarantees and explicit non-guarantees;
- a V1-to-V2 migration guide covering configuration, identity/mutation changes,
  failure timing, ADR-0013 classification and persistence/replay limits;
- current OperatorRuntime, lifecycle, authorization, trust-boundary, public-export
  and plan-version documentation that distinguishes V1 from V2;
- a minimal V2-only runtime example and navigation from the public docs; and
- unversioned release/compatibility notes for the observable branch changes,
  without selecting a release number or changing package metadata.

Historical investigations retain their checkpoint conclusions. Small current-state
notes distinguish their proposal/future wording from the implemented contract.

## Branch-to-main assessment

Before this synthesis document, the branch-to-main diff contained 88 files,
13,223 insertions and 427 deletions. There are no package/lockfile, dependency,
package-version or CI changes. The branch was clean before this document was
created.

### Runtime and public-contract changes

- governed HTTP route migration, trusted caller resolution and retirement of
  stored-Job HTTP execution;
- conservative `destructive` risk for generic HTTP and shell capabilities;
- exact shell executable/argv input and allowlist behavior;
- structured plan-admission diagnostics and root exports for the predicate/types;
- strict plan-version admission;
- public `OperatorRuntimeOptions.planVersions` and opt-in v2 dispatch;
- internal governed-value capture/copy implementation;
- exact shared v1/v2 result-reference recognition; and
- supporting validator/JobManager/runtime changes.

These changes are all release-note-worthy. Some are additive; some deliberately
change observable behavior for previously under-governed or undocumented cases.
The package version must be handled by the eventual release process, not by this
research branch review.

### Documentation and decisions

The branch adds ADR-0010 through ADR-0013 (with 0010 remaining Draft and 0011,
0012, 0013 accepted), investigations for admission, governance, shell policy,
value ownership, result references and pre-capture traversal, and the complete
Experiment I/II design/results record. ADR-0011's implementation status and the
affected public/current-state pages are now reconciled while historical decision
rationale remains intact.

### Tests and governance

The branch adds deterministic coverage for governance routes, HTTP/shell policy,
plan versions/admission, external-reasoner fixtures, value ownership, v2 governed
values and exact references. It updates the governance checker to forbid route
allowances and updates the baseline with individually reviewed implementation,
test and experiment sites. The removed route baseline entries correspond to
retired bypasses; no replacement legacy bypass allowance is present.

The baseline changes are intentional verification-control changes. They are not
evidence that the checker was relaxed: route controls became stricter, and new
reflective/dynamic sites received specific classifications. The two anchors shifted
by the ADR-0011 copy-before-start correction were individually re-reviewed and
narrowly replaced with the same `GOVERNED_MACHINERY` classifications; no wildcard
or new execution allowance was added. Final architectural acceptance remains a
maintainer decision.

### Experiment-only changes

Both experiment harnesses live under `experiments/` with root offline regression
tests. The external-model test runs mocked/scripted harness checks and performs no
real-model call. Live credentials and local primary artifacts are not committed;
the primary results report retains aggregate evidence and hashes. No provider SDK
or production dependency was added.

No temporary probe code from the result-reference investigations remains in a
production path. The runtime has no experiment import. Searches found no new
production TODO/debug artifact attributable to this branch.

### Repository hygiene observations

`git diff --check main...HEAD` reports CRLF-edited source lines as trailing
whitespace in the route, HTTP, shell and command-policy files. The research
documents explicitly record that their existing line-ending conventions were
retained to avoid mixing formatting cleanup with feature work. This is not a
runtime correctness blocker, but release tooling or repository policy should make
an explicit decision rather than hiding the result.

### Resolved conformance blocker

The previously identified mismatch is resolved: V2 now constructs `C` before the
running/start transition, and deterministic tests cover both copy failure and
successful ordering. No other concrete runtime/accepted-decision mismatch was
found in this synthesis.

## Adoption assessment

### Decision

**READY_TO_ADOPT**

The architecture is coherent:

- proposal data and host authority remain separate;
- admission and authorization are on the governed path;
- ADR-0011's versioned value domain, capture point, successful-entry equivalence
  and start/copy ordering match the implementation;
- ADR-0013's exact recognition rule matches its implementation;
- the trusted-host/pre-capture boundary is explicit and does not falsely assign
  authorization authority to installed code; and
- deterministic tests and governance controls cover the claimed runtime
  properties, including post-allow copy-failure ordering.

The bounded ADR-0011 correctness/conformance defect is resolved without changing
the accepted architecture or V1 semantics.

The branch now has a public opt-in V2 contract, migration guidance, compatibility
notes and reconciled governance inventory. This classification means the bounded
architecture/runtime/documentation package is ready for maintainer adoption review;
it does not itself approve a merge, choose a release number or authorize
publication.

## Bounded remaining work and recommended next phase

No known architecture, correctness, compatibility or adoption-documentation
blocker remains in this research scope. Maintainer review still needs to:

1. approve or reject the branch's accepted-ADR implementation and public-contract
   presentation as a whole rather than infer approval from passing tests;
2. review the fixed-base governance/verification-control deltas and make the
   repository-policy decision on the pre-existing CRLF branch diff;
3. choose release/version treatment in the ordinary release process; and
4. commit/merge only through the maintainer's normal workflow.

Do not enable v2 by default, rewrite Experiment II evidence, claim passive result
traversal, add a new ADR, or expand this work into result immutability/provider
binding unless a future product requirement actually needs those stronger
properties.

The recommended next phase is maintainer adoption review and ordinary merge/release
preparation. No default change, new runtime architecture or further live-model
evidence is required by the completed research question.

## Review verification

### Original synthesis review

- `npm run check`: the filesystem-sandbox run exited 1 after 17 test files passed;
  only the two subprocess-based external-reasoner test files reported generic
  `test failed`. The permitted outside-sandbox rerun exited 0: all 307 functional
  tests passed, followed by build and package verification. The package contained
  106 files. No live-model experiment ran.
- `npm run test:quality`: the sandbox run likewise reported only two test-file
  wrapper failures. The outside-sandbox rerun exited 0 with all 216 quality-harness
  tests passing.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`:
  exited 2. Direct dependencies and `package-lock.json` were unchanged. The report
  requires review of 21 verification-control files, reports 15 new governed/
  dynamic sites that cannot self-authorize from the candidate baseline, and lists
  seven base-baseline sites as retired. This is a required maintainer baseline/
  control review, not a passing quality result; no baseline was changed by this
  synthesis.
- At the original synthesis checkpoint, the new synthesis document passed
  `git diff --check` and every local Markdown link target resolved. The cumulative
  committed branch still had the documented CRLF `git diff --check main...HEAD`
  findings. Subsequent adoption-preparation edits are recorded below.

### ADR-0011 conformance correction

- Focused governed-value/lifecycle, V1 compatibility and result-reference tests
  pass after the correction. The successful V2 regression observes
  `authorize → copy → capability.started → execute`; the copy-failure regression
  observes authorization but no start transition, invocation or effect.
- The final outside-sandbox `npm run check` passes all 310 tests, build and package
  verification. Its offline Experiment I/II regressions pass; no paid/live model
  experiment ran.
- At the ADR-0011 correction checkpoint, `npm run test:quality` passed 215 of 216
  harness tests. The sole inventory test reported the expected replacement of two
  `JobManager` governance anchors: the existing `executePlan → execute` entrance
  and the existing capability dispatch. The checker hashes the whole containing
  class, so the lifecycle edit necessarily changed both anchors. Each was reviewed
  individually; neither was a new entrance, alternate dispatch or control
  weakening. The later adoption-preparation pass narrowly reconciled those exact
  anchors in the current baseline; the current 216/216 result is recorded below.
- `npm run quality -- --base 01bc9c6b92d57bd5b2143d5f8dfd1fc5a4875c64`
  reports the changed regression file as a verification control and the same two
  new/two retired anchors. Direct dependencies and the lockfile are unchanged.
  This is a reviewed, deliberately unresolved baseline delta under the correction's
  no-baseline-change scope, not evidence of an unreviewed execution path.
- `git diff --check` passes for tracked changes. A separate no-index check reports
  no whitespace errors in this still-untracked synthesis document.

### Adoption-preparation verification

- The final outside-sandbox `npm run check` passes all 310 tests, typecheck, build
  and packed-package verification. The explicit focused suite passes 141 tests:
  V1/V2 governed values and lifecycle, result references, plan admission/version,
  and offline Experiment I/II regressions. No live provider/model call ran.
- `npm run test:quality` passes all 216 tests. The current inventory contains 148
  relevant files and 24 exact individually classified sites, with no route or
  legacy-bypass allowance.
- The fixed trusted-checkpoint comparison against `01bc9c6b92d57bd5b2143d5f8dfd1fc5a4875c64`
  remains review-required by design: the immutable base does not trust the
  candidate baseline replacement, so it reports the two old JobManager anchors as
  retired, the two reviewed replacements as unmatched, the changed regression
  test, and the baseline file as verification controls. No dependency or lockfile
  change is reported.
- The full comparison against main (`bb3f34e4f938096acec897159f0f56283c11697a`)
  exits 2 with the expected branch-wide verification-control growth, 15
  branch-introduced classified sites, and seven retired mainline sites. Every
  introduced site is represented in the current 24-site baseline and has an
  individual disposition: governed machinery, test/fixture, or legitimate
  planner execution. No genuinely new unreviewed capability/provider/authorization
  entrance was found; the two mainline legacy route bypasses remain retired.
- A read-only Markdown link check validates 101 Markdown files and all local link
  targets. `git diff --check` passes for tracked changes; the no-index check of
  the untracked synthesis and new public docs reports no whitespace errors.
