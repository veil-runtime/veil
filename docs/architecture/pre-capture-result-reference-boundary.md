---
title: Pre-capture result-reference boundary investigation
---

# Pre-capture result-reference boundary investigation

Investigation checkpoint: `0c1a08f6f48648345d0102f0bd764accee020e43`
(`fix: enforce exact result reference shape`), 2026-09-25.

This is an architecture investigation only. It changes no runtime, test, public
contract, ADR, experiment, governance baseline, package version or release state.
ADR-0011 governs values only after result-reference resolution. ADR-0013 governs
wrapper recognition and expressly does not govern result-path traversal.

## Executive answer

Veil should not currently add an unconditional passive-selection or hostile-value
ownership guarantee for `steps.<stepId>.result.<path>`. It should make the existing
trust boundary explicit:

> Installed capabilities, providers and other in-process host integrations are
> trusted executable host code. That trust includes active JavaScript mechanics in
> values they return while those values remain in-process. Result-reference path
> selection may therefore invoke an own accessor or Proxy reflection/read trap
> before receiving-step validation and authorization. Veil does not confer caller,
> registry, capability or provider authority on that callback, and it does not treat
> the callback as the receiving capability invocation. A traversal failure prevents
> receiving-step authorization and entry, but Veil does not roll back behavior that
> occurred during traversal. Under ExecutionPlan 2.0, ADR-0011 begins only after the
> resolver returns and governs the returned representation from that point forward.

This is not a claim that active traversal is desirable. It is the narrowest claim
supported by the current public value types, deliberate compatibility tests,
accepted ADRs, host-code threat model and persistence architecture. A producer can
already perform the same effect before returning, schedule it for later, retain a
runtime/capability/provider handle, or expose another active host object. Making one
property walk passive would reduce surprising callbacks, but would not make an
installed producer untrusted or establish a committed-result ownership boundary.

The current receiving gate remains meaningful. A consumer capability is not entered
without successful resolution, v2 capture where applicable, validation and explicit
authorization. Traversal code can cause ambient effects using authority it already
holds, but the repository evidence does not show it acquiring receiving-step
authority, changing the frozen caller snapshot, or causing a denied receiving
capability to run.

The architecture is therefore sufficient only under the trusted-producer premise.
That premise is currently distributed across security and provider documentation
instead of being stated at the result-reference boundary. The required follow-up is
a trust-boundary clarification, not a behavior change or new ADR. If Veil later
wants to host untrusted capability/provider implementations, transport executable
results from another trust domain, or promise that model-selected paths cannot
trigger host callbacks, that would be a new versioned result/value architecture and
requires a separate accepted ADR.

## Values and provenance

The word “user-controlled” is too broad for this boundary. The reachable value
classes have different authority and behavior:

| Value class | Origin and representation | Can carry executable JavaScript here? | Current owner/trust consequence |
| --- | --- | --- | --- |
| Model-authored JSON | Model text parsed with `JSON.parse`, or equivalent bounded experiment protocol | No accessors, Proxies, closures, functions or custom prototypes survive as such | Untrusted proposal data; it can choose a `$ref` string but cannot itself encode a getter |
| Remote request/MCP data | Fastify JSON or MCP structured arguments projected into a plan | Not by the wire representation alone | Untrusted request data; a host adapter can reintroduce active objects afterward |
| Direct in-process plan input | Arbitrary `ExecutionStep.input: unknown` supplied by application code or a custom planner strategy | Yes | Host JavaScript; admission and literal resolution already have active-object limits outside this result-path question |
| Capability result | Arbitrary `TResult = unknown` returned from installed `Capability.execute` | Yes | No result schema, normalization or producer capture exists; the returned graph is live host data/code |
| Provider result | Whatever a provider returns to capability code; the capability may pass it through or transform it | Yes in principle | Provider/capability integration is host-owned; external JSON normally becomes passive data, but the public capability contract does not require that |
| In-memory Job value | Exact live graph retained by `InMemoryJobStore` | Yes | Identity, accessors, Proxies and external aliases remain live |
| SQLite-reloaded Job value | `JSON.parse(JSON.stringify(job))` projection | No active mechanics from the original graph survive as mechanics | Lossy ordinary JSON data; serialization may already have executed getters, traps or `toJSON` |
| Cross-process value | Adapter-defined serialized/cloned representation | Not as the same closure/object identity | Core execution has no cross-process Job/result protocol; behavior depends on the adapter and can be reintroduced only by code in the receiving process |

