---
title: External reasoner experiment — descriptor and feedback gaps
---
# External reasoner experiment — descriptor and feedback gaps

## ADR-0012 implementation follow-up

This report preserves the original experiment findings and candidate designs.
Accepted ADR-0012 now resolves the narrow admission-information-loss gap: p1 and
p13 use native, privately issued admission evidence (INPUT_TYPE_MISMATCH and
CAPABILITY_VERSION_MISMATCH). The host removed its zero-authorization-counter
classification heuristic and projects only code/issues. Other thrown failures
produce conservative UNKNOWN feedback without forwarding legacy exception text.

The refreshed trace still has 19 entries and the original scenario/counter results.
There is still no error-text parsing. Failed Job/step text is still forwarded in
this fake fixture; denial/failed outcome projection still relies on Job status and
events. UNKNOWN injection, receipt/replay handling, discovery/task conventions and
all descriptor gaps remain host/fixture responsibilities or unresolved findings.
The candidate subtype design below is historical; ADR-0012 selected ordinary
Errors with an exported predicate, private WeakMap and per-call containment.
No generic automatic repair or AI-specific contract has been established.


**Recommendation: ADR REQUIRED**, narrowly scoped to stable runtime-originated
admission diagnostics, with a separately reviewable step-failure extension.
The strongest demonstrated descriptor omission is declared output structure;
it warrants a small candidate extension and another composition test, not a
schema framework or semantic discovery engine. No change is implemented here.

**No AI-specific API is required.** The reasoner uses ordinary metadata, plans,
structured results and a host protocol. Veil never observes a model, prompt,
token, reasoning provider or AI identity. The same shortcomings affect CLI tools,
workflow editors, SDK consumers and human-operated HTTP clients.

## Evidence and scope

Read in full: [experiment report](external-reasoner-experiment.html) and
`experiments/external-reasoner/trace.json` (all 19 exchanges), then checked
host.mjs, reasoner.mjs, passive.mjs, passive.test.mjs and
`test/external-reasoner.test.ts`. Compared with Capability/CapabilityDescriptor,
registry projection, OperatorRuntime, plan-validator, result-reference,
JobManager, Job/JobStep/JobEvent, public exports and accepted ADR-0009.

The trace contains 12 policy calls, 9 capability entries and 5 fake writes. Those
counters are host instrumentation, not native Job diagnostics. The separate
reasoner sees only the feedback sent on its pipe, **not** the complete trace,
policy calls, resolved-input observations or effect oracle.

The reasoner is a scripted deterministic scenario client. It discovers names and
copies versions, but asserts expected outcomes and then follows programmed next
steps. It does not implement generic error repair, permission inference or
arbitrary capability matching. Both adapter and reasoner perform **zero parsing
of error-message text for control flow**. The adapter forwards text; the reasoner
never reads its reason/error fields. This limits claims about automatic replanning.

## 1. Every proposal: provenance of information

Common to submitted plans: capability names and normal capabilityVersion values
come directly from descriptors; read/write selection uses the *first* descriptor
with that static risk. Field keys come from matching literal description phrases
`resource identifier` and `replacement value`. Only the read field's string type
is explicitly asserted. Required flags are available but no generic required-field
construction occurs. The reasoner already knows ExecutionPlan syntax, version
'1.0', step IDs, reference grammar and the adapter protocol; discovery does not
teach those. Knowing public protocol syntax is normal client responsibility.

The host supplies readable/forbidden/alternative task labels and resource IDs.
The alternative is not deduced from a denial. No descriptor enumerates permitted
resources. Selecting one read/one write by risk works only for this inventory:
static risk is not an operation identifier or a permission statement.

