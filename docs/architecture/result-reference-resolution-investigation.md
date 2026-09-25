---
title: Result-reference resolution trust-boundary investigation
---

# Result-reference resolution trust-boundary investigation

Investigation checkpoint: `e02c44010a19e9fd5b771c56d1209d3e64c288d9`
(`feat: implement versioned governed value boundary`), 2026-09-24.

This began as an investigation only. The object-shape follow-up produced ADR-0013,
which the maintainer accepted on 2026-09-24. Its implementation is limited to the
reference recognizer, focused regressions and contract disposition recorded here;
the governance inventory and Experiment II artifacts remain unchanged.

## Executive finding

Yes, existing result-reference processing can execute application-supplied
JavaScript before ADR-0011 governed capture. This is conditional on an in-process
value already carrying executable JavaScript, such as an accessor, Proxy trap, or
overridden array method. Admission reference discovery can execute such behavior
from the submitted input graph. Runtime result-path selection can invoke an own
getter or Proxy `getOwnPropertyDescriptor`/`get` trap on a capability result. The
ordinary recursive resolver can additionally invoke `ownKeys`, descriptor, `get`,
`has`, array method, constructor/species, and related operations while rebuilding
literal input containers. The exact operations are in
`src/runtime/execution/result-reference.ts:6-74` and
`src/runtime/execution/plan-validator.ts:29-85`.

ADR-0011 capture happens after all of that. It can reject or detach the value the
resolver returned, and v2 then gives authorization and capability entry stable,
separate representations. It cannot prevent or undo a traversal getter's earlier
mutation, exception, observation, external action, or reentrant runtime call.
ADR-0011 says this explicitly at `docs/adr/0011-governed-value-ownership.md:85-140`;
the implementation preserves the ordering at
`src/runtime/jobs/job-manager.ts:203-249`.

The evidence does **not** establish a receiving-capability authorization bypass.
In every full-runtime probe the receiving authorizer was called only after
traversal returned, and a traversal exception prevented receiving authorization
and entry. A reentrant submission launched by a getter followed its own admission
and authorization, and its denied capability did not execute. Nor can remote JSON
or model-authored JSON itself encode getters, Proxies, closures, functions, or
hidden state. The executable value must originate in the host process, most
directly from a custom capability/provider or a direct in-process plan caller.

The missing property is narrower than “authorization works” and stronger than
own-property lookup: Veil has no guarantee that reference recognition, recursive
input resolution, and selected-result traversal are passive and non-reentrant
before the receiving value is captured. Current documentation affirmatively says
getters and Proxy traps may run
(`docs/concepts/result-references.md:38-44`; `docs/architecture/trust-boundaries.md:65-68`).
Whether executable in-process values belong in Veil's threat model is a maintainer
decision. If the property is required, it needs a versioned architecture decision;
it is not an implementation correction under the accepted contracts.

Separately, the reference recognizer has one definite contract defect and exposes
an unresolved contract ambiguity. `isResultReference` checks only that
`Object.keys(record).length === 1`; it never checks that the one enumerable own key
is `$ref` before reading `record.$ref`
(`src/runtime/execution/result-reference.ts:6-15`). An object with one unrelated
own key and an inherited `$ref` string/getter is therefore recognized and resolved
as a reference. That conflicts with the public exact form and the rule that an
object with another key is ordinary input
(`docs/concepts/result-references.md:6-15,50-52`). Probe P0 confirms the mismatch.

The same implementation also ignores nonenumerable and symbol-keyed extras, but
the repository does not define whether those are among the “properties” counted by
the exact-form rule. It likewise does not define whether `$ref` must be enumerable
or a data property. The public type only requires a readonly string field
(`src/runtime/planner/planner.ts:9-11`); the reference docs and ADRs add no
descriptor, symbol-key, or prototype rule. Existing getter/Proxy compatibility
evidence establishes that callbacks may run during reference processing, not that
an accessor is part of the valid reference shape. A complete exact-shape fix would
therefore choose semantics that the accepted contract has not chosen.

The follow-up evidence supports a JSON-like tagged data object as the intended
abstraction, with no repository reliance on unusual wrapper representations.
Accepted ADR-0013 defines the exact contract and authorizes its cross-version
recognizer correction. It does not authorize or imply passive result-path
traversal.

## Exact lifecycle and path map

The normal direct entry is `OperatorRuntime.executePlan`:

1. `OperatorRuntime.executePlan` creates admission provenance, shallow-captures and
   freezes caller fields, then calls `JobManager.executePlan`
   (`src/runtime/operator-runtime.ts:52-65,118-133`). `run` obtains a plan from the
   selected strategy and enters the same method
   (`src/runtime/operator-runtime.ts:136-181`).
2. `JobManager.executePlan` reads `plan.version` and checks implementation support
   plus the host-configured allowlist before Job creation
   (`src/runtime/jobs/job-manager.ts:31-45`). v2 is opt-in; the default configured
   version remains v1 (`src/runtime/operator-runtime.ts:68-87`).
3. It synchronously captures the structural plan envelope. The steps array and
   consumed step fields become new records, but each `input` root remains shared
   (`src/runtime/jobs/job-manager.ts:48-64`; ADR-0008 at
   `docs/adr/0008-structural-execution-ownership.md:16-47`). These named reads can
   themselves invoke plan/step getters or Proxy traps; that is the earlier
   structural boundary, not result resolution.
4. `validatePlan` checks step identity, capability/version, declared top-level
   fields, and reference ordering (`src/runtime/execution/plan-validator.ts:109-175`).
   `collectReferences` recursively discovers references with
   `isResultReference`, array `flatMap`, and `Object.values` (lines 79-85).
   `parseResultReference` requires `steps.`, selects the text before the first
   `.result` as step ID, and splits the remaining dot suffix into string path
   segments (`src/runtime/execution/result-reference.ts:17-38`). Admission proves
   syntax and that the target ID appeared earlier; it does not look up a result or
   prove the path exists.
   Recognition is currently broader than the documented exact shape: a sole
   unrelated enumerable own key plus an inherited `$ref` can pass the type guard.
5. A Job is created and persisted without steps; captured steps are then assigned
   as pending `JobStep` records and the Job is updated
   (`src/runtime/jobs/job-manager.ts:85-109,112-139`). `JobStep.result` is publicly
   typed as `unknown` (`src/runtime/jobs/job-step.ts:8-16`).
6. `JobManager.execute` reloads the Job from the selected store, marks it
   executing, and iterates steps in list order
   (`src/runtime/jobs/job-manager.ts:170-194`). It resolves the registered
   capability before resolving that step's input (lines 195-201).
7. For the current step it slices earlier Job steps, then calls
   `resolveResultReferences(step.input, completedSteps)` synchronously
   (`src/runtime/jobs/job-manager.ts:203-214`).
