# Playground readiness — 2026-11-04

The static playground uses the published UI 0.3.0 DOM export, bundled locally with esbuild. No Core dependency, framework, backend or provider credentials are used. `createMountedInterface`, `updateDefinition`, `updateData`, `snapshot` and `dispose` provide real rendering and lifecycle behavior. JSON definitions use built-in components only; host actions are restricted to a local demo callback.

The source and generated asset live in `docs/assets/playground/`; asset provenance and rebuild instructions are in its README. The dedicated route is `/veil/playground/`. Existing Jekyll deployment is unchanged. No final PR, merge or deployment is authorized by this report.

Verification:
- Core `npm run check`: PASS, 455 tests plus typecheck, build and package verification.
- Playground Chromium checks: gallery, real interactive actions, invalid JSON/schema/size, preservation of accepted preview, reset, copy, escaping, keyboard activation, desktop/mobile overflow and uncaught errors.
- Jekyll 4.4.1 production configuration with `/veil`: PASS.
- Rendered validator: 90 pages, 13,145 local links/assets/fragments PASS.
- Source validator: 285 links/routes/fragments PASS.
- Quality comparison against unchanged base `7cc82195ed42d96603236dab3175b5b66a960242`: two governance findings in generated published UI code; no runtime/test/harness LOC or dependency deltas reported by the harness. The new browser test and website code are outside those LOC categories.

Unresolved governance review:
1. `docs/assets/playground/playground.js:47` inspects own property descriptors during bounded-data validation to reject accessors. It does not execute capabilities.
2. `docs/assets/playground/playground.js:608` selects a trusted custom component factory. The playground registers no factories and definitions cannot provide JavaScript; unknown component names are rejected. The code is retained from the unmodified published renderer.

No scanner controls or allowances were changed. These findings require explicit disposition before release. Recommendation: GO for coordinated review; NO-GO for deployment until governance review is resolved.

Limits: no general JavaScript sandbox, no network-backed actions, no live AI generation. Only bounded JSON is accepted. CSP blocks network and external resources; the renderer/browser are trusted. Browser review covers Chromium desktop and mobile viewport emulation, not screen readers, Firefox or WebKit. Clipboard permission failures fall back to manual editor selection. AI generation needs a separate protected server adapter with rate limits, bounded output and the same schema/action validation; it is deferred.

## Final security investigation

Published tarball SHA-256: `42496de0e5c73044b6336468599d129f6d95764b979f14c1024375a5a49356fd`. Rebundling the playground source with the extracted published `/dom` export produced a byte-identical asset (`cmp` passed). No published runtime files were edited.

### Descriptor finding

Origin: UI `src/validation-safety.ts`, `assertBoundedData`, nested `visit`; published `dist/validation-safety.js:49`, bundled line 47. `validateInterfaceDefinition` invokes it before accepting initial definitions and updates. JSON reaches this code on every render. It reads an own descriptor and rejects accessors/non-enumerable properties before inspecting `descriptor.value`; it does not call the property value. Plain JSON parsing cannot construct getters, functions or Proxy objects. Trusted-host JavaScript could supply Proxies to the general library, so this conclusion is specific to the playground's JSON-only ingress. Removing the check would weaken UI validation and is not a preferred source correction.

### Custom-component finding

Origin: UI `src/dom.ts`, `mountInterface`, its node preparation branch; published `dist/dom.js:309`, bundled line 608. The general renderer supports trusted factories selected from a host registry. `createMountedInterface` derives allowed component names from the host's registry keys. The playground supplies no registry; `validateInterfaceDefinition` permits only the nine built-ins and rejects unknown names. Definitions cannot supply registry code or add component names. Built-ins take earlier branches, so valid playground JSON cannot reach custom factory invocation. A malicious trusted registry would be arbitrary host code, which is outside this integration's threat boundary.

### Remediation decision

No supported integration option removes either static scanner site. Adding an iframe would not remove them; moving or excluding the bundle would suppress evidence. A source change that removes defensive descriptor checks is undesirable. A future separately released built-in-only UI entry point could omit custom-factory support, but would still need bounded-data validation. No package patch or governance-control change was made.

