---
title: Governance entry hardening
---
# Governance entry hardening

Research/implementation comparison base: `bb3f34e4f938096acec897159f0f56283c11697a`.
This work follows the v0.2.0 investigation; it does not change package version,
ExecutionPlan, OperatorRuntime, Capability, or public job/result/event contracts.

Reasoning proposes. Veil governs execution. The scoped property here is that the
repository's HTTP capability-work entrances cannot bypass plan admission and
runtime authorization. It is not a claim that all process I/O is capability work
or that arbitrary host JavaScript is sandboxed.

## Inventory verified before implementation

| Location / path | Classification at the comparison base | Current disposition |
| --- | --- | --- |
| `src/api/routes/execution.routes.ts`, generic capability POST | Governed: constructs a plan and calls runtime | Retained; host caller resolver added |
| `src/api/routes/jobs.routes.ts`, execute-plan and run POSTs | Governed: runtime plan/run entries, default singleton | Host may configure runtime and caller resolver |
| `src/api/routes/linkedin.routes.ts`, status GET | Legacy/bypass: direct capability call | Single-step version-pinned plan through runtime |
| `src/api/routes/jobs.routes.ts`, stored-job execute POST | Legacy/bypass: JobManager execution with default authorizer, no caller/admission or completed-job guard | Retired, unconditional 410; no job is loaded or invoked |
| `src/integrations/mcp/inbound/mcp-adapter.ts`, stdio-server | Governed: tool call becomes plan through supplied runtime | Unchanged |
| `examples/veil-starter/server/index.ts`, execute and plan-and-run | Governed: runtime executePlan | Unchanged |
| Starter `server/veil/mcp.ts` | Governed: client call loops through inbound adapter and runtime | Unchanged |
| `src/runtime/operator-runtime.ts`, `src/runtime/jobs/job-manager.ts` | Internal/trusted machinery: admission, resolution, validation, authorization, dispatch | Unchanged |
| `src/sdk/capability/create-capability.ts` | Internal/trusted callback and middleware dispatch | Unchanged |
| `src/capabilities/linkedin/{auth-status,profile-self}.ts`, `web/page-read.ts` | Capability implementation: browser sessions/navigation | Governed when entered through runtime |
| `src/capabilities/filesystem/file-read.ts`, `shell/command-run.ts` | Capability implementation: filesystem reads and process spawning | Governed when entered through runtime; shell policy limitation below |
| `src/capabilities/http/request.ts`, `src/providers/http/fetch-http-provider.ts` | Capability/provider implementation: HTTP request/fetch | Conservative static risk correction |
| `src/integrations/mcp/outbound/{mcp-capability,mcp-provider}.ts` | Capability/provider implementation: remote tool call | Unchanged; governed caller in test-outbound and runtime integrations |
| Starter `server/veil/capabilities.ts` | Capability implementation: fixture actions and GitHub fetch | Registered into host-owned runtime |
| `src/providers/browser/{browser-provider,browser-session,session-manager}.ts` | Internal/trusted provider/session lifecycle | Unchanged |
| `src/providers/storage/sqlite-job-store.ts`, runtime job stores/logging/audit/events | Internal/trusted persistence and observation I/O | Unchanged; these are not separate proposed capability actions |
| `src/runtime/planner/providers/openai-compatible-planner.ts`, planner registration/strategies | Internal/trusted configured reasoning and health-check I/O before execution | Produces plans; not authority to invoke capabilities |
| `tools/linkedin-login.js`, `examples/linkedin-session-example.js` | Manual trusted login/session tooling; direct browser I/O outside runtime | Not server routes or externally submitted capability work |
| `src/integrations/mcp/test-client.ts`, `test-outbound.ts`, package consumer verification | Test/manual clients | Runtime/adapter paths; no production bypass |
| `test/`, starter capability unit test, quality/package tools | Test-only or trusted verification tooling | Isolated direct unit-test dispatch remains explicitly classified |
| Reflective/indirect dispatch outside local analysis | Uncertain | Requires review; checker does not establish a call graph |

No additional externally reachable capability-dispatch bypass was found in this
inventory. Nonexecution API routes expose jobs, review outcomes, logs, planner
metadata, and capability descriptors; this work does not add access control to them.

History explains the exceptions as unfinished migration, not required semantics:
LinkedIn status traces to `d3eb6d2` (source-layer refactor); stored-job execution
traces to `b835808` (initial job lifecycle). Both predate the runtime facade and
versioned plan handoff. No distinct architectural justification was found.

## Route behavior and host authority

LinkedIn status preserves its successful result body. It now records a job and
normal events, returns 403 for explicit denial, 500 for authorization/capability
failure, and 404 if the capability is absent. It resolves the registered version
and submits an ordinary single-step plan. It never imports the implementation.

`POST /api/jobs/:id/execute` returns 410 for every ID, including completed,
failed, empty, and nonexistent jobs. No conversion of a stored Job into a plan,
resume, or replay is provided. Clients must explicitly propose a new plan using
`/api/jobs/execute-plan`, which creates a new job and repeats admission and policy.
This does not make repeated plan submissions idempotent.