8. A recognized reference is parsed again, the earlier step is found by exact ID,
   and its status must be `completed`. Runtime path existence is checked one
   segment at a time with `Object.hasOwn`; a successful segment is then read with
   ordinary bracket access (`src/runtime/execution/result-reference.ts:41-60`).
   A whole-result reference returns `step.result` directly. A selected result is
   returned directly and is not recursively scanned for more `$ref` objects.
9. Non-reference arrays are rebuilt through `value.map`; non-reference objects are
   rebuilt through `Object.entries` and `Object.fromEntries`
   (`src/runtime/execution/result-reference.ts:63-74`). Thus literal containers are
   projections, while selected reference terminals retain their exact identity in
   v1. Multiple selected terminals can still alias one another.
10. For v2 only, `captureGovernedValue(resolvedInput)` runs immediately after the
    resolver returns (`src/runtime/jobs/job-manager.ts:208-220`). It rejects Proxy,
    accessor, function, symbol, unsupported prototype/brand and other excluded
    representations using passive inspection
    (`src/runtime/execution/governed-value.ts:29-134,143-190`). v1 keeps the
    resolver's value unchanged.
11. The receiving input is validated. Failure stops before its authorization
    (`src/runtime/jobs/job-manager.ts:218-229`; tested at
    `test/execution-contract.test.ts:375-429`).
12. v1 authorizes the resolved graph itself. v2 constructs a detached recursively
    frozen authorization view from the private captured graph
    (`src/runtime/jobs/job-manager.ts:231-249,445-478`). The decision must be an
    object with an own `decision`, read as exact `allow` or `deny`; denial and
    malformed/error paths do not enter the capability (lines 251-287).
13. After explicit allow, the step becomes running and emits
    `capability.started`. v2 first creates a detached mutable copy; v1 again uses
    the resolved graph. `Capability.execute` is then awaited
    (`src/runtime/jobs/job-manager.ts:289-317`).
14. Awaiting the capability assimilates a returned Promise or root thenable before
    assignment. The fulfilled value is assigned directly to `step.result`, the
    step is marked completed, and `capability.completed` is emitted
    (`src/runtime/jobs/job-manager.ts:309-326`). There is no result schema,
    producer-side governed capture, serialization, or store update at this point.
    The next step reads this live in-memory result.
15. Only after the loop does the Job aggregate its result and update the store
    (`src/runtime/jobs/job-manager.ts:351-367`). A caught step failure similarly
    updates the terminal failed Job (lines 368-386).

`MemoryJobStore` retains and returns the same live Job object
(`src/runtime/jobs/job-store.ts:22-86`). `SQLiteJobStore` uses
`JSON.stringify` on create/update and `JSON.parse` on get/list
(`src/providers/storage/sqlite-job-store.ts:22-56,59-129`). In a fresh
`executePlan`, SQLite therefore serializes the captured plan inputs during the
pre-execution update and reloads that Job once before the loop. It does **not**
serialize/reload a capability result between producer and consumer. A result
created after that reload stays live for later `$ref` traversal. Terminal
persistence later serializes it and can independently invoke getters, Proxy
`toJSON` reads, or other JSON hooks. That persistence surface is adjacent to this
investigation but is not result-reference selection.

## Current documented contract

The contract separates three evidence classes:

| Topic | Documented/decided contract | Tested characterization | Incidental or unpromised behavior |
| --- | --- | --- | --- |
| Reference shape/order | Exactly one property, `$ref`; an object with other keys is ordinary input; `steps.<earlier-id>.result[.<path>]`; validation discovers nested object/array references (`docs/concepts/result-references.md:6-26,50-52`; `docs/reference/execution-plan-v1.md:67-69`). The documented example and public structural type require a string-valued `$ref` (`src/runtime/planner/planner.ts:9-11`). | Parser/order suites in `test/plan-validator.test.ts` and runtime examples in `test/execution-contract.test.ts:320-429`. P0 exposes the untested recognizer mismatch. | Empty path segments are accepted parser behavior but discouraged (`docs/concepts/result-references.md:46-48`). The inherited-`$ref`/unrelated-own-key acceptance is overbroad. The contract does not say whether exactness includes nonenumerable or symbol keys, whether `$ref` may be nonenumerable or accessor-backed, or whether an own `$ref` object may have a custom/null prototype. |
| Own paths | Every path segment must be own; inherited paths fail; own special names are data (`docs/concepts/result-references.md:38-44`; trust boundaries lines 65-68). | `test/result-reference.test.ts:26-61`; full runtime at `test/execution-contract.test.ts:672-734`. | A Proxy can report virtual ownership; this is not ownership attestation. |
| Identity/mutation | v1 referenced objects retain identity and mutability; resolution does not stabilize authorization-to-entry values (`docs/concepts/result-references.md:40-44`; `docs/reference/execution-plan-v1.md:50-54`). ADR-0008 deliberately preserves this (`docs/adr/0008-structural-execution-ownership.md:16-47`). | Root/nested identity at `test/result-reference.test.ts:17-24`; reference and result mutation at `test/structural-ownership.test.ts:274-293`. | Literal objects/arrays are rebuilt and may split pre-existing aliases; that is implementation behavior rather than a general value-model promise. |
| Accessors/Proxy | Own getters and Proxy traps may run; Veil is not a hostile-JavaScript sandbox (`docs/concepts/result-references.md:38-44`; ADR-0011 lines 129-140). | Getter calls/errors and descriptor/get traps at `test/result-reference.test.ts:75-103`. | Exact trap counts and repeated `$ref` reads are not a stable public protocol. |
| Arrays | References may occur in arrays; numeric dot segments use property lookup (`docs/concepts/result-references.md:26-36`). | Own index/length accepted; holes, inherited indices and methods rejected as result paths (`test/result-reference.test.ts:44-52`). | Receiver-controlled `map`/`flatMap`, species construction, sparse literal projection, and extra-property loss are not promised semantics. |
| Special/rich values | `ExecutionStep.input` and `Capability` result are `unknown`/generic (`src/runtime/planner/planner.ts:13-18`; `src/runtime/registry/capability.ts:14-35`). v1 docs say input may be any value subject to shallow declared fields (`docs/reference/execution-plan-v1.md:29-34`). | Undefined, NaN, bigint, signed zero and functions are characterized at `test/result-reference.test.ts:64-72`; dates, buffers, class instances, cycles and SQLite transformations at `test/value-ownership.test.ts:299-364`. | No portable contract promises symbols, class/private state, native handles, custom prototypes, methods, iterators, functions, or store-independent rich values. |
| v2 receiving value | ADR-0011 guarantees capture after existing resolution, validation of the capture, stable immutable policy view, explicit allow, and detached equivalent entry (`docs/adr/0011-governed-value-ownership.md:11-19,85-140`). | `test/governed-value-v2.test.ts:40-123` covers detachment, freezing, aliases, rejection, opt-in and v1/v2 coexistence. | v2 does not retrospectively make admission or resolution passive. |
| Persistence | ADR-0011 does not promise committed-result stability or storage parity (lines 69-75,129-140). | SQLite structural reload at `test/structural-ownership.test.ts:296-315`; JSON value differences at `test/value-ownership.test.ts:350-364`. | Live inter-step results and later reloaded Job projections are observably different. |