Recommended next action: maintainer review of narrowly scoped governance dispositions for these two exact statements/artifact, backed by this evidence. The review must preserve the JSON-only ingress, empty component registry and fixed local action allowlist. This report proposes that review; it does not approve an exception. Under the instruction not to alter governance controls, the exit-2 gate cannot be resolved within this task.

### Additional qualification

The browser harness now covers three engines, action allowlist rejection, effective CSP blocking of injected inline scripts and external fetch, keyboard traversal from editor to Render, and optional axe-core WCAG A/AA checks. Accessibility tooling is installed only under `/tmp`; no project dependencies changed. Axe found a serious `scrollable-region-focusable` issue; the playground HTML now makes preview and code scroll regions keyboard-focusable. This is an integration-only correction.

The generated meta CSP is active before scripts. Editor data is parsed only as bounded JSON; text is rendered as text nodes. The host provides no custom factories and no network actions. The runtime bounds tree depth to 16 and nodes to 512, alongside data traversal and text/table/list bounds. Initial and replacement definitions are validated, and action names must be in the fixed `demo` allowlist. No provider credentials, arbitrary editor JavaScript, Core invocation or server endpoints are present.

Core verification again passed 455 tests and package checks. Quality remains exit 2 at the original comparison base with the same two findings. Production Jekyll build and rendered-documentation validation pass (90 pages; 13,145 local targets). No governance files, runtime source, package manifests or lockfiles changed.

### Cross-browser and accessibility results

- Chromium (system Chrome): gallery/editor/rendering, JSON/schema/size rejection, reset, clipboard round trip, responsive widths, keyboard activation/traversal, action restriction, HTML escaping and CSP probes PASS. Axe-core 4.10.3 WCAG 2 A/AA and 2.1 AA: zero violations after the focusability fix; `color-contrast` remains incomplete for human review.
- Firefox 157 / Playwright revision 1555: same interaction/security/layout suite PASS. Clipboard action either reports success or offers manual selection according to browser permissions; clipboard contents are independently read back only in Chromium. Axe: zero violations and zero incomplete checks for the tested default view.
- WebKit 27.2 / revision 2370: initial render and example switching passed; greeting interaction FAILED. After entering Amina and clicking Greet, preview stayed at Ready. A second run explicitly waited for Hello Amina and timed out after 30 seconds. Later reset/export/responsive/axe checks in this engine were not reached. This is an unresolved browser/runtime interaction issue, not a qualified engine. Investigate with a minimal UI 0.3.0 reproduction in the UI workstream before any release claim; do not patch the website bundle.

Matching Firefox/WebKit binaries were downloaded to `/tmp/veil-qualification-browsers`; the initial Firefox attempt failed because the previously cached revision did not match this checkout's Playwright version. That environment failure was resolved before the reported Firefox pass.

Keyboard-driven browser checks cover native controls, editor-to-Render Tab order, Enter activation and focusable scroll regions. Native semantic labels, status announcements and focus styles were inspected. This is not a comprehensive manual accessibility or assistive-technology audit. No screen-reader testing was performed; contrast's incomplete result and full keyboard/assistive review remain limitations. Axe tested the default view, not every possible user definition.

**Final decision: NO-GO for deployment.** Precise blockers: two undispositioned generated-runtime governance findings (quality exit 2), plus the reproducible WebKit interaction failure. Recommended next actions are maintainer governance review of the two exact sites and an independent UI browser-compatibility investigation. Runtime/peer dependencies, governance controls and package lifecycle were preserved. No merge, deployment or package publication occurred.

## Focused WebKit hit-target follow-up

A minimal static page was built against the exact published `@veil-runtime/ui@0.3.0` tarball (`SHA-256 42496de0e5c73044b6336468599d129f6d95764b979f14c1024375a5a49356fd`). It contains one Input, one Button, one local `onEvent` handler and one Status output. In Chromium, Firefox and WebKit, input/change events commit `Amina` to UI state. When a click event reaches the button, all three engines dispatch `{action:"greet", state:{name:"Amina"}}`; `updateData` returns true and Status becomes `Hello Amina`. No UI source defect was found.

Hit-target traces compare the minimal page and actual playground at 390x844. In the playground the Greet button initially sits below the viewport (`y≈870`) inside the scrollable preview. Before scrolling, `elementFromPoint` cannot hit the button because the center is outside the viewport. This invalidated the original locator-click test's assumption that automatic scrolling was sufficient.

