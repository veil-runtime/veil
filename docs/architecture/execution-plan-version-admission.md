---
title: ExecutionPlan version admission
---
# ExecutionPlan version admission

Decision authorized by the maintainer's narrowly scoped version-enforcement task:
**ExecutionPlan v1, represented by the exact string `'1.0'`, is the only currently
supported plan protocol.** No other version's semantics are defined here.

## Contract and compatibility investigation

ExecutionPlan.version is already a required readonly string in planner.ts.
The v1 reference and public examples require/use '1.0'. Before this change,
JobManager did not read it and validatePlan only accepted steps; arbitrary or
missing versions could execute despite that documented protocol requirement.

All repository production constructors emit '1.0': DeterministicPlannerProvider,
OpenAICompatiblePlannerProvider (it constructs the envelope around model-returned
steps), generic execution and LinkedIn HTTP routes, inbound McpAdapter, starter
createDemoPlan/createSupportPlan and starter planner. Direct/fallback strategies
forward planner output; reviewer copies the selected plan and adds metadata.
The external-reasoner host/reasoner and package consumer also emit '1.0'. The
external-reasoner host already rejects other versions under its fixture rules.

POST /jobs/execute-plan passes untyped request JSON through. There is no documented
omission default. Such clients must now supply '1.0'. Third-party code may have
relied on the permissive implementation or broad string type: that observable
acceptance is intentionally tightened, not claimed universally non-breaking.
No supported documented example or repository production caller needs migration.

Two deliberate characterizations change: plan-admission's not-enforced string
becomes a supported-v1 success control with dedicated invalid-version tests;
structural-ownership now verifies a single version getter read rather than an
unused getter. Throwing version getters now reject with their ordinary exception.
This newly consumed field and error precedence are explicit compatibility changes.

Memory and SQLite stores persist Jobs, not an ExecutionPlan version. No persisted
job schema, fixture migration or automatic re-execution is introduced. A stored
Job is not a version-negotiation or resume primitive. Future recovery/version
retention needs a separate decision.

## Admission rule

At JobManager.executePlan entry, read plan.version once, before goal/key/step
capture. Accept only strict equality to '1.0'. Missing/undefined, null, numbers,
booleans, objects, arrays, aliases, whitespace variants, '1.0.0' and future strings
all reject; do not coerce, trim, stringify, negotiate or fall back. This rejection
precedes empty-plan and step-validation diagnostics and does not aggregate with
them. Supported v1 follows the existing capture/validation/execution path.

Named reads preserve existing JavaScript property-access conventions (including
inherited fields/accessors). Throwing getters/Proxy traps remain ordinary errors,
subject to the established foreign-diagnostic containment. This is not a general
plan-shape parser: null/non-object submissions can still fail as ordinary capture
errors. Host caller projection also still precedes JobManager admission. Ambient
callback side effects are not excluded by the governed-invocation certainty.

## Explicit extension of Accepted ADR-0012

This task adds a **third eligible pre-Job issuance branch** and a **tenth code**:
`UNSUPPORTED_PLAN_VERSION`. It does not overload CAPABILITY_VERSION_MISMATCH.
It uses the existing issuer, private per-call ownership, immutable details and
public predicate without changing their design. The new plan-level issue has
no stepIndex or schema field, and fixed safe message:

> The plan version is not supported.

The new Error.message is also fixed:

> Execution plan version is not supported; expected '1.0'.

Neither echoes a submitted value nor invokes coercion. Existing diagnostic
messages remain unchanged. Rejection occurs before Job creation, authorization
and this submission's capability invocation. This is evidence, not permission,
retry advice, or a guarantee that arbitrary host code had no side effects.

ADR-0012's original nine-code/two-site decision remains historical; this note
explicitly extends its vocabulary and scope under this task's authorization.
Its earlier statements that plan-version enforcement is absent/non-goal describe
that decision, not the current implementation. Hosts must handle this new code
as another admission category; no wire protocol changes are made. The existing
HTTP endpoint returns its normal 400 error envelope with fixed text; inbound MCP
constructs '1.0' itself. No new information is automatically serialized.

## Non-goals and verification scope

No v2, negotiation, compatibility mode, ADR-0011, $ref changes, descriptor changes,
planner framework, package version change or release. The type remains string;
runtime admission determines support. Future semantic versions require a separate
architecture decision; this note specifies none.

