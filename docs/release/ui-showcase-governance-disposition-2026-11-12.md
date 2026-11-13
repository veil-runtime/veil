# Conditional maintainer disposition: generated Veil UI governance findings

Date: 2026-11-12. Review base: latest `origin/develop` at
`6a829ee6f1adaab17c3dc77eb824314475226d79`. Scope: the twelve existing
VEIL-GOV-001 findings in the four generated browser bundles below. The maintainer
conditionally accepts these exact sites for the current playground, Agent Monitor,
Backend Lab and integration lab, subject to the restrictions in this record. This
is a human disposition, not a scanner allowance, a passing quality gate, or
approval to deploy or publish.

## Artifact identity and exact findings

The bundles contain code from published `@veil-runtime/ui@0.4.2`, pinned in
`tools/showcase/package.json` and `tools/showcase/package-lock.json` at
`https://registry.npmjs.org/@veil-runtime/ui/-/ui-0.4.2.tgz` with integrity
`sha512-DTPTsIZiB0QYdBIPIABI89pL1kT9TNWDoYIj0jQ8s1ALFcsT3Kis3jGNfuRHxF8UrNgRdKZhXCAtIO4dTHkhBw==`.
`tools/showcase/build.mjs` checks the installed version, lock entry and integrity
before bundling; it excludes Core and Zod from browser dependency graphs.
`docs/assets/showcase/provenance.json` records the same package identity, bundle
SHA-256 values and host-source hashes. The table's hashes were independently
checked against the tracked files. Locations are line:column from
`npm run quality -- --base 6a829ee6f1adaab17c3dc77eb824314475226d79`.

| Bundle | Bundle SHA-256 | Reflective descriptor read | Custom-component lookup | Field-error lookup |
| --- | --- | --- | --- | --- |
| `docs/assets/playground/playground.js` | `f396966ebfe875916a732a3c496bfaadfc888f0111c7c0e5f98e7b1c997e9d72` | `47:28` | `761:66` | `877:55` |
| `docs/assets/showcase/showcase.js` | `cd81a087559244d261b87dfef0df466c0886493ae6c6f43f4f66a5e631b2985a` | `47:28` | `761:66` | `877:55` |
| `docs/assets/showcase/backend.js` | `750970d38b2264899e0ab84acc15a65772817ab977d629e1134f04e06b34eb13` | `47:28` | `761:66` | `877:55` |
| `docs/assets/showcase/lab.js` | `6f132277c7d4fbc8e9480c0a5583eccf613c700ec4a24a4c605454bbede8782d` | `47:29` | `761:66` | `877:55` |

Each row names three distinct findings, for twelve total. The first site is
`Object.getOwnPropertyDescriptor(item, key)` in the bundled UI
`validation-safety.js`; the lab bundle renames the local variable but retains
the operation. The second is `components[node.component]` in the bundled UI
`dom.js`, followed by `custom(node, ...)`. The third is `errors[node.key]` in
that module, followed by assignment of the error string to `textContent` and
use in `aria-invalid`. The checker calls the first an unsupported reflective
property access and the other two unsupported dynamic invocation or executable
extraction. None is authored in a Core runtime module or showcase host module.

## Group decisions and limits

1. **Descriptor read — accepted generated-artifact review (four sites).** The
   bounded-data validator inspects an own descriptor to reject accessor and
   non-enumerable properties before recursively copying data. It does not call
   a descriptor value or enter Core capability execution. The playground parses
   editor input with `JSON.parse`, which cannot produce accessors or Proxies.
   Other host-supplied objects can contain Proxies; descriptor traps can execute
   host code. This decision covers only the identified package and bundles,
   with their current input-validation boundaries.
2. **Custom-component lookup — accepted generated-artifact review (four sites).**
   This is a real UI extension invocation. The four current host integrations
   supply no `components` option, so the registry defaults to empty and a
   definition cannot select a custom factory. Built-in component validation and
   the hosts' declared action handling remain in place. A future host-provided
   factory may execute arbitrary trusted host code and needs a new review.
   This acceptance grants no Core execution, provider, registry or authorization
   authority to interface data.
3. **Field-error lookup — accepted false-positive disposition (four sites).**
   The own-key-guarded lookup reads a validation message and writes it as DOM
   text; it does not call or extract a callable. The validator's local-use
   analysis conservatively treats assignment to a member property such as
   `element.textContent` as possible executable extraction. A focused check
   reports this pattern while allowing the same value passed as a data argument.
   The current UI code uses the message only for text and `aria-invalid`.

This acceptance **does not extend** to any modified bundle, changed bundle hash,
other UI package version or integrity, nonempty custom-component registry,
different host wiring, or different executable context. Those changes require
renewed site-specific security and governance review. It is not a general
exception for reflective access, dynamic calls or computed property reads.

## Gate and release status

The unchanged quality gate still exits **2** on the twelve untrusted sites;
the four descriptor findings and eight dynamic findings remain visible. This
record does not modify `tools/quality-governance.mjs`, its baseline, the
comparison base, or any generated bundle, and does not turn that result into an
automated pass. The gate reported no Core source, test or harness LOC delta,
root dependency or lockfile change, or verification-control change relative to
the stated base. The Core functional/package check passed separately.

No finding establishes a Core capability bypass, package-integrity failure or
runtime-security defect in these exact integrations. The nonzero governance gate
remains a release-process blocker until the maintainer accepts this bounded
disposition as review evidence. Hosted Pages, physical-device/Safari and manual
assistive-technology acceptance remain separate release work recorded in the
showcase final delivery note. This record does not authorize promotion, tagging,
publication or deployment.

An optional **separate future validator change** may distinguish data-only
member assignments from executable extraction. It needs a narrowly scoped rule
change and regression tests that continue to detect actual dynamic invocation
and callable extraction. No validator change is part of this disposition.
