# Release Steward v0.1 `apply --execute` operational qualification

## Remediation and repeat qualification

Commit `5cc2301` recorded a failed full-qualification verdict because
`command()` ignored `spawnSync.result.error`. The original observations and
JSON are retained below and under `initialQualification` in the
[combined evidence](release-steward-v0.1-execute-evidence.json). This repeat
corrects that defect without changing the approval, source-integrity, or
allowlist checks.

`command()` now rejects any subprocess error, signal, or missing/nonzero exit
status before reading stdout. Error text includes the command name and first
subcommand plus a bounded diagnostic class and error code, without copying
untrusted stderr, arbitrary arguments, or environment values. The prior
`steward.mjs` SHA-256 was
`4b5ae0264b3b5e3f848cf35d50efca6a70c84215636cae4880e189ff06546f72`;
the corrected SHA-256 is
`accf3ac64ff9ced3fe762f4ef755d7f19633f926b627a79f6f551d9667e027fc`.
`cli.mjs` remains
`201d6bc89560d526b9ebe91e4f42f5300e86c1de999364f29d1f2e6b27829ec0`.

The repeat harness used only disposable checkouts and local bare remotes. Its
approved execution changed exactly
`docs/getting-started/evaluate.md` from “Current Core 0.5.0 release guidance.”
to “Current Core 0.6.0 release guidance.” in a detached worktree. The returned
diff SHA-256 was again
`c4ce250960b9620019a868d51e5d961a745ecdae0e1712ad23db9d06dce01526`.
The new plan digest was
`dc235cc94852ead0c80905d5255fa6734ce46cfdc5b1f4e6736d4ad8740ee9aa`.
The repeat rejected wrong approval, altered digest, stale statement, changed
source commit, dirty checkout, two moved-remote cases, a non-allowlisted file,
and a validator exit of 17. It also rejected an injected `EPERM` subprocess
error with reported status `0`. Each source checkout matched its state at
invocation afterward; the failed validator left one worktree, the original
checkout, and no detached worktree. The JSON records commits, tree and file
hashes, status, remote refs, and tags before, at invocation, and after for
cases that deliberately move a source or remote.

The repeat command was:

```sh
node tools/release-steward/qualify-execute.mjs > /tmp/veil-steward-execute-remediation.json
```

The runner's local `git push` commands populate and move only its bare
fixture remotes before apply calls. Inspection of the Release Steward CLI and
subprocess call sites found no push, merge, tag creation, npm publish, or
GitHub release creation operation. No network remote is configured in the
fixtures, and successful and failed apply calls left their remote refs and
tag lists unchanged from invocation state. Real Core and UI repositories were
never passed to apply.

**Verdict:** the controlled `apply --execute` path is operationally qualified
for these disposable-repository scenarios. This does not qualify a real
Core/UI release correction: captured metadata was manually reviewed only in
the synthetic fixture, the fixture documentation validator is deliberately
small, and the prior live audit plan was empty. Worktree-add failure and
cleanup-failure behavior were not exercised. A real correction still needs a
separately reviewed plan and repository-specific validation.

## Initial qualification scope and conclusion (commit `5cc2301`)

This exercise used Core `origin/develop` at
`f0617f9e026f80dccbe146ccaecc3dd78d7b4e3f` on the separate local branch
`qual/release-steward-execute`. The supplied Core worktree and all real Core
and UI repositories were left untouched. The tool was invoked only against
disposable Git repositories with local bare remotes. No production correction,
push, merge, tag, package publication, or GitHub release was performed.

The approved fixture correction produced exactly one changed file in a
detached worktree. Nine invalid or failing executions were rejected, and a
failed validation removed its worktree. **`apply --execute` is not yet fully
operationally qualified**: the subprocess error handling defect below can
mistake a denied subprocess for success. The fixture also uses a deliberately
small documentation validator and manually reviewed synthetic metadata; this
does not authorize any correction from the prior live audit, whose plan was
empty.

## Reproduction and recorded evidence

Run from this branch with Node 24, Git, and Python 3:

```sh
node tools/release-steward/qualify-execute.mjs > /tmp/veil-steward-execute-evidence.json
node --test tools/release-steward/steward.test.mjs
npm run check
npm run quality -- --base f0617f9e026f80dccbe146ccaecc3dd78d7b4e3f
```

The [JSON evidence](release-steward-v0.1-execute-evidence.json) records the
exact fixture commands' outcomes, plan and diff digests, source and remote
commits, file hashes, Git status, tracked tree, remote refs, and tags before
and after each invocation. Its temporary paths are run specific. The harness
asserts the expected outcomes and exits nonzero on a mismatch. It creates no
network remote. The recorded implementation SHA-256 hashes are
`4b5ae0264b3b5e3f848cf35d50efca6a70c84215636cae4880e189ff06546f72`
for `steward.mjs` and
`201d6bc89560d526b9ebe91e4f42f5300e86c1de999364f29d1f2e6b27829ec0`
for `cli.mjs`. The harness SHA-256 is
`075159d464b1a8e6a5d990b5fe9600c3e60bf01e88dc8a441c5c2a05e2030982`.

