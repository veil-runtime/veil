# Interactive Showcase & Integration Lab — Phase 1

Audit date: 2026-11-06. Status: audit complete; implementation proposed, not delivered.

## Baseline and boundaries

- Public repository: this checkout, `veil-runtime/veil`. Dedicated branch: `feature/ui-showcase-integration-lab`, from `64f4720a715fef4a59e5561cd52b9d4378de6a65`. Use this fixed commit for implementation quality comparisons.
- GitHub HTTPS metadata confirms develop at that commit and main at `7d0c043fb2a043dd840bde970d520ca171e98233`. SSH branch lookup failed with `Permission denied (publickey)`; HTTPS succeeded.
- Private UI repository inspected read-only. Its existing `data/operator.db` modification was left untouched. No private source is copied into this report or the public site.
- No Core contracts, UI runtime package, publication controls, or deployment controls changed. This report is under `docs/release`, excluded by Jekyll.

## Website findings

`docs/_config.yml` sets the GitHub Pages base path to `/veil`. The homepage is standalone HTML; developer documentation uses `docs/_layouts/docs.html`, `docs/_includes/docs-navigation.html`, `docs/_data/navigation.yml` and `docs/assets/docs.css`. The playground is another standalone page with its own CSS.

`.github/workflows/pages.yml` builds `docs` with `actions/jekyll-build-pages`, uploads `_site`, and deploys to Pages. Main pushes affecting docs or that workflow trigger deployment; manual dispatch also exists. The deployment job depends on the build, not functional, browser, security or quality checks. CI separately runs `npm run check`, documentation verifier tests, and a filesystem-security matrix. Do not equate a successful local build with hosted Pages qualification.

The live playground HTML still identifies **0.4.0**. Its downloaded bundle matches the checked-in `docs/assets/playground/playground.js` byte-for-byte (SHA-256 `ab7befca7d2f1227320367254a24daa5ad668178084c310305dbc4075c4d4612`). `source.mjs` imports the real package's `/dom` and `/interface` exports; its provenance README documents esbuild 0.28.2 and the published 0.4.0 package. This is an actual runtime bundle, not a substitute renderer. Jekyll serves prebuilt assets and has no Node bundling step.

Existing examples: greeting, contact form, service dashboard, conditional review workflow, and static AI descriptor. Preserve JSON editing, render/reset/copy, width selection, inspection, bounded action/error history, validation, keyboard behavior and rejected-candidate recovery. There is no dedicated showcase, actual host-source viewer, agent lifecycle simulator or backend integration lab. The displayed integration snippet is generic rather than the gallery's complete host implementation.

Current UI guide, homepage and other documentation contain private-repository destinations and 0.4.0 installation/status claims. Replace current public destinations with local guides and npm links; keep accurate historical release evidence. The site uses dark surfaces and blue/teal accents; extend its existing design rather than introduce a new application framework.

## Published package audit

Downloaded npm 0.4.1 metadata and tarball; SHA-512 matches registry integrity. Tarball SHA-256: `4c350df4cc767128583bb16627822da3ba43c8279817762597dd88394312f4f7`.

Exports: `.`, `/interface`, `/dom`, `/composition`, `/inspection`. Package is ESM, declares Node >=24, Zod dependency, and optional Core peer `^0.4.0`. The universal interface controller executed directly from the unpacked artifact without Core installed there. Browser bundling should use `/interface` and `/dom`, not the broader root graph. Do not claim Core 0.6.0 compatibility from independent UI operation.

Public universal exports include `defineInterface`, `validateInterfaceDefinition`, `createInterfaceController`, `getInterfaceCapabilities`, `getInterfaceValidation`, `resolveInterfaceBinding`, `evaluateInterfaceCondition`, and `isInterfaceField`. DOM exports include `createMountedInterface`, `mountInterface`, and the separate composition adapter `mountComposedApplication`. `/inspection` describes composition inspection; universal-interface inspection uses `snapshot()` and `getInterfaceValidation()`.

Descriptors contain `id`, `screen`, optional declared actions, state and data. Nodes have stable keys. Built-ins are **Stack, Row, Text, Heading, Status, Input, Textarea, Select, Button, Table, List**. Inputs support text, number and checkbox. Fields bind state; display bindings read state or host data. Conditions include equality, numeric comparisons and all/any/not; visible-field validation and conditional disabling are available.