ADR-0012 governs structured diagnostics for explicit admission rejection. It
explicitly leaves structural getters, Proxy traps, cyclic traversal, unexpected
JavaScript errors, and post-admission resolution outside that diagnostic contract
(`docs/adr/0012-structured-admission-diagnostics.md:32-61,157-187`). It neither
adds nor implies passive reference processing.

The strongest compatibility evidence is deliberate but narrow. Identity,
mutability, getter execution, Proxy behavior, and rich terminals are v1
characterizations that ADR-0011 refused to change silently
(`docs/adr/0011-governed-value-ownership.md:21-31,48-54`). Getter/Proxy execution
is compatibility evidence, not a security objective; the earlier reconciliation
states that distinction at
`docs/architecture/result-reference-reconciliation.md:44-63`.

## Result-reference object-shape contract

### Evidence of the intended abstraction

Every contract-level expression uses one JSON-representable tagged field:

- the guide says “exactly one property” and treats other-key objects as ordinary
  input (`docs/concepts/result-references.md:6-15,50-52`);
- the v1 reference writes the exact literal form
  `{ $ref: 'steps.<earlier-step-id>.result' }`
  (`docs/reference/execution-plan-v1.md:67-69`);
- the root-exported structural type has only `readonly $ref: string`
  (`src/runtime/planner/planner.ts:9-11`; `src/index.ts:10-16`);
- repository examples, tests and the Experiment II protocol use object literals or
  decoded JSON (`experiments/external-model-reasoner/protocol.md:7-13`).

ADR-0008 and `test/structural-ownership.test.ts:274-293` intentionally preserve
mutation of an ordinary reference object's data value before resolution. They do
not establish accessor, hidden-key, symbol or prototype semantics. ADR-0011
preserves the broader fact that getter/Proxy callbacks can occur before its
boundary, but does not define the wrapper representation. Git history shows that
the `Object.keys`/ordinary-read recognizer arrived unchanged in the architecture
lock commit; the later own-property fix in `6680e85` changed only referenced-result
path traversal. No caller, test, example, accepted ADR or history entry relies on
an inherited/accessor/nonenumerable `$ref`, hidden/symbol extras, or a Proxy/class/
null-prototype wrapper.

This evidence strongly supports a JSON-like tagged data object. “JSON-like” means
the single own enumerable string data field visible in all wire forms; it does not
make `JSON.stringify`, provenance or prototype identity part of recognition.

### Candidate contracts considered

| Candidate | Definition | Assessment |
| --- | --- | --- |
| Enumerable-own-string repair | The sole enumerable own string key must be `$ref`; require own lookup but continue to accept accessors and ignore hidden/symbol extras. | Smallest code delta, but leaves “exactly one property” with an undocumented enumerable-string-only meaning and permits mixed instruction/data wrappers. |
| Exact tagged data object | Complete own-key set is exactly `$ref`; it is an enumerable own data property containing a primitive string; descriptor flags and prototype do not affect meaning; no special Proxy rejection. | Best fit for docs, exported type and wire examples. It tightens only unpromised JavaScript-only shapes and avoids creating a general hostile-object boundary. Accepted in ADR-0013. |
| Plain-record safe recognizer | Exact data shape plus ordinary/null prototype allowlist and Proxy rejection. | Broader than the reference abstraction, rejects structural objects without repository evidence, and starts a hostile-value boundary excluded from this task. |
| Serialization-defined shape | Accept an object when serialization projects the one-field JSON form. | Invokes conversion behavior, drops hidden/symbol data and makes instruction recognition depend on serialization. Rejected. |
| v2/future-version-only exactness | Retain current v1 recognition and introduce strict shape later. | Preserves the known v1 defect and splits an unversioned public syntax without a selection-semantics change. Rejected. |

### Recommended exact representation

Under accepted ADR-0013, a result-reference wrapper is a non-null, non-array object
whose complete own-key set is exactly the string `$ref`. Its
`$ref` descriptor is enumerable and is a data descriptor whose value is a
primitive string. Writable/configurable flags do not matter. The prototype does
not matter; inherited properties are ignored, but inherited `$ref` cannot satisfy
the required own tag. A non-array Proxy is not categorically rejected and is
judged by the shape its own-key and descriptor traps report. Those traps may run.

These rules have distinct reasons:

| Dimension | Rule and reason |
| --- | --- |
| Own/inherited | Require own `$ref` for semantic correctness: the instruction tag must belong to the submitted wrapper and the inherited-lookup defect must close. |
| Data/accessor | Require data. This matches the tag and wire abstraction and prevents an ordinary getter from supplying a dynamic tag; it is a scoped compatibility tightening, not a passive-processing guarantee. |
| Enumerability | Require enumerable `$ref` to match literals, JSON and recursive input enumeration, while preserving rejection of a sole hidden `$ref`. |
| Descriptor flags | Ignore writable/configurable. They carry no reference meaning and JSON does not express them; frozen/sealed wrappers remain valid. |
| Extra string keys | Reject all enumerable and nonenumerable own extras so “exactly one” has one meaning and mixed data/instruction objects remain ordinary input. |
| Symbol keys | Reject own symbol extras because they are properties outside the documented/wire tag; ignoring them would make exactness transport-dependent. |
| Prototype | Do not restrict it. Prototype identity is unrelated to tag meaning; own shape suffices for ordinary, null-prototype and class-created structural values. |
| Proxy | Do not add special rejection. Proxy exclusion would create the hostile-object boundary this decision excludes; reflective traps can still execute or throw. |
| Value | Require primitive string, as the public type and docs already do. Boxed strings remain ordinary input. |
| Syntax | Preserve the existing parser and earlier-step rules. Shape-conforming malformed text is recognized and then rejected; non-string `$ref` remains ordinary input. |

The parser's normal form remains
`steps.<nonempty-step-id>.result[.<dot-separated-path>]`. This decision does not
tighten the documented empty-segment edge behavior or alter path selection.

### Compatibility matrix

| Wrapper | Current | Proposed | Impact |
| --- | --- | --- | --- |
| Ordinary literal; frozen/sealed equivalent | Reference | Reference | Supported behavior preserved. |
| Null/custom-prototype or class instance with one own enumerable data `$ref` | Reference | Reference | Theoretical structural compatibility preserved. |
| Inherited `$ref` plus unrelated enumerable own key | Reference | Ordinary input | Required defect correction. |
| Inherited-only `$ref` | Ordinary input | Ordinary input | Preserved. |
| Enumerable accessor `$ref` returning string | Reference; getter runs | Ordinary input | Compatibility tightening; no supported reliance found. |
| Sole nonenumerable data `$ref` | Ordinary input | Ordinary input | Preserved. |
| Nonenumerable `$ref` plus unrelated enumerable own key | Reference | Ordinary input | Required exact-own-shape correction. |
| Valid `$ref` plus nonenumerable string extra | Reference | Ordinary input | Tightens incidental behavior. |
| Valid `$ref` plus symbol extra | Reference | Ordinary input | Tightens incidental behavior. |
| Valid `$ref` plus enumerable string extra | Ordinary input | Ordinary input | Documented behavior preserved. |
| Non-array Proxy reporting exact data shape | Reference; traps may run | Reference; traps may run | Broad Proxy compatibility preserved; trap sequence is not promised. |
| Array carrying `$ref` | Ordinary input | Ordinary input | Preserved. |
| Missing/non-string `$ref` | Ordinary input | Ordinary input | Preserved. |
| Exact wrapper with malformed string | Parser rejection | Parser rejection | Diagnostic behavior preserved. |

