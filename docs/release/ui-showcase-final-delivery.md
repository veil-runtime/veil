# Veil UI showcase final delivery for review

Date: 2026-11-06. Branch: `feature/ui-showcase-integration-lab`. No push, merge, deployment, package publication or private repository edit was performed. Existing uncommitted Phase 1–3 work was preserved.

## Inventory and architecture

- `/showcase/`: Agent Monitor, a deterministic simulated agent with tool failure, retry, approval, pause, cancel, timeline and diagnostics.
- `/backend-lab/`: browser-local Pages simulation plus a separately runnable local HTTP service. The server and browser adapter are host code.
- `/showcase/lab.html?example=llm`: three authored incident, access request and operational analysis outputs. The page labels them simulated. An invalid descriptor is rejected and recovery is offered. Decision controls lead to a local confirmation.
- `/showcase/lab.html?example=operations`: simulated service/job health, history, diagnostics, failure, retry and reset. Timed completions use a ticket to discard stale callbacks.
- `/showcase/lab.html?example=workflow`: capture, required-field validation, review, approval/rejection, confirmation and edit/reset. Each step replaces the accepted Veil UI descriptor through `updateDefinition`.
- `/playground/`: editable minimal examples remain available.

All five showcases mount the published `@veil-runtime/ui@0.4.2` DOM adapter. No Core installation is needed. Veil UI validates definitions, renders built-in components, maintains bound field state and emits declared actions. Host modules choose scenarios, check event revision/source/action and lifecycle, own timers and cancellation, and would own model calls, networking and authorization in a real integration. The integration lab performs no external calls or effects. Its Definition, Host Integration and Architecture views sit beside the live Experience view; source text is embedded from actual modules by the existing pinned builder and checked by hashes.

## Security controls and limitations

The lab validates descriptors before mounting or replacing them, caps serialized definitions at 32 KiB, allowlists actions, bounds workflow fields (120/500 characters), uses a fixed scenario enum, and invalidates timed operations on reset/disposal. Content is rendered as text by built-ins. CSP blocks connections and remote scripts on lab pages. The operations history is capped at 20 entries. A real host must additionally validate model and service payloads, authenticate users and authorize side effects server-side. This is a deterministic teaching experience, not live model output or infrastructure control. Physical Safari/device and assistive-technology manual acceptance remain outstanding.

## Files changed in this continuation

New: `docs/assets/showcase/lab-definition.mjs`, `lab.mjs`, `lab-shell.mjs`, generated `lab.js`, `docs/showcase/lab.html`, `tools/showcase/lab.test.mjs`, `lab-browser.mjs`, and this report. Updated: `tools/showcase/build.mjs`, `README.md`, `docs/assets/showcase/provenance.json`, `docs/showcase/index.html`, `docs/_data/navigation.yml`, `docs/developer.md`, `docs/contributing/releases.md`, `docs/contributing/website.md`. The shared build regenerated existing playground, Agent Monitor and Backend Lab bundles from the same pinned runtime. A temporary diagnostic script was used locally and removed before delivery.

## Executed qualification

- `node tools/showcase/build.mjs`; `npm test --prefix tools/showcase`: PASS, 9/9 tests including all new descriptors and runtime definition transitions.
- `/tmp/veil-jekyll-run build --source docs --destination /tmp/veil-final-site/veil --disable-disk-cache`: PASS. `python3 tools/verify-rendered-documentation.py /tmp/veil-final-site/veil /veil`: PASS, 93 pages and 13,713 links/assets/fragments. `python3 tools/verify-documentation.test.py`: PASS, 6/6.
- Served the built site with `python3 -m http.server 4191 --bind 127.0.0.1 --directory /tmp/veil-final-site`. `VEIL_SITE_URL=http://127.0.0.1:4191/veil PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/home/mustapha/dev/ai/veil-care/node_modules/axe-core/axe.min.js node tools/showcase/lab-browser.mjs`: PASS in Chromium, Firefox and WebKit at 1280 and 390 px. Covers invalid LLM output/recovery/decision, operations failure/retry/completion, workflow capture/approval, four perspectives, source view, no page errors/overflow, and axe WCAG 2/2.1 A/AA with zero violations and zero incomplete results.
- Existing Agent Monitor browser gate and playground browser gate: PASS in all three engines, zero axe violations/incomplete findings. The Agent Monitor gate covers timer, failure/retry, approval, cancellation, stale updates and renderer error; the playground gate covers editor, bad inputs, actions and keyboard. The final real HTTP Backend Lab gate was rerun and passed in all three engines, including 10/10 native mouse searches, HTTP submission/422, stale and cancelled responses, offline/retry, session isolation, responsive/a11y and independent static Pages simulation.
- `npm run check`: sandbox attempt failed four known test processes due to confinement; unrestricted rerun passed 455/455 tests, typecheck, build and package verification. Final post-change rerun is recorded in `/tmp/veil-showcase-final-check.log`.
- `npm run quality -- --base 64f4720a715fef4a59e5561cd52b9d4378de6a65`: nonzero, twelve VEIL-GOV-001 findings at the same three published UI operations repeated in four generated bundles. No Core LOC, root dependencies, or verification controls changed. Review required; no scanner allowance was added. Log: `/tmp/veil-showcase-final-quality.log`.

