---
title: Build, review and deploy the Veil website
description: Build the canonical Jekyll documentation, validate rendered routes under /veil, and use the existing GitHub Pages workflow after approval.
---
# Build, review and deploy the Veil website

The canonical website source is `docs/` in the Veil repository. The homepage is
`docs/index.html` at `/`; the developer portal is `docs/developer.md` at
`/developer.html`. Both use the existing dark visual identity. Keep documentation
in this tree rather than maintaining another website.

## Build and review without deploying

Use Ruby/Jekyll (qualified locally with Ruby 3.3.8 and Jekyll 4.4.1), Python 3,
and the repository's Node development dependencies. On an Ubuntu review host,
Jekyll is available as the distribution package `jekyll`. The GitHub workflow
provides its own renderer through `actions/jekyll-build-pages`.

From the repository root:

```bash
jekyll build --source docs --destination /tmp/veil-pages-review/veil --baseurl /veil --strict_front_matter
python3 tools/verify-rendered-documentation.py /tmp/veil-pages-review/veil /veil
python3 tools/verify-documentation.py
python3 -m http.server 4174 --bind 127.0.0.1 --directory /tmp/veil-pages-review
```

Open `http://127.0.0.1:4174/veil/` locally. Check the homepage, developer portal,
evaluation guide, five-minute example and release notes at desktop and mobile
widths. Use the keyboard to reach links, skip content and open native disclosure
menus. The rendered validator checks local targets, fragments and basic document
structure; it does not fetch external destinations or certify accessibility.

Run the package gate and a quality comparison against the recorded task base:

```bash
npm run check
npm run quality -- --base 8cfd8002cf9a7b3db1d615e6c322165aee46c83a
```

That is the published `v0.4.0` source and the starting `main` commit for the final
publication update. For later tasks, record their own starting main commit as the
task comparison base. Preserve historical release comparisons and their accepted
review-required findings; do not change a base to hide findings.

## Existing deployment configuration

`.github/workflows/pages.yml` is **Deploy Veil Website**. It checks out the
selected ref, configures Pages, builds Jekyll from `./docs` into `./_site`, uploads
the Pages artifact, and deploys it using the `github-pages` environment. The
workflow requires `contents: read`, `pages: write` and `id-token: write`.

The configured site is `https://veil-runtime.github.io/veil/`, with Pages using
GitHub Actions. The Jekyll base URL is `/veil`.

## Authorized deployment procedure

Prepare documentation updates on a short-lived branch from the latest `main`.
Build, validate and review the site before committing and opening a documentation-only
PR. Keep runtime source, tests, dependencies and package artifacts unchanged.
Merge requires maintainer authorization.

A push to `main` changing `docs/**` or the Pages workflow automatically
runs **both build and deployment**. Monitor that run; a second manual dispatch is
not needed for a successful automatic run.

```bash
gh run list --repo veil-runtime/veil --workflow pages.yml --branch main --limit 5
gh run watch RUN_ID --repo veil-runtime/veil --exit-status
```

Replace `RUN_ID` with the intended run's ID and verify its source commit. If a
manual deployment of the approved `main` revision is explicitly required, use:

```bash
gh workflow run pages.yml --repo veil-runtime/veil --ref main
gh run list --repo veil-runtime/veil --workflow pages.yml --branch main --limit 5
gh run watch RUN_ID --repo veil-runtime/veil --exit-status
```

Manual dispatch is also a deployment, not a build-only preview. Honour any
`github-pages` environment approval. After success, visit the public homepage,
developer portal and release guide; confirm assets and `/veil` routes on mobile
and desktop. Website changes do not require npm publication or tag modification.

## Published release references

Core v0.4.0 is published on
[npm](https://www.npmjs.com/package/@veil-runtime/core/v/0.4.0) and has a
[GitHub Release](https://github.com/veil-runtime/veil/releases/tag/v0.4.0).
Use `npm install @veil-runtime/core@0.4.0` in current onboarding and the permanent
[`v0.4.0` tag](https://github.com/veil-runtime/veil/tree/v0.4.0) for release source
references. Preserve earlier candidate evidence and verification reports as
historical records.

For future publication updates, verify the public registry, tag source, GitHub
Release and Pages deployment before changing version claims. Preserve Linux
qualification, unqualified Windows/macOS status, experimental local planning and
the independent Core/UI/Emergence workstreams.
