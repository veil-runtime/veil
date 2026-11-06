# Public UI asset provenance

The playground and showcase use the same build tool and pinned published **@veil-runtime/ui@0.4.2** artifact. Both are local esbuild 0.28.2 ESM bundles targeting ES2022; neither uses a CDN or a replacement renderer. Only the published `/dom` and `/interface` entry points are imported. The build checks that no Core or Zod code enters either browser bundle.

From the repository root:

```sh
npm ci --prefix tools/showcase --ignore-scripts
npm run build --prefix tools/showcase
npm test --prefix tools/showcase
```

The isolated manifest/lockfile pins npm artifact integrity; Core package dependencies and publication are unaffected. Jekyll serves the committed bundles and requires no Node build step. Changes to source modules must be followed by the asset build and provenance tests. The showcase embeds its actual host modules during this build; displayed source is not a second illustrative implementation.

UI tarball SHA-256: `4c350df4cc767128583bb16627822da3ba43c8279817762597dd88394312f4f7`.
UI npm integrity: `sha512-DTPTsIZiB0QYdBIPIABI89pL1kT9TNWDoYIj0jQ8s1ALFcsT3Kis3jGNfuRHxF8UrNgRdKZhXCAtIO4dTHkhBw==`.
Bundle and host-module SHA-256 values are in `../showcase/provenance.json`. UI's Apache-2.0 license and NOTICE are retained here and apply to its code in both bundles.

Build Jekyll using `docs/_config.yml` and `/veil`, serve the built output, then run:

```sh
VEIL_SITE_URL=http://127.0.0.1:4176/veil node tools/playground-test.mjs
VEIL_SITE_URL=http://127.0.0.1:4176/veil AXE_PATH=/path/to/axe.min.js node tools/showcase/browser.mjs
VEIL_SITE_URL=http://127.0.0.1:4176/veil AXE_PATH=/path/to/axe.min.js node tools/showcase/contrast.mjs
```

Browser tests use installed Playwright engines and `/usr/bin/google-chrome`; set `PLAYWRIGHT_BROWSERS_PATH` for non-default engine locations. Axe is supplied separately for qualification, not shipped to visitors. Tests retain incomplete checks as evidence, not passes. See the Phase 2 release report for results and environmental paths.

The playground preserves its 32 KiB JSON editor, render/reset/copy, five examples, inspection and event history. JSON is validated before acceptance; host actions remain allowlisted. Text uses the runtime's inert text rendering. CSP blocks network, arbitrary scripts, images, objects and form submission. No arbitrary JavaScript editor or untrusted component factories are available. This is bounded in-process rendering, not a JavaScript sandbox.

Inspection output is capped at 16,000 characters and history at 20 entries. The playground AI descriptor remains an authored static template. The showcase agent is deterministic host code, not a connected agent or model. No API keys or backend credentials are present. Preparation errors preserve accepted state; renderer commit failures cannot promise rollback of DOM changes or external effects.