| Exchange / proposal | From Veil discovery or earlier result | Fixture knowledge, convention or hardcoding |
| --- | --- | --- |
| 1 discovery | Two real descriptors, including required/type metadata | Host filters inventory, adds task IDs and counters; client assumes exactly one useful operation per risk |
| 2 p1 malformed read | Lookup name/version and resource field key | Deliberately invalid number 42; programmed expectation of rejection |
| 3 p2 corrected read | Same descriptor; string-type assertion | Host's readable ID; predetermined correction after REJECTED, not error-driven repair |
| 4 p3 forbidden write | Update name/version and two field keys | Host's forbidden ID; literal value blocked; adversarial test intent |
| 5 p4 forged authority | Same update contract | Forged caller/scopes/approved/risk/policy at known proposal/input locations; value forged |
| 6 p5 permitted re-plan | Same update contract | Host-provided alternative and value permitted; no policy learned from denial reason |
| 7 p6 returned instruction | Actual prior result's instruction text | The property name instruction, override substring and copying text into policy are scripted; forbidden ID and value injected are known |
| 8 p7 two-step reference | Names/versions/fields; path key found in observed result by value equality with alternative | Assumes that matching result value identifies intended output and repeats on next lookup; existing $ref grammar, source/sink IDs, value composed |
| 9 p8 partial failure | Update descriptor for both steps | Fixed sequence, first-part and special FAIL sentinel; knowledge that FAIL throws before effect |
| 10 p9 repaired work | Feedback confirms done completed and failed failed | Client asserts those fixed positions, then submits one known replacement with value repaired; no generic extraction/reconstruction of failed work |
| 11 p10 uncertain | Update descriptor | UNCERTAIN sentinel and expected host fault injection |
| 12 receipt query | Prior proposal ID and UNKNOWN feedback | Session receipt protocol; programmed decision to query instead of ordinary retry |
| 13 p10 replay | Previously built discovered-name plan | Intentionally reuse ID; expected host replay rejection |
| 14 p11 new-ticket replay | Same discovered-name plan | New ID, same effect; fixture assignment-specific duplicate guard |
| 15 p12 wrong name | Discovered read name used as base | Appends .absent; host rejects before Veil admission |
| 16 p13 wrong version | Discovered read name/field | Replaces real version with missing deliberately |
| 17 p14 wrong path | Source descriptor and write fields | Hardcoded nonexistent path suffix absent; expects source completion and failure of sink |
| 18 scope probe | No capability proposal | Arbitrary another-session receipt ID |
| 19 entrance probe | No capability proposal | Invented execute method and approved=true |

The renamed-surface test rules out hardcoded capability names. It does not test
renamed field descriptions, optional fields, multiple same-risk capabilities,
variable outputs or a different domain. These are limits of the evidence, not
failed security criteria.

## 2. Descriptor adequacy and demonstrated gaps

| Concern | Native contract | Evidence and conclusion |
| --- | --- | --- |
| Input structure | Field-name map; type string, required boolean, description | Adequate for the fixture's flat strings. It is not a schema for an arbitrary root value |
| Required/optional | Explicit required flag | No descriptor omission; all fixture fields required. Client does not exercise optional discovery |
| Enums | No enum declaration | No input enum gap demonstrated: public/editable/locked are policy/task data; FAIL/UNCERTAIN are fault controls, not a general enum |
| Nested structures | object/array tags, no child/element definitions | Code-confirmed limitation but no nested business input schema exercised; a $ref expression is plan syntax, not evidence for a nested schema language |
| Constraints | Limited built-in shallow checks | Required also rejects null/empty string; number means finite; extra fields pass. Document these rules. No length/range/regex/cross-field requirement demonstrated |
| Output shape | No declaration; TResult generic is erased | Actual compensation: a read must run before the client learns target. Declared top-level output fields could remove that sample-only dependency |
| Reference paths | Runtime grammar and own-property traversal; no output path declaration | p7 infers target from one sample; p14 fails at runtime. Output declaration could guide composition but never guarantee availability of a particular result |
| Risk/effect | Static read/write/destructive risk | Risk is misused as operation selector in this small inventory. It does not describe invocation effects, authorization, retry safety or semantic purpose |
| Versioning | Exact capability version in descriptor and admission check | Works: versions copied, deliberate mismatch rejected. Multiple versions per name are not registered; no new descriptor version mechanism shown necessary |
| Plan version | Not descriptor metadata; core presently does not validate plan.version | Host's '1.0' filter is separate compensation already known from reconciliation, not a capability-description defect |
| Human vs machine meaning | Prose and shallow field structure | Phrase matching and one-operation-per-risk assumptions are brittle; the experiment does not establish a universal action taxonomy is needed |

