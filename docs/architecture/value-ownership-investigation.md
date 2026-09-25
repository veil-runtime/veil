---
title: Authorization and value ownership investigation
---
# Authorization and value ownership investigation

Decision: **ADR FIRST**. No runtime, shell policy, public contract, value-domain
restriction, or provider implementation is changed in this investigation.
Comparison base remains `bb3f34e4f938096acec897159f0f56283c11697a`; earlier API and
shell hardening is present as uncommitted work and is retained.

## Lifecycle and aliasing map

Let P be submitted input, J a JobStep input, R a committed producer result,
V the resolved input, A the author's policy observation, C the capability input,
and Q the provider request. Identity and value equality are different concepts.

```text
plan.steps[i].input P ──────── same binding ────────> JobStep.input J
                                   │
                 literal objects/arrays recursively rebuilt
                                   ↓
                       resolved container V
                                   ↑
producer-retained result R === JobStep.result === V.referencedSubtree

validation(V) → authorize(V) → capability(V) → capability-defined Q → provider
                         same graph             reuse/copy/normalize/replace

memory getJob/listJobs → live Job/Step/input/result graph
SQLite update/get → JSON serialization/materialization, not live identity
```

| Transition | What is copied | Identity/ownership and mutation rights |
| --- | --- | --- |
| Caller → OperatorRuntime | Caller, scopes and metadata get shallow frozen copies | Nested caller metadata remains shared; plan itself is not frozen |
| Plan capture → admission | Ordered steps and named step fields get shallow runtime-owned records | `input` root and all descendants remain aliases of P; no deep input ownership |
| Admission validation | No validated replacement | Reads schema fields and recursively scans references; getters can run; no domain normalization contract |
| Captured steps → JobStep | Another shallow spread plus lifecycle fields | J === P for memory storage; captured structure protects against original plan structural mutation only |
| Goal/key/metadata | Goal string trimmed/defaulted; idempotency keys copied | Plan `id`, `metadata`, and `version` are not consumed by JobManager; reason/key do not grant authority |
| Result resolution: ordinary object | New record from enumerable string-keyed properties, recursively | New containers, not a general graph clone: repeated literal aliases split, prototypes/nonenumerables/symbol keys lost; accessors run |
| Result resolution: array | New array via map, recursively | Nested literal containers copied; sparse holes preserved |
| Result resolution: `$ref` | No copy of selected result subtree | Returns R/path terminal directly; reference values are not recursively resolved again |
| Resolved-input validation | No copy/freeze | Shallow declared field checks inspect V, including directly referenced subtrees |
| Authorization | Fresh context wrapper and capability identity record; input unchanged | `context.input === V`; TypeScript readonly protects no nested runtime value |
| After allow → capability | No copy/freeze/revalidation | C === V; same object can have different contents by invocation time |
| SDK capability wrapper | Fresh execution wrapper, same input/context | Middleware may mutate input or replace `execution.input` before definition callback |
| Capability → provider | Implementation-specific | Q may reuse nested input, normalize primitives, resolve paths, serialize values, or be independently constructed |
| Capability result → completed step | No result copy/freeze/validation | `step.result === returnedResult`; producer and consumer can retain mutation authority |
| Job result aggregation | Single result reused; multi-step outer array newly made | Array entries alias step results; there is no immutable result commit |
| Memory store create/update/get/list | Same Job object stored/returned; list makes an array of existing jobs | Public in-process runtime get/list callers can mutate job steps/results and future work; not a private execution snapshot |
| SQLite store | JSON.stringify on writes, JSON.parse on reads | Reload detaches and transforms values; results still alias within the currently executing loaded job |
| JobEvent → RuntimeEvent | New outer event, same `data` | Synchronous subscriber portions run during publish; JobManager discards publication promise. Shared data is mutable; subscriber exceptions are isolated, mutations are not |
| Logger → composite sinks | New entry, same metadata; same entry shared with sinks | Console/SQLite serialize, but a retaining/custom sink can observe or mutate aliases |