After explicit scrolling, computed visibility is visible, display is block, pointer-events is auto, and the button is enabled. `document.elementFromPoint` at its center returns the button. Chromium and Firefox locator and coordinate clicks dispatch the action. In WebKit on the real playground, locator and coordinate clicks generate trusted `mousedown` and `mouseup` on that button but no `click` event; the UI action dispatcher is therefore never entered. In the minimal page with the same published runtime, a viewport-contained coordinate click generates `click` and the greeting succeeds. This narrows the remaining discrepancy to WebKit interaction with the real playground's scrolled preview/layout, not state synchronization or action dispatch. No overlap or disabled/pointer-events condition was found after scrolling.

Screenshots and Playwright traces are retained under `/tmp/veil-hit-{minimal,playground}-{chromium,firefox,webkit}.{png,zip}`. The focused records show event sequences and page geometry. A visible, human-operated WebKit browser was not available; Xvfb supports headed launch but provides no human input in this session. Mouse-coordinate events are Playwright-generated, not a manual physical-device test.

The browser harness now scrolls the target into view, verifies viewport bounds and center hit ownership, and uses explicit coordinate clicks. Chromium and Firefox complete the full suite (gallery, render, invalid JSON/schema/size, reset, copy, HTML escaping, local action allowlist, CSP script/network probes, keyboard activation, desktop/mobile overflow, axe). WebKit still times out waiting for the greeting because no click event follows the trusted down/up events. Its remaining suite does not complete past that action. No playground/runtime implementation workaround was added; such a workaround would hide an unresolved WebKit input behavior.

## Maintainer disposition proposal for quality findings

**Finding A — published UI validation:** `/home/mustapha/dev/ai/veil-ui-lab/packages/ui/src/validation-safety.ts:10-53`, `assertBoundedData` / nested `visit`; published artifact `dist/validation-safety.js:9-57`; bundled asset around line 47. `Object.getOwnPropertyDescriptor` is used to inspect own data properties without invoking getters and reject accessors/non-enumerable properties. Every definition passes this bound check. Editor input is parsed by `JSON.parse`, capped at 32 KiB, then validated by UI. Parsed JSON cannot carry getters, functions or Proxies. A hostile JSON object containing `__proto__`, `constructor` or oversized nesting is rejected by the runtime's safe-key and traversal checks. Residual risk is limited to other trusted host code passing non-JSON object graphs into this public package function; the playground does not do so. **Proposed disposition:** exact-site allow after maintainer review, scoped to this published UI artifact and validation statement; retain the check and JSON ingress evidence.

**Finding B — custom renderer extension:** `/home/mustapha/dev/ai/veil-ui-lab/packages/ui/src/dom.ts:181-250`, `mountInterface` node preparation; lookup also appears in `render` at line 122; published `dist/dom.js:~213-~330`; bundled asset around line 608. The registry lookup invokes host-supplied custom factories, a supported extension point. JSON cannot supply executable factories. The playground passes no `components` registry; `createMountedInterface` derives component names from registry keys, and `validateInterfaceDefinition` rejects every unrecognized component before rendering. Only the nine built-ins and host-approved `demo` action are accepted. Residual risk requires a future integration to add an unsafe trusted factory or broaden the action handler. **Proposed disposition:** exact-site allow only for the unused custom-factory branch with empty registry, backed by the fixed integration and schema check; do not allow arbitrary custom factories or editor input to select code.

These are proposals only; the maintainer must approve dispositions. Scanner controls, quality configuration and published package artifacts remain unchanged. The quality gate still exits 2 with these two sites.

**Updated decision: NO-GO for deployment.** The published renderer, minimal runtime path and UI integration have no identified defect. The browser harness exposed the actual offscreen target and now uses explicit viewport/hit-target checks. The WebKit real-playground scrolled-layout path still generates no click despite trusted down/up events and requires a manual browser reproduction or a WebKit-owned compatibility decision. Governance dispositions also remain pending. No merge, publication or deployment occurred.

## Real playground WebKit lifecycle reduction (follow-up)