Screenshots: `/tmp/veil-lab-{chromium,firefox,webkit}-{1280,390}.png` (last scenario at each viewport), plus prior Phase 3 paths in `ui-showcase-phase3-delivery.md`. These local artifacts are ephemeral. Final Backend Lab evidence is regenerated in `/tmp/veil-backend-{chromium,firefox,webkit}-qualification.json`; Phase 3 contains the detailed test design. Hosted Pages, physical devices and manual accessibility have not been tested. Two current contributor-document links to an inaccessible private UI release were replaced with the public npm 0.4.2 page.

## Readiness

### Twelve quality findings

The source locations below are in the bundled copy of published `@veil-runtime/ui@0.4.2`, pinned by `docs/assets/showcase/provenance.json`; none originates in new showcase host modules. The four bundles each report the same three sites. These are scanner reports, not evidence that capability execution is reachable from the site. No runtime edit or scanner allowance was made.

| Reported file | Reflective read at 47:28 | Component lookup/call at 761:66 | DOM method call at 869:55 |
| --- | --- | --- | --- |
| `docs/assets/playground/playground.js` | Inherited; duplicate 1 | Inherited; duplicate 1 | Inherited; duplicate 1 |
| `docs/assets/showcase/showcase.js` | Inherited; duplicate 2 | Inherited; duplicate 2 | Inherited; duplicate 2 |
| `docs/assets/showcase/backend.js` | Inherited; duplicate 3 | Inherited; duplicate 3 | Inherited; duplicate 3 |
| `docs/assets/showcase/lab.js` | Inherited; duplicate 4 | Inherited; duplicate 4 | Inherited; duplicate 4 |

The reflective read is `Object.getOwnPropertyDescriptor` in UI data validation: low practical risk and a protective check against accessors. The component lookup/call is the published renderer's custom-component extension: moderate general integration risk if a host registers untrusted components, but these pages register none; accept for this fixed built-in-only integration. The DOM call builds a fixed `<option>` from definition data: low practical risk; accept. The three originating sites are inherited published UI code; the last bundle is newly generated showcase output, but its reported code is unchanged runtime code. All twelve therefore have **documented acceptance for this release candidate**, subject to maintainer review of the quality exit 1. Future use of custom components needs a fresh review. The quality gate is not represented as passing.

### User experience and release hygiene

The public landing, UI guide, showcase index and navigation expose the examples before their implementation detail. The monitor, backend lab and three integration lab scenarios show working state transitions; their simulated nature is stated. Experience, Definition, Host Integration and Architecture views expose the descriptor, host code and boundary in public source text, so readers do not need the private repository. The minimal playground and UI guide show the small integration surface. Browser interaction and responsive/axe checks above found no material defect requiring a presentation edit in this final review. Physical Safari, assistive-technology use and hosted Pages remain unverified; the browser results cannot substitute for those checks.

The intended change inventory is the twelve tracked modifications shown by `git diff --stat`, plus the new `docs/assets/showcase/`, `docs/backend-lab/`, `docs/showcase/`, `examples/backend-lab/`, `tools/showcase/` trees and four `docs/release/ui-showcase-*.md` reports. Root package files, runtime source, locked contracts and verification controls are unchanged. `git diff --check` passes. The existing playground browser gate passed in three engines. Rendered Jekyll link verification passed 93 pages and 13,713 references; no broken public link was reported. The generated JS bundles are deliberate deployable assets; screenshots, browser profiles and logs remain under `/tmp`, outside the candidate. The branch is still uncommitted and has not been pushed.

**Recommendation: CONDITIONAL GO for commit and human release review.** The maintainer must disposition the twelve inherited quality reports and complete hosted Pages, physical-device and manual accessibility acceptance before deployment. Proposed sequence: review this diff and provenance; commit the intended website, example, tool and release files; run the same check, quality, Jekyll/link and three-engine browser gates on that commit; obtain maintainer acceptance of quality findings and remaining manual checks; then seek separate approval for push, merge and deployment. No publication is proposed.