Evidence: `src/runtime/jobs/job-manager.ts` executePlan/execute/addEvent;
`execution/result-reference.ts`; `execution/plan-validator.ts`;
`runtime/operator-runtime.ts`; `jobs/job-store.ts`; `providers/storage/sqlite-job-store.ts`;
`sdk/capability/create-capability.ts`; `events/memory-event-bus.ts`; and
`execution/console-execution-logger.ts` / `logging/composite-log-sink.ts`.

Ordinary lifecycle events contain IDs and primitive metadata, not the full input
or result graph. A callback needs another retained handle, such as getJob in
memory mode, to mutate execution values. Changing an event's outer type does not
change the separately constructed JobEvent; changing their shared data does.

## Actual provider translations

- HTTP uppercases method, normalizes URL, constructs a new request object, but
  reuses headers/query/body references. FetchHttpProvider adds query parameters,
  copies headers and JSON-stringifies the body before fetch. The method/URL
  normalization occurs after runtime authorization. The fixture exercises the
  real capability with an intercepted HTTP provider; no request is sent.
- Shell copies canonical argv at capability entry and computes cwd from host
  configuration. This does not own values before runtime authorization and
  supplies no prepared environment/executable identity to policy.
- Filesystem resolves the input path to a provider/OS path, then reads/truncates
  content. Browser capabilities construct URLs and consume remote page content.
- Outbound MCP forwards `input.arguments` to a provider whose host-configured
  transport is established asynchronously before tool dispatch. That async path
  may outlive earlier observations of its shared arguments.
- SDK middleware shares/replaces execution input. Timeout middleware races an
  operation without cancelling it; the callback can retain values after timeout.

Veil cannot infer or constrain an arbitrary registered capability's provider call
from the input object alone. Provider transformation is not necessarily wrong:
it means provider equivalence requires an explicit semantic mapping, not object
identity or byte equality with the capability's input.

## Reproductions with possible scheduling only

`test/value-ownership.test.ts` contains characterization fixtures, not guarantees
that unsafe behavior must remain. Providers are inert; scheduling uses explicit
promises at actual async boundaries, no sleeps or imagined concurrent mutation
of uninterrupted synchronous code. Update these fixtures if an ADR is accepted.

| Fixture | Authorization inspected | Execution/provider consumed | Mutation authority |
| --- | --- | --- | --- |
| Literal-input negative control | Nested target staging | Staging; recorded JobStep input changes to production separately | Original submitter retains P, but resolution detached literal execution containers |
| A/F retained policy view | targets[0]=staging | production plus a second array element | Authorizer-retained graph changed after capability entry, while its provider dispatch awaits a gate |
| B/F referenced producer result | value.targets[0]=staging | production; completed source result also changes | Producer retains R and changes it after later invocation starts |
| B/E synchronous started observer | Referenced staging result | Production already at capability entry | Subscriber synchronously changes producer-retained R after allow and before execute is called |
| C authorizer mutation | environment is staging string | environment is number 42 | Authorizer changes V before returning allow; no subsequent validation |
| D capability translation | Staging; same value at capability entry | Independent delete/production request | Capability mutates its input then reconstructs Q |
| E subscriber/job handle | Referenced staging result | Production | Started subscriber awaits public memory getJob, mutates R; capability awaits that callback before consumption |
| E event data | Real runtime denial | No invocation; denial event reason rewritten while job.error retains real reason | Subscriber mutates shared event data, corrupting history rather than executing input |
| E middleware | Staging | Production at SDK definition callback | Configured middleware replaces execution.input after runtime dispatch |
| E logging | Staging | Production | Inert host sink retains metadata containing input; changed during capability's await |
| Real HTTP mapping | method get, URL without slash | GET, URL with slash; same nested body | Capability-defined normalization, with no external I/O |

Memory getJob exposure is specific to that backend. SQLite retrieval does not
return the active live object, but it does not isolate the active producer result
from later steps within one execution either. Event emission and setting
`status='completed'` are not immutable or transactional result commits.

## Distinct security properties