Controller: `snapshot`, `updateData`, `updateDefinition`, `setState`, `dispatch`, `subscribe`, `dispose`. Events contain action, source, state and revision. Data/definition updates optionally compare an expected revision and return false for stale/disposed updates. Definition changes can retain compatible state. Reset therefore needs explicit disposal/recreation where a completely fresh experiment is intended.

Transactions prepare render candidates before acceptance. Preparation failure preserves accepted state; a commit failure cannot guarantee rollback of already changed DOM or external effects. Internal renderer transaction machinery is not an application integration API. Keyed DOM reconciliation preserves compatible focus/selection; custom factories are trusted host JavaScript, not arbitrary code accepted from descriptors.

Limits observed from the artifact: depth 16, 512 nodes, text length 4096, 100 table rows, 20 columns, 100 list items, 1 MiB transport-data limit. These do not replace raw-byte limits before JSON parsing. Retain the playground's stricter 32 KiB descriptor input limit.

## Capability matrix

| Experience | Existing UI responsibilities | Required host implementation |
| --- | --- | --- |
| Agent monitor | Status, tables/lists, state/data bindings, allowed button events, conditional controls | Deterministic scheduler, lifecycle, progress calculation, tool records, retry and approval state machine; cancellation and cleanup |
| LLM-to-UI | Descriptor validation, built-in vocabulary discovery, mounting and events | Authored prompt/output pairs, byte limits, policy allowlist, safe action handlers; no live model initially |
| Backend lab | Inputs, visible-field validation, loading/result display, revision checks | Transport adapter, response bounds/schema checks, AbortController, request identity, edit/reset invalidation, authentication/authorization and side effects |
| Operations console | Health/status display, history tables, diagnostics and controls | Deterministic telemetry and operation simulation; explicit confirmation and operation policy |
| Adaptive workflow | Definition replacement, compatible state retention, validation, conditions | Step progression, review model, final confirmation, cancellation and export |
| Playground | Existing real rendering, inspection, event dispatch and validation | Discovery, error explanations, reset/export, actual source display and navigation |

No built-in agent runner, LLM client, HTTP client, authorization service, chart, progress-bar or streaming transport was found in the universal component contract. Use built-in text/status/table representations initially. A trusted custom visual component can be added later only with an explicit teaching purpose and its actual implementation visible.

## Backend reference and trust boundaries

The private package's `examples/backend/integration.mjs` implements request supersession, aborts, request identity, invalidation on edits, revision capture after loading, stale-result rejection and disposal. `app.mjs` connects event handling to fetch; `server.mjs` provides a local, unauthenticated search service with an intentional failure case. These are host application features, independently usable without Core.

The reference bounds queries and result strings but calls `response.json()` without bounding response bytes first. Our new public host adapter should bound raw response bytes before parsing as well as validate the parsed shape. Implement the pattern afresh against published APIs: the backend example is excluded from the npm package and must not simply be copied out of the private repository. No production identity or authorization implementation is demonstrated by that demo server.

The existing playground has `connect-src 'none'`, no arbitrary JavaScript editor, no custom components, host action allowlisting, textContent rendering, bounded histories and input limits. Keep edited descriptors untrusted: they cannot choose endpoint URLs, headers, credentials, action policy or host code. A button's visibility/validation is not authorization.

## Proposed architecture and implementation sequence