Registry projection is not discarding an existing richer standardized contract:
CapabilityInputField itself contains only those three fields. Adding enums or
nested metadata solely to a descriptor would create assertions the validator does
not necessarily enforce. Accepted ADR-0009 deliberately excludes semantic search,
output schemas and provider inspection. Any extension needs a deliberate contract
decision, not reinterpretation of current discovery.

Smallest demonstrated descriptor gap: optional declared output field metadata for
composition. Input-purpose ambiguity is real but still a reasoning/domain problem;
a field's type alone cannot explain what business task it serves. Better capability
prose/documentation may suffice. Authorization policy should not be published as
an enum to help a reasoner choose an allowed resource.

## 3. Every outcome: native evidence versus adapter invention

The trace stores **projections**, not raw Jobs. Native return details below are
reconstructed from the inspected execution path, not claimed to be present in the
trace itself. Native completed Jobs have status completed/outcome success; failed
Jobs have status failed/outcome failed. Step status/result/error and event types
already exist. No new result wrapper was required to identify completed steps.

| Exchanges | Native Veil result | Adapter operation | Certainty and remaining ambiguity |
| --- | --- | --- | --- |
| 1 | listCapabilities returns detached descriptors; no execution | Adds task/counters | Zero invocation evidenced by fixture; filtering is host responsibility |
| 2 p1 | Ordinary Error before job creation: field type error | Counts unchanged authorizations, labels REJECTED, forwards error.message | This input rejected before invocation. Generic catch cannot identify admission versus infrastructure failure without fixture assumptions |
| 3 p2; 6 p5; 8 p7; 10 p9 | Completed Job and completed step results | Labels SUCCESS, projects id/status/result | Capability returned successfully; real-world correctness/effect durability is not guaranteed |
| 4 p3; 5 p4; 7 p6 | Failed step/Job, capability.denied event, denial reason text | Detects event type, labels DENIED; forwards errors | Explicit policy denial; no entry in these attempts. Event detection is structured, not text parsing |
| 9 p8 | Failed Job; first step completed with result, second failed; error Fixture failure before effect and capability.failed | Labels FAILED; retains both statuses/results/error | Partial progress is native. No effect on the second step is known from fixture code/counters, not the generic failed status or trustworthy error text |
| 11 p10 | Actually completed Job and applied fake write | Suppresses success; invents UNKNOWN receipt after known injected delivery loss | Host knows actual fixture effect; reasoner does not. Not a native uncertain execution outcome |
| 12 | No new runtime call | Returns saved UNKNOWN | Still no new evidence, not reconciliation or an execution retry |
| 13 p10; 14 p11 | No runtime call | Session ID / known-effect guard invents REJECTED | No new invocation; does not prove durable deduplication or native idempotency |
| 15 p12 | No runtime call | Surface allowlist rejects unknown name | Demonstrates host scoping, not core unknown-capability diagnostics (which exist separately as Error text) |
| 16 p13 | Ordinary Error before job creation: capability version mismatch | Same counter heuristic and text projection as p1 | Rejection certain for this known validation failure; no stable public code/issue list |
| 17 p14 | Failed Job; source completed, sink failed during resolution; reference-path Error copied into step/Job and capability.failed event | Labels FAILED; forwards path text | No sink authorization/entry in trace. Projected FAILED alone does not distinguish resolution from invocation failure |
| 18; 19 | No runtime call | Scope/method rejection | Host protocol boundary, not new runtime diagnostics |

