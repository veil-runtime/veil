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
uses Node built-ins, the pinned Babel parser and read-only Git commands, installs nothing, and writes no
reports or baselines. There is no CI integration in this experiment.

## Output and exit codes

- **0:** Comparison completed; no verification-control changes or governance findings.
- **1:** Comparison completed; **review required** for verification-control changes.
  This does not establish that a change weakens verification. Also used for
  unapproved static execution references and initial baseline adoption.
- **2:** Invalid arguments, invalid base, unreadable/unsupported inputs, malformed
  manifest/lockfile/baseline JSON, parser failure, unsupported dynamic access,
  or another analysis failure. Do not treat this as a pass.

Direct dependency additions, removals, version-specification changes, and category
transitions are informational. Categories are dependencies, devDependencies,
optionalDependencies, and peerDependencies. A move is shown both as category
removal/addition and as a transition. Lockfile added/removed/changed status is
separate; V1 does not analyze the transitive graph or judge dependency necessity.

Growth reports cover JS/TS files (`js`, `jsx`, `ts`, `tsx`, and their `c`/`m`
variants) under `src/` and `test/`, with the quality and governance implementation/test files counted
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
`test/`, the package verifier, AGENTS.md, all four harness files, the governance baseline, package export/entry
metadata, `src/index.ts`, and `src/sdk/**/index.ts`. Additions and deletions count.
JSON key ordering does not change package metadata comparisons. File comparisons
ignore CRLF/LF differences but otherwise flag even benign edits for review.

## Governance reference check (VEIL-GOV-001)

The checker requires **Node >=24.11** because its direct development dependency
is pinned to `@babel/parser` **8.0.5**. Veil's runtime engine declaration remains
**Node >=24**. Older Node 24 releases cannot run this development tool; installing
development dependencies there may also produce engine warnings. Production
runtime compatibility is not redefined by this tool.

The parser reads source as data, without Babel configuration, candidate execution,
or error recovery. Governance covers every Git-discovered JS/TS file, including
JSX/TSX, examples, tools, tests, root-level files and non-ignored untracked files.
It is independent of the narrower growth metrics and of tsconfig includes.
Tracked generated/ignored code is still scanned. Ignored untracked output and
dependencies are omitted by Git discovery. Unsupported syntax fails analysis.

The rule checks all `execute` member references, regardless of receiver spelling
or type: direct/optional access, literal computed keys, extraction, destructuring,
and binding. Definitions of `execute` are not references. It also recognizes
`execute`/`executePlan` on the JobManager singleton, static imports, namespace
access, simple local assignment aliases, and internal `this`. Destructured
`executePlan` is conservatively checked regardless of receiver. Ordinary runtime
`executePlan` calls are permitted. These are syntax rules, not type inference.

Computed access is inspected by **local usage**, not receiver/binding spelling.
Ordinary reads, comparisons, returns, formatting, data arguments, object fields
and JSX values do not trigger merely because their keys are dynamic. A simple
local binding whose uses are all data uses also passes, including numeric array
selection, result-path traversal and metric accumulators. This removes the
previous data-lookup allowances entirely.

Dynamic calls, optional calls, constructors, tagged templates and `.bind`/`.call`/
`.apply` uses fail closed. Simple aliases and assignments are followed within
local blocks, including later calls and TypeScript expression wrappers. An
unused extraction such as `const fn = obj[key]` still fails: without uses, this
rule cannot distinguish it from an executable extraction. Renaming `fn` to
`value`, or `obj` to `data`, does not change that result. Unresolved bindings,
`var` extractions, alias cycles and ambiguous shadowing also fail closed.

Computed destructuring, reflective getter references, nonliteral module loading,
and JobManager require/re-export forms remain conservative unsupported findings.
The two pre-ADR-0012 dynamic sites have individual, specific explanations: the
input validator selects and **calls** `TYPE_CHECKS[definition.type]`, and the
package fixture intentionally imports enumerated private paths to assert rejection.
Neither receives a general data-access exemption.

The post-bypass-removal inventory contained **14 sites**: six `GOVERNED_MACHINERY`,
one `LEGITIMATE_NON_CAPABILITY_EXECUTE`, and seven `TEST_OR_FIXTURE`.
The earlier generic HTTP migration reduced 17 sites to 16. The subsequent
LinkedIn migration and stored-job endpoint retirement remove the last two
`LEGACY_BYPASS` entries (16 → 14); the other 14 entries are unchanged.
No replacement allowance was added for those retired routes.