The bundled capabilities generally construct ordinary records. The HTTP provider
parses JSON or text and creates a record. Outbound MCP returns the SDK result without
a Veil result-domain check. These implementation tendencies do not narrow the public
`Capability<TInput, TResult>` contract, whose result remains unconstrained.

## Exact current lifecycle

The direct and planned paths meet at `OperatorRuntime.executePlan`; `run` does not
create a separate execution boundary.

1. `OperatorRuntime.executePlan` shallow-copies and freezes caller, scopes and the
   metadata root, then delegates to `JobManager.executePlan`
   (`src/runtime/operator-runtime.ts:52-65,118-133`). Nested metadata remains shared.
2. `JobManager.executePlan` reads and admits the plan semantic version, then captures
   goal, idempotency key, step membership/order and named step fields. Each `input`
   root remains the original binding (`src/runtime/jobs/job-manager.ts:39-64`).
3. `validatePlan` checks capability identity/version, declared top-level fields,
   step IDs and earlier-reference order. Reference discovery uses ADR-0013's
   recognizer plus array/object recursion (`src/runtime/execution/plan-validator.ts`).
   It validates reference syntax and order, not a future result value or path.
4. The manager creates and stores an initially empty Job, materializes the captured
   steps as pending JobSteps, and updates the store
   (`src/runtime/jobs/job-manager.ts:85-109,112-139`).
5. `JobManager.execute` loads the Job once, marks it executing and iterates its live
   `job.steps` array (`src/runtime/jobs/job-manager.ts:170-194`). With SQLite this is
   the pre-loop JSON reload. There is no store reload between steps.
6. For a producer step, the runtime resolves/validates/authorizes its input and calls
   `Capability.execute`. The awaited fulfilled result is assigned directly to
   `step.result`, then the step becomes completed and `capability.completed` is
   published (`src/runtime/jobs/job-manager.ts:289-326`). Root promises/thenables are
   assimilated by `await`; nested active values are not. There is no result capture,
   result schema, serialization or store update here.
7. A synchronous `capability.completed` subscriber can run before the loop advances.
   The producer, provider, subscriber or any retained external alias can therefore
   mutate the result after return/completion and before consumer resolution.
8. For the consumer, the runtime takes earlier JobSteps and calls
   `resolveResultReferences(step.input, completedSteps)` synchronously
   (`src/runtime/jobs/job-manager.ts:203-214`).
9. ADR-0013 recognition uses `Reflect.ownKeys` and
   `Object.getOwnPropertyDescriptor`; an ordinary exact wrapper is read as data, but
   a Proxy wrapper may execute reflection traps. The resolver then reads `value.$ref`,
   so a conforming Proxy may also execute `get`
   (`src/runtime/execution/result-reference.ts:6-54`).
10. The resolver finds the earlier step and requires `status === 'completed'`. It
    starts with `step.result`. For each string path segment it calls
    `Object.hasOwn(resolved, segment)`, then performs ordinary bracket access
    (`src/runtime/execution/result-reference.ts:55-68`). The first operation can run
    a Proxy `getOwnPropertyDescriptor` trap; the second can run an own getter or
    Proxy `get` trap. An intermediate and a terminal segment are equally active.
11. Non-reference input arrays are recursively rebuilt with the receiver's `.map`;
    non-reference input objects use `Object.entries` and `Object.fromEntries`
    (`src/runtime/execution/result-reference.ts:71-81`). These operations can execute
    input-object getters, Proxy traps and overridden array mechanics before capture.
    A selected result is returned directly and is not recursively interpreted as
    more reference syntax.
12. For ExecutionPlan 2.0, `captureGovernedValue(resolvedInput)` runs immediately
    after the resolver returns and before validation
    (`src/runtime/jobs/job-manager.ts:208-221`). It passively inspects the returned
    graph, rejects unsupported active/rich representations and creates a private
    detached snapshot. For v1, `resolvedInput` remains the live graph.