**Error-text parsing inventory: none.** Host copies String(error.message), Job.error and
Step.error; it classifies returned Jobs using status/event type, and thrown errors
using its policy counter. Reasoner checks only outcomes, statuses and known result
content. There is no regex extraction of fields, versions or paths, and no automatic
repair algorithm based on error details. Future generic repair would otherwise
need text interpretation or duplication of Veil's validator.

Native validation already produces `PlanValidationError[]` with stepId, capability,
optional field and message. JobManager joins only messages into Error text before
admission, losing machine-usable issue boundaries/location. Resolved-input errors
are flattened similarly. Internal validators are not exported from the package;
exporting them or the registry is neither necessary nor appropriate.

Other limits relevant to feedback:

- JobStep.status failed conflates reference resolution, resolved validation,
  policy exceptions/malformed decisions, infrastructure preparation and invocation
  exceptions. Explicit denial is separately evidenced by capability.denied.
- capability.started occurs **before logger construction and the actual call**.
  It cannot alone prove capability entry; the fixture's entry counter is stronger.
  Absence/presence of mutable asynchronously published events is not a durable
  security receipt for arbitrary consumers.
- A completed prefix does not make retry of the failed step safe. No generic
  operation/effect certainty follows from successful return or throw.
- JobOutcome inconclusive exists, but it is not this experiment's UNKNOWN delivery
  state and the normal execution loop does not assign it for lost feedback.
- An exception after a completed effect/persistence failure may leave no returned
  Job. Zero policy calls is a useful fixture observation, not a general admission
  error discriminator. An unknown exception must remain an infrastructure/unknown
  outcome, not be promoted to a caller-correctable validation error.

## 4. Removing the adapter: compensation inventory and responsibilities

Removing host code must not mean exposing a raw process-global runtime to an
untrusted client. Another trusted host still owns transport, identity, filtering,
scope and business policy. It need not know fixture sentinels to run a conservative
loop; it must refuse blind retries when effects are unknown. Reproducing *these
exact fault-injection scenarios* necessarily requires their test-domain knowledge.
No generic core contract can infer the meaning of FAIL/UNCERTAIN or invent a goal.

| Fixture compensation | Classification | Minimum reusable source of information |
| --- | --- | --- |
| Detached descriptor lookup and exact version | Required core primitive, already present | listCapabilities/describeCapability |
| Plan admission, resolved-input validation and explicit policy gate | Required core primitives, already present | executePlan plus host ExecutionAuthorizer |
| Completed-prefix statuses/results | Required evidence, already present | Returned Job/steps, safely projected by host |
| Counter heuristic for thrown admission errors | Missing small general diagnostic primitive | Stable runtime admission discriminator and structured issue locations/codes |
| FAILED phase inference | Useful core evidence extension | Runtime-originated step failure phase/code; never automatic retry permission |
| Sample-derived output path | Useful descriptor extension | Capability-authored declared output fields; actual result still checked |
| Matching purpose by prose/static risk | Reasoner/domain responsibility | Domain goal and descriptions; no authority-bearing operation taxonomy inferred from this test |
| Resource IDs, goals, permitted alternative | Host/user task responsibility | Task data or separate resource API, not hidden authorization rules in discovery |
| Caller/scopes, allowed names, method whitelist | Host responsibility | Trusted configuration and scoped adapter; no request-granted authority |
| Session receipt IDs, transport UNKNOWN, replay guards | Host/application responsibility | Delivery bookkeeping and domain reconciliation; no core exactly-once inference |
| FAIL/UNCERTAIN semantics, effect oracle | Research-only instrumentation | Not a missing public execution primitive |
| Frozen JSON data, temporary directories, isolated process | Fixture/host constraints; unresolved general ownership | ADR-0011 remains independent and unimplemented |
| Raw provider handles, policy enumeration, cross-job access | Deliberately unsupported exposure | No replacement primitive should provide them |

A generic host can already submit and stop conservatively on ambiguous outcomes.
Automatic *targeted repair of invalid proposals* benefits from stable diagnostics;
this differs from automatic *retry of possible effects*, which no diagnostic code
alone can authorize or justify. The experiment proves neither requires AI APIs.

