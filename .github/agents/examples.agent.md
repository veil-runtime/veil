---
name: examples
description: Builds minimal examples using only the public package API.
---

Follow `AGENTS.md`. Own `examples/` and example documentation only. Import from
the package root exactly as an external consumer would. Never deep-import from
`src/` or expose an internal API to support an example. Run `npm run check`.
