# Core v0.4.0 website publication readiness

**Disposition: ready for review and authorized GitHub Pages deployment with
candidate wording.** Prepared on `docs/core-v0.4.0-website`, based on qualified
Core commit `903efad9c7212f1f1137407cf2401973577a5287`. No merge, tag, npm
publication or Pages deployment was performed.

## Information architecture and visual identity

The canonical Jekyll source remains `docs/`. `/` is still the standalone
`docs/index.html`; `/developer.html` remains the documentation portal. The
navigation data, shared documentation layout, base URL `/veil` and deployment
workflow retain their existing roles. The dark palette, grid background, brand
mark, typography, card styles and violet/cyan accents are preserved.

The landing page now follows the requested progression: plain-language hero,
execution-governance problem, governed execution layer, five-stage process,
business value, six possible application patterns, evaluation/adoption paths,
technical model and separate products, then published/experimental/future status.
It no longer opens with an SDK example or simulated execution controls. Technical
architecture is available through a native keyboard-accessible disclosure and
links. The page uses static HTML/CSS, no client JavaScript, external fonts or
decorative animation widgets. The existing lightweight visual treatment remains.

Existing `#top`, `#why`, `#install`, `#architecture`, `#starter`, `#build`,
`#quickstart`, `#today`, `#v030` and `#open-source` destinations remain available
near their relevant content. The removed simulation is no longer offered as a
call to action.

The documentation journey is explicit: overview → mental model → five-minute
example → concepts → build → architecture → API reference. The evaluation guide
provides a separate business entry point without creating another documentation
source. Shared navigation links to both. The production-denial cookbook now has
a complete example rather than a one-line description.

## Claims and audience review

| Perspective | What the visitor can understand and do |
| --- | --- |
| Business leader | The hero and problem explain why a proposed action needs validation and permission. Five concrete benefits and six possible integration patterns lead to a bounded evaluation, with no customer, savings or certification claims. |
| Technical architect | The execution flow, host responsibilities and architecture disclosure explain plans, authorization, capabilities, providers and outcomes. Core/UI/Emergence are explicitly separate; trust-boundary and public-API links provide detail. |
| Developer | The portal supplies the learning path. The five-minute guide identifies the unpublished tarball, Linux/Node prerequisites, a complete root-import example and exact expected output. TypeScript prerequisites and denial behavior are verified. |

These are engineering reviews of the content and routes, not a user study.
Possible applications are labelled as patterns requiring application-owned
integration and policy. Demonstrated behavior is grounded in the runnable echo,
ordered plans and denial checks. Human approval requires a host-owned process;
Core has no approval inbox or approval workflow. It does not replace identity
management or certify compliance. Model output grants no authority.

The current npm registry was checked: `latest` is 0.3.1 and 0.4.0 is absent.
The homepage and entry pages consistently describe v0.4.0 as an unpublished,
Linux-qualified candidate. Windows/macOS remain unqualified. Linux filesystem
protections are correctly scoped to the source-server reader, not an exported
file capability or a general sandbox. Local Ollama/Qwen planning remains
experimental and opt-in; reliable autonomous write planning is not claimed.
Sandbox, repository-task and browser capabilities are not published Core features.

## Verification

| Command or review | Result |
| --- | --- |
| Jekyll 4.4.1 / Ruby 3.3.8, strict front matter, `/veil` | Pass; 87 rendered HTML pages. |
| `python3 tools/verify-rendered-documentation.py /tmp/veil-website-preview/veil /veil` | Pass; 12,395 local links/assets/fragments, document and navigation structure. |
| `python3 tools/verify-documentation.py` | Pass; changed Markdown, navigation and homepage/layout source checks. |
| `npm run check` | Pass; 328 tests, zero failures/skips; typecheck, build and packed consumer pass. |
| `npm run quality -- --base 903efad9c7212f1f1137407cf2401973577a5287` | Exit 0; no dependency/lock/control changes or governance findings. Source/test/harness LOC deltas all zero. |
| `npm run quality -- --base v0.3.1` | Exit 1 retained; exactly the same four accepted controls, no new governance findings. Release deltas remain source +259/-385, tests +322/-0, harness unchanged. |
| Fresh tarball consumer | Installation and `npm ls` confirm 0.4.0. Extracted JavaScript echo and denial examples pass. The three existing TypeScript onboarding snippets compile together with NodeNext/ES2022 and run successfully. |
| Headless Chrome / Playwright | 28 checks across seven routes and widths 320/390/768/1440; HTTP 200, one H1/main, canonical URL, no document horizontal overflow or page errors. |
| Keyboard | Skip link focuses main content; architecture disclosure and mobile documentation menu open by keyboard. |
| axe-core 4.14.0 | Fourteen desktop/mobile WCAG A/AA scans; zero final violations. |
| Contrast review | Gradient backgrounds require manual review in axe. Conservative background-channel/overlay bounds give minimum 6.51:1, above 4.5:1 for normal text. |
| `git diff --check` | Pass. |

The initial accessibility run found unfocusable scrolling code regions on the
developer and five-minute pages. The shared layout now renders code/text blocks
with keyboard focus and an accessible region label; the rerun passes. No rule was
disabled. Gradient checks were reviewed separately rather than treated as an
automatic pass. This review does not constitute accessibility certification or
exhaustive assistive-technology/browser testing.

The qualified Core tarball is unchanged by this assignment. Repacking produced
SHA-256 `d20146d4a195678391882949055a4dc268b4835fa35920eb6f77f545897ac4ee`,
identical to the retained Linux-qualified artifact. Runtime source, contracts,
manifests, locks, test/harness files, workflow and earlier qualification records
are unchanged. The website task does not replace their evidence.

Detailed command/log hashes, accessibility summaries and screenshot hashes are in
[website-evidence-2026-10-25.json](website-evidence-2026-10-25.json).
Review artifacts remain local:

- `/tmp/veil-website-desktop.png` and `/tmp/veil-website-desktop-full.png`
- `/tmp/veil-website-mobile.png`
- `/tmp/veil-website-process.png`
- `/tmp/veil-website-developer.png`
- `/tmp/veil-website-preview/veil` (rendered site)
- `/tmp/veil-website-consumer` (installed examples)

## Deployment and remaining work

There is no remaining local build, route, example or reviewed accessibility blocker.
Remote GitHub Actions rendering and public-site smoke checks belong to the actual
authorized deployment and have not been claimed as completed. Local rendering
used the extracted Jekyll toolchain recorded in the existing qualification; no
renderer dependency or workflow change was needed.

The exact procedure is in
[website build and deployment](../contributing/website.html). After approval,
integrate the reviewed documentation through the normal `main` protection process.
The website branch includes the qualified candidate in its ancestry; if that Core
history is not independently approved for `main`, use the documented site-only
delivery worktree procedure instead of merging that entire history for a website
update.
Changes to `docs/**` on `main` automatically run the existing build-and-deploy
workflow. Monitor the intended run using `gh run list` / `gh run watch`. Manual
`gh workflow run pages.yml --repo veil-runtime/veil --ref main` is only for a
separately authorized dispatch and also deploys; it is not a preview command.

The site may deploy while 0.4.0 remains a candidate. Only after confirmed npm
publication and a published-package consumer check should a separate reviewed
change replace candidate labels or change installation commands to 0.4.0.