## 5. Options and smallest candidate contracts — NOT APPROVED

| Demonstrated gap | A: no change | B: documentation | C: descriptor enrichment | D: diagnostics | E: helper/adapter | F: smaller alternative / recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Admission errors flattened | Conservative stop still safe | Can warn against matching text, cannot recover lost structure | Input metadata helps avoid errors, not identify actual rejection | Best fit: preserve structured runtime issues | Wrapper cannot recover authoritative issues without parsing/revalidation | ADR for one typed admission failure; no exported validator |
| Resolution vs capability failure | FAILED remains conservative but coarse | Explain that failure does not mean no effects | Output hints reduce some invalid paths | Optional stage/code on failed step | Current event/status projection useful but ambiguous | Review separately after admission; no new outcome state machine |
| Output/path inference | Can inspect prior results as today | Capability docs can describe target | Small optional output-field declaration | Missing-path code helps repair but cannot describe successful shape | Host-specific result catalog duplicates capability contracts | Test an explicit declared output contract before broadening schema support |
| Purpose inferred from prose/risk | Works in this two-operation fixture | Better descriptions and explicit risk warning | Tags/operation IDs might help but lack demonstrated general vocabulary | Not relevant | Domain planner/host mapping can supply intent | Keep semantic selection outside core; test larger ambiguous inventory |
| Enums/nesting/constraints | No demonstrated failure in this fixture | Document actual shallow checks | Possible later extension; must align validation | Not a substitute for an input contract | Application validation can remain capability-local | Defer; do not assume JSON Schema |
| UNKNOWN/replay/safe repair | Stop on uncertainty | Explicitly distinguish execution failure from effect certainty | Risk/output metadata is insufficient | Do not invent a core provider-effect guarantee | Host receipts and domain reconciliation are appropriate | Retain host responsibility; no general reasoning protocol |

### Priority 1: an admission diagnostic, preserving the existing call shape

Smallest useful addition would keep executePlan returning Promise<Job> on admitted
execution and rejecting on known admission failure. It would expose a documented
runtime-generated error discriminator and passive issue list. Illustrative shape:

```ts
// Candidate contract, not implemented or exported by this investigation.
interface AdmissionIssue {
  code: 'INVALID_PLAN' | 'INPUT_TYPE_MISMATCH' | 'CAPABILITY_VERSION_MISMATCH';
  stepId?: string;
  field?: string;
  expectedType?: string;
}
// A runtime-owned admission Error subtype, still catchable as Error:
// code: 'PLAN_REJECTED'
// issues: readonly AdmissionIssue[]
```

These are the minimum demonstrated specific categories; INVALID_PLAN is a generic
fallback for other known admission validation failures, not arbitrary exceptions.
An ADR should settle naming and future code extension rules. Human-readable Error
message remains explanatory and non-normative. No actual input values, internal
stack/cause, credentials or allowed-resource hints belong in this payload. A host
may translate/redact it before transmitting it. Step IDs/field names must be
bounded and treated as untrusted labels, not executable paths.

This would remove the policy-counter heuristic for p1/p13 and preserve enough
location/type data for a client to repair those errors without English parsing.
It need not expose validatePlan, add a validate-only entrance or redesign the Job
return type. A preflight helper alone would not solve execution-time admission
races; the authoritative submission must still diagnose its own validation.
Unexpected exceptions are **not** PLAN_REJECTED. Capability/provider exceptions
must never acquire that discriminator merely by supplying a matching code or
throwing a publicly constructible lookalike: origin is assigned at the runtime's
own admission boundary, not trusted from arbitrary thrown properties.

For admission failures that reject before job creation, the typed discriminator
can document that no capability invocation occurred for that submission. It says
nothing about a previous submission and grants no retry/authorization authority.
This is a general SDK diagnostic improvement, not a reasoner endpoint.