Tests cover untyped JSON, absence/malformed/future versions, zero Job/storage/
authorization/invocation on rejection, single-read/no-coercion behavior, native
provenance and foreign replay containment, HTTP projection, built-in planner
emission and unchanged supported-v1 execution. Existing MCP, strategy, structural
ownership and external-reasoner suites remain regression controls.


## Implementation verification

`npm run check` passed: **293 functional tests**, typecheck, build and packed
consumer verification (104 files). `npm run test:quality` passed **216 tests**.
The explicit focused run passed **18 tests** (15 version admission, 3 external
reasoner). HTTP/MCP and supported planner/runtime behavior remain covered by the
complete suite. Documentation links/fences/whitespace and the scoped diff were
reviewed. Repository-wide diff whitespace findings remain the historical CRLF
findings in earlier hardening files, not new version-enforcement edits.

The fixed-base quality command against
`bb3f34e4f938096acec897159f0f56283c11697a` remains **exit 2** for untrusted
candidate anchors/reflective sites and review-required controls. No rule or base
changed. Only the two JobManager candidate anchors were refreshed for the new
version gate's enclosing-class change; their execution expressions and authority
gates are unchanged, with no new site or allowance. Current exact anchors:

- `75b4703be8dcf754f100d3231e3da7a1fd53e3a04ac00b132be0953305ca87bc`
- `db7d11c496d45d0718ae5a3bb1c0b98fa7a1ee42ff113f63572d653801e6eb2c`

## Reviewed version-admission inventory reconciliation

Both refreshed entries are individually approved under the maintainer's scoped
review instruction. Their existing classification remains GOVERNED_MACHINERY.

| Site | Previously reviewed ADR-0012 anchor | Refreshed version-admission anchor | Review |
| --- | --- | --- | --- |
| this.execute(job.id, caller, authorizer) | c4619c7c10289a51643d7fb8461fc7724cecde6bd2a32bb39f440a8169a6c0c2 | 75b4703be8dcf754f100d3231e3da7a1fd53e3a04ac00b132be0953305ca87bc | Approved V1: delegation remains after admission, Job creation and materialization, forwarding the same caller and authorizer. |
| capability.execute(resolvedInput, context) | 49986990ab0308123896bb1a414fb5dd1ac6c22eb84529fa5989d54556f6e74c | db7d11c496d45d0718ae5a3bb1c0b98fa7a1ee42ff113f63572d653801e6eb2c | Approved V2: invocation remains behind resolved-input validation and explicit authorization; denial/malformed decisions remain fail-closed. |

The sole version-task change in JobManager is the preceding read-once strict
version gate and its pre-Job diagnostic. Neither execution expression changed.
Removing exactly that gate from an in-memory source copy reproduces both prior
anchors with the unchanged parser, confirming the refresh is solely due to this
approved change to the enclosing class. No production source was altered by this
check. There is no added execution, authorization, provider, registry mutation or
governance bypass. Existing ambient host limitations are unchanged.

The inventory already held the correct refreshed hashes. Reconciliation changes
only these two reason strings to record explicit approval; hashes, paths, kinds,
classifications, the other 16 entries and all rules remain unchanged. No wildcard
or additional allowance is created. The fixed comparison base remains
bb3f34e4f938096acec897159f0f56283c11697a. These reviewed candidate entries cannot
bootstrap checker authority: they remain mechanically untrusted against that
historical base until normal trusted-branch adoption enables a later legitimate
comparison. This does not leave either site unjustified or change the historical
exit-2 result.

Review verification: `npm run test:quality` passed all **216** tests;
`npm run check` passed all **293** functional tests (including version admission
and external-reasoner scenarios), typecheck, build and package verification
(104 files). Fixed-base quality remains **exit 2** for candidate sites absent
from its trusted manifest and review-required controls; no base or check changed.
The review-only diff contains exactly two inventory reason changes and this
record. Runtime/checker hashes are unchanged. `git diff --check` retains only
historical CRLF findings in prior hardening files; review files are clean.
The version-admission implementation and its two-site review are complete.
Normal trusted-branch adoption remains a repository workflow step, not an
unresolved architecture or implementation defect.