ADR-0012 updates five anchors in the edited validator/runtime/JobManager declarations
and adds four individually reviewed diagnostic-test sites: descriptor inspection,
descriptor copying, fixed-module resolution and fixed-module reload. These test
sites exercise immutability and separate-module issuance identity, not capability
execution. The candidate inventory now has **18 sites** (six governed, one
legitimate non-capability execution, eleven test/fixture). The checker is unchanged;
there remain zero route allowances and zero legacy bypass entries. Against the
fixed pre-change base, moved/new anchors remain untrusted even after this inventory
update; unsupported dynamic findings retain exit 2 pending trusted-branch adoption.
The [ADR-0012 individual inventory review](../architecture/adr-0012-governance-inventory-review.html)
approves those exact nine changes and records why the fixed-base comparison
continues to treat them as untrusted; no checker rule changes.

Each entry in `tools/quality-governance-baseline.json` records a path, kind,
classification, reason and SHA-256 anchor. The anchor includes the normalized
enclosing top-level statement, its index and the reference's structural position.
Comments, whitespace, line endings and quote style do not change it. Moving,
copying, renaming a receiver, changing its containing declaration, or inserting
another reference cannot reuse the allowance. Unrelated edits within that
declaration or earlier top-level insertions may require re-review as a tradeoff
for simple, conservative identity. No wildcard/file/directory allowances exist.

Only the manifest read from the explicit **Git comparison base** grants
allowances. Its entries must match actual sites in that base. Candidate entries
are schema-validated and their changes require review, but cannot authorize
anything in that comparison. Removed sites are reported as retired; remove their
candidate entries too. Do not choose a different base merely to make a proposed
allowance pass. Review and adopt an allowance into the trusted branch first.

**Initial adoption:** base `6e73af8` has no manifest. The checker uses zero trusted
allowances, reports adoption as review required, and reports all unmatched sites.
Unmatched dynamic sites produce exit 2 even when the candidate inventory explains
them. This expected non-green first comparison must be reviewed; the candidate
manifest must never bootstrap its own authority. Subsequent comparisons use the
manifest only once it exists in their legitimate trusted base.

For v0.2.0, the maintainer explicitly accepted the reviewed 16-site inventory
unchanged, its two legacy exceptions, the 20 reviewed verification-control changes,
and these detection limits. Final release preparation uses accepted baseline
`e4df5be69105e8d2fcb76bd6b9c8e249beec3064`; the fixed release-scope comparison
against `0b591f38b6146179cfea9d66f5bf50a1773520d7` remains exit 2, not a pass.
See the [adoption record](releases.html#accepted-governance-baseline). This human
decision grants no additional allowances and does not change checker behavior.

The former LinkedIn and stored-job route exceptions are removed in the current
hardening work, compared against `bb3f34e4f938096acec897159f0f56283c11697a`.
LinkedIn status submits a plan through OperatorRuntime; stored-job execution
returns 410 without loading or executing a job. The historical v0.2.0 adoption
record above remains a record of that earlier scope.

For `src/api/routes/`, recognized execution references (including direct
JobManager entry and unsupported dynamic accesses) cannot use baseline
allowances, even if an old trusted baseline contains one. Candidate manifests
containing route allowances are rejected. Direct import/require/re-export source
strings containing `capabilities/` or `providers/` are also rejected there.
Normal runtime `run`/`executePlan` references remain permitted; their receiver's
identity is not proven by this syntax check. Nonexecuting JobManager methods
are not prohibited. Inventory tests require zero route or legacy allowances
and exact correspondence between discovered sites and the 18 current entries.

This proves absence of the recognized forbidden syntax within the analyzed
route files, not transitive absence of provider access. Helpers imported under
other names, barrels, alias module paths, callbacks, raw `fetch`/process APIs,
or code outside this route directory can require separate review. Existing
whole-tree execution-reference checks still apply elsewhere. See the
[entry inventory and behavior changes](../architecture/governance-hardening.html).

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

The reference rule does not track endpoint callers or HTTP wiring, perform
call-graph analysis, follow objects through arbitrary function calls/containers,
prove authorization semantics, or detect arbitrary eval/proxy/reflective aliases.
Simple alias recognition is conservative and can over-report shadowed names.
The local dynamic-use rule treats returns, call arguments and object/JSX fields
as data contexts; it does not prove how another function or a later consumer
uses those values. It does not follow callbacks across call boundaries or values
through containers. Explicit `execute` references remain checked even in data
contexts. Unused dynamic extractions and local ambiguity can still over-report.
New unrelated APIs named `execute` also require review. Dynamic failures must not
be described as proof of a bypass; they mean the checker cannot exclude one.

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

Run just governance tests with `node --test tools/quality-governance.test.mjs`.
The test named `complete relevant repository parses and current individual sites
classify correctly` verifies the entire current Git-discovered source inventory
against the candidate manifest; this is a compatibility/inventory check, not
authorization of candidate exceptions. At introduction, Babel 8.0.5 parsed all
112 relevant files on Node 24.18.1. The complete quality suite also exercises
whole-tree discovery, untracked files, malformed syntax and control reporting.