### Priority 2: a small step-failure projection, separately reviewed

If generic hosts need to distinguish p14 from p8 without knowing fixtures, extend
the existing failed-step record with optional runtime-originated diagnostic data,
not a new executor or result hierarchy. Candidate shape:

```ts
// Candidate optional JobStep.failure:
{
  stage: 'resolution' | 'input-validation' | 'authorization' | 'invocation' | 'runtime';
  code: string; // documented finite initial vocabulary; unknown codes handled conservatively
  field?: string;
}
```

For the actual trace, `resolution / REFERENCE_PATH_NOT_FOUND` versus
`invocation / CAPABILITY_ERROR` is sufficient. Explicit denial already has a
structured native event; its normalization is a convenience, not missing policy
machinery. Existing validator information can support field locations for resolved
input errors. Runtime-originated assignment must distinguish logger/setup errors
from actual invocation errors. Unexpected failures default to a generic runtime
code; never infer a stage by parsing exception text.

This describes **where runtime processing failed**, not what a provider did.
Do not add retryable:true, safeToRetry, effects:none, or permission hints based
solely on stage/status. The failed step can have prior completed peers; invocation
failure may follow a real effect. A returned resolution failure under trusted
runtime execution establishes no invocation of that receiving step, not zero
work in the whole plan. Live Job mutability and durable storage remain existing
limitations; a failure field would not be a signed immutable receipt.

This changes a locked public JobStep contract and requires maintainer review.
It can be deferred without blocking the narrower admission change.

### Descriptor candidate: declared output fields, not a schema framework

The smallest metadata that could replace p7's sample-derived path would be an
optional capability-authored declaration of a record result's fields, for example:

```ts
// Candidate CapabilityDescriptor addition, with matching capability declaration:
output?: {
  type: 'object';
  fields: Record<string, { type: string; required: boolean; description: string }>;
};
```

For this fixture a declared `target` string field and its data meaning would make
a top-level candidate path visible before a lookup. No nested DSL, enum system,
output examples containing live data, universal operation taxonomy or permission
schema is needed to demonstrate that improvement. Absence means unspecified,
not no result or empty result. The root marker prevents a field map from falsely
implying every capability returns a record. Root primitives/arrays and nested
output declarations need separate evidence before expanding this candidate.

Initially this would be a **declared expectation**, not runtime-validated output
or proof that the next result contains the field. The documentation must say so;
missing paths must still fail closed. Whether to validate results is a separate
semantic decision with post-effect failure implications. Merely projecting an
unenforced declaration as a guarantee would worsen the contract.

This removes only the sample-path guess, not business-purpose interpretation or
permission selection. Relevance remains reasoner/host work. The capability
version should identify the declaration's compatibility; no parallel schema
version or ExecutionPlan v2 is needed solely for this metadata discussion.
Do not implement the proposed addition before revisiting ADR-0009 explicitly.

## 6. Security review of the options

| Improvement | Exposure risk | Required boundary |
| --- | --- | --- |
| Structured admission issues | Existence of undisclosed capabilities, input secrets, schema details | Host filters submissions/discovery and feedback; expose only caller-relevant locations and known safe categories; never raw submitted values or registry inventory |
| Step failure phase/code | Provider paths, stack traces, policy conditions or exception spoofing | Codes assigned by runtime origin; generic capability/runtime failure; do not serialize arbitrary cause objects; denial remains coarse |
| Output metadata | Sensitive result names, concrete examples, executable accessors | Trusted capability-authored static passive projection, detached like current descriptors; host filters visibility; no live result/provider inspection during discovery |
| Documentation/helper | Default forwarding of live Job/error data or assumed authorization | Explicit scoped projection/redaction examples; preserve host caller; no registry/store/provider exports |
| More machine-readable content | A client treats descriptions/errors as executable instructions or permission | Every subsequent plan must pass fresh admission and authorization; content is evidence, never a capability token |

