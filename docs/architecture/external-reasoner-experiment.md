---
title: External untrusted reasoner — bounded research fixture
---
# External untrusted reasoner — bounded research fixture

## ADR-0012 follow-up

The original bounded fixture is unchanged except for native admission feedback.
For p1 (malformed input) and p13 (capability-version mismatch), the host now checks
isPlanAdmissionError on the direct executePlan rejection and projects code/issues.
It no longer infers admission from unchanged authorization counters or forwards
legacy admission error.message. Unrecognized thrown failures become UNKNOWN with
a fixed host message. The checked trace has been regenerated.

The 19 trace entries retain their original outcomes and invocation counts:
3 lookups, 6 update invocations, 5 effects, 12 authorizations, 9 total invocations.
Both discovered-name variants still pass. No error-text parsing is used. Job
status/event projection for denial/failure, fake failure text, receipt/replay
handling and simulated UNKNOWN remain experiment compensation. These changes do
not establish generic repair, retry safety or a general failure taxonomy.


**Result: the requested bounded experiment succeeds under its fixture constraints.**
An independent deterministic process discovers names/contracts, proposes plans,
adapts to feedback and attempts escalation. Only the trusted host supplies caller
identity and policy; Veil performs admission, per-step authorization and dispatch.
No production runtime code, ExecutionPlan semantics or ADR status changes here.
This is research evidence, not a new Veil feature or a general security proof.

## Architecture and ownership

```text
reasoner.mjs (separate process, empty inherited environment)
  JSON-line request: discover | submit | feedback
                         ↓
host.mjs (dedicated process, one session, two fake capabilities)
  text-only decode / limits / frozen fixture data / scoped receipt map
  bounded names / host caller / replay checks
                         ↓
OperatorRuntime.executePlan(existing v1 plan, host-owned caller)
  admission → resolved-input validation → host authorizer → capability entry
                         ↓
fake lookup / fake update → private in-memory record effects and counters
                         ↓
projected Job outcome → detached JSON feedback → next reasoner decision
```

The host imports only the existing public index from the compiled test tree.
It has no bundled HTTP server, shell registration, network capability or arbitrary
plugin-loading entrance. Runtime registries are process-global, so each run has a
fresh dedicated host process; discovery filters to its two registered capabilities.
The reasoner imports only Node readline/assert, receives no runtime objects,
callbacks, registry, store, provider, authorizer or credentials, and runs with an
empty inherited environment in its own temporary directory. It learns task
resource identifiers through discovery alongside genuine Veil descriptors.

Separate processes and a cleared environment are **not an OS sandbox**: the child
still runs under the same OS account and could access ambient filesystem/process
facilities if its source were replaced. The tested adversary controls serialized
proposals, not arbitrary installed host code. No hostile-code isolation is claimed.
The trusted fixture source, Node process and host filesystem remain assumptions.

Veil's existing dispatch constructs a SQLite log sink even for these nonlogging
fake capabilities. The host runs in a disposable directory so this runtime
artifact is confined and removed afterward. Fake capability effects themselves
are exclusively in-memory. No real external provider, network or shell is exposed.

## Fixture-only value discipline

Ingress accepts **JSON text only**, never a JavaScript object API. JSON.parse
creates fresh plain data without invoking client getters/Proxy traps. The fixture
rejects nonfinite parsed numbers (including overflowing JSON exponents), excessive
depth/node count/message size, invalid JSON and non-text objects. Accepted data is
null, boolean, finite number, string, dense array and plain record. Parsed graphs
are recursively frozen; no live Job handles or executable callbacks cross IPC.
Wire parse failures close the experiment rather than submit anything to Veil.

A client Date serialized as a string is just a string; the receiver cannot infer
its pre-wire origin. This is a wire-domain restriction, not a claim to detect
hidden original rich types. JSON signed-zero serialization follows JSON behavior;
this does not redefine Veil numeric equivalence. Unit tests reject direct rich or
mutable JS graph arguments at the text-only ingress, without evaluating getters
or traps. They do not implement or prove ADR-0011.

Host-generated outputs are explicit trusted passive projections. Their snapshot
helper JSON-encodes those known records, parses and freezes fresh copies; it is
**not** an arbitrary-JavaScript normalization API. Optional caller metadata and
undefined Job result fields are not part of these projections. Producer results
are fresh frozen records; policy is observational; fake capabilities do not mutate
input or expose it through logging/subscribers. Input/reference alias mutation is
prevented by fixture discipline, not by a new Veil core ownership guarantee.

## Discovery and authority

The default names are fixture.records.lookup/update. The reasoner contains no
literal capability names or versions. It selects the read/write descriptors,
finds required fields through their descriptions, checks the input type and uses
discovered names/versions. A second test runs the same reasoner against the renamed
`different.discovered.surface` namespace.