### Version and governance vehicle

The decision applies to ExecutionPlan 1.0 and 2.0. Both use the same recognizer,
the root-exported `ResultReference` is unversioned, and the exact-shape docs predate
v2. This is a malformed-recognition correction, not a change to result selection or
ADR-0011's governed-value boundary. A version split would leave the known defect
in v1 and invent two wrapper languages with no public type representation.
ADR-0011's v1-preservation rule concerns its authorization-to-entry ownership
guarantee; ADR-0013 neither changes that guarantee nor moves its boundary. Its
acceptance supplies the explicit authority for the separate cross-version wrapper
correction.

A formal decision is nevertheless required. The rule determines whether public
input is executable plan syntax or ordinary capability data and tightens incidental
acceptance for accessors and hidden/symbol extras. None of ADR-0008, ADR-0011 or
ADR-0012 owns that decision, and amending them would expand their accepted scopes.
The smallest vehicle was therefore the new, narrow ADR-0013. The maintainer's
acceptance authorizes only its recognizer, regression and contract-documentation
changes.

### Implementation and regressions

The inherited-`$ref` fix is mechanical: inspect the complete own keys and own
`$ref` descriptor, require the exact enumerable primitive-string data shape, and
leave prototypes and Proxies otherwise unrestricted. It adds no capture,
serialization, prototype allowlist, Proxy detection or path-traversal change.

Focused regressions must cover an ordinary and frozen/sealed valid wrapper;
null/custom-prototype own data wrappers; inherited-only and inherited-plus-own-key
cases; accessor and nonenumerable `$ref`; enumerable, hidden and symbol extras;
missing/non-string `$ref`; arrays; Proxy-reported conforming/nonconforming shapes;
and malformed text reaching the existing parser diagnostic. One negative case must
prove recognition did not broaden to class prototype getters or other
reference-shaped ordinary input.

This decision does not make wrapper recognition passive: Proxy `ownKeys` and
descriptor traps may execute. It does not decide how a referenced result path is
traversed, make result getters/Proxies safe, change governed capture, validate
producer results, alter persistence, or reinterpret Experiment II.

## Reachable value provenance

### Submitted inputs

A public in-process caller may pass any JavaScript value as `ExecutionStep.input`.
Structural capture keeps its root binding but does not capture its contents. A
custom `PlannerStrategy` can likewise return an arbitrary in-process plan before
`run` enters `executePlan` (`src/runtime/operator-runtime.ts:149-181`). These
origins can carry accessors, Proxies, functions, symbols, aliases, custom
prototypes, and closures.

Common remote paths materially narrow that provenance:

- the built-in OpenAI-compatible planner parses model text with `JSON.parse` and
  constructs a v1 plan (`src/runtime/planner/providers/openai-compatible-planner.ts:182-266`);
- Fastify JSON request bodies and MCP SDK arguments are data transported into
  host-created plans (`src/api/routes/execution.routes.ts:27-54`;
  `src/integrations/mcp/inbound/mcp-adapter.ts:44-87`);
- Experiment II decodes bounded passive JSON and recursively freezes it before
  plan projection (`experiments/external-model-reasoner/protocol.md:27-30`;
  `experiments/external-reasoner/fixture-host.mjs:97-118`).

Those transports can supply suspicious strings and special property names, but
they cannot encode executable accessors, Proxy identity, functions, closures, or
private native state. Host adapters can reintroduce such objects after parsing,
so JSON ingress is a property of those adapters, not the core `ExecutionPlan`
type.

### Prior-step results

`Capability<TInput, TResult>` places no runtime restriction on `TResult`
(`src/runtime/registry/capability.ts:14-35`). After the awaited capability returns,
the result is assigned directly to the live `JobStep`; there is no validation or
serialization before a later step resolves it. Therefore a custom capability can
return a getter-bearing object, Proxy, class instance, function, symbol, Promise
nested in a result, native object, alias graph, or object with hidden closure
state. A custom provider can return the same through its capability.

Bundled implementations usually reduce this risk by construction rather than by
a runtime boundary. Filesystem, shell, browser and LinkedIn capabilities construct
ordinary records (`src/capabilities/filesystem/file-read.ts:115-122`;
`src/capabilities/shell/command-run.ts:158-233`;
`src/capabilities/web/page-read.ts:53-80`;
`src/capabilities/linkedin/auth-status.ts:23-43`). The HTTP provider parses JSON or
text and constructs a record (`src/providers/http/fetch-http-provider.ts:70-105`).
Outbound MCP returns the SDK result object without a Veil value check
(`src/integrations/mcp/outbound/mcp-provider.ts:51-65`;
`src/integrations/mcp/outbound/mcp-capability.ts:62-77`). None of these examples
narrows the public custom-capability contract.

A root Promise/thenable returned by an async capability is assimilated by the
`await` at capability execution, before `step.result` is stored. A Promise or
thenable nested inside the fulfilled result is not awaited by the resolver. v1 can
select and pass it; v2 capture rejects native Promise and ordinary callable/
accessor-bearing thenable representations if they remain in the resolved graph
(`src/runtime/execution/governed-value.ts:46-66,97-117,149-168`).

### Persistence provenance

Memory storage retains the original graphs. SQLite JSON serialization invokes
`toJSON`/ordinary reads and loses prototypes, accessors, Proxy identity, functions,
symbols, undefined members, aliases, signed zero and other non-JSON distinctions;
bigint and cycles can reject persistence. Its reload returns ordinary JSON-parsed
records. However, the active SQLite reload precedes capability production, so it
does not sanitize or detach new results between steps. No persisted-job replay
path is part of this execution flow (`docs/architecture/governed-value-implementation-readiness.md:57-75,122-127`).

## Traversal-operation analysis