No proposed improvement publishes authorization rules, credentials, executable
callbacks, provider handles, registry mutation or cross-job queries. Disclosure
control and caller identity remain host responsibilities. Even a truthful
structured denial must not reveal which secret scope would have granted access.
Descriptors may be intentionally incomplete for an external caller.

The fixture's raw error strings happen to contain harmless test data. Their
unfiltered projection is not a production-safe error policy. A stable safe code
reduces dependence on those strings but does not automatically sanitize existing
Job.error or transport responses. Keep operator diagnostics separate from
externally permitted evidence.

These suggestions do not resolve value mutation between policy and invocation.
More precise metadata about a mutable input is not an ownership guarantee.
ADR-0011, ADR-0008 reconciliation, static-risk versus invocation-effect, and
provider-effect equivalence remain independent decisions.

## 7. Architecture consequence and recommendation

| Proposed product statement | What is demonstrated | Limit |
| --- | --- | --- |
| Veil is not an agent framework | This loop needs no agent abstraction, model provider, memory/reasoning framework or new executor | A fixture alone cannot define every future product direction |
| Intelligence exists outside Veil | Separate process constructs proposals and reads serialized outcomes | Scripted client, not arbitrary autonomous intelligence; no OS hostile-code isolation |
| Veil exposes bounded possibilities | Existing detached descriptors enable name/version discovery; host exposes two capabilities | Bounded external visibility is the host's filter; core inventory remains global; semantics/output paths incomplete |
| Intelligence proposes | Client submits passive plans and adversarial authority claims | It also knows fixture task, protocol and fault sentinels; not self-sufficient semantic discovery |
| Veil validates, authorizes and executes | Real admission, resolved validation, policy calls and gated capability entry observed | Host supplies policy/identity, source values are fixture-stable, providers are fake |
| Outcomes return as evidence | Native statuses/results/denial event support host-projected feedback | Five outcome labels, uncertainty and receipts are adapter protocol; no durable effect-proof receipt |
| Intelligence may reason again | Programmed repair, alternative target, partial-plan repair and conservative unknown handling work | Does not prove generic error repair or safe retries of arbitrary effects |

The statement is supported as a **separation-of-responsibilities model**, with
those qualifications. No evidence requires Veil to know or care that a proposer
is AI. Veil must know the trusted host's caller identity and enforce policy; it
does not need the caller's reasoning technology.

Recommendation remains **ADR REQUIRED** because even a small diagnostic addition
extends locked public error/Job contracts and an output declaration would extend
ADR-0009. The first ADR should be small: preserve structured admission reasons at
the public submission boundary, without exporting internals or changing execution
semantics. Consider optional failed-step phase/code in a separate review. Do not
bundle schema generalization, semantic discovery, policy introspection, retry
orchestration, ownership migration or UNKNOWN provider effects into that change.

Next step: review the candidate admission diagnostic and its failure-origin/redaction
rules, then authorize a narrowly scoped implementation if desired. Separately
exercise composition with declared output metadata and multiple same-risk
capabilities before choosing a descriptor expansion. Existing primitives remain
sufficient for bounded, conservative host adapters while those decisions proceed.

## Investigative verification

- Read the complete report and trace, including every proposal, response, policy
  observation and counter delta; inspected implementation/tests and current native
  contracts. Distinguish public feedback from trusted research instrumentation.
- `npm run check` passed: typechecking, **257 functional tests**, build and packed
  consumer verification (`veil-runtime-core-0.2.0.tgz`, 102 files). This includes
  existing introspection/execution tests and the separate-process fixture tests;
  no new test or implementation was needed for this document review. The command
  used the previously established outside-sandbox subprocess verification path.
- `git diff --check` retains the earlier source-edit CRLF findings (exit 2).
  No formatting controls or source files were changed to alter this result.
- This pass adds only `docs/architecture/external-reasoner-gap-analysis.md`.
  Runtime, public types, experiment code/trace, ADR statuses, package version and
  release files remain unchanged from the reviewed working tree. Earlier
  uncommitted hardening remains separate; this document approves none of it.
