# Playground v2 final qualification — 2026-11-05

Decision: **MERGE / DEPLOY NO-GO**. Browser and functional gates pass; governance dispositions and PR CI evidence remain outstanding. No merge or deployment performed.

## Artifact and governance evidence

Head inspected: f8d0258; comparison base: fc45d40 (branch parent/main merge). Published UI 0.4.0 tarball SHA-256: `783459ed25fbc5485a84b2668166b415cf1daddeeb861f2aacd53465c8da460f`. Rebundling source.mjs against extracted published dist/dom.js and dist/interface.js with esbuild produced a byte-identical playground.js (`cmp` passed). All three findings originate in that distribution.

| Bundle site | Published site | Untrusted JSON reachability | Classification |
| --- | --- | --- | --- |
| playground.js:47 | validation-safety.js:49 | Every definition reaches own-property descriptor inspection. JSON.parse cannot create accessors, functions or proxies. Reserved keys, accessors and traversal excess are rejected. | Defensive validation, security-relevant protection; no capability execution or identified exploitable path. Retain it. Trusted JS proxies remain outside this integration's ingress. |
| playground.js:761 | dom.js:314 | Custom factory branch is unavailable to accepted playground descriptors: no components registry is supplied; schema admits built-ins only. | Trusted extension dispatch, potentially executable in other hosts; unreachable here. Recommend narrow integration-specific acceptance only. |
| playground.js:869 | dom.js:412 | Field descriptors select an own validation error by node.key. interface.js:482–517 constructs error strings from fixed validation rules; DOM writes the result with textContent. | Passive data lookup misidentified as executable extraction; reachable but no executable value, HTML interpretation or capability dispatch. Recommend exact-site acceptance. |

These are technical classifications and recommended dispositions, not maintainer approvals. Existing 0.3.0 proposals do not constitute approval for 0.4.0. No scanner rules, baselines, allowances, package files or runtime code changed. Quality remains exit 2 with three review-required findings. Against fc45d40: source/test/harness category LOC deltas zero; direct dependencies and lockfile unchanged; no verification-control changes. Website/browser-harness files are outside those LOC categories.

## Browser investigation

The original complete suite passed Chromium and Firefox, then WebKit timed out after 30 seconds waiting for Hello Amina at tools/playground-test.mjs:19. The minimal greeting test filled the field and immediately clicked, unlike the form/workflow tests, which explicitly blur and await inspected state.

The sole test change blurs the greeting input and waits until inspection contains Amina before the existing real pointer click. The complete three-engine suite then passed, including WebKit's greeting, gallery, validation/recovery, reset, copy feedback, escaping, keyboard, CSP probes, action rejection and 1440/390/195-pixel layouts. No synthetic click, retry, longer timeout or runtime workaround was added. This supports a test synchronization diagnosis for UI 0.4.0; it does not retrospectively resolve all 0.3.0 pointer observations or prove physical Safari input behavior. Logs: /tmp/v2-browser.log and /tmp/v2-browser-sync.log. Screenshots: /tmp/veil-playground-{chromium,firefox,webkit}-{1440,390,195}.png.

## Functional, website and CI gates

- npm run check passed: 455/455 tests, typecheck, build and 112-file package verification. Initial sandbox run failed tests including filesystem-confinement and local-planner; unrestricted rerun passed. Log: /tmp/v2-final-check.log.
- Source documentation validator: 288 links/routes/fragments passed. Rendered validator: 90 pages and 13,145 local targets passed at /veil using existing /tmp/veil-v2-site/veil output; its bundle matches current source. No fresh Jekyll build was performed in this qualification.
- Existing theme/layout retained: shared layout changes only version labels; original playground CSS retained with additive v2 rules. No public-route removal. CSP is unchanged and script/network blocking probes pass in all engines. JSON ingress retains both character and UTF-8 32 KiB caps; built-in tree depth 16/node count 512 and data limits remain. Only demo is allowed; no custom factories, backend or external actions. Inspection/history limits remain 16,000 characters/20 entries.
- GitHub authenticated queries: `gh pr view` reports no PR for feature/developer-playground-v2; `gh pr list --state all --head feature/developer-playground-v2` returns []; `gh run list --branch feature/developer-playground-v2 --limit 5` returns no runs. Thus no current PR CI results exist to verify and no branch-introduced CI failure can be identified. Push alone does not trigger CI on this feature branch: ci.yml runs on pull_request or main pushes.
- pages.yml automatically runs on main pushes changing docs/** or itself. This branch changes docs, so merging to main triggers Pages build and deployment, subject to successful jobs and any GitHub environment protections. It does not depend on the CI workflow. Treat merge as deployment-triggering.

Remaining gates: maintainer dispositions for all three exact 0.4.0 findings; create/locate PR and obtain passing CI on final committed test change; follow existing manual Safari acceptance policy or explicitly disposition that limitation. Manual Safari, assistive technology and axe were not run here (AXE_PATH unset). Clipboard content was read back in Chromium only. No Core compatibility or arbitrary-JavaScript sandbox claim is made.

Files changed during final qualification: tools/playground-test.mjs and this report only.

Final post-edit check initially passed 454/455 and failed `execution-integration.test.js:178`, “1.0: cleanup failure preserves execution failure and releases capacity”: actual `Execution deadline exceeded`, expected `primary execution failure`. Earlier full check passed 455/455; Core test/source files are unchanged by this branch. This is a local deadline-sensitive failure, not evidence of a branch-introduced CI failure. An unchanged full rerun was requested; see /tmp/v2-final-check-retry.log. The first successful check log was overwritten by the post-edit attempt; its result was observed during qualification.

Unchanged final retry: PASS, exit 0, 455/455 tests plus typecheck/build/package verification. The intermittent deadline failure remains recorded as a qualification limitation; no retry logic or timeout changes were introduced.

## Integration preparation

Remote develop verified at fc45d40abf99a624244c17e101aae9de12f1e83c, the existing comparison base. Dependabot targets develop and open dependency PRs use it; the maintainer explicitly selected it for this integration. Only docs/assets and tools/playground-test.mjs differ from that base; no src, test, package, lockfile or workflow changes. Pages triggers only on main docs/workflow pushes or manual dispatch, not develop pushes or pull requests. Draft PR preparation is authorized; merge/deploy is not. See [formal UI 0.4.0 dispositions](playground-v2-governance-dispositions.md); all three await explicit maintainer approval, with governance controls preserved. The earlier no-PR observation above describes qualification time, before integration preparation.