| Operation/site | User-code mechanism in JavaScript | Actually reachable here |
| --- | --- | --- |
| `Array.isArray(value)` in reference recognition | No ordinary trap; revoked Proxies can throw. | Every candidate. It classifies Proxy-wrapped arrays as arrays, enabling later receiver method access. |
| `Object.keys(record)` in `isResultReference` | Proxy `ownKeys` and `getOwnPropertyDescriptor`; ordinary accessors are not read yet. | Admission and runtime, for each non-array object considered as a possible reference. The code checks only key count, not `keys[0] === '$ref'`, and ignores nonenumerable/symbol extras. P0 confirmed the shape bug; P6 observed both Proxy traps. |
| `record.$ref` in recognition/parse/error formatting | Own/inherited getter or Proxy `get`. | Reachable. Recognition reads it even when `$ref` is inherited and the sole own key is unrelated. Callers read it again for parsing, and a missing-path error reads it again. A stateful getter can return different values or throw at each read. |
| `Object.values` during admission discovery | Proxy `ownKeys`, descriptors and `get`; ordinary enumerable getters. | Reachable for every non-reference input object before Job creation. Cycles recurse until stack failure. |
| Receiver `.flatMap` during admission array discovery | Proxy `get`; own/inherited overridden method; built-in method reads `length`, may use constructor/species, and performs `has`/`get` per index. | Reachable for submitted arrays. Probe P6 observed `get(flatMap/length/constructor)`, `has(0)`, and `get(0)`. No iterator is used. |
| Receiver `.map` during runtime array resolution | Same mechanisms as `flatMap`; sparse holes are checked with `has`. | Reachable in memory for submitted arrays and for arrays in the unresolved literal input graph. Probe P6 observed it after the source completed and before sink authorization. |
| `Object.entries` during runtime object resolution | Proxy `ownKeys`, descriptors and `get`; ordinary enumerable getters. | Reachable before v2 capture. Symbols and nonenumerable keys are ignored. Probe P6 observed it after the source completed. |
| `Object.fromEntries` for the rebuilt record | Operates on the resolver-created entry array; defines data properties, including `__proto__`, rather than using the legacy setter. | It does not call a setter on the submitted object's prototype. It does not make earlier enumeration passive. |
| `completedSteps.find` and status/result reads | Ordinary reads on runtime-owned JobStep records. | The records are newly captured or JSON-parsed. `step.result` is a data property whose value may itself be active. |
| `Object.hasOwn(resolved, segment)` | Proxy `getOwnPropertyDescriptor`; no `has` trap and no inherited lookup for ordinary objects. | Reachable for every result path segment. Probe P3 observed the descriptor trap. An ordinary inherited getter was rejected without firing in P1 and `test/result-reference.test.ts:75-85`. |
| `resolved[segment]` | Own accessor or Proxy `get`; a Proxy can return data inconsistent with its ownership descriptor. | Reachable immediately after the ownership check. Probe P2 fired a mutating getter; P3 fired a mutating `get` trap. |
| Numeric segments | Already strings from `split('.')`; property lookup uses strings such as `"0"`. | Own array indices and own `length` work; holes/inherited indices/methods fail. No numeric coercion hook runs. |
| Prototype chain | Ordinary inherited segment fails at `Object.hasOwn`. | Inherited getters are not fired. Custom-prototype objects with own properties remain traversable; whole-reference v1 preserves them. Proxy traps can synthesize “own” status. |
| Symbols | Grammar produces string segments; `Object.entries/values` omit symbols. | Symbol-keyed paths are unaddressable. Whole/nested selected symbol values can reach v1; v2 rejects a symbol that remains after resolution. |
| Iterators/methods | Object and array iteration protocols are not used for path selection. | A custom `map`/`flatMap` method can be invoked for literal arrays. Selected iterator objects are passed in v1 and rejected by v2 capture when still recognizable/unsupported. |
| Coercion | Parser operates only after a string check; segments are strings; path guards use truthiness/`typeof`. | No value `toString`/`valueOf` coercion is required for normal parsing or selection. JSON persistence is a separate active conversion boundary. |
| Exceptions | Getter/trap/method exceptions propagate out of resolution. | JobManager marks the receiving step/job failed and skips later steps. Probe P4 confirmed no receiving authorization or entry. A hostile thrown Proxy/Error can cause more behavior during `instanceof`/message extraction; that is exception handling, not a fail-open path. |
| Reentrancy | Any invoked getter/trap/method can call code available through its closure. | Probe P7 started a nested `executePlan` during v2 path traversal. The outer sink still followed its own authorization; the nested denied capability had zero entries. No runtime/registry/provider reference is automatically supplied to the getter. |

Unusual path names have no special grammar semantics. `__proto__`, `constructor`,
and `prototype` are accepted when they are actual own properties. An ordinary
object's inherited versions fail. JSON-created own versions resolve normally,
as shown by `test/result-reference.test.ts:26-42` and Probe P5. Empty-string
segments are also plain property names under the current parser.

## Probe results

The temporary probe ran locally on Node v24.18.1 against the compiled checkpoint,
once with the memory store and once with active SQLite. It registered only fresh
fake read capabilities, used in-memory counters/records, performed no network,
filesystem, process, browser, or external-provider action, and was removed with
its temporary SQLite files. The first attempted `tsx` launch did not execute the
probe because the sandbox denied its IPC listener with
`listen EPERM ... /tmp/tsx-1000/2.pipe`; the successful runs used plain Node and
the repository build output.

| Probe | Observation | Lifecycle conclusion |
| --- | --- | --- |
| P0 exact-shape recognizer | An object with sole enumerable own key `unrelated` and an inherited `$ref` getter was recognized; the getter ran once for the standalone guard and twice more during resolution, which returned the selected source value. An own `$ref` plus a nonenumerable `extra` property was also recognized/resolved. | `isResultReference` violates the documented exact-shape/extra-key rule. Inherited `$ref` access is an additional admission/runtime callback path. |
| P1 inherited getter | An inherited `value` getter had zero calls; lookup failed with `Result reference path not found`. | Own-property enforcement prevents ordinary prototype getter execution. |
| P2 getter + mutation | In both v1 and v2: source authorization/entry → getter → sink authorization/entry. The getter changed a sibling from `before` to `after`; a later reference in the same receiving input observed `after`. | Traversal executes and can mutate/affect later selections before v2 capture. |
| P3 result Proxy + mutation | In both versions, `getOwnPropertyDescriptor('virtual')` and `get('virtual')` ran before sink authorization and changed counters; sink received the trap's passive string. | Proxy ownership/read traps are live pre-capture. Capture neutralizes the returned string, not trap effects. |
| P4 throwing getter | Memory v1/v2 returned a failed Job with the exact getter error; source ran, sink authorization/entry did not. | Traversal exceptions fail the receiver closed with respect to its governed invocation. |
| P5 arrays/special names | Own index `0`, array `length`, and JSON-own `__proto__`, `constructor`, `prototype` all resolved. | Current own-data semantics match the tests/documentation. |
| P6 submitted object/array Proxies | Memory showed admission `ownKeys`/descriptor/get and array `flatMap` traps, then runtime `ownKeys`/descriptor/get and array `map`/`has` traps before sink authorization. SQLite showed admission traps, then JSON `toJSON`/element reads before source authorization, and no proxy traps after the reload. | Submitted active inputs stay live through memory resolution; SQLite materializes them before the loop. Admission/storage are already active boundaries. |
| P7 reentrant getter | A v2 result getter launched a nested plan. The outer Job completed. The inner Job was denied and failed; inner capability entries remained zero. | Reentrancy into public runtime state is possible when the closure has the runtime, but the nested path did not inherit permission or bypass its authorizer. |
| P8 alias selection | Two references to the same producer object remained aliases at sink entry in both versions. v1 sink identity equaled the producer object; v2 alias topology was preserved but detached from it. | This matches v1 identity and ADR-0011 v2 equivalence semantics. |
| P9 active SQLite results | Capability-created getter/Proxy results still executed during the later `$ref`, because production followed the one pre-loop reload. Terminal JSON persistence then fired the getter twice through the step result and aggregate Job result, and read Proxy `toJSON`; a throwing getter caused `executePlan` rejection during failed-Job persistence. | SQLite is not an inter-step sanitizer. It adds a separate post-loop active serialization surface and can change failure delivery. |

