---
title: Releases
---
# Releases

The current release candidate is **v0.3.0**. Package metadata and package verification
both target `@veil-runtime/core@0.3.0`. v0.2.0 remains the latest published package
until publication; local source and a packed tarball do not establish npm availability.

## Candidate scope

The [v0.3.0 release notes](../getting-started/v0.3.0.html) cover the public delta
from the published v0.2.0 tag at
`bb3f34e4f938096acec897159f0f56283c11697a` through the synchronized develop
checkpoint at `e5aae087ad201369efaf9f28b6b8d03be314b71e`: opt-in ExecutionPlan V2,
structured version admission, exact result-reference recognition, entry and
authorization hardening, conservative HTTP/shell policy, bounded research
evidence, dependency refreshes and starter lock remediation. Historical release
work remains under `docs/release/`, which is excluded from Pages.

The release-only metadata delta is intentionally bounded to the root package and
lock version, the package verifier's expected tarball version, and the starter
lock's linked-root version. The `tools/verify-package.mjs` change from `0.2.0` to
`0.3.0` is an expected verification-control change reviewed as part of this
candidate preparation; its content/exclusion checks are otherwise unchanged.

## Accepted governance baseline

The maintainer accepted Recommendation B for v0.2.0: the 14 reviewed non-legacy
governance findings, two documented pre-existing legacy bypasses, 20 reviewed
verification-control changes, and the experimental checker's limited detection
scope. The reviewed `tools/quality-governance-baseline.json` is adopted unchanged:
16 individual entries, SHA-256
`0e5cee42b3da4528f5fa38239b651f570c3922af61119d0350bc1601332fb40f`.
It already exists in `e4df5be69105e8d2fcb76bd6b9c8e249beec3064`, which is now
the accepted-baseline comparison for final release preparation:

```sh
npm run quality -- --base e4df5be69105e8d2fcb76bd6b9c8e249beec3064
```

This explicit human adoption does not change the fixed release-scope comparison
against `0b591f38b6146179cfea9d66f5bf50a1773520d7`. That comparison has no trusted
baseline and remains exit 2, not a pass. The accepted-base comparison only measures
subsequent changes; it does not retroactively clear the initial-adoption report.
The release verifier's expected-version change from `0.1.3` to `0.2.0` remains
a review-required control change, already included in the accepted review.