1. **Shared shell and reproducible assets.** Add `docs/showcase/index.html`, small browser modules under `docs/assets/showcase/`, and a pinned isolated showcase build manifest/lockfile under `tools/showcase/`. Bundle npm UI 0.4.1 locally, preserve its license/NOTICE and record integrity. Keep tooling outside the Core package dependency graph. Use Jekyll `relative_url` for all site entry/assets. Preserve `/playground/` and its existing controls.
2. **One complete agent monitor.** Implement deterministic start/step/pause, tool failure/retry, approval/deny, completion and reset with bounded logs. Mark it as simulation throughout. Use the real UI mount/controller for its interface. Add host state-machine tests and browser tests before expanding.
3. **Verify the learning model.** Every example has Live Experience, Interface Definition, Host Integration and How It Works. Display the current accepted descriptor separately from the editable candidate. Generate source-display assets from the exact authored host modules during bundling, with source-drift checks; show supporting transport modules too. No hand-maintained illustrative duplicate snippets. Applying a descriptor validates it and retains the last accepted preview on preparation errors; reset/example switching cancels host work and disposes mounts. Export descriptor plus useful integration source/instructions without serializing secrets.
4. **Backend integration lab.** Start with a deterministic in-browser service adapter supporting controllable delay, failure, retry, overlap and cancellation. Label it local simulation. Add real same-origin GET of a public static JSON fixture as a clearly separate network mode; it demonstrates retrieval only, not authenticated backend writes. A separately runnable new public local server can demonstrate the full HTTP contract without implying GitHub Pages hosts a backend. Keep a fixed endpoint allowlist and bounded response parsing. Set only the showcase CSP to the minimum required same-origin connectivity; retain playground network blocking.
5. **Remaining experiences.** Add authored LLM prompt/output pairs with schema and policy rejection demonstrations; deterministic operations health/history/diagnostics with controlled actions; dynamic intake/review/confirmation workflow. Each reuses the four-perspective shell and exposes actual host source. No API keys, live model claims or unrestricted remote destinations.
6. **Website integration.** Update `docs/index.html`, `docs/developer.md`, `docs/ui.md`, `docs/ecosystem.md`, navigation data and shared layout as needed. Add Showcase entry points and a minimal-to-advanced learning path, public integration guidance, npm links and accurate independent-UI compatibility. Upgrade the preserved playground bundle to 0.4.1 with a regression run. Inventory current private links before changing them.
7. **Qualification.** Run package-level smoke checks against the published artifact; deterministic host tests; Chromium/Firefox/WebKit tests for every example, editing, actions, loading/failure/retry/cancellation/stale responses and teardown. Exercise malformed/oversized/prototype-key/action-escalation inputs, HTML injection, response bounds and rejected-descriptor recovery. Check keyboard/focus, live status, contrast and mobile/desktop layout. Build Jekyll at `/veil`, run rendered link verification, scan output for private URLs/credentials/private imports, run `npm run check` and `npm run quality -- --base 64f4720a715fef4a59e5561cd52b9d4378de6a65`. Review all quality findings without weakening controls. No push, merge, public deploy or package publication is authorized.

## Executed Phase 1 validation

- Published tarball integrity and direct `/interface` smoke execution: PASS for descriptor validation, event dispatch, accepted update and stale-revision rejection. This is not a full 0.4.1 browser qualification.
- Private repository read-only worker: `node --import tsx --test --test-isolation=none packages/ui/test/backend-integration.test.mjs packages/ui/test/security-regressions.test.ts`: 16 passed. Backend HTTP browser test inspected but not run; the package's default browser command omits that test.
- `npm run check`: initial sandbox run failed four test files (`external-model-reasoner`, `external-reasoner`, `filesystem-confinement`, `local-planner`) with generic `test failed` diagnostics. Authorized unrestricted rerun PASS: typecheck, 455 tests, build and 112-file package verification. Logs: `/tmp/veil-showcase-audit-check.log`, `/tmp/veil-showcase-audit-check-unrestricted.log`.
- `/tmp/veil-jekyll-run build --source docs --destination /tmp/veil-showcase-audit-site/veil --disable-disk-cache`: PASS. Local Jekyll wrapper is environment-specific; no hosted workflow was triggered.
- `python3 tools/verify-documentation.test.py`: 6 tests passed.
- `python3 tools/verify-rendered-documentation.py /tmp/veil-showcase-audit-site/veil /veil`: PASS, 90 pages and 13,145 local links/assets/fragments.
- Served that output on loopback port 4174; `PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/tmp/veil-playground-a11y/node_modules/axe-core/axe.min.js node tools/playground-test.mjs`: PASS in Chromium, Firefox and WebKit. Covers existing gallery/actions, validation, reset/copy, bad input, escaping, blocked actions/network/scripts, keyboard and 1440/390/195px layouts. Zero axe violations; contrast remains incomplete in Chromium/WebKit. Log: `/tmp/veil-showcase-audit-browser.log`.

Browser evidence above is for the existing **0.4.0 playground**, not a new 0.4.1 showcase. Physical Safari, assistive technology and incomplete contrast checks remain manual acceptance work. No new experiences are implemented or deployment-ready in this phase. Quality deltas are not claimed: this phase changes only this excluded audit document; implementation quality uses the fixed baseline above.