These probes establish reachability and order. They do not establish an external
attacker path, real external effect, tenant crossing, or authorization bypass.

## v1 versus v2 behavior

| Point | ExecutionPlan 1.0 | ExecutionPlan 2.0 |
| --- | --- | --- |
| Exact reference recognition | Same overbroad `Object.keys` count behavior; inherited `$ref` and hidden-extra cases can be misclassified. | Identical implementation bug before capture. |
| Admission reference discovery | Active current logic. | Identical active logic. |
| Runtime literal recursion/path selection | Active current logic. | Identical active logic. |
| Getter/Proxy side effects and exceptions | Occur before validation/authorization. | Same; occur before governed capture. |
| Selected object identity | Exact selected result object can cross validation, authorization and outer entry. | Resolver first returns exact object, but successful governed capture detaches it before validation/policy/entry. |
| Alias topology | Selected producer aliases remain shared with producer and receiver. | Aliases within the captured representation are preserved, while source, policy view and capability value are mutually detached. |
| Active selected terminal | May reach authorization/entry as the active object. | Capture rejects an accessor/Proxy still present in the returned graph. If traversal already invoked it and returned passive data, that passive output can succeed. |
| Authorization stability | Shared mutable graph; historical behavior. | Frozen detached view and detached equivalent capability input after allow. |
| Version enablement | Default and explicitly supported where configured. | Must be explicitly enabled by the trusted host; no automatic upgrade. |

V2 therefore reduces post-resolution exposure but does not reduce pre-capture
execution. It can even make the distinction easy to miss: the authorizer and
capability see clean passive copies after an active getter or Proxy already ran.

## Relationship to ADR-0011

ADR-0011 is correctly implemented for its stated boundary. Its required sequence
places synchronous capture immediately after resolution and before receiving-step
validation (`docs/adr/0011-governed-value-ownership.md:85-120`). It explicitly
keeps existing reference grammar, ordering, own-property traversal, and
getter/Proxy reads, and states that safe pre-resolution traversal requires another
scoped decision (lines 129-140). `JobManager` repeats that boundary in its comment
and code (`src/runtime/jobs/job-manager.ts:208-220`).

Consequently:

- governed capture occurs **after** the dangerous operations identified here;
- it neutralizes the returned graph for v2 when capture succeeds;
- it does not neutralize traversal behavior that already happened;
- v2 changes identity/mutation exposure after resolution, while pre-resolution
  exposure is the same as v1;
- a getter that returns passive data can perform an ungoverned side effect and
  still yield a perfectly governed v2 authorization/entry value;
- a getter/Proxy that remains in the returned graph is rejected by v2 capture, but
  only after any earlier path/literal operation needed to reach it;
- no ADR-0011 claim should be extended backward to admission, storage, reference
  recognition, or selection.

This is not evidence that ADR-0011 needs correction. It is evidence for a distinct
possible property at the preceding boundary.

## Security and authority implications

The strongest supported claims are:

- **Arbitrary JavaScript execution:** yes, within the host process, when the
  traversed in-process graph already contains an accessor, Proxy, or invoked custom
  method. The runtime does not sandbox that code. JSON-only attackers cannot create
  those mechanisms by syntax alone.
- **Object mutation:** yes. P2 and P3 demonstrate mutation of application-held
  state and changed later selection. A callback can mutate any object reachable
  through its receiver or closure.
- **Observation/information flow:** yes, for reachable object/closure state and
  traversal timing/path names. The resolver supplies no caller, registry, provider,
  credentials, or private snapshot reference as an argument. Such data is
  observable only if the code already retained or can otherwise access it.
- **Fixture/application state:** yes. The local counters and sibling record were
  changed. Real application state would be equally reachable through a closure.
- **External effects:** possible for in-process code that already has filesystem,
  network, provider, or other ambient authority. The safe probes intentionally did
  not perform one. This is not the same as proving a Veil capability or provider
  was invoked.
- **Capability invocation:** the traversal callback can directly call any function
  it already holds, or submit a new plan if it retained a runtime. P7 proves the
  latter. Veil does not hand it a capability/registry/provider reference.
- **Authorization bypass:** not established. The receiving capability still needs
  explicit allow after successful traversal/capture/validation. The reentrant
  runtime call had its own policy and denial prevented entry. Directly calling a
  retained capability/provider would bypass runtime, but retaining and calling
  that object is ambient host-code authority, not authority acquired from `$ref`.
- **Plan-meaning/type-validation bypass:** the P0 shape defect can reinterpret an
  object documented as ordinary input as a reference. Admission then skips the
  declared-field literal type check when `allowReferences` is true
  (`src/runtime/execution/plan-validator.ts:29-56`) and validates only the resolved
  value at the receiving step. This is a reference-recognition/type-validation
  contract bypass, not permission to skip receiving authorization.
- **Caller identity/scopes:** no direct alteration path was found. The runtime
  freezes copies of caller, scopes and metadata at entry
  (`src/runtime/operator-runtime.ts:52-65`). Nested metadata values remain a
  separate shallow-ownership limit. A producer already receives caller in its own
  execution context and can retain what it was given.
- **Registry/provider access:** no new access is conferred. Registry and services
  are process-global/trusted-host limitations, not private runtime sandboxes
  (`docs/reference/operator-runtime.md:22-24`;
  `docs/architecture/governance-hardening.md:119-138`).
- **Denial of service:** reachable through throwing behavior, unbounded synchronous
  getter/trap/method work, cyclic admission recursion, or large graphs before v2's
  capture limits apply. P4 proves the ordinary exception case.
- **Failure/evidence distortion:** traversal mutations can influence later
  selections and application state before policy. SQLite terminal serialization
  can execute the result again and can replace a failed-Job return with a rejected
  Promise, as P9 showed. This does not produce a fail-open capability entry.

The governance gap, if Veil chooses to close it, is therefore: **the orchestrator
can invoke application code while interpreting a proposed/reference-bearing value,
before it owns the value to be validated and authorized.** That code's effects are
not themselves represented as the receiving capability invocation. Current trust
documents limit governed execution claims and state that arbitrary host JavaScript
is not sandboxed (`SECURITY.md:52-65`;
`docs/architecture/governance-hardening.md:10-13`). The maintainer must decide
whether custom capability/provider results are data at this boundary or trusted
host code whose accessors remain permissible.

