# Independent capability release assessment

Reviewed 2026-10-25. Core, UI and Emergence remain separate packages. This
assessment does not add an export, provider, application or dependency to Core.
No independent npm package is ready for publication in its current form.

## Evidence and reproduction

The superset capability checkout is `feat/autonomous-engineering-benchmark`,
`35f4051f6b2a5fbb1129157bf0a42e8fd44a96c8`, retained at
`/tmp/veil-capability-review`. Earlier coherent refs are
`feat/secure-verification-sandbox` (`062411c8b7f4f7da6f9b45cc3886d4889868a541`)
and `feat/live-autonomous-repository-tasks`
(`8dbd44a1369a4e56303f625bcae2cc0c15f5a990`). All three are remotely preserved.
The tests below qualify the superset commit, not a claim of independently rerunning
every historical tip.

```sh
npm ci
npm run check
./node_modules/.bin/tsc --project apps/repository-task/tsconfig.json
VEIL_TEST_TYPESCRIPT=/absolute/typescript-5.6.3/lib/typescript.js \
  node --test .tmp/test-build/test/component-verification.test.js
npm audit --json
npm run quality -- --base v0.3.1
```

Linux x86_64/WSL2, Node 24.18.1: the full gate passes (399 passed, 0 failed,
4 skipped); all four skipped component cases then pass with TypeScript 5.6.3
installed separately in `/tmp/veil-reviewed-typescript`. Application compilation
passes. Ten real sandbox integration cases pass, without skip/fallback. No paid
model calls or authenticated browser operations were performed.

The audit exits 1 with eight affected packages: one critical, three high,
three moderate, one low. Packages: MCP SDK, body-parser, fast-uri, Fastify, Hono,
ip-address, proxy-addr and Zod. Passing functional tests do not resolve that lock.
The quality comparison exits 1 with eleven review-required files, no unapproved
execution references or unsupported accesses. Source delta +211/-0; test delta
+1840/-0; harness unchanged. Those eleven findings are not covered by Core's
four-control acceptance.

## Linux verification sandbox

Implementation: `src/providers/sandbox/linux-verification-sandbox.ts`,
`seccomp.ts`, and `src/capabilities/verification/sandbox-verify.ts`.
The provider itself uses Node built-ins; its capability wrapper depends on Core's
Capability contract. Current source imports are internal, with no independent
manifest or packed-consumer contract.

The ten passing tests exercise authorization, credential/environment exclusions,
symlink and hard-link rejection, isolated PID/network namespaces, denied sockets,
fork restrictions, permitted threads, wall/CPU/address-space/output limits,
snapshot limits and cleanup. The implementation requires Linux x86_64, procfs,
unshare, bubblewrap, prlimit, user/network namespace support and trusted runtime
mounts. There is no unsandboxed fallback. Setup errors may report `failed` as well
as `unavailable`; neither permits acceptance.

This supports a **preview implementation**, not a stable sandbox security claim.
Host profiles, executable/library sources, kernel and quiescent input trees are
trusted. Excluding credential filenames is not secret scanning. Snapshot/setup
time is outside the launched-process wall timer; there is no aggregate host quota
or transactional snapshot. The seccomp denylist is specific to x86_64 and needs
ongoing syscall/kernel review. Same-user host compromise is outside the boundary.

Recommended boundary: a separate Linux-only sandbox provider package, with an
optional capability integration using the public Core contract. Before publishing
a preview: create its own manifest/build/export surface, carry the real integration
tests to its packed artifact, document required OS packages and kernel assumptions,
audit its actual dependency graph, and review the provider/security API. Do not
publish this branch's root Core 0.3.0 package to distribute the provider.

## Repository task host

Implementation: `apps/repository-task/runner.ts`, `workspace.ts`, `acceptance.ts`,
`tsx-verification.ts`, `component-verification.ts`, and CLIs. Test suites include
repository-task, repository-patch, developer-workflow, TSX and component verification.
It imports Core through `../../src/index.js` and the sandbox provider through its
source path, and compiles a combined tree rather than an independent application.

The host owns approved readable/writable paths, budgets and independent acceptance;
actions become V2 plans through OperatorRuntime. Work occurs in a disposable copy;
patch application to the original remains a separate reviewed action. It is a
substantial **experimental application**, potentially a preview after extraction.
It is not a general autonomous engineer. Preserve the source CLI documentation in
`apps/repository-task/README.md` and `WORKFLOW.md`.

Blockers: audited dependencies, supported public Core imports and sandbox package,
independent application packaging/consumer tests, host profile and acceptance-oracle
security review, and documented interruption/effect recovery. A successful finish
message is insufficient; edits invalidate prior acceptance. Do not merge it into
Core as a shortcut to distribution.

## Live adapter and benchmarks

Implementation: `apps/repository-task/live.ts`, `live-cli.ts`, `trial.ts`,
benchmark modules and test/live-repository-task.test.ts. Offline adapter tests pass
for normalization, malformed actions, authorization, context/transcript/token/cost
limits, secret redaction and replay. These are controlled transports, not live
model reliability measurements. The historical `TRIAL-5-RESULT.md` reports exhausted
cost budget and failed independent acceptance; preserve that negative result.

Recommended boundary: opt-in adapter/application alongside the repository host,
**experimental**. Fixed provider transport and reported usage do not guarantee
billing ceilings or successful repair. Resolve application dependencies and
credential/evidence handling, then measure live acceptance independently before
claiming preview readiness. No reliable autonomous write-planning claim is justified.

## Browser infrastructure

Core's source tree contains `src/providers/browser/` and `web.page.read`; the
npm Core artifact excludes these built-in providers/capabilities. The browser
launches installed Chrome with `headless: false`, creates public or authenticated
contexts, and reads LinkedIn state from `playwright/.auth/linkedin.json`.
Playwright is a development dependency. There is no independent browser manifest
or dedicated real-browser security suite in this qualification.

Recommended boundary: separate browser capability package, with credential/session
handling owned by a trusted application. **Experimental, not publishable.** Required
work includes destination/redirect/subresource/SSRF policy, credential/session scope,
browser lifecycle and concurrency limits, reproducible browser installation and
headless configuration, and real-browser negative tests. `http:`/`https:` scheme
validation alone is not destination confinement. Do not expose internal browser
providers from the Core root.

## Publication order

Publish qualified Linux Core first after maintainer approval. Next qualify and pack
the independent sandbox preview, then the repository-host preview against that
published Core, then keep live adapters/benchmarks opt-in and experimental. Browser,
UI and Emergence require their own release qualifications. No independent package
tarball or publication command is supplied as ready when these blockers remain.
