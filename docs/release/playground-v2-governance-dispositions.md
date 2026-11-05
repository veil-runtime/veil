# UI 0.4.0 playground governance review

Status: reviewed technical dispositions; **maintainer approval pending for all three sites**. Acceptance of qualification evidence for PR preparation is not approval to waive findings. This record neither changes nor suppresses VEIL-GOV-001. Quality remains exit 2.

Scope: published UI 0.4.0, tarball SHA-256 `783459ed25fbc5485a84b2668166b415cf1daddeeb861f2aacd53465c8da460f`, byte-identical rebundle documented in [qualification](playground-v2-qualification.md). Prior 0.3.0 decisions do not authorize this artifact.

| ID / bundle location | Review and proposed disposition | Maintainer decision |
| --- | --- | --- |
| V2-A — playground.js:47 | Published validation-safety.js:49 inspects own descriptors and rejects accessors. Reachable from every JSON definition; JSON ingress cannot construct getters/proxies/functions. Security-protective bounded-data validation, not capability execution. Retain check; recommend accepting this exact site for JSON-only playground ingress. | PENDING |
| V2-B — playground.js:761 | Published dom.js:314 selects a trusted custom factory. Potential executable extension in general hosts, but unreachable for accepted playground JSON: no host factories registered and unknown components rejected. Recommend accepting only this empty-registry integration. | PENDING |
| V2-C — playground.js:869 | Published dom.js:412 reads an own error string constructed by interface.js:482–517 and assigns it to textContent. Reachable through fields, but no executable extraction, invocation or HTML interpretation. Recommend classifying as passive validation-data lookup and accepting this exact site. | PENDING |

No identified exploitable descriptor path in this integration. Residual assumptions: trusted browser/runtime; 32 KiB JSON-only ingress; reserved-key and runtime bounds; built-ins only; fixed demo action allowlist; no host registry additions. Any change to those assumptions requires renewed review. Trusted JS proxies or unsafe factories in other hosts are outside these recommendations.

Approval must identify V2-A/B/C, accepting maintainer, date and scope. Until explicit approval is recorded, none is waived and production promotion remains NO-GO. Develop integration has occurred; that merge does not substitute for these decisions. A draft promotion PR may collect evidence while approval remains pending. No runtime, architecture contract, scanner rule or baseline change is requested by this record.

## Exact-site proposals for maintainer decision

Reviewed against develop `01359e1bdb06e2ead2c0a9a584e454d9af7d8743`. Locations below refer to the unchanged committed `docs/assets/playground/playground.js` and published tarball `package/dist` files, not repository TypeScript line numbers. The published artifact was rebuilt with the documented DOM/interface aliases and compared byte-for-byte with the bundle during production qualification. The source-to-bundle mapping is established by matching each statement and its enclosing validation/rendering code. No finding is suppressed by this document.

### V2-A — bounded descriptor validation

- Scanner location: `docs/assets/playground/playground.js:47:28`, `Object.getOwnPropertyDescriptor(item, key)`; published source: `dist/validation-safety.js:49`.
- Reachability: editor text passes both character and UTF-8 32 KiB limits, then `JSON.parse`, before controller definition validation and bounded data copying. This descriptor inspection is reachable for JSON objects. JSON cannot construct getters, functions or proxies. Reserved keys are rejected before inspection; non-enumerable/accessor descriptors are rejected immediately afterwards. Traversal, key, array and data-size bounds remain enforced.
- Risk: descriptor reflection can execute a proxy trap when a trusted JavaScript host supplies a proxy in another integration. This playground's JSON ingress cannot supply one. This check does not resolve capabilities, invoke an extracted function, or enter Core execution. Browser/runtime integrity remains a trust assumption; this is not an arbitrary-JavaScript sandbox claim.
- Proposed decision: **accept this exact defensive validation site for this JSON-only playground integration; retain the check unchanged**. Removing it would weaken validation. If ingress later accepts arbitrary host objects, reassess proxy reachability before promotion; do not extend this acceptance to other UI hosts.
- Maintainer authorization: **PENDING** — record name, date, accepted scope or requested remediation.

### V2-B — unavailable custom component factory

- Scanner location: `docs/assets/playground/playground.js:761:66`, `components[node.component]`; published source: `dist/dom.js:314`. The selected factory would be invoked at published `dist/dom.js:320`.
- Reachability: `source.mjs` supplies only the `demo` action allowlist and callbacks to `createMountedInterface`; it supplies no custom component registry. The runtime validates component names against built-ins and registered components. Accepted playground JSON uses built-ins, whose renderer branches precede this fallback. Unknown components are rejected; descriptor data cannot register a factory or supply executable values.
- Risk: this is genuinely executable extension dispatch in general-purpose UI hosts. It is not a passive lookup and should not receive a global false-positive classification. Adding a registry or broadening the admitted component vocabulary could make the path reachable; trusted factories can perform external effects in other integrations.
- Proposed decision: **accept only the unreachable fallback in this empty-registry playground integration**, with renewed review required for any factory registration, ingress, vocabulary or renderer change. No bundle surgery is proposed: modifying the distribution would break artifact equivalence. If the maintainer declines this narrow acceptance, keep promotion blocked and request an upstream built-ins-only distribution or equivalent reviewed remediation, followed by rebundling and requalification.
- Maintainer authorization: **PENDING** — record name, date, accepted scope or requested remediation.

### V2-C — passive validation error lookup

- Scanner location: `docs/assets/playground/playground.js:869:55`, `errors[node.key]`; published source: `dist/dom.js:412`. Producer: `getInterfaceValidation` in published `dist/interface.js:482–524` (fixed validation messages and bounded numeric-rule interpolation).
- Reachability: field descriptors select an own validation error using a validated node key. The error map is recomputed internally from accepted state; callers cannot inject an alternate error map. Values are strings, selected only after `Object.hasOwn`, and assigned to `textContent` on the next line.
- Risk: reachable data selection, but no callable extraction/invocation, HTML interpretation, capability lookup or execution authority. Reserved-key rejection and own-property checking prevent inherited-property selection. Changes to the producer's value types or the DOM sink require renewed review.
- Proposed decision: **accept this exact site as passive validation-data lookup**. No runtime remediation is justified by the current dataflow; retain own-property checks, validation and text-only output. Do not generalize this disposition to other computed lookups.
- Maintainer authorization: **PENDING** — record name, date, accepted scope or requested remediation.

## Evidence boundaries

The browser suite checks unknown-component and forbidden-action rejection, invalid JSON/size recovery, literal HTML text rendering, CSP script/network blocking, and form validation in Chromium, Firefox and WebKit. These probes support the integration assumptions; they do not prove all possible inputs safe. Artifact equivalence and source inspection establish the three dataflows above. Quality must continue to report all three review-required findings until the normal maintainer governance process determines their treatment; this proposal does not request scanner, baseline or allowance edits.