| Property | Current state | Appropriate responsibility |
| --- | --- | --- |
| A: immutable authorization snapshot | Not established | Core can own/freeze a defined passive input value before handing it to policy |
| B: equivalent value at capability entry | Same identity today, not stable contents | Core can supply a detached value equal to the immutable authorized snapshot at the outer Capability.execute entry |
| C: equivalent effect-bearing provider operation | Not established, and cannot follow merely from A/B | Capability owns translation, middleware and asynchronous retention; provider owns consumption/serialization/network/process semantics. A future prepared-operation contract would need a separate decision |
| D: committed result stability | Not established | Core could own immutable result commits and detached read projections; distinct change to results, references, stores and job APIs |

A snapshot only helps B if execution is derived from that snapshot, not from an
original alias. B is defined at the outer capability boundary; SDK middleware and
the definition callback are inside trusted capability implementation. B does not
prohibit capability mutation after entry and does not imply C or D. Conversely,
B can be established with a fresh snapshot at each step even if a source result
changed earlier: policy would inspect the selected value that is actually passed.
That weaker design leaves history unstable, so it must not be called D.

## Actual value-model findings

Public input/result types are unknown/generic, not JsonValue. The schema recognizes
only shallow string/finite-number/boolean/object/array fields. Object accepts
typed objects; array does not validate element types. Undeclared/no-schema values
can contain undefined, functions or bigint. TypeScript admits more than any
consistent portable runtime value contract presently defines.

JSON is strongly suggested by HTTP/MCP, examples and SQLite. It is **not** the
existing universal contract. ADR-0008 deliberately preserved nested aliases and
result identity; result-reference tests explicitly cover undefined, NaN, bigint,
special own keys, null prototypes, accessors and proxies. This does not amount to
intentional support for every arbitrary JS graph. It establishes incompatible
partial semantics that cannot be silently replaced with JSON.

| Value | Literal input resolution / memory | Direct referenced result | SQLite/JSON transport |
| --- | --- | --- | --- |
| Ordinary acyclic record/array | Rebuilt recursively; identity not preserved | Selected graph reused | Detached JSON value on reload |
| undefined | Preserved in rebuilt properties/terminals absent a failing schema | Existing tests permit terminal undefined | Object fields omitted; array elements become null; root job.result omitted |
| Date | Becomes empty record | Date identity retained | ISO string via toJSON |
| Buffer/typed array | Enumerable numeric keys copied into ordinary record | Typed identity retained | Buffer uses its JSON representation; other typed arrays do not retain type |
| Class/prototype/nonenumerables/symbol keys | Ordinary record; only enumerable string keys retained | Selected object retains original behavior | Enumerable JSON representation, possibly custom toJSON |
| Function/symbol/bigint | Can reach no-schema memory execution as nonobject leaves | Retained terminal | Functions/symbols omitted or null in arrays; bigint throws |
| NaN/infinity/-0 | Finite-number field check rejects first two; otherwise can pass | Retained | Nonfinite values become null; -0 serializes as 0 |
| Cycles | Recursive reference discovery overflows before admission completes | Cyclic result can be committed and selected directly into memory execution | Serialization throws |
| Repeated aliases | Literal traversal duplicates them | Direct references preserve them | JSON duplicates values, losing alias identity |

Fixtures confirm Date/Buffer/class/function/undefined/bigint, cycles, and SQLite
round trips. Map/Set/RegExp follow the object-enumeration path rather than a
supported rich-type contract. Unsupported serialization is not uniformly an
admission error: SQLite can fail saving an input after empty job creation, or
fail recording a result after capability effects. HTTP/MCP feedback serialization
can also fail after successful execution. Nonserializable log metadata can fail
inside a sink; logger writes are not an immutable audit commit.

## Strategies evaluated

