# Phase 3 — Backend Integration Lab delivery

Qualification date: 2026-11-06. Branch: `feature/ui-showcase-integration-lab`.

Recommendation: **accept Phase 3** on the evidence below. Published UI 0.4.2 resolves the original WebKit mouse-activation defect. No significant functional regression remains in the executed checks. Quality still exits 1 for the inherited published-artifact findings described below; this is not a clean quality-gate claim. No runtime source, locked contract, verification baseline or allowance was changed. Nothing was published, pushed, merged or deployed.

## Published artifact and shared build

The playground, Agent Monitor and Backend Lab use the existing shared `tools/showcase/build.mjs` architecture, importing only the published `/dom` and `/interface` entry points. No local runtime build, CDN or unpublished artifact is used.

Registry metadata and independently hashed downloaded tarball agree:

- Package: `@veil-runtime/ui@0.4.2`.
- Registry URL: `https://registry.npmjs.org/@veil-runtime/ui/-/ui-0.4.2.tgz`.
- SHA-512 integrity: `sha512-DTPTsIZiB0QYdBIPIABI89pL1kT9TNWDoYIj0jQ8s1ALFcsT3Kis3jGNfuRHxF8UrNgRdKZhXCAtIO4dTHkhBw==`.
- SHA-1: `87aaf5c4953c2930ab87fb29cb5c13439d765dd5`; tarball: 76,149 bytes.
- Optional Core peer remains `^0.4.0`; Core 0.6.0 compatibility is not claimed.

The builder checks installed version, lockfile version, exact npm URL and fixed integrity; generated asset/source hashes are recorded in `docs/assets/showcase/provenance.json`. Build dependency graphs exclude Core and Zod.

Commands executed from repository root:

```sh
npm view @veil-runtime/ui@0.4.2 version dist peerDependencies --json --fetch-retries=0 --fetch-timeout=15000
npm view @veil-runtime/ui versions dist-tags --json --prefer-online --fetch-retries=0 --fetch-timeout=15000
npm view @veil-runtime/ui@0.4.2 version dist peerDependencies --json --prefer-online --fetch-retries=0 --fetch-timeout=15000
npm install --prefix tools/showcase --save-dev --save-exact @veil-runtime/ui@0.4.2 --ignore-scripts --prefer-online --fetch-retries=0 --fetch-timeout=15000
npm pack @veil-runtime/ui@0.4.2 --pack-destination /tmp --ignore-scripts --json --prefer-online
node --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const bytes = readFileSync('/tmp/veil-runtime-ui-0.4.2.tgz');
const locked = JSON.parse(readFileSync('tools/showcase/package-lock.json')).packages['node_modules/@veil-runtime/ui'];
const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
if (integrity !== locked.integrity) throw Error('Tarball integrity mismatch');
console.log(integrity, createHash('sha1').update(bytes).digest('hex'), bytes.length);
JS
node tools/showcase/build.mjs
npm test --prefix tools/showcase
```

The initial sandbox registry lookup failed `EAI_AGAIN`. The first network-enabled lookup returned `E404 No match found for version 0.4.2`; fresh versions/dist-tags and a repeated version lookup then returned 0.4.2 successfully. These were resolved environmental/registry observations, not substituted package sources. Download evidence: `/tmp/veil-phase3-v042-npm-pack.json`, `/tmp/veil-phase3-v042-integrity.json`.

## Real HTTP qualification

Environment: Node 24.18.1, Playwright 1.64.1, Chromium (system Google Chrome) **151.0.7922.108**, Firefox **157.0**, WebKit **27.2**, axe-core 4.13.0. Linux headless browser qualification; mobile evidence uses responsive browser viewports, not physical mobile devices or Safari on Apple hardware.

```sh
/tmp/veil-jekyll-run build --source docs --destination /tmp/veil-phase3-v042-site/veil --disable-disk-cache
PORT=4188 SITE_ROOT=/tmp/veil-phase3-v042-site/veil node examples/backend-lab/server.mjs
python3 -m http.server 4189 --bind 127.0.0.1 --directory /tmp/veil-phase3-v042-site
PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/home/mustapha/dev/ai/veil-care/node_modules/axe-core/axe.min.js node tools/showcase/backend-browser.mjs
```

`/tmp/veil-jekyll-run` is an environment-local Jekyll wrapper; public instructions now use ordinary `jekyll build`. Backend URL defaults to `http://127.0.0.1:4188/veil/backend-lab/`; static-only URL defaults to `http://127.0.0.1:4189/veil/backend-lab/`. Override with `BACKEND_URL` and `STATIC_BACKEND_URL`.