The approved plan digest was
`e12ed9e387adfedf5c9ab71b043de9b841dd4847ce436f9ab6da38403a8f39a0`.
Its returned diff SHA-256 was
`c4ce250960b9620019a868d51e5d961a745ecdae0e1712ad23db9d06dce01526`:
`docs/getting-started/evaluate.md` changed only from “Current Core 0.5.0
release guidance.” to “Current Core 0.6.0 release guidance.” The source
commit, tracked tree, file hash, status, remote refs, and tags matched their
pre-execution values after the detached worktree was removed.

| Case | Result |
| --- | --- |
| Approved exact replacement | Executed in detached worktree; one allowed file changed; `git diff --check` and fixture documentation validator passed |
| Wrong approval; tampered plan without a new approval | Rejected: plan digest approval mismatch |
| Reapproved plan with stale statement | Rejected: ambiguous or stale statement |
| Reapproved plan targeting a non-allowlisted file | Rejected: unauthorized file |
| Source commit changed | Rejected: stale source |
| Dirty source checkout | Rejected: dirty source |
| Remote and cached tracking ref moved | Rejected: stale remote metadata |
| Advertised remote ref moved while cached main stayed fixed | Rejected: stale or unverified remote |
| Documentation validator exited 17 | Rejected; detached worktree removed |

The source and remote changes made to exercise rejection cases occurred
**before** their `apply` invocation. Their evidence records both the initial
fixture state and the state at invocation; each rejection preserved the latter.
Inspection of the CLI and `applyPlan` command sites found only Git reads,
`git worktree add/remove`, `git diff --check`, and the Core documentation
validator on the apply path. The audit path reads npm and GitHub release
metadata and runs `npm pack` for verification; there is no push, merge, tag
creation, package publish, or GitHub release creation command in the tool.
Local bare remote refs and tag lists were unchanged by successful and failed
apply invocations.

## Implementation defect, separate from the qualification evidence

`tools/release-steward/steward.mjs` `command()` checks `spawnSync`'s `status`
but ignores `result.error`. In the restricted runner, a denied nested Node
spawn returned `error.code === 'EPERM'`, `status === 0`, and empty output. This
reproduction returned an empty string without throwing:

```sh
node --input-type=module -e "import {command} from './tools/release-steward/steward.mjs'; console.log(JSON.stringify({result:command(process.execPath,['-e','process.stdout.write(\"ready\")'],process.cwd())}))"
```

The output was `{"result":""}`. An error on a validation subprocess could
therefore be treated as success in a restricted or failing process environment.
The harness itself checks `result.error` and was run with approved command
execution to complete the disposable repository exercise. Fix and test this
defect before claiming full operational qualification. This record does not
reclassify or resolve any existing Core quality governance finding.

## Verification gates and remaining work

- `node --test tools/release-steward/steward.test.mjs`: passed.
- `npm run check`: the first sandboxed run passed typecheck but stopped at four
  subprocess-heavy test files (`external-model-reasoner`, `external-reasoner`,
  `filesystem-confinement`, and `local-planner`). The approved-command rerun
  passed typecheck, all 455 tests, and package verification (112 tarball files).
- `python3 tools/verify-documentation.py`: passed, checking 307 source links,
  routes, and fragments. It does not validate rendered Jekyll output.
- `npm run quality -- --base f0617f9e026f80dccbe146ccaecc3dd78d7b4e3f`:
  exited 2 with 12 existing `VEIL-GOV-001` findings in the playground and
  showcase assets. Source, test, and classified harness LOC deltas were zero;
  dependency and lockfile deltas were zero; no verification-control change was
  reported. These governance findings remain review required and unresolved.

At the time, the next step was to fix the subprocess error check, add a
regression test for the `error` plus zero-status case, and repeat the execution
qualification. No PR, merge, or production release-state change was part of
that initial record.

## Repeat verification results

- `node --test tools/release-steward/steward.test.mjs`: 11 tests passed with
  approved command execution. The new deterministic test covers `EPERM` with
  status `0`, `ENOENT` with null status, `SIGTERM`, missing status, genuine
  success, nonzero exit, and diagnostic redaction. The sandboxed invocation
  failed before individual cases were reported; it is a sandbox failure, not
  a verified implementation failure.
- `npm run check`: the sandboxed run again passed typecheck and stopped at the
  four subprocess-heavy suites named above. The approved-command rerun passed
  typecheck, all 455 tests, and package verification (112 tarball files).
- `python3 tools/verify-documentation.py`: passed with 307 source links,
  routes, and fragments checked before the final record edit; the final run
  passed with 308 checked. Rendered Jekyll output remains untested.
- `npm run quality -- --base f0617f9e026f80dccbe146ccaecc3dd78d7b4e3f`:
  exited 2 with the same 12 existing `VEIL-GOV-001` findings in playground
  and showcase assets. It reported zero dependency, lockfile, classified
  source/test/harness LOC, and verification-control deltas. The tool and
  qualification files changed as shown by Git; those changes are outside the
  quality gate's reported LOC categories. Existing governance findings remain
  review required and were not suppressed or reclassified.
