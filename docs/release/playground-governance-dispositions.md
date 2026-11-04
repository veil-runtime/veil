# Maintainer decisions — playground quality findings

These are two narrow proposals. They do not change scanner controls and are not approved until a maintainer records a decision below. The exact source sites are in the published `@veil-runtime/ui@0.3.0` artifact (tarball SHA-256 `42496de0e5c73044b6336468599d129f6d95764b979f14c1024375a5a49356fd`), bundled without modification in `docs/assets/playground/playground.js`.

## A. Bounded-data descriptor inspection

**Site:** UI `packages/ui/src/validation-safety.ts`, `assertBoundedData` → nested `visit`, descriptor inspection (`Object.getOwnPropertyDescriptor`; published `dist/validation-safety.js`, bundled around line 47).

**Why it exists:** inspect own data properties without invoking getters; reject accessors, non-enumerable properties, cycles, unsafe keys and over-limit data before recursive schema validation.

**Boundary and evidence:** every parsed playground definition enters `validateInterfaceDefinition`, which calls this check. The playground caps text before JSON parsing and obtains values only from `JSON.parse`; JSON cannot represent getters, functions or Proxies. The runtime rejects dangerous keys and enforces depth/node/size limits. This operation reads descriptors and rejects accessors; it does not call descriptor values.

**Residual risk:** other trusted host integrations may pass proxies or adversarial object graphs to the public API. The browser runtime is trusted. This disposition applies only to the published UI artifact used by this static playground and this validation site, not blanket authorization for descriptor inspection elsewhere.

**Proposed disposition:** accept this exact site for this integration. Retain the published validation code and all limits.

**Maintainer decision:** [ ] Accept proposed scope  [ ] Reject  [ ] Request changes

Decision by: ____________________  Date: __________  Notes: ______________________________

## B. Trusted custom-component registry lookup

**Site:** UI `packages/ui/src/dom.ts`, `mountInterface` → node preparation custom-component branch (`components[node.component]`; published `dist/dom.js`, bundled around line 608; a related lookup exists in `render`).

**Why it exists:** allow a trusted host to register custom DOM factories as a supported UI extension point.

**Boundary and evidence:** factory functions come from the host registry, never from interface JSON. The playground supplies no `components` registry. `createMountedInterface` derives permitted names from host registry keys; `validateInterfaceDefinition` rejects names outside the nine built-ins plus registered names. The playground accepts only its fixed `demo` action and has no external effects. The custom branch is unreachable for definitions accepted by this playground.

**Residual risk:** a future host change that registers an unsafe factory or broadens action dispatch could execute trusted host code or effects. This decision does not approve any such factory or action source. Review again if registry or action wiring changes.

**Proposed disposition:** accept this exact lookup site only for the playground integration with an empty custom-component registry and its existing schema/action boundaries.

**Maintainer decision:** [ ] Accept proposed scope  [ ] Reject  [ ] Request changes

Decision by: ____________________  Date: __________  Notes: ______________________________

## Release gate

Neither proposal is pre-approved. Keep the quality controls unchanged. Deployment requires an explicit maintainer decision on both findings and completion of the [manual Safari checklist](safari-acceptance-checklist.md) with recorded evidence. WebKit automation's down/up-without-click result remains unresolved until the manual pointer check establishes browser behavior.