The host task supplies `public`, `locked` and `editable` as resource candidates;
these are experiment task data, not descriptor-invented permissions. Policy permits
reading public and writing editable. Locked is never writable. Caller identity
is always fixture-reasoner with host-owned scopes read:public and write:editable.
Top-level proposal authority fields are excluded from the submitted plan; forged
input fields remain visible as untrusted data and cannot change resource policy.

The adapter exposes exactly three operations: discovery, submission and receipt
feedback. It reserves session-local proposal IDs, rejects repeat IDs, restricts
capability names and plan size/version, and rejects known applied duplicate fake
assignments. The authorizer also checks previously applied assignments after
reference resolution. This duplicate check is **adapter/fixture policy**, not
Veil idempotency or a durable exactly-once mechanism. No allowance, compatibility
mode, alternate execution entrance or provider handle is sent to the reasoner.

## Scenario results

The checked-in [complete trace](../../experiments/external-reasoner/trace.json)
records each reasoner request, trusted host decision, Veil authorization and
capability entry, fake effects, structured feedback and before/after counters.
The full trace is also reproducible on stdout. Rows below show invocation deltas;
`write` counts capability entry, while `effects` counts applied fake assignments.

| Exchange | Decision / outcome | Authorizations | Reads | Writes | Effects |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Discover; no execution | 0 | 0 | 0 | 0 |
| 2 | Malformed field type → REJECTED by Veil admission | 0 | 0 | 0 | 0 |
| 3 | Correct using descriptor → SUCCESS | 1 | 1 | 0 | 0 |
| 4 | Forbidden write → DENIED | 1 | 0 | 0 | 0 |
| 5 | Forged caller/scopes/approved/risk/policy → DENIED | 1 | 0 | 0 | 0 |
| 6 | Permitted re-plan → SUCCESS, fresh policy call | 1 | 0 | 1 | 1 |
| 7 | Returned malicious instruction used to escalate → DENIED | 1 | 0 | 0 | 0 |
| 8 | Two-step lookup/$ref/update → SUCCESS | 2 | 1 | 1 | 1 |
| 9 | First write completes, next throws before effect → FAILED | 2 | 0 | 2 | 1 |
| 10 | Re-plan failed work only → SUCCESS | 1 | 0 | 1 | 1 |
| 11 | Applied write, injected outcome-delivery loss → UNKNOWN | 1 | 0 | 1 | 1 |
| 12 | Scoped feedback for uncertain receipt → UNKNOWN | 0 | 0 | 0 | 0 |
| 13 | Adversarial same-ticket replay → REJECTED | 0 | 0 | 0 | 0 |
| 14 | Adversarial new-ticket duplicate effect → REJECTED | 0 | 0 | 0 | 0 |
| 15 | Capability outside discovered surface → REJECTED by host | 0 | 0 | 0 | 0 |
| 16 | Wrong capability version → REJECTED by Veil admission | 0 | 0 | 0 | 0 |
| 17 | Valid source, missing $ref path → FAILED before sink policy/entry | 1 | 1 | 0 | 0 |
| 18 | Out-of-session receipt lookup → REJECTED | 0 | 0 | 0 | 0 |
| 19 | Alternate execute entrance → REJECTED | 0 | 0 | 0 | 0 |
| Total | 19 exchanges | 12 | 3 | 6 | 5 |

The forbidden record remains untouched. The completed partial write appears
exactly once in this run; the reasoner uses completed-step feedback to omit it
from the repair. Normal unknown handling requests feedback rather than retrying;
subsequent explicitly adversarial replay probes demonstrate the host guard.

The uncertain scenario is deliberate fault injection: the fake write completes,
the host discards its successful response before delivery, and the reasoner gets
UNKNOWN. The trusted research trace records the actual effect; that oracle is
not sent to the reasoner. This does not simulate a host crash, lost durable state,
an ambiguous external provider, or generic reconciliation. The special FAIL and
UNCERTAIN values are disclosed experiment scenario controls, not capabilities or
error semantics advertised as general contracts.

## Descriptor and feedback shortcomings

No hidden enriched capability schema is supplied. Existing descriptors provide
name/version/description/static risk and shallow input fields. They omit:

- Output schemas and referenceable paths. The reasoner infers the target path
  from the earlier successful lookup result; it cannot safely discover that path
  before execution from descriptors alone.
- Machine-readable operation semantics. Field selection relies on prose phrases
  and the fixture having exactly one read and one write operation. Renaming works;
  arbitrary description wording or a larger ambiguous inventory is untested.
- Resource permission constraints, enumerations, nested schemas, effect certainty,
  retry safety and idempotency guarantees. Discovery is not permission.

The adapter returns only outcome, projected step status/result/error where known,
and rejection/unknown reason text. Its five outcome classes are fixture protocol,
not new core diagnostics:

