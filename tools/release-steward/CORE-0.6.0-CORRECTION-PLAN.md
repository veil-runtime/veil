# Core v0.6.0 documentation correction plan and disposition

Source snapshot: `74428f33106e139c93e1578e061138f1624b2828` on cached
`origin/main`; remote URL `https://github.com/veil-runtime/veil.git`.
The remote could not be fetched in this session, so its current advertised head
was not verified. Changes below were prepared manually from the source snapshot,
local tags and public Core release pages. The live CLI plan contains no automatic
patches because npm and GitHub CLI reads failed closed.

| Repository and file | Current source statement | Proposed correction | Evidence | Validation | Risk |
| --- | --- | --- | --- | --- | --- |
| Core `docs/getting-started/evaluate.md` | “UI 0.4.0 is a stable release” | Name UI v0.4.2, explain independent publication and standalone UI, state optional Core peer `^0.4.0` and no qualified Core v0.6.0 compatibility | UI recovered `packages/ui/package.json` on `origin/main`; Core `docs/ecosystem.md`; published-version context | Source links, rendered page, version-reference and installation checks | Low |
| Core `CHANGELOG.md` | Only a v0.4.0 candidate entry | Add published v0.5.0 and v0.6.0 entries; retain the candidate record | [v0.5.0 release](https://github.com/veil-runtime/veil/releases/tag/v0.5.0), [v0.6.0 release](https://github.com/veil-runtime/veil/releases/tag/v0.6.0), local tags targeting `78713066` and `03b5ed6d` | Review against release pages, source links, diff check | Medium: release prose requires human review |
| Core `docs/contributing/releases.md` | “The current release candidate is v0.3.0”; “v0.2.0 remains the latest published package”; future instruction to change v0.3.1 to v0.4.0 | Recast those statements as historical preparation and point to the existing present-status introduction | Existing top section lists Core 0.6.0 and UI 0.4.2; preserved historical governance record | Source links, rendered page, diff check | Low |

The changes are committed in `ec2a48a` for review. The evaluation guide is a
Pages source file; merging a `docs/**` change into `main` triggers the existing
Pages build and deployment workflow. No deployment was performed here.
