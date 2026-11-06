# Phase 2 delivery — showcase foundation and Agent Monitor

Date: 2026-11-06. Branch: `feature/ui-showcase-integration-lab`.
Fixed comparison base: `64f4720a715fef4a59e5561cd52b9d4378de6a65`.

Status: implemented and tested in real Chromium, Firefox and WebKit. Ready to extend with the next showcase. **Not approved for public promotion:** six bundled-runtime governance findings still require maintainer disposition; manual browser/assistive-technology acceptance remains outstanding. No push, merge, Pages deployment or npm publication was performed.

## Delivered behavior

`/veil/showcase/` provides Experience, Definition, Host Integration and Architecture perspectives. Tab switching preserves the mounted controller, scenario selection and active execution. Arrow keys, Home and End navigate the tablist. The monitor's buttons, scenario input, statuses, steps, timeline and diagnostics are all rendered by the published Veil UI DOM adapter. The surrounding site shell handles navigation and code inspection only.

The deterministic incident-investigator simulation supports automatic progression, pause/resume, manual advancement, tool timeout, retry, human approval/rejection, cancellation, completion and reset. Tool requests/results and lifecycle events appear in a bounded 40-entry timeline. Step counts, percentage and attempt count derive from host state. Approval affects only local simulation; nothing is sent or executed externally.

The Definition perspective shows the exact accepted `snapshot().definition` separately from current state/data/revision. JSON export overlays live data/state so the result can be mounted by a developer's host. The definition view is intentionally read-only in this iteration; the existing editable playground remains available. Host Integration displays the actual integration, simulation and descriptor modules embedded during the build, verified byte-for-byte in browsers. Architecture explains each event/update boundary and the responsibilities of a future real agent adapter.

The shared isolated build pins UI 0.4.1 and esbuild 0.28.2 for both playground and showcase. It validates the expected npm integrity, excludes Core/Zod from browser dependency graphs, preserves UI license/NOTICE, and generates bundle/source hashes. No CDN or second runtime-loading mechanism was added. Playground runtime code is functionally unchanged between these published versions in its bundled graph; the rebuilt output differs in module provenance comments. Current entry pages now use 0.4.1 wording and public npm/showcase destinations.

## Runtime versus host

| Veil UI | Host application |
| --- | --- |
| Validate built-in descriptors and bound data | Produce the simulated lifecycle/tool events |
| Bind scenario state and render status/table data | Enforce action phase and scenario policy |
| Dispatch declared, allowlisted actions with source/state/revision | Schedule, pause, retry, approve/reject and cancel |
| Reject stale revision updates and invalid table candidates | Invalidate run identity and pending-work identity |
| Reconcile keyed DOM, provide snapshots and disposal | Project model data, bound timeline, inspect/export and explain |

No live agent, LLM, backend, authentication or authorization service is connected. A real host must validate service events, authenticate users, authorize effects on the server, enforce tool policy and own transport. UI never grants execution authority. No Core contracts or runtime packages were changed.

## Security and failure behavior

- Descriptor construction uses only published built-ins and checks a 32 KiB byte limit plus runtime validation. No custom factories or arbitrary code editor are exposed.
- Actions are declared/allowlisted by UI and checked again by the host for current revision, source/action agreement and permitted lifecycle transition. Scenario values are a fixed enum.
- Timer callbacks capture both run generation and pending-work ticket. Cancel/reset/restart/disposal invalidate them, even if timer cancellation itself fails or a queued callback arrives late.
- The diagnostic probe actually attempts a stale revision and an invalid table-data update against the published runtime; both preserve the accepted interface.
- Unexpected publication errors stop simulation scheduling and display a generic recovery message. A real-browser test injects a DOM commit exception and verifies safe reporting, no uncaught page error and no later mutation. Partial DOM commits still cannot promise rollback.
- Source and data use text rendering. CSP forbids network requests, injected scripts, images, objects and form submission. Inline style permission remains necessary for runtime DOM styles. No credentials, private source imports or private repository URLs appear in the new showcase or changed current entry pages.

## Exact file inventory

New implementation files:

