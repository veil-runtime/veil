---
title: Experimental local quality harness
---

# Experimental local quality harness

Run both the existing functional/package gate and the complementary comparison:

```sh
npm run check
npm run test:quality
npm run quality -- --base <commit>
```

Choose and record the appropriate base before making changes, typically the branch
merge-base with its intended target. Supply that commit explicitly. The harness
prints the resolved commit and never selects a fallback or empty tree. Missing,
invalid, or non-commit revisions are errors. Run it from the repository being
reviewed; it compares the base with that repository's current working tree,
including staged, unstaged, and relevant non-ignored untracked files.

`npm run check` is unchanged and remains authoritative for functionality and
package verification. The harness neither reruns nor replaces those checks. It
uses Node built-ins and read-only Git commands, installs nothing, and writes no
reports or baselines. There is no CI integration in this experiment.

## Output and exit codes

- **0:** Comparison completed; no verification-control changes detected.
- **1:** Comparison completed; **review required** for verification-control changes.
  This does not establish that a change weakens verification.
- **2:** Invalid arguments, invalid base, unreadable/unsupported inputs, malformed
  manifest/lockfile JSON, or another analysis failure. Do not treat this as a pass.

Direct dependency additions, removals, version-specification changes, and category
transitions are informational. Categories are dependencies, devDependencies,
optionalDependencies, and peerDependencies. A move is shown both as category
removal/addition and as a transition. Lockfile added/removed/changed status is
separate; V1 does not analyze the transitive graph or judge dependency necessity.

Growth reports cover JS/TS files (`js`, `jsx`, `ts`, `tsx`, and their `c`/`m`
variants) under `src/` and `test/`, with the two quality harness files counted
separately. Consumer fixture code counts as test code. Documentation, examples,
generated output outside these roots, and other tools are not growth metrics.
Tracked files remain in scope even if ignored; ignored untracked files are omitted.

LOC means physical lines including blank lines and comments. CRLF is normalized
to LF; a final nonempty line without a newline counts as one line. Git computes
gross line additions/removals with CR-at-line-end differences ignored. Renames
are deliberately represented as deletion/addition. Net LOC is after minus before;
gross additions/removals reveal replacements and offsetting deletions. No ceilings
are imposed. New files are counted even when untracked.

Verification controls include all package scripts (conservatively including
helpers and lifecycle hooks), discovered `tsconfig*.json` files, all files under
`test/`, the package verifier, AGENTS.md, both harness files, package export/entry
metadata, `src/index.ts`, and `src/sdk/**/index.ts`. Additions and deletions count.
JSON key ordering does not change package metadata comparisons. File comparisons
ignore CRLF/LF differences but otherwise flag even benign edits for review.

## Review and limitations

Report the chosen base, dependency changes, growth deltas, and every review-required
finding. Do not change the base or relax controls to obtain a pass. Introducing
this harness itself changes protected files and therefore correctly requires
review against the pre-harness branch base.

This is a local change report, not a tamper-proof gate. The current working-tree
script runs; modifying it can bypass its own checks. The self-modification test
proves that an unchanged checker detects candidate harness changes, not that a
modified checker can police itself. Trusted-base execution and protected CI are
deferred. The workflow itself is not checked by V1.

Git configuration, attributes, ignore rules, and index flags can affect discovery
and line diffs. Run against a quiescent working tree; concurrent edits are not an
atomic snapshot. Relevant symlink/non-regular working-tree files are rejected.
This is not an exhaustive repository-integrity or filesystem-security checker.

No semantic architecture checks, complexity analysis, duplication analysis,
composite score, or full public API comparison are implemented. Barrel and metadata
changes prompt review, but signatures can change without either changing. A green
report does not establish architectural compliance, test strength, or API stability.
Verification changes may be legitimate improvements; the tool cannot decide that.

## Deliberate regression tests

`npm run test:quality` creates disposable Git repositories in the OS temporary
directory and removes them after testing. It introduces dependency changes,
offsetting additions/deletions, untracked files, weakened scripts/configuration,
control-file changes, malformed input, and newline-only changes. Tests assert
diagnostics and exit codes without modifying Veil source or its Git history.
Fixtures run no candidate code or package installation. Review local results before
considering any CI integration or broader analysis.
