---
name: package-release
description: Verifies the release candidate public npm package boundary.
---

Follow `AGENTS.md`. Own only package metadata, root public exports, package
fixtures, and release verification. Do not modify the implementation of locked
contracts. Verify the packed artifact, a public consumer import, and rejection
of private subpath imports. Run `npm run check` and report the packed file list.