13. Receiving-step schema validation runs next. A resolution/capture/validation
    failure marks the consumer and Job failed without consumer authorization or
    entry (`src/runtime/jobs/job-manager.ts:218-229,327-386`). Effects already caused
    by traversal are not rolled back.
14. V2 authorization receives a detached recursively frozen copy of the captured
    input. V1 authorization receives the resolved graph. The authorizer's explicit
    decision is validated and denial prevents `capability.started` and capability
    entry (`src/runtime/jobs/job-manager.ts:231-287,445-478`).
15. After allow, the step becomes running and emits `capability.started`. V2 creates
    a detached mutable capability input from the private capture; v1 reuses the live
    resolved graph. The outer registered capability is then called
    (`src/runtime/jobs/job-manager.ts:289-317`). Capability/middleware/provider
    behavior after that point is outside ADR-0011's entry guarantee.
16. Only after all steps does the runtime form `job.result` and update the store. A
    failed Job is likewise persisted only in the outer catch
    (`src/runtime/jobs/job-manager.ts:351-385`). Terminal SQLite persistence can
    execute active result mechanics again.

## Observable JavaScript execution sites

This table distinguishes the selected-result path from adjacent active boundaries.

| Site | Observable behavior that can execute | Provenance |
| --- | --- | --- |
| Structural plan capture | Plan/steps/step getters and Proxy membership/read traps | Direct caller or custom planner plan |
| Admission reference recognition | Proxy `ownKeys` and descriptor traps under ADR-0013 | Reference wrapper from in-process plan input |
| Admission recursive discovery | Enumerable getters, Proxy traps, receiver `flatMap`, array species mechanics | In-process plan input |
| Pre-execution SQLite update | `toJSON`, getters, Proxy enumeration/read traps; may throw | Captured plan input/Job graph |
| Producer `Capability.execute` | Arbitrary installed capability and provider behavior | Explicitly authorized producer invocation |
| Completion event publication | Host subscriber callbacks; synchronous prefix runs before loop continuation | Registered trusted observer |
| Wrapper read during runtime | Proxy reflection and `$ref` `get` trap | In-process reference wrapper; ordinary ADR-0013 wrapper is data |
| `Object.hasOwn` for each result segment | Proxy `getOwnPropertyDescriptor` trap | Capability/provider result or nested path object |
| `resolved[segment]` | Own getter or Proxy `get` trap | Capability/provider result or nested path object |
| Runtime literal recursion | Object-entry getters/traps; array `map`/`has`/`get`/species behavior | Unresolved consumer input graph |
| ADR-0011 v2 capture | No callback for an admitted node; Proxies/accessors/unsupported brands reject through trusted inspection | Resolver-returned graph |
| V1 validation | A whole-reference active root can execute reads during field validation | Resolved producer graph; v2 has already detached/rejected it |
| Authorization | Deliberate host policy callback | Runtime-configured authorizer |
| Capability entry | Deliberate installed capability/middleware code | Explicitly allowed receiver invocation |
| Terminal SQLite update | JSON conversion hooks and active property reads; may replace a normal Job return with persistence rejection | Completed/failed live Job and results |

Exception handling can add secondary observations for exotic thrown Proxies while
classifying or reading an error. That is not a fail-open path and is not a stable
error-callback protocol.

## Temporary probe evidence

Two temporary local probes ran with Node v24.18.1 against the compiled checkpoint.
They registered only unique inert local capabilities, used an in-memory SQLite
database where needed, performed no network/browser/process/provider action, and
were deleted after execution.