| Strategy | What it can establish | Costs and limits |
| --- | --- | --- |
| A deep clone, authorize and invoke same clone | Removes original aliases | Authorizer can still mutate clone; freeze or separate views needed. Rich clone semantics are not identical to current values |
| B deep freeze after resolution | Read-only passive tree if complete | Freezing aliases also freezes producer/caller objects; typed internal state may remain mutable; cycles need traversal policy; freezes capability input incompatibly |
| C immutable internal representation | Explicit domain, A/B and potentially D | Larger conversion/API burden; no evidence a generalized framework is needed |
| D serialize/deserialize | Detachment for a defined wire domain | JSON silently drops/transforms values, invokes toJSON, rejects cycles/bigint; serialization alone is not immutable authorization |
| E canonical hash/snapshot check before invocation | Detects some changes at a checkpoint | Requires domain/equality first, can invoke accessors, and leaves later mutation windows; a hash is no substitute for ownership |
| F capability-specific reconstruction | Can constrain concrete provider operations | Happens after current authorization; cannot establish universal B/C and can itself change effects |
| G owned passive snapshot, frozen policy view, detached invocation copy | Smallest candidate for A+B | Requires explicit supported types/equality/failure contract; O(materialized size) copies and expanded-size limits for repeated aliases; D remains separate |

Node probes in this investigation confirm why arbitrary deep freeze/clone is not
a drop-in answer: a frozen Date still changed year, a frozen Map still accepted
entries, freezing a nonempty Uint8Array threw TypeError, structuredClone rejected
a function and did not preserve a custom class prototype. These are mechanism
constraints, not newly imposed Veil semantics. No performance benchmark or claim
of bounded cost is made: size/depth limits and allocation behavior need review.

## Recommendation and trust boundary

Select **ADR FIRST**, with [draft ADR-0011](../adr/0011-governed-value-ownership.html)
as the independent decision for A/B. It proposes a limited passive data domain,
explicit equivalence and failure behavior, and private runtime-owned snapshots.
It does not declare the current contract JSON-only. Results, stores and D need
separate compatibility treatment, even if eventually covered by the same domain.

Core can bind authorization to values at capability entry. It must avoid exposing
that private snapshot through jobs/events/logging and must create the invocation
copy from the snapshot after allow. Capability/middleware authors remain trusted
to translate inputs appropriately and control retained aliases before provider
use. Providers remain responsible for exact request consumption and enforcement
of network/process policies. Ambient code, credentials, environment and external
state remain outside an input-value equality guarantee.

ADR-0010 now explicitly depends on A/B and distinguishes those from provider
operation binding. Effect metadata has no security meaning if execution can
re-read mutable aliases or independently construct another operation. No dynamic
risk, prepared-operation framework or end-to-end real-world equivalence is added.

No implementation of A/B is justified before maintainer approval: supporting
only passive data, breaking result identities, freezing authorizer input, or
changing persisted values would alter locked semantics. The external-reasoner
experiment remains unstarted.

## Verification and handoff

- `npm run check`: passed typechecking, 254 functional tests, build and package
  consumer verification (`veil-runtime-core-0.2.0.tgz`, 102 files).
- `npm run test:quality`: 216 tests passed.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`:
  exit 1, review required for changed verification controls. Governance reported
  no unapproved execution references or unsupported accesses. No allowance was
  added for these fixtures. The comparison base and controls were not relaxed.
- Initial sandbox runs failed: package verification at
  `tools/verify-package.mjs:24` reported `SyntaxError: Unexpected end of JSON
  input`; quality test subprocesses reported `test failed` without individual
  diagnostics. Authorized reruns outside the sandbox passed as reported above.
- `git diff --check`: exit 2 for preserved CRLF source lines edited in earlier
  hardening work. No source formatting or whitespace controls were changed.

The cumulative quality delta includes prior uncommitted hardening: source
+113/-254 (net -141), tests +916/-1 (net +915), harness +56/-8 (net +48).
This investigation adds 365 test lines and no runtime or harness changes.
The 14 new tests characterize current gaps; passing them does **not** establish
that those gaps are closed. They should become prevention regressions when an
ownership decision is accepted.

Files changed by this investigation are this report,
`test/value-ownership.test.ts`, draft ADR-0011, the ownership implications in
draft ADR-0010, and the value-ownership addendum in `trust-boundaries.md`.
Earlier API/shell hardening remains intact. The complete working diff was
reviewed with that distinction; no version, dependency, or release changes were
made here.

Next step: maintainer review of ADR-0011's supported domain, equivalence,
mutation/error semantics and result-stability scope. Once approved, implement
only the selected A/B boundary and turn the corresponding reproductions into
prevention tests. Provider equivalence and stable result commits require their
own explicit scope decisions.
