---
title: Structured admission diagnostics — boundary inventory
---
# Structured admission diagnostics — boundary inventory

## Implementation follow-up: accepted ADR-0012

The inventory below records the pre-implementation investigation. ADR-0012 is now
Accepted and implemented. The two eligible rejection branches now issue ordinary
Errors with immutable structured issues. Validator metadata carries source codes
and captured step ordinals without parsing legacy messages. Public callers use
isPlanAdmissionError on the direct executePlan rejection; a private WeakMap and
per-call owner prevent foreign-call replay from acquiring current-call certainty.

The excluded paths, lack of plan-version enforcement, legacy message disclosure
and ambient JavaScript caveats in this inventory remain unchanged. Regression
evidence is in test/plan-admission.test.ts and the packed consumer test. The
historical verification/handoff section below describes the original investigation,
not the current implementation status.


Recommendation: **IMPLEMENT AFTER ADR APPROVAL**, limited to the explicit
pre-job rejection branches described in [draft ADR-0012](../adr/0012-structured-admission-diagnostics.html).
No behavior, contracts, experiment or ADR status is changed by this investigation.

## Current public path

OperatorRuntime.executePlan first projects host caller data, then delegates to
JobManager.executePlan. JobManager synchronously captures the structural envelope,
checks nonempty steps, calls validatePlan, computes the goal, creates/persists a
Job, materializes/persists steps, then calls execute. execute reloads the Job,
resolves each step input, validates it, authorizes it and dispatches it.
OperatorRuntime.run performs router/strategy/planning work first and only then
submits its resulting plan through executePlan.

There is no general runtime parser for arbitrary ExecutionPlan object shapes.
The TypeScript contract is not a runtime shape validator. Out-of-contract values
can throw incidental JS errors; some unusual inputs are accepted. This proposal
must not add shape/value/version restrictions under the name of diagnostics.

## Failure-path inventory

"No invocation" below means no governed capability step dispatched by this
submission's runtime path, not absence of all host/user-code side effects.

| Path | Origin / representation / loss point | Job yet? | Authorization / step invocation? | Proposed treatment |
| --- | --- | --- | --- | --- |
| run: no router, router selection rejects, missing strategy, planner/memory errors | Ordinary Error or propagated dependency exception before executePlan | No Job for the not-yet-submitted plan; planner may do other work | No admission step dispatch; arbitrary planner/provider activity possible | Exclude: planning/configuration, not admission |
| executePlan options/caller getter or scopes/metadata projection throws | immutableCaller reads/copies host data; raw exception | No Job for this submission | No admission dispatch; callback side effects possible | Exclude |
| Null/missing plan, missing/non-array steps, null/sparse step, bad length | Named structural capture / iteration may throw TypeError/RangeError; some malformed shapes reach normal validation instead | None at capture | No admission dispatch | Incidental exceptions remain ordinary; only a later explicit validator rejection is eligible |
| Throwing plan/step/input getters or Proxy traps | Capture and validator read operations; raw exception unless already caught by reference-parser validation | None before create | No core step invocation; user code may run/reenter | Do not blanket-wrap exceptions |
| Empty captured steps | Explicit Error: Execution plan contains no steps | No | No / no | EMPTY_PLAN |
| Unsupported plan.version | Not checked or consumed for admission; no native rejection | Normal path can create Job | Normal path can authorize/invoke | No code; no new version validation |
| Duplicate step IDs | validatePlan creates PlanValidationError for each repeated ID; messages joined in JobManager | No | No / no | DUPLICATE_STEP_ID |
| Unknown capability | Registry lookup returns absent; PlanValidationError | No | No / no | UNKNOWN_CAPABILITY |
| Requested capability version mismatch | Exact comparison; PlanValidationError includes requested/registered versions in message | No | No / no | CAPABILITY_VERSION_MISMATCH |
| Unavailable provider or unhealthy registered capability | No readiness/provider check during admission | Can be admitted | Failure may occur after authorization/inside capability | Exclude; wrong capability version is not provider unavailability |
| Missing required field | validateInput: undefined, null or empty string creates issue with field | No | No / no | REQUIRED_INPUT_MISSING |
| Declared field type mismatch | Shallow built-in check fails; issue with field | No | No / no | INPUT_TYPE_MISMATCH |
| Unsupported declared schema type | Missing TYPE_CHECKS predicate; issue with field | No | No / no | UNSUPPORTED_INPUT_SCHEMA; may require capability-author correction, not proposal repair |
| Invalid reference syntax/parser rejection | collectReferences finds candidates; parseResultReference throws; validator catch stores its message in an issue | No | No / no | INVALID_RESULT_REFERENCE, meaning parser rejected it, not proof of caller fault |
| Reference not to earlier declared ID | Parsed target absent from seenStepIds; issue with reference text | No | No / no | RESULT_REFERENCE_NOT_EARLIER (self, forward or unknown target) |
| Unrecognized reference-shaped data | Extra keys, arrays or non-string $ref are not recognized as references; may otherwise validate | Normal path | May invoke | No new rejection/code |
| Cyclic literal input / deep traversal / enumeration exception | collectReferences recursion or Object.values can throw before a validation result | No | No core dispatch; getters may have run | Ordinary exception; no governed-value model added |
| Bad goal type / goal trim getter or method failure | After successful validatePlan, before create; raw exception | No | No / no, aside from user code | Exclude, not an existing validation issue |
| Job goal is required | create's direct guard; normal executePlan uses trimmed/default goal | No created Job at guard | No / no | Internal creation guard, not one of executePlan's admission rejection branches |
| Job create/event/storage failure | Job object constructed; job.created published before store.create completes | Object/event exists; persistence may or may not exist | No step policy/dispatch yet; observer/storage activity possible | Infrastructure exception, not admission diagnostic |
| Step materialization/store update failure (e.g. SQLite bigint serialization) | After create; raw storage/serialization exception | Yes | No step dispatch yet | Infrastructure/value persistence failure; exclude |
| execute reload missing Job / empty stored steps | Ordinary Error before execute's try loop | Job may have existed; no current loaded Job or empty loaded Job | No dispatch in this attempt | Execution/store state, exclude |
| Capability absent at execution-time lookup | After reload/admission, may follow earlier steps; outer failed Job/error | Yes | Earlier steps may have invoked | Execution state, exclude |
| Reference source not completed/path missing/getter error during resolution | resolveResultReferences throws; failed step/Job and capability.failed text | Yes | Current step not invoked; earlier steps may have invoked | Exclude even when no step happened to run yet |
| Resolved input validation failure | Same structured validator shape, flattened inside execute to failed Job/step text | Yes | Current step before policy; earlier steps may have invoked | Exclude; same internal validator does not imply same public boundary |
| Authorization denial, invalid decision, authorizer throw | Failed Job; denial has capability.denied event; others ordinary failure text | Yes | Current step not invoked; earlier steps may have invoked | Exclude |
| Logger setup, capability/provider or final persistence failure | After admission; may fail before or after capability effects | Yes | Invocation may have occurred | Exclude |
| HTTP JSON/shape errors, host allowlist/version/replay rejection, delivery loss | Host/transport logic, not Veil admission | Varies | Depends on where host stopped | Keep host-specific outcomes separate |