| Probe | Observation | Boundary consequence |
| --- | --- | --- |
| Intermediate and terminal getters | Both getters ran in path order. The intermediate getter changed a sibling before a later reference selected it. | Traversal is active and input entry order can affect the value ultimately captured/authorized. |
| Proxy path | `getOwnPropertyDescriptor('value')` ran before `get('value')`; the Proxy returned a value inconsistent with its reported descriptor. | Own-property checking is not passive or ownership attestation for a Proxy. |
| Throwing getter/trap | The thrown identity propagated through the direct resolver; in a v2 Job the consumer failed with zero consumer authorizations and zero entries. | Failure is fail-closed for the receiving invocation, not transactional for prior behavior. |
| Custom prototype | An own path remained selectable; an inherited property failed without invoking an inherited getter. | Current traversal is own-only, not plain-record-only. |
| Arrays | Own index `0` and own nonenumerable `length` resolved; inherited/hole behavior remains as characterized by repository tests. | A blanket enumerable-record rule would be a compatibility change. |
| Mutation after producer completion | A synchronous `capability.completed` observer changed the retained producer result before the next step selected it. | Completion is not a committed immutable result boundary. |
| Retained producer alias | In memory, the producer object was identical to `JobStep.result` and to the value returned by `getJob`. A traversal getter mutated that same object. | Producer and Job ownership remain shared before v2 receiving capture. |
| Reentrant submission | A result getter submitted a nested v2 plan. The outer consumer still authorized and entered normally; the nested plan reached its own authorizer, was denied, failed, and had zero entries. | Reentrancy is possible only with a retained runtime handle; the probe found no authority inheritance or receiving-policy bypass. |
| V2 handoff | Authorization and consumer entry saw structurally equal but nonidentical passive values after the active getter returned. | ADR-0011 works at its stated boundary and does not erase earlier effects. |
| SQLite serialization/reload | JSON storage invoked an enumerable getter once and reload produced an ordinary data descriptor. | Persistence materializes behavior but executes it during serialization and changes representation. |
| Active SQLite execution | A newly produced getter ran once for `$ref` selection and twice during terminal serialization through `step.result` and aggregate `job.result`. The returned Job retained the active alias; a later `getJob` returned ordinary data without another getter call. | SQLite is not an inter-step sanitizer; returned and reloaded Job representations differ. |

These results reproduce and refine the earlier P1-P9 evidence in
`result-reference-resolution-investigation.md`. They establish reachability and
ordering, not an external attacker path or an authorization bypass.

## Authority and threat analysis

### Receiving-step authorization

Traversal cannot cause the receiving capability to enter without the later gate.
The resolver runs first; v2 capture and schema validation then run; only an explicit
allow reaches entry. Throwing behavior stops before receiving authorization, and a
denial stops entry. Code executing before authorization is therefore not, by that
fact alone, an authorization bypass.

The narrower concern is that path-selected host code can cause an effect for which
there is no *receiving-step* authorization event. Under the current architecture,
that code belongs to the already installed producer/provider or another in-process
host integration. It had ambient host authority before `$ref` selection and could
have used it during producer execution, after a timer, or through a retained handle.
Veil does not sandbox such code. The effect is outside the receiving invocation, not
permission gained from it.

### Value seen by authorization

Yes, traversal can alter it. A getter/trap chooses the returned value, mutates a
sibling read later, or mutates a selected object before v2 capture. A completion
observer or retained producer alias can also mutate the graph before traversal.
V2 then captures the value that exists after resolution; authorization receives a
stable detached view of that captured representation. ADR-0011 does not promise
that this is the value that existed at producer return or completion.

### Caller identity and scopes

No direct alteration path was found. `OperatorRuntime` creates a frozen shallow
caller snapshot before Job execution. Traversal receives no caller argument. A
producer already receives caller in its own execution context and can retain that
snapshot, and nested metadata remains a separately documented shallow-ownership
limit. Those facts do not let a result getter replace the consumer's caller/scopes.

### Reentrant runtime or direct invocation

A getter/trap can submit another plan if its closure already holds an
`OperatorRuntime`. That plan follows its own admission and authorizer. A callback
can also directly call a capability/provider object it already holds, but such a
call is ambient host authority outside Veil; `$ref` did not supply the handle.
Passive traversal would remove this particular trigger but would not remove the
producer's ability to submit or call before returning or asynchronously afterward.

### Producer state, later execution and ADR-0011

Traversal can mutate producer-owned objects, application state and any closure-
reachable state. It can influence later references and unrelated later host code.
These effects escape ADR-0011 only in the temporal sense that they occur before its
boundary. Once v2 capture succeeds, source/producer/policy aliases cannot mutate the
private snapshot or detached capability entry value. There is no contradiction in
ADR-0011 and no evidence of an implementation bug at this seam.

### Information flow and denial of service