- `docs/showcase/index.html`
- `docs/assets/showcase/agent.mjs`
- `docs/assets/showcase/definition.mjs`
- `docs/assets/showcase/integration.mjs`
- `docs/assets/showcase/shell.mjs`
- `docs/assets/showcase/showcase.css`
- `docs/assets/showcase/showcase.js` (generated)
- `docs/assets/showcase/provenance.json` (generated)
- `tools/showcase/package.json`
- `tools/showcase/package-lock.json`
- `tools/showcase/build.mjs`
- `tools/showcase/agent.test.mjs`
- `tools/showcase/artifacts.test.mjs`
- `tools/showcase/browser.mjs`
- `tools/showcase/contrast.mjs`
- `tools/showcase/README.md`
- `docs/release/ui-showcase-phase2-delivery.md` (this excluded delivery record)

Modified files:

- `docs/assets/playground/playground.js` (rebuilt from published 0.4.1)
- `docs/assets/playground/README.md`
- `docs/playground/index.html`
- `tools/playground-test.mjs` (configurable local base URL and detailed incomplete-check evidence; existing assertions retained)
- `docs/_data/navigation.yml`
- `docs/_layouts/docs.html`
- `docs/index.html`
- `docs/developer.md`
- `docs/ecosystem.md`
- `docs/ui.md`

`docs/release/ui-showcase-phase1-audit.md` was already untracked from the accepted previous phase and is retained. Core source, root manifests/lockfile, workflows, runtime package, quality scanner, baselines and allowances are unchanged. UI license/NOTICE were copied from the artifact by the builder and are byte-identical to existing files.

## Executed validation

Commands below were run from the public repository root. Browser environment: `VEIL_SITE_URL=http://127.0.0.1:4176/veil`, `PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers`, `AXE_PATH=/tmp/veil-playground-a11y/node_modules/axe-core/axe.min.js`. These installed paths are local qualification infrastructure, not public dependencies.

| Command | Result |
| --- | --- |
| `npm install --prefix tools/showcase --ignore-scripts` | Initial sandbox attempt failed `EAI_AGAIN` for registry DNS; authorized unrestricted retry installed 4 packages, audit reported 0 vulnerabilities |
| `npm run build --prefix tools/showcase` | PASS; both assets use UI 0.4.1; expected integrity checked; no Core/Zod in bundles |
| `npm test --prefix tools/showcase` | PASS, 8 tests: lifecycle/retry/approval/rejection; late callbacks across cancel/reset/restart/disposal; pause/manual progression; host policy; real published controller validation/events/revisions; bounded timeline numbering; generated asset/source provenance |
| `npm run check` | PASS on delivery workspace: typecheck, 455/455 tests, build and 112-file package verification; `/tmp/veil-showcase-phase2-check-delivery.log` |
| `/tmp/veil-jekyll-run build --source docs --destination /tmp/veil-showcase-phase2-site/veil --disable-disk-cache` | PASS; environment-specific Jekyll wrapper, not a hosted Pages run |
| `python3 tools/verify-documentation.py` | PASS, 297 source links/routes/fragments |
| `python3 tools/verify-documentation.test.py` | PASS, 6 verifier tests |
| `python3 tools/verify-rendered-documentation.py /tmp/veil-showcase-phase2-site/veil /veil` | PASS, 91 pages and 13,335 local links/assets/fragments |
| `node tools/showcase/browser.mjs` with environment above | PASS, Chromium/Firefox/WebKit: real mounted controls/tables; perspective/state preservation; actual source equality; automatic/manual lifecycle; timeout/retry; approval/rejection; cancellation/reset; stale/invalid update probe; JSON export; keyboard; all perspectives at 1440/390/320px; CSP rejection; real DOM exception containment |
| `node tools/playground-test.mjs` with environment above | PASS in all 3 engines on UI 0.4.1: five examples, event flow, validation, forbidden actions, bad JSON/schema/size, recovery, reset/copy, inert HTML, CSP, keyboard and 1440/390/195px layouts |
| `node tools/showcase/contrast.mjs` with environment above | PASS for measured editor contrast/occlusion assertions; retains axe incompletes described below |
| `npm run quality -- --base 64f4720a715fef4a59e5561cd52b9d4378de6a65` | Exit **2**, six VEIL-GOV-001 findings described below; `/tmp/veil-showcase-phase2-quality-delivery.log` |
| `git diff --check` | PASS |

