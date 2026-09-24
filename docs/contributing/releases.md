---
title: Releases
---
# Releases

The current release candidate is **v0.2.0**. Package metadata and package verification
both target `@veil-runtime/core@0.2.0`. v0.1.3 remains the latest published package
until publication; local source and a packed tarball do not establish npm availability.

## Candidate scope

The [v0.2.0 release notes](../getting-started/v0.2.0.html) cover changes present
between `main` at `0b591f38b6146179cfea9d66f5bf50a1773520d7` and `develop` at
`e4df5be69105e8d2fcb76bd6b9c8e249beec3064`: capability introspection,
runtime/governance hardening, the local quality harness, and the website/docs refresh.
The earlier v0.1.4 target was reassigned to v0.2.0; no v0.1.4 release is implied.
Historical release work remains under `docs/release/`, which is excluded from Pages.

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
changing candidate labels and latest-published text in the README, homepage,
docs layout, developer portal, installation page, and release notes. Add release
announcement links only when their targets exist. Publishing and these follow-up
changes are separate from candidate preparation.
