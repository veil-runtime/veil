# Showcase build and qualification

The current package is **v0.5.0 — Developer Preview**. These demos intentionally remain pinned to v0.4.2; their build, provenance and reproduction commands describe that artifact. See the [current UI guide](https://veil-runtime.github.io/veil/ui.html) for v0.5.0. A demo dependency upgrade requires separate asset and browser qualification.

This private tooling package builds the public playground and Agent Monitor from npm UI 0.4.2. It is not a runtime package and must not be published. Run commands from the repository root:

```sh
npm ci --prefix tools/showcase --ignore-scripts
npm run build --prefix tools/showcase
npm test --prefix tools/showcase
```

`build.mjs` resolves only public package exports, checks the fixed lockfile integrity, embeds actual host source and records asset hashes. Core and Zod must not appear in bundle dependency graphs. Generated browser assets are committed so the existing Jekyll workflow continues to work unchanged.

Modules under `docs/assets/showcase`:

- `agent.mjs`: deterministic host state machine, bounded timeline, timer/run guards and lifecycle policy. No UI or network dependency.
- `definition.mjs`: built-in descriptor and host model-to-data projection.
- `integration.mjs`: real published UI mount, allowlisted host events, revision checks and teardown. The minimal integration boundary for adaptation.
- `shell.mjs`: perspective navigation, snapshot/source inspection and descriptor export. Does not render the monitor's controls or data.

The integration, agent and definition modules are displayed verbatim in the Host Integration perspective. A browser bundle can import `mountAgent` from `integration.mjs`, call it with an existing mount element, and call the returned `dispose()` on teardown. A real integration would replace the simulator with validated service events and enforce authorization server-side. UI does not execute agents.

After a Jekyll build to a directory containing `/veil`, serve that directory and run `tools/showcase/browser.mjs` and `tools/playground-test.mjs`. Set `VEIL_SITE_URL`, `PLAYWRIGHT_BROWSERS_PATH` and `AXE_PATH` as needed; the showcase browser gate requires axe. `contrast.mjs` independently checks the playground editor's foreground/background ratio and occlusion, retaining detailed axe findings. Browser screenshots and JSON evidence are written to `/tmp`.

New examples should provide their own definition, host model and mount lifecycle and reuse the four-perspective shell. Do not add a generic agent framework, private imports, a second renderer, or remote runtime loading.

The integration lab is at `/veil/showcase/lab.html?example=llm`, `operations`, or `workflow`. Its actual host source is `lab.mjs` and `lab-definition.mjs`. `node tools/showcase/lab-browser.mjs` checks all three examples at desktop and mobile widths in Chromium, Firefox and WebKit after building and serving the Jekyll site. Set `VEIL_SITE_URL` and `PLAYWRIGHT_BROWSERS_PATH` as for the other browser gates. Operations and model output are deterministic browser-local simulations; no backend or model credentials are required.
