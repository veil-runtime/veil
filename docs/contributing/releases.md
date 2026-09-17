---
title: Releases
---
# Releases

Current package version is 0.1.3. Package verification asserts that version. Follow maintainer release direction.

## Website changes safe before release

Keep the published version at v0.1.3 in installation guidance, homepage and docs
footer. Positioning, public-API examples, corrected links, and accurate architecture
explanations can land before release. Hardening and introspection documentation
must remain explicitly marked **unreleased v0.1.4**. The local introspection feature
still needs its PR reviewed and merged; a website update does not establish its
release availability.

## Website changes that wait for the release

Only after v0.1.4 is published and verified:

- Update the published-version text in `docs/index.html`, `docs/_layouts/docs.html`,
  `docs/developer.md`, `docs/getting-started/installation.md`, and this page.
- Update the upcoming section and `docs/getting-started/upcoming-v0.1.4.md`, plus its
  navigation label, to describe released behavior. Update explicit unreleased
  labels across concepts, architecture and reference pages after checking final scope.
- Recheck npm installation and run the introspection examples against the published
  package. Keep package version, capability version and ExecutionPlan format distinct.
- Add an announcement or changelog/release links only when their targets exist.
  `docs/release/` is excluded from the Pages build; do not link to an unbuilt site route.
- Build the Pages site, check internal links and preview desktop/mobile layouts.

Do not create an install command for an unpublished v0.1.4 package or treat
`develop` documentation as proof of npm availability.