The three route modules accept internal registration options `runtime` and
`resolveCaller(request)`. The resolver is trusted host code and may return a
caller synchronously or asynchronously. It must derive identity from verified
host authentication/session state, never copy request body/query claims. Resolver
failure stops execution; it does not fall back to anonymous execution. The
existing runtime performs its usual shallow caller capture.

The bundled local server does not configure authentication: caller remains
undefined. Optional identity does not mean authenticated identity. All route
groups must be wired to the intended runtime/policy by a host that requires one;
configuring a policy on one route group does not configure the others.
`approved`, `caller`, `scopes`, and `risk` in request data or proposed plans do
not configure runtime authority. Capability input may contain similarly named
domain data; a trusted authorizer must not treat self-asserted data as approval.
The existing MCP adapter also supplies no authenticated caller.

## HTTP risk correction without a new contract

The existing capability has one static risk, while supporting GET, POST, PUT,
PATCH, and DELETE. `read` was inaccurate for its complete execution surface.
It now declares `destructive`, conservatively covering removal/overwrite effects
already included in the existing risk definition. Every method, including GET,
is denied by default. Existing host authorizers receive that classification and
the resolved request; they can explicitly allow narrower operations.

There is no runtime method special case, request-controlled risk override, or
provider-local permission mechanism. The supported method/input surface is
unchanged. This intentionally changes default behavior for existing GET clients:
they need explicit host authorization, as do all other methods. Capability and
package version strings are unchanged in this unreleased hardening work.

Method alone does not prove effects or target safety. Host policy must consider
target, credentials, and operation semantics. A split into domain-specific
capabilities may be appropriate later; input-dependent risk in the runtime would
require an explicit architecture decision. No such contract change is made here.

## Regression evidence and limits

`test/governance-routes.test.ts` covers LinkedIn lifecycle and denial/failure,
host identity against forged request/plan claims, resolved-input authorization,
admission rejection, caller-resolution failure, host-configured run, and retired
stored-job execution. `test/http-risk.test.ts` verifies every supported HTTP
method is default-denied with zero provider calls, explicit host permission can
allow a narrow request, and malformed/throwing authorizers never reach the
provider. MCP regression tests retain governed invocation and add denial,
malformed-decision and exception cases. Existing runtime tests continue to cover
the detailed fail-closed decision matrix and reference/structural guarantees.

The candidate governance inventory contains 14 individual sites and no legacy
route allowances. Recognized execution references in `src/api/routes/` cannot
be excused by either old trusted or new candidate allowances. Direct import,
require, or re-export source strings containing capability/provider directories
in those routes are also rejected. Tests enforce both restrictions and compare
the full discovered inventory with the manifest. See the
[quality harness](../contributing/quality-harness.html) for precise limitations.

Remaining weaknesses are explicit:

- Authorization-to-invocation value stability is still unresolved. Nested input,
  result aliases, observers, and trusted host code are not generally isolated.
- JobManager remains internal machinery, and its stored-job execution method
  remains callable by trusted source code. It is not package-root exported; new
  direct entrances are checked. This is not a hostile-JavaScript security barrier.
- Registry/job state is process-global; job/log/review APIs lack tenant access
  control. Runtime instances are not independent sandboxes.
- No idempotency enforcement, transactional external effects, or safe retries.
- The shell prefix weakness discovered in this pass is addressed by subsequent
  [shell invocation hardening](shell-invocation-hardening.html): canonical inputs,
  exact tuples and conservative destructive risk. Ambient process effects and
  authorization-value stability remain explicit limits.
- HTTP URL checks are not a complete network boundary: hostname/DNS resolution
  and followed redirects require separate policy analysis.
- Configured planner network I/O, trusted tooling, providers, and storage still
  perform I/O outside per-capability authorization where appropriate to their
  role. The stronger invariant must distinguish proposed capability work from
  trusted runtime/support operations.

The next step is review of this hardening and its verification-control changes,
then a focused review of shell effect policy and host exposure. The external
reasoner experiment has not begun.

## Verification

- `npm run check`: passed typechecking, 230 functional tests, build, and packed
  consumer verification. The first sandbox run failed in package verification at
  `tools/verify-package.mjs:24` with `SyntaxError: Unexpected end of JSON input`;
  the approved rerun outside the sandbox passed.
- `npm run test:quality`: 216 tests passed outside the sandbox. The initial
  sandbox run reported both test files as failed without individual diagnostics.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`: exit 1,
  review required for the three changed/added test files, governance checker,
  checker tests, and baseline deletions. No unapproved execution references or
  unsupported accesses remain. The report identifies both former sites as
  retired; their candidate entries are already deleted. The other 14 allowances
  retain their original anchors and classifications.
- Quality deltas: source +67/-38 (net +29 LOC); tests +326/-1 (net +325);
  harness +56/-8 (net +48). No dependency, lockfile, package export or version
  changes. The comparison base and verification controls were not relaxed.
- Raw `git diff --check` flags preserved CRLF line endings as trailing whitespace
  in the four edited source files. Their existing line-ending conventions are
  retained; no formatting or file-mode cleanup is mixed into this work.

The quality review is deliberately left visible for maintainer review, not
converted into a passing comparison by adopting a different base.
