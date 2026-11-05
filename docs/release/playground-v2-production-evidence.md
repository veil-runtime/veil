# Playground v2 production promotion evidence — 2026-11-05

Status: technical qualification complete subject to promotion PR CI; **production approval pending**. Keep the develop-to-main promotion PR draft until the maintainer decisions below are recorded. No merge, deployment, package publication or protection change is authorized by this record.

## Revisions and change scope

The exact integrated develop commit `01359e1bdb06e2ead2c0a9a584e454d9af7d8743` was confirmed locally and through GitHub before editing. Main and the fixed quality comparison base are `82b671d5e098d8a2df6d9cc431dc0e266788c9f0`. PR #94 feature head `a1a80c83e698168b787ff6c670b7d8a1485b1465` has the same tree as that develop merge.

This follow-up corrects current UI release wording in the shared layout, homepage, developer/ecosystem/UI guides, contributing release/website guides and evaluation page; expands the governance proposals; and adds this record. Accurate historical release records are retained. The complete promotion also includes Playground v2 assets and its browser test from PR #94. No Core runtime/contracts, package manifests, lockfile, workflows, scanner, baseline or allowances change.

GitHub release metadata for UI v0.4.0 reports `draft:false`, `prerelease:false`. npm reports version `0.4.0`, dist-tag `latest:0.4.0`, and integrity `sha512-4+9YuJV7/cc4CnjkP3Y/qMwXX2hBg1KgoxOwC4aI577ZFGqc97w05zq3MSgtU/tB3qaOS3rA5YZVJKuiBtAurw==`. Current website wording now describes a stable release. The unsupported `0.4.0-rc.2` historical statement is removed. This does not claim Core 0.6.0 integration compatibility; UI's optional Core peer remains `^0.4.0`.

## Exact-commit integration verification

Before edits, `npm run check` passed on `01359e1bdb06e2ead2c0a9a584e454d9af7d8743`: typecheck, 455/455 tests, build and 112-file package verification. The documentation verifier's six tests and the Linux filesystem-confinement suite also passed. Logs in this qualification environment: `/tmp/veil-v2-exact-01359e1-check.log` and `/tmp/veil-v2-exact-filesystem.log`.

No hosted workflow run exists for that exact merge SHA. The unchanged CI workflow runs on pull requests and main pushes, with no `workflow_dispatch`; rerunning an older PR run would not target the merge SHA. We did not modify CI or move refs to manufacture that evidence. [PR #94 CI](https://github.com/veil-runtime/veil/actions/runs/42063751395) passed on the identical feature tree, including Linux/macOS/Windows filesystem checks. The local run is Linux evidence, not a replacement for hosted clean installation or all three operating systems.

Reproduce the exact-commit local checks in a separate checkout with Node 24 and the native build prerequisites:

```sh
git clone https://github.com/veil-runtime/veil.git veil-v2-exact-check
cd veil-v2-exact-check
git checkout --detach 01359e1bdb06e2ead2c0a9a584e454d9af7d8743
npm ci
npm run check
python3 tools/verify-documentation.test.py
node --test .tmp/test-build/test/filesystem-confinement.test.js
```

The observed local run used the existing installed dependencies; the commands above add a clean lockfile installation for reproducibility. Promotion PR CI will verify the corrected head and its proposed integration with main. Consult that PR's live checks for the final SHA and results.

## Checks after corrections

- `npm run check`: PASS, 455/455 tests, typecheck/build/package verification. Log: `/tmp/veil-v2-final-promotion-check.log`.
- `npm run quality -- --base 82b671d5e098d8a2df6d9cc431dc0e266788c9f0`: exit **2**, exactly V2-A/B/C remain review-required. No direct dependency or lockfile changes; source/test/harness category LOC deltas zero; no verification-control changes. Log: `/tmp/veil-v2-final-promotion-quality.log`.
- Fresh local Jekyll 4.4.1 build at `/veil`: PASS. Command: `/tmp/veil-jekyll-run build --source docs --destination /tmp/veil-v2-final-promotion-site/veil --disable-disk-cache`. The local wrapper supplies installed Ruby/gem paths; use an equivalent Jekyll installation elsewhere. This is not the hosted Pages action.
- `python3 tools/verify-rendered-documentation.py /tmp/veil-v2-final-promotion-site/veil /veil`: PASS, 90 HTML pages and 13,145 local links/assets/fragments.
- `python3 tools/verify-documentation.py` and `python3 tools/verify-documentation.test.py`: PASS (source baseline is the verifier's existing v0.3.1; six verifier tests). Current rendered landing/UI/ecosystem/developer/release/website/evaluation pages were also checked for stable wording and absence of stale preview/prerelease/candidate claims.
- Served output with `python3 -m http.server 4174 --bind 127.0.0.1 --directory /tmp/veil-v2-final-promotion-site`; ran `PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/tmp/veil-playground-a11y/node_modules/axe-core/axe.min.js node tools/playground-test.mjs`. Installed browser/axe locations are environment-specific. Results are recorded in `/tmp/veil-v2-final-promotion-browser.log`.
- Chromium, Firefox and WebKit all PASS: gallery, form/workflow validation, greeting, invalid-input recovery, reset/copy feedback, HTML escaping, keyboard, forbidden actions, CSP script/network rejection and 1440/390/195px layouts. Axe reports zero violations; color-contrast checks remain incomplete in Chromium and WebKit. Clipboard content readback was checked only in Chromium.
- The rendered bundle matches the committed asset byte-for-byte. Source and bundle were not modified by this follow-up. `git diff --check` passes.

## Remaining maintainer decisions and deployment implications

1. Explicitly accept or request remediation for each of [V2-A, V2-B and V2-C](playground-v2-governance-dispositions.md), recording maintainer identity, date and exact integration scope. None is approved by this proposal, previous PR merge or passing functional checks. No scanner suppression is requested.
2. Review the exact-commit CI limitation and promotion PR CI evidence before changing draft status. Preserve the distinction between observed local Linux verification and hosted multi-platform verification.
3. Disposition the remaining physical Safari/assistive-technology acceptance and any incomplete automated contrast checks. Browser-engine automation does not establish those manual acceptance results.

Main pushes touching docs trigger Pages automatically. Its build configures Pages, runs Jekyll and uploads the artifact; deploy needs build and the main-only github-pages environment branch policy. It does not depend on CI, quality, browser or rendered-link checks. Therefore merging is deployment-triggering and must await the maintainer decisions; leaving this PR draft is deliberate. No deployment was initiated during qualification.