Follow-up instrumentation attached capture listeners for `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`, and `pointercancel` to the button and each ancestor. It recorded the button node identity, connectivity, rectangle, viewport scroll, active element, event target, and `defaultPrevented`, while a MutationObserver watched the preview subtree for button removal/replacement.

Across the WebKit real-playground attempts, the same button node remained connected. After scrolling, its rectangle stayed stable through down/up; `document.elementFromPoint` at the center returned the button. The active element changed from the input to the button at pointer-up. No `pointercancel`, `click`, default prevention, or subtree mutation was observed. The action callback therefore never ran. Explicit stylesheet disablement, removal of the workspace grid, and visible preview overflow did not produce a click in the instrumented attempts. This rules out those individual CSS/layout causes but does not establish the remaining browser cause.

The standalone minimal page previously passed with its viewport-contained coordinate click. The real page still fails in WebKit with locator clicks and explicit coordinate clicks after scrolling. The earlier report's statement that a coordinate click on the real page succeeded was too broad; the focused reproduction is the more recent evidence and corrects it. The standalone pass only demonstrates that the UI runtime dispatches and updates when a click is delivered.

Traces/screenshots from the reductions: `/tmp/veil-lifecycle-{baseline,noStylesheet,noGrid,previewVisible,locator,coordinate}.{zip,png}`. The webkit logs capture stable node id 1 and stable rect `[37,398.015625,316,47.59375]` during delivered pointer/mouse down/up, with no click. The reduction run did not complete the additional same-engine page variants as cleanly as intended, so these results are diagnostic evidence, not full proof against every browser/layout factor. The full test harness's explicit-scroll coordinate-click attempt still timed out in WebKit; Chromium and Firefox remained passing. No source-level implementation fix was made because no application event handler, node replacement, pointer cancellation or overlay defect has been identified.

Manual WebKit input remains unavailable. Xvfb permits a headed process but does not provide a human-controlled device in this session. A maintainer should reproduce in Safari/WebKit with a real pointer on the deployed/local page before attributing this to WebKit itself.

**Decision remains NO-GO.** Root cause is narrowed to a WebKit-specific missing `click` after trusted pointer/mouse down/up in the scrolled real playground; the precise cause is unresolved. No UI package or playground implementation was changed for this follow-up. The test helper's scroll-and-hit assertions remain diagnostic and must not be treated as a passing workaround. Governance findings remain exact-site proposals awaiting maintainer approval.

## Release preparation handoff

Investigation is paused at the user's direction. No speculative WebKit changes were made. Preserved WebKit artifacts remain under `/tmp`:

- `/tmp/veil-hit-minimal-webkit.png` and `.zip`
- `/tmp/veil-hit-playground-webkit.png` and `.zip`
- `/tmp/veil-lifecycle-baseline.png`, `noStylesheet.png`, `noGrid.png`, `previewVisible.png`, `locator.png`, `coordinate.png`
- `/tmp/veil-lifecycle.log` and `/tmp/veil-hit-results.log`

The current known browser evidence is: minimal published-runtime path passes when a click is delivered; real playground WebKit receives trusted down/up without click despite stable connected button, a valid center hit target, and unchanged rectangle after scrolling. The full browser suite therefore remains unqualified in WebKit. No human-operated Safari result is available.

Maintainers can record the two exact-site decisions in [playground governance dispositions](playground-governance-dispositions.md). The proposed scopes are narrow and do not approve broader descriptor inspection or custom component registration. Both require explicit accept/reject decisions; no exception has been applied.

Use the [manual Safari acceptance checklist](safari-acceptance-checklist.md) on real Safari/WebKit, record device/browser details and attach pointer/keyboard evidence. Final release conditions are: (1) manual Safari pointer greeting passes or a browser-owned defect is independently identified and dispositioned; (2) keyboard, gallery, validation, reset, export and responsive checklist passes; (3) maintainers approve or reject both exact-site governance proposals; and (4) after those decisions, rerun the final browser suite and production Jekyll/route gates. Core package checks passed previously; do not rerun them unless runtime or package-related source changes.

**Release recommendation remains NO-GO** pending manual Safari acceptance and both governance decisions. The working branch is ready for final review of these documents and the existing playground changes; it is not ready for merge or deployment.