## Compatibility constraints

1. **Changing v1 is breaking.** Own getter execution, Proxy descriptor/get behavior,
   exact selected identity, rich terminals and mutation are documented/tested.
   ADR-0008 and ADR-0011 require v1 preservation. A package-only change or silent
   hardening cannot identify the new meaning in submitted/saved plans.
   Correcting the exact reference-shape recognizer is different: it enforces the
   already documented syntax and makes currently misclassified objects ordinary
   input. Any reliance on inherited `$ref` or hidden extra keys is reliance on the
   implementation defect, although the precise treatment of nonenumerable/symbol
   properties should be stated in the corrective test.
2. **Own-data-property-only traversal is mechanically plausible but incomplete.**
   After rejecting Proxy, `Object.getOwnPropertyDescriptor` can select a data
   descriptor without invoking an ordinary getter and can return the exact data
   value. Without prior Proxy rejection the descriptor lookup itself invokes a
   trap. Rejecting accessors changes current semantics; requiring enumerable data
   would additionally reject nonenumerable properties that currently resolve.
3. **Prototype rejection is a separate restriction.** Existing own-property
   traversal permits own fields on class/custom-prototype objects while rejecting
   inherited methods. Rejecting nonordinary prototypes would change primitive
   path selections from such results, even though v2 already rejects a whole
   selected custom-prototype object at capture.
4. **Proxy detection is Node-specific but already used.**
   `node:util.types.isProxy` is the current v2 capture mechanism and the accepted
   ADR mechanism (`src/runtime/execution/governed-value.ts:1,46-73`). It avoids the
   investigated traps for ordinary/revoked Proxy detection under the trusted
   Node runtime; reflection alone cannot safely distinguish a Proxy.
5. **Capture-before-selection changes rejection scope.** Capturing the entire
   producer result would make path selection passive afterward, but it inspects
   off-path siblings and can reject a safe requested leaf because an unrelated
   sibling is active, cyclic, huge, or rich. Capturing only the chosen subtree
   still requires a passive path selector first.
6. **Admission must be scoped deliberately.** A safe runtime path selector alone
   still leaves active `$ref` recognition and recursive plan-input traversal at
   admission, plus submitted-input JSON storage. An end-to-end passive reference
   property needs descriptor-based recognition/traversal or an earlier v2 input
   capture before these operations. That would move or expand ADR-0011's current
   capture boundary and must define diagnostics and persistence ordering.
7. **Serialization/canonicalization is not a safe generic selector.** JSON invokes
   getters/`toJSON`/Proxy operations, rejects bigint/cycles, loses undefined,
   symbols, functions, aliases, prototypes and signed zero, and changes failure
   timing. `structuredClone` has a broader value domain and does not by itself
   define passive source inspection. ADR-0011 already rejected these as general
   substitutes (`docs/adr/0011-governed-value-ownership.md:374-388`).
8. **A v2-only safe resolver can coexist with v1.** The admitted semantic version
   is carried privately through the active SQLite reload
   (`docs/architecture/governed-value-implementation-readiness.md:77-127`). A new
   v2 rule could reject active reference inputs/results without altering v1, but it
   would still change the accepted v2 lifecycle that currently specifies existing
   resolution. It needs explicit architecture authority and migration wording.
9. **ADR-0008 identity can be preserved for v1 and data selection.** Descriptor
   traversal can return the exact selected data-property object, so passive path
   mechanics do not inherently require detachment. V2 already detaches after
   resolution. Accessor/Proxy rejection and literal-container processing remain
   the semantic breaks.
10. **Storage needs an explicit boundary.** Active execution has no inter-step
    SQLite reload, while terminal persistence executes JSON hooks. A reference-only
    decision can leave terminal storage behavior separate, but it must not claim
    store parity or passive result commit.

The earlier unapproved reconciliation outlines a possible passive own-data selector
at `docs/architecture/result-reference-reconciliation.md:240-259`. It is useful
design evidence, not authority to implement.

## Experiment II relevance

Experiment II taught the model v1 `$ref` syntax
(`experiments/external-model-reasoner/protocol.md:7-13`), but its primary
multi-step scenario never reached the host: all five multi-step trials stopped at
the provider boundary (`docs/architecture/external-model-reasoner-primary-results.md:164-168`).
The primary report records no model-authored reference traversal; its two-step
partial trial exercised sequential capability execution, not hostile JavaScript
traversal.

The offline Experiment II harness does contain a scripted reference regression:
it uses two references from a fresh lookup result and records the resolved passive
authorization input (`experiments/external-model-reasoner/harness.test.mjs:127-135`).
That proves the normal resolver ran for ordinary frozen data in the fixture. The
fixture deliberately returns a fresh frozen passive record and snapshots passive
JSON at ingress/feedback (`experiments/external-reasoner/fixture-host.mjs:20-21,44-70,97-118`).
It contains no getter, Proxy, class instance, function, native handle, retained
producer alias, or active SQLite result reload.

Experiment II's authority observations remain valid for what its traces contain:
model-authored proposals did not supply caller/scopes/policy and observed
invocations followed authorization
(`docs/architecture/external-model-reasoner-primary-results.md:231-244`). They do
not establish passive traversal, safe hostile capability results, general
authority containment for active JavaScript values, or ADR-0011 ownership. The
experiment design and results say the fixture is passive and does not address that
boundary (`docs/architecture/external-model-reasoner-experiment-design.md:113-127,519-534`;
`docs/architecture/external-model-reasoner-primary-results.md:358-365`).

## Candidate architectural directions without selection

- Define a v2 passive reference recognizer and path selector that rejects Proxy
  before reflection, accepts only specified own data descriptors, and never calls
  receiver methods, accessors, iterators, constructors, coercion hooks, or `toJSON`.
- Limit the new rule to runtime result selection, leaving admission/input graphs as
  trusted host data. This closes the capability-result getter path but cannot claim
  passive reference processing end to end.
- Extend the rule through v2 admission by passively validating/capturing the input
  graph before reference discovery and SQLite persistence, while retaining `$ref`
  as syntax. This is stronger and changes timing, diagnostics, accepted literals,
  and the current ADR-0011 boundary.
- Capture an entire producer result at completion, creating a passive committed
  result domain. This would stabilize future selection but changes producer
  completion, off-path rejection, Job/result identity, persistence, and effects
  after a producer has already run.
- Capture only descriptors along the selected path and the selected subtree. This
  minimizes off-path inspection but must specify arrays/`length`, nonenumerable
  data, custom prototypes, aliases, limits, Proxy detection and concurrent source
  mutation.
- Keep current v1 and v2 behavior and formally treat in-process capability/provider
  values as trusted executable host objects. This is consistent with current
  documentation, but hosts could not claim passive/non-reentrant resolution.
