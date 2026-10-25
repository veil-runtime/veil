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
evaluation guide, five-minute example and candidate notes at desktop and mobile
widths. Use the keyboard to reach links, skip content and open native disclosure
menus. The rendered validator checks local targets, fragments and basic document
structure; it does not fetch external destinations or certify accessibility.

Run the package gate and a quality comparison against the recorded task base:

```bash
npm run check
npm run quality -- --base 903efad9c7212f1f1137407cf2401973577a5287
```

That base is the qualified Core candidate before the website-only assignment.
The separate release-scope comparison remains `v0.3.1`, with its four accepted
review-required controls; website work does not replace or relax that comparison.

## Existing deployment configuration

`.github/workflows/pages.yml` is **Deploy Veil Website**. It checks out the
selected ref, configures Pages, builds Jekyll from `./docs` into `./_site`, uploads
the Pages artifact, and deploys it using the `github-pages` environment. The
workflow requires `contents: read`, `pages: write` and `id-token: write`.

The configured site is `https://veil-runtime.github.io/veil/`, with Pages using
GitHub Actions. The Jekyll base URL is `/veil`.

## Authorized deployment procedure

No deployment is part of website preparation. After approval, a maintainer can
integrate the reviewed website changes into `main` through the normal protected-branch
process. The website branch starts from the qualified Core candidate, not `main`;
its full history also contains Core release work. If that work has not separately
been approved for `main`, prepare a site-only delivery branch instead:

```bash
git fetch origin
git worktree add -b docs/pages-v0.4.0-delivery /tmp/veil-pages-delivery origin/main
git -C /tmp/veil-pages-delivery restore --source origin/docs/core-v0.4.0-website -- docs tools/verify-documentation.py tools/verify-rendered-documentation.py
```

This transfers the complete reviewed documentation tree and its existing Python
verifiers, without transferring the candidate's runtime or package changes.
Build, validate and review that delivery branch before committing it and opening
the documentation PR. Use its recorded `origin/main` starting commit as the
delivery quality comparison base; the website task's original comparison remains
recorded above. If `main` already contains the qualified candidate, the website
commit can follow the normal documentation PR path directly.

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
developer portal and candidate guide; confirm assets and `/veil` routes on mobile
and desktop. No npm publication, tag or GitHub release is required to deploy
candidate-labelled documentation.

## Version wording after npm publication

Until verified publication, retain **unpublished v0.4.0 candidate** and
**latest published v0.3.1** across the homepage, developer portal, layout,
installation, evaluation, five-minute and candidate pages. Confirm the registry
and install the published artifact before changing those labels:

```bash
npm view @veil-runtime/core dist-tags versions --json
```

Updating publication labels is a separate reviewed change. Preserve Linux
qualification, unqualified Windows/macOS status, experimental local planning and
the separate Core/UI/Emergence package boundaries regardless of publication.