The path text and read timing are observable to a getter/Proxy. The callback can
inspect its receiver and closure state. Veil supplies no additional caller,
credential, registry or provider object during the read. Throwing or unbounded
synchronous callbacks can fail or stall the Job before v2 resource limits apply.
This is an availability and host-code risk, not a permission grant.

## Persistence and process boundaries

### Memory Job storage

`InMemoryJobStore` stores and returns the exact Job object. Producer aliases,
accessors, Proxies, custom prototypes, arrays and mutation remain live. This is the
universal behavior for the default store and is enough to expose the boundary.

### SQLite Job storage

SQLite stores `JSON.stringify(job)` and loads `JSON.parse(data)`. The materialized
plan is reloaded once at the start of `JobManager.execute`. Results produced after
that reload remain live through all later steps because the runtime does not update
or reload the Job between steps. SQLite therefore does not protect result selection.

Terminal update serializes the live producer result. Serialization may invoke
getters, Proxy operations and `toJSON`, omit functions/undefined, convert nonfinite
numbers, erase signed zero/prototypes/accessors/aliases, and reject bigint/cycles.
The Job returned by `executePlan` is still the live local object; a later `getJob`
returns the materialized JSON projection. A serialization failure can occur after
earlier capabilities or traversal have already caused effects.

### Active Job reload and replay

The public stored-job execute route is retired, and no public replay/resume contract
exists. Internal `JobManager.execute` loads once, but normal `executePlan` invokes it
only for the newly materialized pending Job before any producer runs. A persisted
and reloaded result would normally be ordinary JSON data, but current runtime flow
does not insert such a reload between producer and consumer. This problem is thus
not limited to the memory backend; it applies to every uninterrupted in-process
multi-step run, including SQLite-backed runs.

### Serialization and process boundaries

Executable object identity does not survive JSON serialization/deserialization.
Conversion can execute behavior on the sending side, and the receiving side sees
ordinary records/arrays/primitives. Core has no generic cross-process Job/result
transport, semantic version record for replay, or durable governed-value encoding.
An adapter can define a narrower passive wire format or reconstruct active objects,
but that is adapter behavior. The pre-capture problem is therefore specific to
in-process active graphs and to serialization hooks at conversion time; it is not a
universal property of already materialized wire data.

## Contract and history evidence

- `Capability<TInput, TResult>` leaves `TResult` unconstrained, and `JobStep.result`
  is `unknown`. No result schema, passive marker or referenceable-result type exists.
- Result-reference documentation promises own-property traversal and explicitly
  says own getters and Proxy traps may run and referenced objects retain identity/
  mutability (`docs/concepts/result-references.md:47-56`). ADR-0011 assigns that
  historical behavior to v1 (`docs/adr/0011-governed-value-ownership.md:21-24`).
- `test/result-reference.test.ts:147-233` deliberately preserves whole/nested
  identity, null prototypes, nonenumerable data, arrays, getters, throws and
  Proxy descriptor/get behavior. These are stronger than accidental source facts.
- `test/structural-ownership.test.ts:274-293` preserves mutable reference wrappers
  and result identity for v1. `test/value-ownership.test.ts:87-142` characterizes
  retained producer aliases and mutation between authorization and entry.
- ADR-0011 deliberately starts after existing resolution, preserves v1, and says
  safe pre-resolution traversal requires another scoped decision
  (`docs/adr/0011-governed-value-ownership.md:85-140,303-343`).
- ADR-0013 deliberately permits Proxy-observable wrapper recognition and excludes
  result-path traversal from its decision
  (`docs/adr/0013-result-reference-object-shape.md:77-116,254-272`).
- Trust documentation says arbitrary host JavaScript is not sandboxed, provider code
  safety remains an application responsibility, and configured runtime/support code
  can perform I/O outside per-capability authorization
  (`SECURITY.md:52-65`; `docs/architecture/trust-boundaries.md:122-128`;
  `docs/architecture/governance-hardening.md:119-138`).
- Commit `d3fb8ed` introduced ordinary bracket traversal. Commit `6680e85` changed
  only inherited lookup to `Object.hasOwn` and added explicit getter/Proxy/array/
  null-prototype compatibility tests. Commit `e02c440` implemented ADR-0011 after
  that traversal. The only runtime semantic change in commit `0c1a08f` was ADR-0013
  wrapper recognition.
