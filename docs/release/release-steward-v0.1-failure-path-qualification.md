# Release Steward v0.1 controlled-execution failure-path qualification

## Scope and verdict

This follow-up starts from Core `origin/develop` at
`b22b817f5b37dc45e614bb6b4954f37473e819ce`, which includes merged PR
#106. It supplements the [prior execute qualification](release-steward-v0.1-execute-qualification.md)
and does not replace its initial or repeat results. Only disposable local Git
repositories and local bare remotes were passed to `apply --execute`; no real
Core or UI checkout was a correction target.

**Verdict:** the controlled-execution failure path is qualified for the
deterministic creation and removal faults below. Recoverable faults leave no
detached worktree, Git registration, or temporary worktree directory. A
persistent cleanup fault rejects execution and identifies the remaining path
for manual cleanup. This does not authorize a real release correction or
establish behavior for every possible filesystem failure.

## Defect and correction

`applyPlan` previously recorded a temporary worktree only after `git worktree
add` returned success. An add that created a directory or Git registration
and then failed escaped cleanup. The failure handler also discarded
`git worktree remove` errors, leaving an undisclosed worktree while reporting
only the original validation failure.

The temporary path is now recorded before the add call. On any execution
failure, cleanup attempts removal twice, inspects Git's worktree registration,
and removes any unregistered temporary directory. If registration remains or
the directory cannot be removed, the command exits unsuccessfully with the
original failure, the remaining path, and an instruction to inspect Git's
worktree list. Successful execution still returns the detached worktree for
review. Approval, source-integrity, allowlist, and validation checks are
unchanged.

## Disposable failure injections

`failure-path.test.mjs` places a deterministic Git wrapper on `PATH` for the
CLI subprocess. Every fixture has one source checkout and a local bare remote.
The tests compare source HEAD, tracked tree, status, documentation content,
remote refs, and tags before and after each invocation. Failed CLI calls must
exit 1 and produce no success JSON.

| Injected fault | Observed outcome |
| --- | --- |
| Add fails after creating an unregistered directory | Original add error propagated; directory removed; one source worktree remains |
| Add succeeds in Git, then reports failure | Original add error propagated; detached worktree and registration removed; one source worktree remains |
| Validator exits 17 and first remove fails | Original validator error propagated; second remove succeeds; no detached worktree or directory remains |
| Validator exits 17 and both removes fail | CLI exits 1; original error and remaining registered path reported; manual removal succeeds |
| Remove reports success without removing the worktree | Registration check catches the false success; CLI exits 1 and reports the remaining path; manual removal succeeds |

The test runner removes each disposable fixture after its assertions. The
manual-cleanup cases deliberately retain the worktree until the diagnostic
and registration assertions complete, then remove it through Git.

## Verification

The implementation SHA-256 is
`0b75b5c2f187a836e2333188629d5f539510f89c6a42ddc737b23c065f9de09e`;
the failure-test SHA-256 is
`996088865160823a57b8817a9a9a739eefa75ac01daa8c576d056ffcada71b14`.
Run from this branch with Node 24, Git, and Python 3:

```sh
node --test tools/release-steward/steward.test.mjs tools/release-steward/failure-path.test.mjs
npm run check
python3 tools/verify-documentation.py
npm run quality -- --base b22b817f5b37dc45e614bb6b4954f37473e819ce
```

- Steward tests: 16 passed, including five new failure cases.
- Full Core check: typecheck passed, all 455 tests passed, and package
  verification passed for a 112-file tarball. An initial sandboxed invocation
  stopped at four subprocess-heavy test files; the approved-command rerun
  passed.
- Source documentation validation: passed. Rendered Jekyll output was not
  checked.
- Quality gate: exit 2 for the same 12 `VEIL-GOV-001` findings in playground
  and showcase assets. Dependency and lockfile deltas were zero; classified
  source, test, and harness LOC deltas were zero; no verification-control
  changes were detected. All 12 findings remain visible, review required,
  and unresolved.

The persistent-removal cases require manual cleanup when Git cannot remove
the registered worktree. The regression tests establish discoverability and
rejection for that condition, then perform cleanup in their disposable repos.
