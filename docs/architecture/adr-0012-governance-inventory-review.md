---
title: ADR-0012 governance inventory review
---
# ADR-0012 governance inventory review

Disposition: **all nine sites approved individually** under the maintainer's
instruction to review and reconcile the Accepted ADR-0012 implementation.
No runtime violation was found. No runtime, test, parser, classification rule,
comparison base or package version changes are part of this review.

Fixed comparison base: `bb3f34e4f938096acec897159f0f56283c11697a`.
The full exact anchors are retained in
`tools/quality-governance-baseline.json`; prefixes below identify them uniquely.
This review authorizes only these exact sites, not their files or future edits.

## Changed machinery anchors

| ID / site / anchor transition | Exact change and ADR justification | Governance review and disposition |
| --- | --- | --- |
| M1: plan-validator.ts:56, TYPE_CHECKS lookup; d8937f3f → 56e72b01 | Added source issue codes in validateInput and a type import; validatePlan also adds captured step indexes. The existing predicate lookup/call is unchanged. The normalized enclosing declaration and its top-level position change the anchor. ADR implementation item 2 requires source metadata without changing validation rules. | **Approve**, GOVERNED_MACHINERY. It selects the existing schema predicate, not a capability/provider. No new dispatch, caller authority, registry mutation or policy exception. |
| M2: job-manager.ts:89, this.execute; 13fce248 → c4619c7c | Added internal admissionOwner and replaced only empty-plan/invalid-validation Error construction with the issuer. The existing delegation is unchanged; the enclosing JobManager class changes its anchor. ADR item 3 requires these two issuance sites. | **Approve**, GOVERNED_MACHINERY. Delegation remains after validation and Job creation. Caller/authorizer are still forwarded; execution still performs resolved validation and explicit authorization before invocation. No additional entrance/provider/registry path. |
| M3: job-manager.ts:276, capability.execute; 31a7754a → 49986990 | The capability invocation and authorization block have no ADR-0012 code change. M2's admission edits alter their shared enclosing class anchor. Reconciliation is required by the exact-statement anchor mechanism, not a new execution requirement. | **Approve**, GOVERNED_MACHINERY. Reviewed the unchanged surrounding gate: malformed decisions and explicit denial prevent invocation; resolved input is validated and authorized. No new bypass or exception. |
| M4: operator-runtime.ts:112, jobManager.executePlan; 6bfbeefd → 815c4aa9 | Creates a private owner before caller projection; awaits the same JobManager path inside try/catch; contains foreign diagnostics. ADR's selected mechanism requires both owner propagation and synchronous/asynchronous rejection containment. | **Approve**, GOVERNED_MACHINERY. Same trusted caller and authorizer reach admission; the owner stays internal. Containment wraps foreign evidence without invoking, authorizing, registering or retrying anything. |
| M5: operator-runtime.ts:157, strategy.execute; 2d0d6f2f → 0c724365 | Strategy invocation is unchanged. M4's adjacent executePlan edit and import change the enclosing OperatorRuntime class anchor. ADR requires the executePlan edit, not a new planner behavior. | **Approve**, LEGITIMATE_NON_CAPABILITY_EXECUTE. Strategy returns a plan; run still submits via this.executePlan. No direct capability/provider access or registry mutation is added. Planner activity remains outside the direct-call admission certainty claim. |

The source diff changes no authorization logic, provider implementation or
registration function. Existing ambient-process and pre-admission getter caveats
remain; this review is not a complete call-graph security proof.

## Reflective test sites

All four sites are in `test/plan-admission.test.ts`, outside the production
`src/index.ts` build graph. Tests run in a separate test process; none is imported
by production code or exposes a runtime API. Internal access is deliberate test
instrumentation, not a supported application entry point.

| ID / line / anchor | Observed behavior and necessity | Scope and disposition |
| --- | --- | --- |
| T1 / 78 / 0187fa2f | Object.getOwnPropertyDescriptor(error, key), with key drawn only from code/issues, inspects writable/configurable/enumerable flags. Value equality cannot prove those approved descriptor requirements. | **Approve**, TEST_OR_FIXTURE. Reads the local test Error's descriptors; no executable extraction or dispatch. |
| T2 / 104 / b66fcc08 | Object.getOwnPropertyDescriptors(error) constructs a prototype/descriptor-identical lookalike. The regression proves copied public shape is insufficient for private issuance classification. | **Approve**, TEST_OR_FIXTURE. Copies only a local diagnostic into a negative fixture; neither copies the WeakMap nor changes the genuine error or production state. |
| T3 / 113 / e5a2f8f0 | require.resolve of the literal ../src/runtime/execution/plan-admission-error.js finds the precise compiled module cache key. Needed with T4 to test the documented separate-loaded-instance limitation rather than merely a JSON clone. | **Approve**, TEST_OR_FIXTURE. Fixed local diagnostic path, no user-controlled import, registry or provider loading. |
| T4 / 116 / 9a74dee9 | After removing only that cache entry, require(path) obtains a new module-private WeakMap; its predicate must reject the original error. The original cache entry is restored in finally. | **Approve**, TEST_OR_FIXTURE. Mutates only the test-process module cache. This is not a hostile-module isolation claim; the ADR explicitly excludes such access. No production process/cache is touched. |

## Inventory reconciliation and trust semantics

The implementation had already replaced the five old anchors and added these
four exact test sites. This review changes **only the nine reason strings** to
record their individual approvals and rationale. All paths, anchor hashes, kinds,
classifications and the other nine entries are unchanged. There are 18 entries:
six governed machinery, one legitimate non-capability execution, eleven tests or
fixtures. There are no route allowances, legacy bypass entries or wildcards.

This uses the existing reviewed inventory mechanism: explicit per-site reasons
and exact anchors, with a recorded review. It does not invent a review-file trust
channel. Under checkGovernance, only the manifest in the fixed Git comparison
base grants machine allowances. Consequently **all nine reviewed changes remain
untrusted by that historical comparison**; candidate approval cannot bootstrap
checker authority. The fixed-base exit 2 remains correct. The manifest must be
adopted into the trusted branch through normal review before a later legitimate
comparison can use it. No commit, merge or base substitution is performed here.

The previously retired two route sites remain absent from the candidate inventory.
The comparison still reports their retirement because they exist in the old base;
this does not restore or approve them. No other candidate allowances are added.

## Verification

- Fixed-base quality comparison: **exit 2**, exactly the nine unmatched sites
  reviewed above; old anchors and the two previously removed route sites appear
  as retired. Verification-control changes across the broader working tree also
  remain review-required; this narrow review does not approve unrelated changes.
- `npm run test:quality`: **216 passed**, including exact 18-site inventory matching
  and zero route/legacy allowances.
- `npm run check`: **278 functional tests passed**, plus typecheck, build and
  packed consumer verification (104 package files).
- Explicit admission/external-reasoner test run: **24 passed** (21 admission and
  3 experiment tests). All bounded-reasoner scenarios retain their behavior.
- Reviewed current source diffs against the fixed base and the review-only diff
  against the captured pre-review inventory. Exactly nine reason strings changed;
  all 18 path/anchor/kind/classification tuples are identical. Runtime, test and
  checker hashes are unchanged from review start.
- `git diff --check`: historical CRLF findings remain in earlier hardening source
  files. This review's inventory/documentation files have no whitespace findings.

Review complete: none of the nine sites is rejected or left unjustified. They are
approved in the reviewed candidate inventory, but all nine remain mechanically
untrusted against the immutable historical base. The next step is normal
trusted-branch adoption of the reviewed inventory and its matching implementation;
the fixed-base result remains part of that record, not a green gate.