- JSON/MCP examples and experiments use passive data, but ADR-0011 and Experiment II
  reports expressly refuse to generalize that fixture property to all core values.

Veil therefore already promises active traversal as a compatibility fact, while
also promising that v2 owns the resulting representation after the resolver. It
does not promise passive producer results, committed-result stability, store parity,
untrusted plugins, or a hostile-JavaScript sandbox.

## Compatibility constraints

1. Changing v1 traversal is a public break: own getters, Proxy traps,
   nonenumerable data, arrays, rich terminals and selected identity are documented
   or tested. ADR-0011 requires v1 preservation.
2. V2 also deliberately uses existing traversal before capture. Changing it without
   a new accepted decision would contradict ADR-0011's chosen boundary even though
   v2 later rejects active selected graphs.
3. Descriptor-only reads can preserve an exact data-terminal identity, but rejecting
   accessors/Proxies changes whether a plan succeeds and when it fails.
4. Requiring enumerable record data would also reject currently selectable hidden
   properties and array `length`; passive behavior alone does not justify that rule.
5. Restricting prototypes is independent from passivity. An own primitive data field
   on a custom-prototype object can be read without invoking prototype behavior.
6. Capturing a complete producer result rejects safe selected leaves when an
   unrelated sibling is active, cyclic, large or rich. It also changes producer
   success/failure timing after effects may already have happened.
7. Capturing only the selected subtree requires a passive selector first. Capturing
   each reference separately can destroy alias topology across two references;
   delaying capture leaves selected aliases mutable while the rest of the input is
   resolved. A combined resolver/capture is a broader ADR-0011 boundary change.
8. JSON normalization is active, lossy and store-dependent. It cannot define a safe
   generic path selector or a storage-independent result contract.
9. The Job/result public model currently exposes raw producer results. A shadow
   governed reference representation would make `$ref` values differ from public
   `JobStep.result` and needs lifecycle/persistence/version semantics.
10. There is no persisted plan semantic version or replay contract in Job storage.
    Any durable governed-result design must solve that separately rather than infer
    semantics from the installed package.

## Architectural alternatives

### A. Preserve traversal and clarify the trusted-host assumption — recommended now

- **Property gained:** no new runtime security property; it makes responsibility and
  non-guarantees explicit. Existing own-path/fail-closed receiving gate and ADR-0011
  post-resolution guarantees remain precise.
- **Compatibility/identity/mutation:** no change. V1 keeps exact selected identity;
  v2 keeps post-resolution detachment. Pre-capture producer and Job aliases remain
  mutable.
- **Persistence:** accurately describes memory, active SQLite execution and reloaded
  JSON as different representations without claiming parity.
- **V1/v2:** applies as a trust-model clarification to both; it does not reinterpret
  either plan version.
- **Performance/complexity:** none.
- **ADR relationship:** honors ADR-0011's start point and ADR-0013's Proxy rule. No
  new semantic decision is needed.
- **Does it solve the problem?** It does not prevent callbacks. It resolves ownership
  by placing them inside trusted host execution and prevents overclaiming what
  authorization or ADR-0011 covers. This is sufficient for the repository's current
  non-sandboxed installed-code model, not for untrusted plugins.

### B. Descriptor-based passive result-path traversal

- **Property gained:** after rejecting Proxy before reflection, own data descriptors
  can be followed without invoking getters. A path callback cannot run.
- **Compatibility/identity/mutation:** data-terminal identity can remain exact until
  existing capture, but accessors and virtual Proxy properties newly fail. Retained
  aliases can still mutate before selection; callbacks elsewhere in wrapper/literal
  resolution can still mutate selected objects before the one whole-input capture.
- **Persistence:** no committed-result or store parity property. JSON hooks remain.
- **V1/v2:** breaking for both current versions; a future explicit semantic version
  is required. Applying it only to a future version preserves v1/v2 history.
- **Performance/complexity:** O(path length), low overhead, but array `length`, hidden
  data, custom prototypes, Proxy detection and diagnostics need contract rules.
- **ADR relationship:** does not by itself move ADR-0011, but changes the resolver it
  expressly preserved. ADR-0013 wrapper Proxies remain a separate active boundary.