At that accepted release baseline, `POST /api/jobs/:id/execute` and
`GET /api/linkedin/status` remained explicitly deferred technical debt.
Subsequent [entry hardening](../architecture/governance-hardening.html) retires
the former and governs the latter, removing their two candidate allowances.
The historical 16-entry adoption above is unchanged. Acceptance does not establish that
every execution path is governed, that every bypass can be detected, or that
legacy debt is resolved. The [checker limitations](quality-harness.html#review-and-limitations)
continue to apply.

## Post-v0.2.0 governance-delta acceptance

On 2026-09-25 the maintainer reviewed the complete quality delta from the
immutable v0.2.0 tag, commit
`bb3f34e4f938096acec897159f0f56283c11697a`, through develop commit
`203c0c29bb1dc68ec8797e0b168b239492cb3323`. This is an acceptance record for
that bounded delta, not a change of comparison base and not a release or version
selection. The candidate governance inventory has 24 exact entries and SHA-256
`59122461a8084c3b55f7999674cdfde72821bf19262d9ff41495f2f84436765f`.

The fixed comparison remains:

```sh
npm run quality -- --base v0.2.0
```

It continues to report review-required controls, 15 candidate sites and seven
retired historical sites because the immutable historical base cannot trust a
later candidate manifest. The candidate manifest does not authorize itself. The
secondary comparison against accepted inventory checkpoint
`991c73fef8fbaedee1c71aa3ee003f8a51f4b1d1` proves no governance/source/test/
harness drift, but cannot replace this historical review.

### Growth and verification-control review

Every source, test and harness growth item reported by the fixed comparison was
reviewed. A “control” disposition also records review of that file as a reported
verification-control change.

| Reported file and delta | Disposition |
| --- | --- |
| `src/api/routes/execution.routes.ts`, +6/-2 | Route failure containment and trusted host caller resolution; behavior is covered by route-governance tests. |
| `src/api/routes/jobs.routes.ts`, +23/-30 | Host runtime/caller wiring and unconditional retirement of stored-job execution; removes rather than adds an execution entrance. |
| `src/api/routes/linkedin.routes.ts`, +35/-5 | Replaces direct capability invocation with a version-pinned runtime plan and governed lifecycle. |
| `src/capabilities/http/request.ts`, +3/-1 | Conservatively classifies the existing multi-method HTTP surface as destructive; no new provider entrance. |
| `src/capabilities/shell/command-run.ts`, +22/-148 | Replaces prefix-style shell admission with canonical exact command/argument tuples; the net reduction is intentional hardening. |
| `src/index.ts`, +3; **control** | Exposes the reviewed admission diagnostic type, issue type and predicate only; no internal registry, issuer or validator is exported. |
| `src/runtime/execution/governed-value.ts`, +216 | ADR-0011 V2 detached governed-value capture and passive descriptor inspection. |
| `src/runtime/execution/plan-admission-error.ts`, +73 | ADR-0012 owner-issued structured admission diagnostics and containment support. |
| `src/runtime/execution/plan-validator.ts`, +16/-1 | Adds stable issue codes and step indexes without weakening plan/input validation. |
| `src/runtime/execution/result-reference.ts`, +10/-2 | ADR-0013 exact own enumerable data-property recognition shared by V1 and V2. |
| `src/runtime/jobs/job-manager.ts`, +99/-21 | Version admission, structured diagnostics, V1/V2 coexistence and ADR-0011 copy-before-start lifecycle; authorization still precedes capability invocation. |
| `src/runtime/operator-runtime.ts`, +25/-5 | Trusted-host `planVersions` admission and diagnostic containment around the same JobManager dispatch. |
| `src/runtime/permissions/command-policy.ts`, +24/-68 | Exact canonical tuple policy replaces permissive prefix matching; no additional execution authority. |
| `test/execution-contract.test.ts`, +1; **control** | Updates the expected structured validator issue with code and step index. |
| `test/execution-routes.test.ts`, +1; **control** | Asserts the public route does not leak internal diagnostic detail. |
| `test/external-model-reasoner.test.ts`, +8; **control** | Offline wrapper for bounded Experiment II scenarios; no product guarantee or live model call. |
| `test/external-reasoner.test.ts`, +47; **control** | Offline subprocess coverage for the experiment runner and its bounded fixtures. |
| `test/fixtures/package-consumer/index.ts`, +10; **control** | Consumer typechecks the new public diagnostic exports. |
| `test/fixtures/package-consumer/verify.mjs`, +3; **control** | Confirms private admission issuer/implementation paths remain unexported. |
| `test/governance-routes.test.ts`, +219; **control** | Covers route admission, authorization, caller provenance, failure containment and retired execution. |
| `test/governed-value-v2.test.ts`, +355; **control** | Covers V2 ownership/isolation, descriptor safety and fail-closed behavior. |
| `test/http-risk.test.ts`, +66; **control** | Covers default denial for every HTTP method and zero provider calls on failed authorization. |
| `test/introspection-mcp.test.ts`, +47/-1; **control** | Adds MCP admission and deny/malformed/throw containment with zero capability starts. |
| `test/plan-admission.test.ts`, +251; **control** | Covers ADR-0012 issuance identity, descriptors, containment and separate-module limits. |
| `test/plan-validator.test.ts`, +9/-8; **control** | Updates expectations for structured issue codes and indexed steps. |
| `test/plan-version.test.ts`, +94; **control** | Covers explicit V2 host opt-in, V1 default behavior and unsupported-version rejection. |
| `test/result-reference.test.ts`, +131/-1; **control** | Covers ADR-0013 exact reference recognition and rejection of accessor/non-enumerable/extra-key lookalikes. |
| `test/shell-command.test.ts`, +225; **control** | Covers exact argument boundaries, bypass regressions, canonical invocation and conservative risk. |
| `test/structural-ownership.test.ts`, +2/-1; **control** | Updates the version-field ownership assertion now that admission consumes version once. |
| `test/value-ownership.test.ts`, +365; **control** | Characterizes V1 compatibility and V2 authorization/capability input isolation. |
| `tools/quality-governance.mjs`, +19/-2; **control** | Strengthens route checks: route capability/provider imports cannot be allowlisted and route execution references cannot inherit historical allowances. |
| `tools/quality-governance.test.mjs`, +46/-7; **control** | Regression coverage for the stricter route rules and exact 24-site/no-legacy inventory. |

The remaining reported control, `tools/quality-governance-baseline.json`, was
reviewed entry by entry. It removes both route bypasses, reconciles five moved
machinery anchors, and adds only the individually classified descriptor,
admission-test and experiment sites below. Its rule scope and classification
vocabulary are unchanged. The informational `@babel/parser` 8.0.5 to 8.0.6
development-only update and root lockfile change add no runtime dependency or
governance authority.

The aggregate growth (+272 source, +1,823 test and +56 harness physical lines)
is therefore explained by the reviewed V2/admission implementation, route and
command hardening, bounded research fixtures, and substantially larger negative
and lifecycle coverage. No generated code or unexplained execution surface is
included.

### Candidate governance-site review

Each of the 15 sites untrusted by the immutable v0.2.0 comparison was inspected
individually:

| Site | Classification and acceptance rationale |
| --- | --- |
| `plan-validator.ts:56` | **Governed machinery.** Existing `TYPE_CHECKS` predicate lookup; issue metadata/import movement changes its anchor, not dispatch or authority. |
| `result-reference.ts:18` | **Governed machinery.** Passive own `$ref` descriptor inspection required by ADR-0013; it invokes no getter or capability. |
| `job-manager.ts:104` | **Governed machinery.** Existing internal `this.execute` handoff after admission; the V2 lifecycle edit moved the enclosing anchor. |
| `job-manager.ts:312` | **Governed machinery.** The sole capability invocation remains behind resolved validation and explicit authorization; V2 supplies the detached copy. |
| `operator-runtime.ts:124` | **Governed machinery.** Same JobManager admission dispatch with a copied trusted-host version allowlist and diagnostic containment. |
| `operator-runtime.ts:170` | **Legitimate non-capability execution.** A strategy produces an ExecutionPlan and then delegates to `executePlan`; it cannot perform capability work. |
| `governed-value.ts:85` | **Governed machinery.** Passive own array-length descriptor inspection; no accessor, iteration, coercion or dispatch. |
| `governed-value.ts:99` | **Governed machinery.** Passive own data-descriptor inspection and value copy; accessors are rejected. |
| `plan-admission.test.ts:78` | **Test/fixture machinery.** Inspects fixed diagnostic property descriptors to verify their flags. |
| `plan-admission.test.ts:104` | **Test/fixture machinery.** Builds a local Error lookalike to prove public shape does not confer issuance identity. |
| `plan-admission.test.ts:113` | **Test/fixture machinery.** Resolves one fixed local diagnostic module for a separate-instance regression. |
| `plan-admission.test.ts:116` | **Test/fixture machinery.** Reloads that fixed module and restores the test-process cache in `finally`. |
| `model-adapter.mjs:30` | **Test/fixture machinery.** Experiment II reads a response metadata field selected only from a fixed string-key allowlist; model text cannot select an executable target. |
| `model-adapter.mjs:33` | **Test/fixture machinery.** Experiment II reads bounded token/latency keys selected only from a fixed allowlist and accepts only finite non-negative numbers; no Veil execution entrance. |
| `run.mjs:28` | **Test/fixture machinery.** Experiment II writes an allowlisted CLI option into a local options record; the experiment owns no runtime authority. |

The experiment entries are accepted only as bounded research/fixture machinery.
They do not establish model safety, a security proof, or shipped runtime behavior.
The descriptor sites retain the documented Proxy/host-JavaScript limitations;
their classification is not a sandbox claim.

### Retired-site review

All seven historical anchors reported as retired were also reconciled:

| Retired v0.2.0 site | Disposition |
| --- | --- |
| `jobs.routes.ts`, anchor `858ad85b…` | **Retired/replaced.** The stored-job execution route is now unconditional 410 and performs no lookup or execution. |
| `linkedin.routes.ts`, anchor `01bd3bcf…` | **Retired/replaced.** Direct capability execution was replaced by a runtime-submitted plan. |
| `plan-validator.ts`, anchor `d8937f3f…` | **Retired/replaced anchor.** Same governed predicate machinery, reconciled to the reviewed current anchor. |
| `job-manager.ts`, anchor `13fce248…` | **Retired/replaced anchor.** Same internal JobManager handoff, moved by admission/V2 lifecycle work. |
| `job-manager.ts`, anchor `31a7754a…` | **Retired/replaced anchor.** Same authorized capability invocation, moved by enclosing-class changes. |
| `operator-runtime.ts`, anchor `6bfbeefd…` | **Retired/replaced anchor.** Same runtime-to-JobManager admission path with version configuration and containment. |
| `operator-runtime.ts`, anchor `2d0d6f2…` | **Retired/replaced anchor.** Same non-capability strategy execution, moved by adjacent runtime changes. |

The result is accepted as a legitimate post-v0.2.0 governance delta: no route
allowance or legacy bypass remains, no candidate entry is a blanket file
allowance, and no unresolved governance site remains. This acceptance is bounded
to the exact reviewed anchors and does not weaken the checker, establish a full
call graph, or imply that trusted host JavaScript and ambient process effects are
sandboxed. The detailed ADR-0011, ADR-0012, ADR-0013, route-hardening and
Experiment II records remain the controlling scope and non-guarantee statements.

## Release preparation

- Keep package and root lockfile versions aligned with the package verifier.
- Run `npm run check` (typecheck, tests, build, and packed consumer verification).
- Run `npm run test:quality` and `npm run quality -- --base <commit>` against the
  recorded comparison base. Review governance and verification-control findings;
  do not change the base or relax checks to obtain a pass.
- Verify public API examples against the locally packed candidate. Keep package
  version, capability version, and ExecutionPlan format distinct.
- Build the Jekyll site, validate internal links and fragments, and run
  `git diff --check`. Keep navigation and release-note links on built routes.
- Review the final diff and verification results with the maintainer before committing.

Release preparation does not publish, tag, push, merge, or create a GitHub release.

## After an authorized publication

Verify the published npm package and rerun consumer examples against it before
changing the latest-published version from v0.2.0 to v0.3.0 and removing candidate
labels in the README, homepage, docs layout, developer portal, installation page,
and release notes. Add release announcement links only when their targets exist.
Publishing and these follow-up changes are separate from candidate preparation.
