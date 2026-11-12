# Release Steward v0.1

Read-only release inventory and a constrained documentation correction workflow. Requires Node 24, Git, npm and GitHub CLI. Copy `config.example.json`, set absolute checkout paths, and fetch default branches and tags before auditing. The audit reads npm registry metadata and GitHub releases with bounded subprocess timeouts, and compares downloaded tarball bytes with registry SHA-512 integrity. Failed reads remain unverified. Captured metadata is marked unverified and cannot authorize automatic patches.

```sh
node tools/release-steward/cli.mjs audit --config /tmp/veil-steward-config.json --output /tmp/veil-audit.json --markdown /tmp/veil-audit.md
node tools/release-steward/cli.mjs plan --audit /tmp/veil-audit.json --output /tmp/veil-plan.json
node tools/release-steward/cli.mjs apply --plan /tmp/veil-plan.json --approve PLAN_DIGEST
node tools/release-steward/cli.mjs apply --plan /tmp/veil-plan.json --approve PLAN_DIGEST --execute
```

`apply` defaults to dry run. Execution checks the plan digest, source commits and clean source trees, accepts only exact replacements in maintained documentation files, creates detached isolated worktrees, and runs `git diff --check`. Inspect returned diffs and run the repository documentation and package gates before review. The tool never pushes, merges, publishes, tags, or edits GitHub releases. Ambiguous prose and release notes require manual review.