Browser logs: `/tmp/veil-showcase-phase2-browser-delivery.log`, `/tmp/veil-showcase-phase2-playground.log`, `/tmp/veil-showcase-phase2-contrast.log`.

## Browser and accessibility evidence

- Showcase: zero axe violations **and zero incomplete checks** in all four perspectives and approval state at 1440px and 390px, across Chromium, Firefox and WebKit. Detailed records: `/tmp/veil-showcase-{chromium,firefox,webkit}-a11y.json`.
- Desktop approval screenshot: `/tmp/veil-showcase-chromium-approval-1440.png`.
- Mobile approval screenshot: `/tmp/veil-showcase-chromium-approval-390.png`.
- Additional full-page screenshots at 1440/390/320px for each engine: `/tmp/veil-showcase-{engine}-{width}.png`.
- Playground: zero axe violations. Firefox has no incomplete checks. Chromium/WebKit report `color-contrast` for `#editor`: background cannot be determined because the element is “partially obscured”; the related node is the textarea itself.
- Focused investigation at 195/390/1440px confirmed computed foreground `rgb(245, 242, 236)`, opaque background `rgb(16, 18, 24)`, no background image, **16.75:1** calculated contrast and all four interior hit targets resolving to the textarea. Screenshots were visually inspected. Axe still returns incomplete at all three widths. This is retained as an automated-analysis limitation, not silently converted to an axe pass. Evidence: `/tmp/veil-playground-contrast-{chromium,webkit}.json` and matching width screenshots.
- Generic-container/pre labels initially produced `aria-prohibited-attr` incomplete results in the showcase. Appropriate region roles and removal of unsupported generic labels resolved them. No runtime modification was needed.
- Physical Safari and assistive-technology/manual interaction acceptance have not been performed. Engine automation does not establish those results.

## Quality review and deltas

The final quality report records no changes to root direct dependencies, root lockfile or verification controls. Its Core categories have zero LOC deltas: source 6638→6638, test 5630→5630, harness 1237→1237. These categories do **not** count the new website modules or isolated tooling dependencies; the inventory above makes that additional scope explicit.

Six findings remain: three identical published-runtime locations in each of `docs/assets/playground/playground.js` and `docs/assets/showcase/showcase.js`:

1. Line 47: `Object.getOwnPropertyDescriptor(item, key)` inspects bounded JSON-like data and rejects accessor/non-enumerable properties. This is input validation, not capability execution.
2. Line 761: trusted custom-component registry lookup. Both public applications register no custom components; visitors cannot supply registry code. It remains part of the unmodified npm DOM adapter.
3. Line 869: field-validation message lookup by validated node key; the result becomes text content. It is not a callable capability or execution entrance.

The three playground findings already existed in the baseline; the new bundle contains the same three runtime sites. The implementation review finds no bypass of Core execution contracts: these are independent UI data/DOM operations. This explanation is **not maintainer approval** and does not waive VEIL-GOV-001. No scanner, allowance, comparison base or verification controls were changed. Public promotion should wait for explicit disposition of all six findings.

The initial scan also flagged the host-source object's computed lookup and its bundled copy. Replacing that lookup with a Map prevents inherited-property lookup and removed those two authored-code findings. Read-only review also found repeated sequence numbers after timeline truncation and an uncontained asynchronous publication exception; both were corrected and regression-tested before delivery.

## Remaining work and recommendation

Proceed with the next showcase using the same published-runtime builder, descriptor/data separation, visible host source and lifecycle cleanup pattern. No backend lab or other showcase was implemented here.

Before public promotion: disposition the six quality findings, review manual accessibility acceptance and the recorded playground contrast limitation, run hosted Pages/PR qualification on an approved commit, and obtain deployment approval. This work intentionally leaves workflows and deployment controls unchanged. No production service integration, arbitrary descriptor editing in the monitor, persistent sessions or cross-device execution state is claimed.