For malformed shapes, the exact accidental TypeError is not a proposed contract.
Missing step IDs are not independently checked for being valid strings; the
current duplicate/lookup logic is the actual admission logic. A blank required
field has existing special semantics; do not replace it with a new schema model.
Reference discovery skips normal field checks for recognized references, but
required-field checks and other admission errors still apply. Unknown capability
short-circuits that step's further input/reference checks after duplicate checking.
Ordering/aggregation must remain unchanged.

## Exact information-loss point

`src/runtime/execution/plan-validator.ts` creates:

```ts
{ valid: false, errors: [{ stepId, capability, field?, message }, ...] }
```

`src/runtime/jobs/job-manager.ts` executePlan flattens this with:

```ts
throw new Error(`Execution plan failed validation: ${validation.errors
  .map(error => error.message).join('; ')}`);
```

Empty-plan rejection is a separate direct Error. Internal validation currently
has no stable issue codes or step indices: these would be assigned at the already
existing decision branches, not recovered from messages. Positional index is
available from captured steps; it disambiguates duplicate IDs without echoing IDs.
A nested consumer field path for references is **not** available today; the
collector retains reference strings only. Do not promise such a path in v1 of
this diagnostic.

The parser's broad catch is already converted to PlanValidationError. An
INVALID_RESULT_REFERENCE diagnostic should mean that this validation stage rejected
the reference; it must not claim all such exceptions are syntactic user mistakes.
Original parser exception text must not enter the new safe issue message. Raw
exceptions escaping collection/capture are a different path and stay untyped.

## Compatibility evidence

- `test/plan-validator.test.ts` asserts exact duplicate error text and zero job,
  store, lifecycle, policy and invocation effects for ordinary duplicate plans.
- `test/execution-contract.test.ts` asserts exact mismatch messages and deeply
  compares internal validation result objects. `test/structural-ownership.test.ts`
  covers throwing capture getters/proxies, sparse steps and preserved capture
  ordering. Reference tests preserve current grammar/own-property behavior.
- Generic HTTP execution route detects the prefix Execution plan failed validation:
  to return 400. Jobs execute-plan returns 400 for any thrown Error message.
- MCP emits Error.message as text/isError; failed step errors are also text.
- Starter execute handling returns 422 with kind rejected and message for caught
  errors. Its request parsing/shape errors have separate paths.
- None of these adapters automatically forwards a new Error property. Adding the
  diagnostic cannot silently create a structured transport protocol.
- The external-reasoner host uses authorizations-before/after to classify thrown
  errors. It does not parse messages. A recognized native admission diagnostic
  would remove that heuristic for p1 and p13; arbitrary exceptions remain UNKNOWN
  or host infrastructure errors, not presumed invalid proposals.

## Scope result

All proposed diagnostic issuance sites are before `this.create(goal)` and before
this submission's authorization/step dispatch. This is narrower and stronger than
"some error before first capability": it identifies an explicit rejection of the
captured proposal. Other pre-invocation failures remain distinguishable by not
receiving this type. Error text alone cannot prove the category.

