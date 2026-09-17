# ADR-0008: Runtime Structural Execution Ownership

**Status:** Accepted (explicit maintainer architecture decision)

**Date:** 2026-09-17

## Context

Validation previously read caller-owned steps and materialization reread them
across asynchronous job creation. Caller mutation could therefore change the
structure of execution after admission. The architecture remains locked at
`v0.1.0-arch-lock` except for this explicitly authorized semantic boundary.

## Decision

Before admission, Veil captures a runtime-owned structural execution envelope.
Admission and job materialization operate exclusively on that captured envelope.
Ownership begins synchronously at the beginning of JobManager.executePlan,
before the empty-plan check, validation, job creation and any await.

Capture goal and plan idempotencyKey, an independent steps array preserving
membership/order/holes, and a shallow record for each present step containing
id, capability, capabilityVersion, input root binding, reason and idempotencyKey.
Do not newly consume plan id or metadata. Caller structural mutations after
capture cannot alter execution. Named fields are read once before validation.

Nested input contents intentionally remain shared, including nested arrays,
objects and mutable reference objects. This is not immutable-plan or
immutable-input semantics, and does not stabilize exact validated input values.
Result ownership, reference identity and mutability remain unchanged.
Stored-job execution and replay are outside this decision.

## Consequences and compatibility

Ordinary valid plans retain behavior. Post-capture structural mutation ceases to
redirect execution. Named reads retain inherited/non-enumerable consumed fields
that validation previously read but materialization's spread dropped. Extra step
properties are no longer copied; absent optional fields may become own undefined
properties. Capture may invoke getters/proxy traps earlier, including goal/key
accessors on invalid plans. Throwing accessors reject before execution effects.
Frozen/sealed/null-prototype objects need no mutation; holes remain invalid rather
than being compacted. Getter/proxy side effects during capture are not isolated:
this is not a hostile-JavaScript sandbox or an atomic snapshot guarantee.

No deep copying, freezing, serialization or input sanitization is introduced.
Authorization-to-invocation mutation, registry mutation, persistence transactions,
reference grammar, cancellation and observer mutation are not addressed.

## Fixed-base implementation review

Comparison base: current local develop at
`968b060dc0d984115220b0219e9acc0a29e73c89`. The base stays fixed throughout review.

Exactly two protected constructs changed anchor identity because their enclosing
JobManager declaration changed:

| Construct | Previous anchor | Replacement anchor |
| --- | --- | --- |
| executePlan's `this.execute(job.id, caller, authorizer)` delegation | `5f3f1b0494184d690be3485b53673dd261ef66e52115a63f9dcc8a03dcc5b06a` | `13fce248843444d387420b751d6e621dc142722e6d02bd588fe58b8ff5710ba5` |
| execute's `capability.execute(resolvedInput, context)` invocation | `d676503342a50af035e6bdc0ac631b88457ffee675928a52ec87e431a02ac23d` | `31a7754a040e7469f1201d936db763818a90e448d07e25b4b6b1179bcbac52a9` |

Both are source-anchor drift, not new execution entrances or changed dispatch
policy. Exact source comparison against the fixed base confirms the delegation
expression is unchanged and every method from create onward (including the full
execute method, input resolution, authorization, dispatch and result assignment)
is byte-for-byte unchanged. The authorized admission ownership change is confined
to executePlan. Only these two candidate anchors were replaced; classifications,
reasons, other entries and verification controls were not relaxed.

Fixed-base quality exits 1, review required: the new structural-ownership tests
and the baseline file changed; the two replacement anchors lack trusted-base
allowances and the old anchors are reported retired. This is expected under the
existing reconciliation process: candidate entries cannot authorize themselves.
The maintainer must review/adopt the replacements through the trusted branch.
No base switch or unrelated allowance regeneration was used. Deltas: source
+24/-6 (net +18 LOC), tests +338 LOC, harness code unchanged; no dependency or
lockfile changes.

Verification: focused structural/execution, existing plan-validator and
result-reference suites pass, including the new SQLite materialization/reload
regression. `npm run check` passes (typecheck, tests, package verification),
`npm run test:quality` passes all 206 tests, and `git diff --check` passes.
Sandbox attempts initially failed at package JSON parsing (empty subprocess
output) and quality Git subprocesses (`spawnSync git EPERM`); authorized reruns
outside the sandbox passed without changing controls.

A fresh adversarial review checked single reads of plan.steps and each consumed
step field, input-getter mutation during validation, pending asynchronous job
creation, sparse membership, ordinary-plan compatibility and rejection before
job/persistence/event/authorization/capability effects. The implementation has no
copy/freeze operation on nested inputs and makes no result-ownership changes.
Capture-time getter/trap side effects and subsequent nested-input/reference
mutation remain the explicit limits; stored-job execution is unchanged.