- **Does it solve the problem?** It solves callbacks on producer path segments. It
  does not make complete reference processing passive, stabilize a result at
  completion, or sandbox the producer. It is a useful future determinism feature,
  not the current trust boundary's missing authorization fix.

### C. Traverse a previously governed producer representation

- **Property gained:** path selection over a detached passive snapshot invokes no
  producer behavior and observes stable producer-time data.
- **Compatibility/identity/mutation:** `$ref` no longer selects the public raw result
  identity. Producer mutations after snapshot do not affect consumers. Whole-result
  eligibility can reject because of off-path values.
- **Persistence:** the governed representation must be stored with semantic version
  and a lossless encoding, or retained only for the active run. A transient shadow
  value makes returned/reloaded Jobs diverge further.
- **V1/v2:** new version only; it adds committed-result timing beyond ADR-0011.
- **Performance/complexity:** O(complete result graph) capture and storage, even for a
  small selected leaf, plus internal shadow-state lifecycle.
- **ADR relationship:** establishes the committed-result stability that ADR-0011
  explicitly excludes and therefore requires a new ADR.
- **Does it solve the problem?** Yes for active producer path traversal if every
  reference uses the governed representation. It moves the acceptance/failure
  boundary to whole producer results and creates a larger public result architecture.

### D. Governed capture of complete producer results before storage/reference

- **Property gained:** one passive result domain for Jobs, later references and
  potentially persistence; producer aliases cannot mutate the committed result.
- **Compatibility/identity/mutation:** largest break. Raw result identity, rich
  results and post-completion mutation disappear; an otherwise successful producer
  can fail after external effects because its result is unsupported.
- **Persistence:** meaningful parity requires a governed wire/storage encoding, not
  current JSON. Without that encoding, it solves memory only.
- **V1/v2:** future version/result contract; not a v1 fix or silent v2 extension.
- **Performance/complexity:** copy every result and possibly encode it durably.
- **ADR relationship:** supersedes ADR-0011's explicit exclusion of committed-result
  stability and touches public Job/result semantics.
- **Does it solve the problem?** Yes, but by broadening the system from receiving-
  invocation ownership to producer-result ownership. Repository evidence does not
  currently justify that cost or scope.

### E. Governed capture immediately before traversal

- **Property gained:** if the entire producer result is passively captured first,
  subsequent path reads are passive and stable for that consumer.
- **Compatibility/identity/mutation:** observes mutations up to capture, then
  detaches. Off-path active/rich siblings can reject a safe leaf. Capturing only a
  path still needs passive traversal and alias rules.
- **Persistence:** per-consumer snapshot; no historical or store parity guarantee.
- **V1/v2:** future-version behavior. It moves ADR-0011 earlier for referenced data.
- **Performance/complexity:** repeats whole-result copying per consumer unless a
  cache creates the shadow-result architecture in C.
- **ADR relationship:** broader than ADR-0011's selected resolved-input capture.
- **Does it solve the problem?** It prevents path callbacks only by inspecting and
  restricting the full result first. It moves the boundary and rejection scope.

### F. Restrict referenceable results to a passive domain

- **Property gained:** active/rich results may remain valid Job outputs but cannot be
  used through `$ref`; references become data-only.
- **Compatibility/identity/mutation:** needs a marker, output schema or runtime domain
  check. Whole-result checks reject off-path values; path-local checks collapse into
  passive traversal plus selected capture. Identity rules must be chosen.
- **Persistence:** a passive in-memory domain is not automatically JSON-portable;
  bigint, undefined, NaN and signed zero show the distinction.
- **V1/v2:** new version and probably capability metadata/result-contract evolution.
- **Performance/complexity:** registration/schema surface or runtime validation and
  diagnostics.
- **ADR relationship:** adds a result domain absent from ADR-0011/0013.
- **Does it solve the problem?** It can, if enforced before active inspection. A
  label without capture/validation merely restates a producer promise.

### G. Normalize at the capability or provider boundary

- **Property gained:** producer-specific adapters can expose known passive data and
  avoid leaking SDK/native objects.
- **Compatibility/identity/mutation:** transformations are capability-specific and
  can intentionally change identity/types. Provider normalization does not cover a
  capability that constructs an active result afterward.