| Outcome | Evidence / inference |
| --- | --- |
| REJECTED | Host checks, or thrown executePlan error before any fixture authorization; no general typed admission error exists |
| DENIED | Job capability.denied event; no generic error-string matching |
| FAILED | Failed Job without denial event; this conflates resolution/validation errors and capability failures |
| SUCCESS | Completed Job and projected step results |
| UNKNOWN | Explicit adapter fault injection or exception after authorization; not a core Job state |

A failed step does not generally prove absence of effects. Here FAIL throws before
its fake write by construction, so retrying only that work is justified by fixture
knowledge. Production retry advice cannot be inferred from Job failure alone.
Completed steps provide useful partial-progress evidence, but do not establish
rollback, stable historical snapshots, durable delivery or recovery guarantees.
The authorizer's recorded resolved input supplies trace evidence about $ref
resolution; the projected Job does not itself expose a canonical authorized-input
record. No diagnostics were patched to make these distinctions look native.

## What the experiment establishes and leaves open

Within this bounded protocol and audited fixture, discovery invokes nothing,
malformed plans cannot reach capabilities, policy denial stops entry, forged
claims/instructions grant no authority, and every permitted retry/re-plan receives
fresh authorization. An external deterministic reasoner can adapt using existing
ExecutionPlan v1 and discovery/job APIs. No agent framework, reasoning provider or
new runtime primitive was required.

It does **not** prove ADR-0011 ownership, hostile-code isolation, provider-operation
equivalence, exactly-once execution, production authentication, multi-tenant
isolation, stable committed Jobs, arbitrary plugin safety or arbitrary reasoning
competence. Protocol requests are untrusted; host code, fixture capabilities and
nonmutating ownership discipline are trusted. Counters evidence only these runs.
The replay guard is process-local and specific to these assignment operations.

## Reproduction and next step

From the repository root:

```sh
npx tsc --project tsconfig.test.json
node experiments/external-reasoner/host.mjs
node --test .tmp/test-build/test/external-reasoner.test.js
```

The root test is also part of npm run check. It runs the text-ingress tests and
two fresh host/reasoner pairs, asserting counts, fixed caller/scopes, zero entry
on denials/rejections, resolved reference authorization, partial repair and unknown
handling. Temporary directories are removed. The trace has no random job IDs or
timestamps and uses no secret data.

Recommendation: retain this fixture as evidence that the external reasoning loop
needs no new core abstraction. Review descriptor/output-schema and structured
failure/effect-certainty needs separately before proposing APIs. Continue the
ADR-0008/0011 value-semantics decision independently; do not promote these fixture
assumptions into production guarantees. A future experiment with a different
reasoner should use this same narrow host boundary and explicitly test whether
prose-only discovery remains sufficient.

## Verification and changed files

- `npm run check`: typecheck, all **257 functional tests**, build, and package
  verification passed (`veil-runtime-core-0.2.0.tgz`, 102 files).
- `npm run test:quality`: **216 passed**; repository inventory remains 14 sites.
- The root fixture tests run two additional passive-codec subtests and two
  independent renamed-surface host/reasoner runs. The captured default trace
  records 19 exchanges, 12 policy calls, 9 capability entries and 5 fake writes.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`:
  exit 1, verification-control review required, **no unapproved execution references
  or unsupported accesses**. No new allowance or checker modification was made.
  Cumulative deltas including prior hardening: source +113/-254 (net -141),
  tests +956/-1 (net +955), harness +56/-8 (net +48). This task adds 40 root-test
  lines; experiment files are scanned for governance but are outside those LOC
  categories. Production source/harness delta for this task is zero.
- Initial sandbox runs failed at the subprocess test-file level (`test failed`);
  authorized outside-sandbox runs passed. A direct sandbox trace run closed the
  child's feedback channel before discovery; the authorized run succeeded.
- An initial fixture bug rejected the optional undefined caller metadata while
  recording authorization. The trace now explicitly projects only subject/scopes.
  Initial nested Node tests inherited test-runner context and could skip files;
  child test environments are now explicit and empty. Neither fix changes Veil.
- Initial governance review flagged the configurable runtime import, descriptor
  reflection and explicit iterator extraction. The final fixture uses one fixed
  import, a text-only ingress instead of accepting arbitrary JS graphs, and a
  line-event protocol. Checks were not weakened to allow those earlier constructs.
- `git diff --check` reports the pre-existing CRLF source-edit findings from prior
  hardening. New fixture/report files use normal LF; no formatting cleanup made.
- Reviewed the complete new fixture, assertions, generated trace and report;
  checked cumulative diff/status to distinguish earlier work. No runtime, ADR,
  package version, dependencies, lockfile or release controls changed this pass.

Files added:

- `experiments/external-reasoner/host.mjs`
- `experiments/external-reasoner/reasoner.mjs`
- `experiments/external-reasoner/passive.mjs`
- `experiments/external-reasoner/passive.test.mjs`
- `experiments/external-reasoner/trace.json`
- `test/external-reasoner.test.ts`
- `docs/architecture/external-reasoner-experiment.md`