The guarantee is not "nothing happened." ADR-0008 permits getter/trap side effects
and trusted planner/host code; they may call other operations, including reentrant
submissions. The guarantee is only that this rejected submission did not enter
its runtime-governed step invocation sequence. No provider called *by such a step*
was reached. Arbitrary ambient provider calls cannot be ruled out by an admission
error, and prior submissions are outside its scope.

## Verification and handoff

`npm run check` passed typechecking, **257 functional tests**, build and packed
consumer verification (`veil-runtime-core-0.2.0.tgz`, 102 files). It exercised the
existing validator, structural ownership, execution, transport, introspection and
external-reasoner fixture tests. No new behavior/test assertions were introduced;
these runs substantiate the current inventory, not an unimplemented diagnostic.
The established outside-sandbox subprocess path was used; no verification failure
occurred in that run.

`git diff --check` remains exit 2 for pre-existing CRLF source edits from earlier
hardening. No source formatting, baseline, control or comparison base changed.
Reviewed the new ADR and this inventory against source and existing test/adapter
expectations. This pass adds only:

- `docs/adr/0012-structured-admission-diagnostics.md`
- `docs/architecture/admission-diagnostics-investigation.md`

Next step: maintainer review of the Draft's exact issuance sites, code vocabulary,
ordinal/field location, legacy-message versus safe-details distinction, and scoped
certainty guarantee. Only after approval implement the specified small change and
regressions. Earlier uncommitted work, runtime behavior, experiment, public exports,
existing ADR status, package version and releases remain unchanged.


## Final ADR-0012 implementation verification

ADR-0012 is Accepted and implemented without contract deviations. The resumed
final regression was complete; no runtime or test correction was necessary.

- Focused admission suite: **21 passed**, including unexpected Proxy,
  reference-collection and planner failure negative controls.
- `npm run check`: **278 functional tests passed**, typechecking, build and packed
  consumer verification passed (`veil-runtime-core-0.2.0.tgz`, 104 files).
- `npm run test:quality`: **216 passed**. The exact candidate inventory contains
  18 individually classified sites and no API-route or legacy-bypass allowance.
- Explicit external-reasoner suite: **3 passed**; fresh trace equals the stored
  trace structurally. All 19 entries retain expected outcomes and counts:
  3 lookups, 6 update invocations, 5 effects, 12 authorizations, 9 invocations.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`:
  **exit 2**, not a pass. Five changed machinery anchors and four new reflective
  diagnostic-test sites lack trusted allowances in that fixed base. Candidate
  entries document their review but cannot authorize themselves. Verification
  controls also require review; no base or checker rule was relaxed.
- Documentation status, local links, fences and whitespace checked. Full tracked
  diff and ADR-0012 additions reviewed. `git diff --check` retains only the
  pre-existing CRLF findings in earlier hardening files; no ADR-0012 whitespace
  regression was introduced.

Replay, overlapping-call and reentrant-call regressions pass, including a foreign
diagnostic thrown from storage after a real fake-capability invocation. Immutable
property descriptors, detached/frozen issue graphs, legacy Error compatibility,
lookalike rejection and sanitized projection pass. HTTP/MCP retain their previous
response shape without exposing new fields. Their legacy message disclosure is
still a host concern.

The experiment replaces the authorization-counter heuristic for p1 and p13 with
native INPUT_TYPE_MISMATCH and CAPABILITY_VERSION_MISMATCH evidence. There is no
error-text parsing. Job/event-based failure/denial projection, fake failure text,
receipt handling and simulated UNKNOWN remain fixture compensation. No automatic
repair, retry safety, provider-effect or value-ownership guarantee is added.

Files changed for ADR-0012 (earlier hardening changes are separate):

- `src/index.ts`
- `src/runtime/execution/plan-admission-error.ts`
- `src/runtime/execution/plan-validator.ts`
- `src/runtime/jobs/job-manager.ts`
- `src/runtime/operator-runtime.ts`
- `test/plan-admission.test.ts`
- `test/plan-validator.test.ts`
- `test/execution-contract.test.ts`
- `test/execution-routes.test.ts`
- `test/introspection-mcp.test.ts`
- `test/external-reasoner.test.ts`
- `test/fixtures/package-consumer/index.ts`
- `test/fixtures/package-consumer/verify.mjs`
- `experiments/external-reasoner/host.mjs`
- `experiments/external-reasoner/trace.json`
- `tools/quality-governance-baseline.json`
- `tools/quality-governance.test.mjs`
- `docs/adr/0012-structured-admission-diagnostics.md`
- `docs/reference/operator-runtime.md`
- `docs/reference/public-exports.md`
- `docs/contributing/quality-harness.md`
- `docs/architecture/admission-diagnostics-investigation.md`
- `docs/architecture/external-reasoner-experiment.md`
- `docs/architecture/external-reasoner-gap-analysis.md`

Next step: review/adopt the precise governance inventory changes on the trusted
branch. The implementation and behavioral gates are complete; the fixed-base
quality comparison remains explicitly non-green pending that review. No version,
release, plan-version enforcement or ADR-0011 change is included.