| Assertion | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Session POST 200, initial GET 200 / three seed records | PASS | PASS | PASS |
| Original fill → ordinary mouse Search trigger, alternating queue/cache, 10 repetitions | 10/10 | 10/10 | 10/10 |
| Client field validation | PASS | PASS | PASS |
| Server validation POST 422 displayed safely | PASS | PASS | PASS |
| Record POST 201 and refreshed GET / four records | PASS | PASS | PASS |
| Superseded real HTTP response cannot overwrite newer results | PASS | PASS | PASS |
| Cancelled response cannot overwrite cancellation state | PASS | PASS | PASS |
| Offline failure and mouse Retry → filtered HTTP 200 | PASS | PASS | PASS |
| Independent browser session sees three seeds, no other session's submission | PASS | PASS | PASS |
| 1280, 390, 320px / all four perspectives / no page overflow | PASS | PASS | PASS |
| Mouse search at each responsive width | PASS | PASS | PASS |
| Axe: four perspectives at all three widths | 0 violations/incomplete | 0 violations/incomplete | 0 violations/incomplete |
| Independent static simulation / zero API requests / local submission | PASS | PASS | PASS |

The 422 case uses a browser route to alter one mouse-triggered POST body after client validation. The real Node service rejects that body; the actual host displays the response. This tests the independent server boundary, rather than falsely attributing server validation to client constraints.

The stale/cancel cases use a **test-only** fetch wrapper that sends real HTTP, ignores abort for one request and holds its response until a newer result or cancellation has been accepted. Releasing that response must produce `request.ignored` and leave the displayed result unchanged. Other requests retain normal abort behavior. No activation workaround is used: every Backend Lab action in this gate uses ordinary Playwright mouse activation; no `element.click()`, synthetic click or keyboard action replacement.

The original UI 0.4.1 failure was text-node replacement during the input blur/change sequence inside a mouse press. UI 0.4.2 preserves the text node. Native mouse-click evidence, host action traces and filtered HTTP results now pass in WebKit 10/10. Earlier forensic scripts remain diagnostic artifacts for 0.4.1 and were not used as current passing gates.

Full current evidence: `/tmp/veil-phase3-v042-backend.log` and `/tmp/veil-backend-{chromium,firefox,webkit}-qualification.json` contain browser versions, request bodies, response status/bodies, native click/host traces and axe results. A Chromium session-response body was unavailable after five seconds although its 200 status and resulting session-authenticated GETs were observed; this is retained as `bodyUnavailable`, not invented response content. Evidence collection is bounded for interrupted response bodies.

## Static hosting

The simulation is tested through the separate Python static server, which has no API implementation. The default mode identifies itself as “Pages simulation”, filters local sample records and submits locally, with zero `/api/` requests. Successful simulated submission explicitly says “Browser-local simulation only; nothing was sent.” Real mode identifies itself as “Real local HTTP” in both the badge and explanatory panel. Successful recovery clears the prior error notice.

## Regression and build gates

```sh
npm run check
VEIL_SITE_URL=http://127.0.0.1:4188/veil PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/home/mustapha/dev/ai/veil-care/node_modules/axe-core/axe.min.js node tools/showcase/browser.mjs
VEIL_SITE_URL=http://127.0.0.1:4188/veil PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/home/mustapha/dev/ai/veil-care/node_modules/axe-core/axe.min.js node tools/playground-test.mjs
VEIL_SITE_URL=http://127.0.0.1:4188/veil PLAYWRIGHT_BROWSERS_PATH=/tmp/veil-qualification-browsers AXE_PATH=/home/mustapha/dev/ai/veil-care/node_modules/axe-core/axe.min.js node tools/showcase/contrast.mjs
python3 tools/verify-documentation.test.py
python3 tools/verify-rendered-documentation.py /tmp/veil-phase3-v042-site/veil /veil
npm run quality -- --base 64f4720a715fef4a59e5561cd52b9d4378de6a65
```

| Check | Result / evidence |
| --- | --- |
| Repository check | PASS: 455/455 tests, typecheck, build and consumer/package verification; `/tmp/veil-phase3-v042-check-elevated.log` |
| Showcase targeted tests | PASS: 8/8; artifact/provenance and Agent Monitor state contracts |
| Agent Monitor browser regressions | PASS all three engines, including real timer progression, failure/retry, approval/rejection, cancellation, stale/invalid updates, source/export, responsive layout and safe renderer-error shutdown; `/tmp/veil-phase3-v042-agent.log` |
| Playground browser regressions | PASS all three engines: gallery, rendering/actions, invalid JSON/schema/size, reset/copy, escaping, keyboard and responsive layout; `/tmp/veil-phase3-v042-playground.log` |
| Accessibility | Agent Monitor and playground: zero axe violations and incomplete checks in all three engines. Backend: zero at all four perspectives and 1280/390/320px. These are automated checks, not a comprehensive manual accessibility audit. |
| Editor contrast/occlusion | PASS Chromium/WebKit at 195/390/1440px; 16.75:1, unobscured, zero incomplete checks; `/tmp/veil-phase3-v042-contrast.log` |
| Jekyll | PASS; `/tmp/veil-phase3-v042-jekyll.log` |
| Rendered links | PASS: 92 pages, 13,518 local links/assets/fragments; `/tmp/veil-phase3-v042-links.log` |
| Documentation verifier tests | PASS: 6/6; `/tmp/veil-phase3-v042-doc-tests.log` |
| Quality comparison | EXIT 1: nine inherited published-bundle findings; no verification-control changes; `/tmp/veil-phase3-v042-quality.log` |

