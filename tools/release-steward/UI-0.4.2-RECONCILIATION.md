# UI v0.4.2 release reconciliation proposal

The local UI tag inventory contains `v0.4.0` and `v0.4.1`, but no `v0.4.2`.
The public `releases/tag/v0.4.2` page returned 404 on 12 November 2026.
GitHub CLI and remote fetch were unavailable due network resolution failures,
so recheck the remote tag and release immediately before any administration.

The original v0.4.2 source commit is
`b1b5a3ade4be929674872cbc6c81d3a49aa1ede7` (leaf text stability fix).
The candidate qualification record gives a 76,149-byte tarball SHA-256 of
`5346b2bc8c0b4de068c07592efc8e381cea8a66638f17b60c8d67337335f66ff`.
The retained final and qualification tarballs both match this hash locally.
PR #8 recovered this source and merged it in `bc3249cd88a466e05041b5542b400d281114eb0c`.
`git diff b1b5a3a..bc3249c -- packages/ui` is empty: the recovery merge adds
qualification tooling and documentation without changing the package source.
The retained read-only `--verify-published` qualification at
`/tmp/veil-ui-governance-published-qualification-final-20261112/` records a
successful official-registry metadata and tarball download on 12 November 2026.
Its `published-artifact-verification.json` records SHA-512 integrity
`sha512-DTPTsIZiB0QYdBIPIABI89pL1kT9TNWDoYIj0jQ8s1ALFcsT3Kis3jGNfuRHxF8UrNgRdKZhXCAtIO4dTHkhBw==`
and SHA-256 `5346b2bc8c0b4de068c07592efc8e381cea8a66638f17b60c8d67337335f66ff`.
The retained downloaded tarball and candidate tarball match both digests.
Fresh registry access was unavailable during this final review; rerun the
read-only verifier before release administration.

The existing UI tags use a `v` prefix. `v0.4.1` targets its package-version
preparation commit, while `v0.4.0` targets the release merge. If a fresh remote
check still lacks v0.4.2 and the published artifact remains consistent with
the retained verification, tag the exact
source commit `b1b5a3ade4be929674872cbc6c81d3a49aa1ede7` as `v0.4.2`,
then create a GitHub release against that tag after maintainer review.

Proposed release notes, grounded in the source changelog and candidate record:

> Veil UI v0.4.2 preserves existing text nodes for Text, Heading, Status and
> Button updates, avoiding WebKit mouse activation loss when an input blur
> commits state during a button press. Public APIs, action handlers, revision
> behavior, keyed reconciliation and transaction boundaries remain unchanged.
> Cross-browser regression coverage includes ordinary mouse activation,
> changed and unchanged text, escaping, nested keyed identity and rejected
> updates. Core remains an optional peer with range `^0.4.0`; standalone UI
> use does not require Core. This release makes no Core v0.6.0 compatibility
> claim.

No tag, GitHub release, publication or deployment was performed.