- Add a future passive result/value contract at capability registration or provider
  translation. This may prevent active values from reaching Jobs but is broader
  than `$ref`, changes producer failure timing, and does not by itself make
  submitted plan input traversal passive.

No direction is selected here. None authorizes a source or test change.

## Exact unresolved questions

1. Are installed custom capabilities/providers trusted executable host code for
   all result semantics, or must their returned values be treated as untrusted data
   once `Capability.execute` settles?
2. Is the desired property limited to prior-result path selection, or does it cover
   `$ref` recognition and recursive input traversal during admission as well?
3. Must the property say only “no application callback is invoked,” or also provide
   a stable atomic selection against synchronous alias mutation by trusted host
   observers?
4. Which descriptors are selectable: enumerable data only, all own data including
   nonenumerable, and the structural array `length` special case?
5. May an own primitive field on a class/custom-prototype result be selected, or
   must every traversed container be an ordinary/null-prototype record or ordinary
   dense array?
6. Should a Proxy anywhere on the selected path fail deterministically using the
   Node-specific detection already used by governed capture, and is Node's trusted
   intrinsic assumption sufficient for the runtime contract?
7. Should off-path active/rich siblings be ignored, rejected at producer commit, or
   rejected only when selected?
8. How should safe admission interact with literal rich values that the legacy
   resolver currently projects before v2 capture, such as Date, Buffer and class
   instances?
9. Does a safe selector preserve exact data-terminal identity until the existing
   v2 capture, or combine selection and capture into one operation with newly
   specified alias/limit behavior?
10. Are terminal SQLite `JSON.stringify` hooks and persistence rejection a separate
    trusted storage boundary, or part of the same no-callback result contract?
11. What error/evidence contract should distinguish unsupported active traversal
    from missing paths, producer failures and admission diagnostics without
    disclosing attacker-controlled details?
12. Is v2 still pre-release enough to extend its semantics directly, or must a
    further plan semantic version identify the passive-resolution contract for
    persisted/submitted plans?
13. Resolved by accepted ADR-0013: exactness covers every own string/symbol key;
    `$ref` must be an enumerable own primitive-string data property; descriptor
    flags and prototype identity are irrelevant; Proxies are not rejected.

## Recommended next decision

ADR-0013 is accepted and its exact wrapper recognition contract is implemented for
both v1 and v2. The recognizer now uses complete own-key and own-descriptor
inspection; focused regressions cover the accepted and rejected wrapper forms,
Proxy observability, ordinary accessor recursion, and unchanged parser diagnostics.

After that defect is isolated, the maintainer may separately decide whether to
charter a versioned passive result-reference ADR. That future decision would need
to identify its start point (admission input, runtime selection, or producer
commit), value/descriptor domain, array/prototype rules, Proxy mechanism, error
phase, SQLite relationship, and semantic version. Current evidence is sufficient
to frame that choice, but current contracts do not make passive traversal an
implementation requirement.

## Verification

- Temporary local probes: memory and active SQLite runs completed with the results
  recorded above; fake/local capabilities only; all probe source and SQLite files
  removed.
- `npm run check`: the sandbox run exited 1 because only
  `.tmp/test-build/test/external-model-reasoner.test.js:1:1` and
  `.tmp/test-build/test/external-reasoner.test.js:1:1` reported generic
  `test failed` subprocess failures. The required outside-sandbox rerun exited 0:
  typecheck, all 301 functional tests, build, and package verification passed;
  `veil-runtime-core-0.2.0.tgz` contained 106 files.
- `npm run quality -- --base e02c44010a19e9fd5b771c56d1209d3e64c288d9`:
  exited 0. Source, test and harness deltas were each +0/-0; dependencies,
  lockfile and verification controls were unchanged; there were no unapproved
  execution references or unsupported accesses.
- The first ad hoc Markdown checker command was malformed by shell interpretation
  of backticks and exited with Bash's “unexpected EOF while looking for matching
  backtick” error;
  the corrected passive file checks, final recommendation check and whitespace
  checks passed.
- The original investigation's final status/diff audits found only this document.
  Runtime source,
  tests, ADRs, governance inventory/controls, package files, and all Experiment II
  code, prompts, traces, results and evidence were untouched. `git diff --check`
  passed for tracked changes; the new file's trailing whitespace, final newline,
  front matter and balanced fences were checked directly.
- Contract-fix follow-up: independent review of the implementation, public type,
  reference documentation, existing tests, ADR-0008, ADR-0011, ADR-0012 and file
  history confirmed the inherited-`$ref` overrecognition. It found no accepted rule
  for nonenumerable/symbol extras, `$ref` enumerability or data-versus-accessor
  descriptors, so no source or regression-test semantics were added.
- Follow-up focused baseline: TypeScript test compilation plus
  `result-reference.test.js` and `plan-validator.test.js` passed.
- Follow-up `npm run check` outside the sandbox passed typecheck, all 301 functional
  tests (including external reasoners, Experiments I/II and v1/v2 governed-value
  regressions), build and package verification; the package contained 106 files.
- Follow-up `npm run test:quality` first produced only generic child-process failures
  in the sandbox; the outside-sandbox rerun passed all 216 governance/quality tests.
  Fixed-base `npm run quality -- --base
  e02c44010a19e9fd5b771c56d1209d3e64c288d9` passed with zero source, test or
  harness growth and no governance or verification-control change.
- Object-shape decision follow-up: repository-wide wrapper-usage and history review
  found no intentional reliance on inherited/accessor/nonenumerable `$ref`, hidden
  or symbol extras, Proxy wrappers, or class/null-prototype wrappers. Ordinary
  literal/JSON use was universal; the class/null-prototype cases remain accepted by
  the accepted contract because prototype identity has no tag meaning.
- Current implementation `npm run check` outside the sandbox passed typecheck, all 307 functional
  tests, build and package verification; the package contained 106 files. This
  includes the external-reasoner, Experiment I/II and v1/v2 governed-value
  regressions.
- Current implementation `npm run test:quality` outside the sandbox passed all 216
  governance and quality regressions, including exact correspondence between 148
  parsed files and 24 individually classified sites. The one new site is the
  ADR-0013 descriptor inspection in `result-reference.ts`; it is individually
  classified as governed machinery, and the Proxy test was written without a
  second reflective-access allowance.
- Fixed-base `npm run quality -- --base
  e02c44010a19e9fd5b771c56d1209d3e64c288d9` exited 2 as designed because that
  trusted checkpoint cannot authorize the new exact descriptor-inspection anchor.
  It also marked the two regression files, candidate baseline and matching inventory
  assertion as review-required controls. Dependencies and lockfile were unchanged;
  no wildcard, route or legacy-bypass allowance was added.
- Changed-document link, fence and final-newline checks passed. `git diff --check`
  passed. Final path audits found no changes under `experiments/` or to the
  Experiment I/II design, traces, results or evidence.

RESULT_REFERENCE_CONTRACT_IMPLEMENTED