- **Persistence:** can align a particular integration with its wire format; does not
  establish universal Job semantics.
- **V1/v2:** usable today as host discipline; mandatory core normalization is a new
  versioned result contract.
- **Performance/complexity:** distributed adapter work; difficult to verify
  universally.
- **ADR relationship:** consistent as an application constraint, but a core mandate
  exceeds both ADRs.
- **Does it solve the problem?** For controlled capabilities, yes. It is the best
  local hardening option now, but not a core guarantee for custom capabilities.

### H. Versioned passive semantics

Versioning is the required vehicle for B-F, not a complete design. A new version
must state whether it governs only producer path segments or all wrapper/literal
resolution; descriptor/array/prototype rules; snapshot and alias timing; result and
storage domains; diagnostics; downgrade policy; and whether raw Jobs diverge from
reference views. A package major alone is insufficient because submitted/saved plan
meaning must identify the semantics. Current v1/v2 must not silently change.

## Recommendation and decision threshold

Preserve current traversal and add a focused public trust-boundary clarification in
a later documentation task. The clarification should appear together in the result-
reference, trust-boundary and capability/provider documentation so no single page
implies that all pre-authorization work is passive. It should state:

1. installed capability/provider implementations are trusted host code, not plugins
   isolated by `OperatorRuntime`;
2. active in-process results remain part of that trust until a v2 receiving value
   has successfully entered ADR-0011 capture;
3. path traversal may run own getters/Proxy traps before consumer authorization;
4. this does not grant the callback caller/scopes or receiving capability authority;
5. traversal failure prevents consumer authorization/entry but provides no rollback;
6. JSON/process materialization changes the representation and may execute behavior
   during serialization; SQLite does not materialize between active steps; and
7. hosts wanting passive results today must normalize/detach them in their trusted
   capability adapter and avoid active wrappers/results.

Do not describe this as “providers are safe” or “all provider effects are
authorized.” The provider/capability author remains responsible for implementation,
risk classification, credentials, ambient authority and any lazy result behavior.

No new ADR is drafted because no new semantic guarantee is recommended. A future
ADR becomes necessary if any of these product requirements is adopted:

- untrusted or mutually distrustful capabilities/providers share a process;
- model-authored reference paths must be incapable of triggering host callbacks;
- producer completion must commit an immutable/reference-stable result;
- reference behavior must be identical across memory, SQLite reload and processes;
- raw rich Job results and referenceable passive results need separate public types;
  or
- v1/v2 traversal behavior is to be rejected, normalized or reinterpreted.

At that point, the preferred starting comparison is B versus C, not JSON
normalization: B is the smallest callback-elimination rule, while C is the smallest
architecture that also owns mutation timing. Neither should be implemented without
an accepted versioned decision.

## Verification record

- Inspected the runtime, resolver, validators, stores, capability/job/public types,
  ADR-0011, ADR-0013, trust/security docs, existing investigations, examples and the
  relevant result/ownership/governed-value tests.
- Reviewed history at `d3fb8ed`, `6680e85`, `e02c440` and `0c1a08f`; no historical
  evidence of a passive traversal or passive result contract was found.
- Temporary memory/direct-resolver and active-SQLite probes produced the observations
  above and were removed. No permanent test or runtime artifact was retained.
- The sandbox `npm run check` exited 1 after 17 test files passed and only
  `.tmp/test-build/test/external-model-reasoner.test.js:1:1` and
  `.tmp/test-build/test/external-reasoner.test.js:1:1` reported generic `test failed`
  subprocess failures. The required outside-sandbox rerun exited 0: typecheck, all
  307 functional tests, build and package verification passed; the package contained
  106 files.
- The first quality command used an incorrect expanded checkpoint hash and exited 2
  at `git rev-parse` with `fatal: Needed a single revision`; the document hash was
  corrected. `npm run quality -- --base
  0c1a08f6f48648345d0102f0bd764accee020e43` then exited 0 with source, test and
  harness deltas all +0/-0, no dependency/lockfile/control change, and no unapproved
  execution references or unsupported accesses.
- `git diff --check` passed, and final status/temporary-file audits found only this
  architecture document as a tracked change.

TRUST_BOUNDARY_CLARIFICATION_REQUIRED