First attempts and corrections are retained honestly:

- In-sandbox `npm run check` exited 1 with failures in `external-model-reasoner.test.js`, `external-reasoner.test.js`, `filesystem-confinement.test.js`, `local-planner.test.js` (22/26 test-file processes passed). The full required command passed outside the sandbox: 455/455 assertions.
- Loopback servers failed with `listen EPERM` / `PermissionError: Operation not permitted`; sandbox Chromium failed at crashpad `setsockopt: Operation not permitted`, SIGTRAP. Reruns with required execution permission succeeded.
- New mobile Backend accessibility assertions found `scrollable-region-focusable` on two Host Integration `pre` blocks at 390px. Both now have keyboard focus and accessible region labels; the complete gate was rerun.
- Agent Monitor initially timed out at its fault-injection assertion (`tools/showcase/browser.mjs:109`). Its old injected `textContent` setter no longer intercepted the 0.4.2 in-place text write. The fixture now throws from the existing text node's `nodeValue` setter. The unchanged expected safe-error and stopped-scheduler assertions pass across engines; no gate was removed or relaxed.
- A browser evidence run was interrupted while awaiting response bodies indefinitely. Body collection now retains headers/status immediately and records a bounded body failure explicitly. Functional assertions remain unchanged.

## Quality review and deltas

The comparison base is the branch's existing HEAD `64f4720a715fef4a59e5561cd52b9d4378de6a65`, including the pre-existing uncommitted showcase work. It was not advanced to hide changes. Core source totals remain 6,638 LOC; tests 5,630; harness 1,237; all net deltas zero in the quality tool's measured categories. Root dependencies and lockfile are unchanged. The private showcase dependency changes from UI 0.4.1 to 0.4.2.

Nine VEIL-GOV-001 findings occur at lines 47, 761 and 877 in each generated bundle (`playground.js`, `showcase.js`, `backend.js`). Review: passive own-property descriptor inspection for safe data copying, own-property component lookup, and own-property field-error lookup, respectively. These are published UI data/DOM operations, with no Core registry/provider/capability authority or execution dispatch. The three sites in playground/Agent Monitor were already dispositioned in Phase 2; Backend adds a third copy of the same sites. The count is therefore six → nine across the three bundles, with the same three underlying operations. No production Core behavior or verification allowance changed. The scanner still returns 1; this report records the review and does not suppress it.

## Screenshots and changed files

Desktop/mobile Backend screenshots for each engine: `/tmp/veil-backend-{chromium,firefox,webkit}-{1280,390,320}.png`. Static simulation screenshots: `/tmp/veil-backend-{chromium,firefox,webkit}-pages-simulation.png`. Agent Monitor screenshots: `/tmp/veil-showcase-{chromium,firefox,webkit}-{1440,390,320}.png`; playground screenshots are produced by `tools/playground-test.mjs`. WebKit desktop and mobile Backend images were visually reviewed. `/tmp` artifacts are local and ephemeral; no hosted Pages deployment, hosted browser check or physical-device check is claimed.

Files changed in this resumption:

- `tools/showcase/package.json`, `package-lock.json`, `build.mjs`, `artifacts.test.mjs`, `README.md`: published artifact pin, provenance verification and instructions.
- `tools/showcase/backend-browser.mjs`: complete real HTTP, mouse activation, failure/race/isolation, responsive/a11y and independent static simulation gate.
- `tools/showcase/browser.mjs`: renderer-fault fixture targets 0.4.2's text-node write.
- `docs/assets/showcase/backend-integration.mjs`, `backend-shell.mjs`: truthful simulation success message, mode explanation and cleared recovery feedback.
- `docs/assets/playground/playground.js`, `docs/assets/showcase/showcase.js`, `backend.js`, `provenance.json`: regenerated shared assets.
- `docs/backend-lab/index.html`: version, accessible code blocks, portable local-build command.
- `docs/_layouts/docs.html`, `docs/assets/playground/README.md`, `docs/developer.md`, `docs/ecosystem.md`, `docs/index.html`, `docs/playground/index.html`, `docs/showcase/index.html`, `docs/ui.md`: current published-version references.
- `docs/release/ui-showcase-phase3-delivery.md`: current qualification and recommendation, replacing the earlier unaccepted 0.4.1 status.

The pre-existing feature work remains in place. The local Node service is demonstration infrastructure with in-memory session data and an HTTP-only SameSite demo cookie, not production authentication. Production hosts must enforce authorization and service policy independently of UI allowlists.
