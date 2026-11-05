# Playground asset provenance

`playground.js` bundles `source.mjs` with the published `@veil-runtime/ui@0.4.0` DOM entry point using esbuild 0.28.2. The runtime is the actual npm artifact, not a replacement renderer. UI's Apache-2.0 license and NOTICE are retained alongside it. No Core or Zod code is required by this entry point's dependency graph. No CDN is used at runtime.

To rebuild in an isolated directory, install `@veil-runtime/ui@0.4.0` and `esbuild@0.28.2` there, then run that directory's esbuild binary from the repository root:

```sh
/path/to/build/node_modules/.bin/esbuild docs/assets/playground/source.mjs --bundle --format=esm --platform=browser --target=es2022 --alias:@veil-runtime/ui/dom=/path/to/build/node_modules/@veil-runtime/ui/dist/dom.js --alias:@veil-runtime/ui/interface=/path/to/build/node_modules/@veil-runtime/ui/dist/interface.js --outfile=docs/assets/playground/playground.js
```

The alias resolves the package's published `/dom` export during bundling. Internal modules remain bundled implementation details. The browser loads only the generated local asset. Jekyll does not need Node dependencies or a new build step.

Build with the existing Jekyll configuration and `/veil` base path; serve the output on localhost:4174 and run `node tools/playground-test.mjs`. This exercises the gallery, real UI events, rejection and recovery, export, escaping and responsive widths.

Security: JSON only, 32 KiB before parsing, built-in runtime depth/node/string/table limits, no custom factories, only the host's `demo` action, textContent rendering, CSP blocks network, images, objects and forms. The editor has no JavaScript execution feature. This is an in-process bounded renderer, not a sandbox for trusted arbitrary JavaScript. Browsers and the published runtime remain trusted. Clipboard export requires browser permission or manual selection.

AI generation is deferred: no backend is available. A future provider-independent server adapter must authenticate/rate-limit requests, bound provider output before parsing, return JSON only and apply the same validation and action allowlist. It must keep credentials server-side. Current examples are authored templates.

Published tarball SHA-256: `783459ed25fbc5485a84b2668166b415cf1daddeeb861f2aacd53465c8da460f`. Inspection output is capped at 16,000 characters and history at 20 entries. The AI example is static.
