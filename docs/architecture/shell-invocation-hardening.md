---
title: Shell invocation hardening
---
# Shell invocation hardening

Investigation base: `bb3f34e4f938096acec897159f0f56283c11697a`, with the preceding
API hardening changes already in the working tree. That fixed Git base continues
to be used for quality review; cumulative deltas include the preceding pass.
No reasoning integration, release, or public runtime contract change is included.

## Root cause and reproduction

`evaluateCommandPolicy` previously built a key from the executable and only
`args[0]`. A read entry such as `git branch` accepted all later arguments.
The runtime also saw `shell.command.run` as read-risk and permitted it by default.
The capability-level guard therefore accepted an invocation whose effect could
be materially different from the label used to permit it.

Before changing implementation, `test/shell-command.test.ts` submitted
`{ command: 'git', args: ['branch', '-D', 'fixture-only'] }` through OperatorRuntime
with an explicit allowing host authorizer. Its process spy threw before starting
anything. The regression expected zero attempts and failed with the complete
deletion argv captured. Runtime logs labeled that invocation read-risk. This
demonstrated an actual dispatch attempt, not just a policy-helper return value.
No branch, repository, or external resource was changed. Git documents `-D`
as a branch deletion option in its [branch reference](https://git-scm.com/docs/git-branch).

Equivalent problems included branch creation/rename operands and options such
as `git diff --output=...`, `git log --output=...`, or external diff selection.
The entire suffix of every accepted prefix was unchecked. `docker model list`
was an unreachable policy entry because the key contained only two tokens;
`npx` was on the executable list but had no allowing policy entry. Neither is
newly enabled. See [Git diff options](https://git-scm.com/docs/git-diff).

## Complete execution trace

The generic HTTP route, direct plan endpoint, runtime run path, and inbound MCP
all converge on OperatorRuntime. The built-in registration includes the shell
capability. The runtime resolves earlier-result references and checks declared
input fields before calling ExecutionAuthorizer, then invokes the capability.
Authorization sees the full resolved input, not merely a command prefix.

The previous shell implementation subsequently accepted whitespace-split command
strings, arrays, and JSON-array strings. Nonempty explicit args replaced embedded
args; an empty explicit array fell back to embedded args. Quotes had no shell
grammar. The descriptor declared a string, so actual command arrays were rejected
by ordinary governed admission even though direct capability code supported them.
That mismatch and post-authorization parsing made independent host policy harder
to interpret correctly.

Current input is a single executable basename string plus a separate dense string
array. There is no command-line parsing, whitespace trimming, JSON decoding,
argument override, or alias expansion in Veil. Exact tuples, including length and
individual argument boundaries, are checked. Arguments are copied for this local
check/dispatch; log metadata gets detached copies of the checked array.

The capability calls Node `spawn(command, args, { cwd, shell: false,
env: process.env })`. There is no separate shell provider abstraction. Veil does
not invoke a shell for expansion, redirection, pipes, substitutions, globbing,
or shell aliases. Those forms are also outside the exact allowlist. This does
not prevent the selected executable from invoking interpreters or helpers.
Node documents process lookup and shell behavior in
[child_process](https://nodejs.org/api/child_process.html).

The executable is still resolved by the host's PATH/OS. Environment is inherited,
including tool-specific settings and possible interpreter startup options.
Working directory is resolved lexically beneath the root captured from
`OPERATOR_FILES_ROOT` or process cwd at module load. Symlink traversal, executable
replacement, repository configuration, hooks, helpers, plugins, and tool versions
are not controlled by this guard. Requested `cwd` reaches authorization; the
absolute resolved cwd and ambient environment/executable identity do not appear
as a new prepared-invocation contract. Extra `env` or `shell` input fields are not
used as spawn configuration.

## Other process and interpretation paths

| Path | Input/authority source | Finding |
| --- | --- | --- |
| `src/capabilities/shell/command-run.ts` | Resolved untrusted capability input | Only request-controlled general command launcher found; fixed here |
| `src/integrations/mcp/outbound/mcp-provider.ts` | Host-constructed McpProviderOptions: command/args/cwd/env | Starts StdioClientTransport after governed capability invocation; not governed by shell tuple policy |
| Installed MCP stdio client | Host options plus SDK default environment | Uses cross-spawn with shell false; executable/tool/wrapper remains trusted |
| `src/integrations/mcp/test-outbound.ts` | Manual host configuration | Uses npx package launcher; may install/run package code, even when wrapped tool is labeled read |
| `src/integrations/mcp/test-client.ts` | Manual client configuration | Launches the local stdio server |
| Browser providers, LinkedIn login/session tools | Host-configured Playwright/browser | Browser process lifecycle; web content has its own interpretation and network effects |
| `tools/quality*.mjs`, package verifier | Trusted developer commands/fixtures | Git/npm/Node subprocesses; not external proposal entry points |
| Starter server | Host-registered capabilities | Runtime entry; its MCP demo uses in-memory transport, not command input |

No second request-controlled command-prefix policy was found. Host configuration
can nevertheless wrap powerful tools in incorrectly scoped capabilities. A
downstream MCP tool's declared risk does not prove the effects of its startup
command or implementation. This is the same possible-effect versus invocation
distinction, not a reason to silently apply the shell allowlist to all providers.

## Selected property and alternatives

For ordinary passive inputs, with trusted executable resolution, environment,
workspace and nonmutating host components:

> The shell boundary accepts only a complete reviewed executable/argv tuple,
> and dispatches that checked tuple without parsing, overriding, or extending it.
> A prefix permission cannot admit an additional option or operand.

Runtime authorization still precedes capability entry and sees all resolved
request fields. The exact tuple guard is a restriction after that decision; it
does not grant runtime authority. Static shell risk is now destructive, so no
tuple executes under default policy. This is conservative treatment of ambient
process effects, consistent with the preceding HTTP correction.

| Option | Assessment |
| --- | --- |
| A. Exact executable and argument matching | Selected: small, explicit, denies unknown suffixes; cannot prove ambient effects |
| B. Structured command policies | Would require executable-specific option grammars and version maintenance; unjustified here |
| C. Operation/effect-specific capabilities | Prefer for future real operations such as branch listing; providers can own fixed commands |
| D. Input-aware host authorization | Already available and required here; must inspect full command/args/cwd and trusted context, not a prefix |
| E. Remove/restrict unsafe prefix authorization | Selected together with A; removes permissive parsing and read-risk default permission |
| F. Disable all shell support | Appropriate for the external-reasoner fixture; unnecessary to remove explicitly authorized trusted-host use entirely |

Retained exact tuples are Git status/log/diff/branch/show; Docker ps/images;
Node/npm/pnpm/Python/python3 --version; and dotnet --info. All other combinations
fail closed, including previously accepted optional flags. These are compatibility
restrictions. Canonical retained commands continue to dispatch when the host
explicitly allows them. Descriptor text now states those restrictions.

## What is not established

Complete resolved command data is necessary but insufficient to prove the actual
effect. Equal argv can act differently under different PATH, environment, cwd,
configuration, executable contents, or remote state. Exact matching is not a
claim that these commands are pure reads.

The existing runtime also shares resolved reference values through authorization
and invocation. A retained producer result or authorizer can mutate args after
the decision. The shell guard blocks a mutation into an unlisted tuple, as the
regression proves. It cannot detect a change from one permitted tuple to another
or preserve the host's earlier decision about cwd. No test claims otherwise.
General authorization-value stability requires the separately deferred value
model and an explicit maintainer architecture decision. The local array copy
begins at capability entry, after runtime authorization, and does not fix that gap.
See [trust boundaries](trust-boundaries.html) and the
[draft invocation-effect ADR](../adr/0010-capability-risk-and-invocation-effect.html).

There is still no process timeout, memory/output accumulation bound, filesystem
sandbox, credential isolation, or general command-safety proof. The final output
is truncated but accumulated output is not bounded. Denied runtime authorization
prevents capability start and spawn; a local tuple rejection happens after
capability start and is recorded as capability failure, not capability.denied.

## Host exposure for the future experiment

| Issue | Classification | Required experiment boundary |
| --- | --- | --- |
| Unauthenticated bundled server | Blocker if reused directly; production hardening concern | Use a dedicated private channel/session and narrow host adapter; loopback alone is not identity |
| Global registry/job state and unrestricted history/log/review routes | Blocker for shared/multi-caller use; acceptable single-principal fixture limitation | Dedicated process/store with synthetic data; expose feedback only for that request/session, not global get/list/review |
| Incomplete HTTP network restrictions | Blocker if real network capabilities are exposed; acceptable fixture limitation when absent | Register only fake capabilities; deny network/process capability access and isolate reasoner credentials/egress |
| Shell PATH/environment/workspace trust | Blocker if generic shell is exposed to the untrusted fixture | Do not register/expose shell; use fake effects only |
| Trusted developer verification subprocesses | Unrelated to the experiment's proposal authority | Keep tooling inaccessible to the reasoner |

HTTP request filtering does not validate resolved DNS destinations or every
redirect. Additionally, `web.page.read` accepts HTTP(S) URLs without rejecting
private hosts and browsers can make subrequests. Therefore denying only
`http.request` is not a network-isolation boundary. No network or authentication
system is implemented in this task.

The eventual adapter should expose discovery, proposal submission, and scoped
feedback only. Descriptor visibility is not permission. The reasoner must not
receive the runtime object, registry access, provider credentials, ambient shell
access, or access to other host services. This experiment has not begun.

## Verification and handoff

New coverage is in `test/shell-command.test.ts`: the initially failing intercepted
deletion regression; all retained tuples and rejected suffixes; ambiguous command
encodings, wrappers and malformed args; default/deny/malformed/throwing policy;
resolved command/args/cwd observation; rejection of a retained-result mutation to
an unlisted tuple; forged HTTP authority claims; detached logging data; and an
actual explicitly authorized `node --version` execution on the trusted test host.
The process-boundary spy ensures mutation cases never execute real commands.

- `npm run typecheck`, test compilation and focused shell tests passed after
  fixing a test-only TS2769 error (optional assertion message needed a fallback).
  The first regression failed intentionally before the fix with one intercepted
  deletion invocation; it now passes.
- `npm run check`: passed typechecking, 240 functional tests, build, and package
  consumer verification. The sandbox attempt reached package verification but
  failed at `tools/verify-package.mjs:24` with `SyntaxError: Unexpected end of JSON
  input`; the approved rerun outside the sandbox passed.
- `npm run test:quality`: all 216 tests passed outside the sandbox. Its first
  sandbox attempt reported both test files failed without individual diagnostics.
- `npm run quality -- --base bb3f34e4f938096acec897159f0f56283c11697a`: exit 1 for
  review-required verification-control changes. Governance finds no unapproved
  execution references or unsupported accesses; no allowances were added by
  this shell pass. Four test files and three checker/baseline files require review
  cumulatively, including the preceding API work.
- Cumulative quality growth: source +113/-254, net -141 LOC; tests +551/-1,
  net +550; harness +56/-8, net +48. This shell pass alone changes source
  +46/-216, net -170, and adds 225 test lines. No dependency/lockfile/version
  changes and no new checker changes in this pass.
- Full tracked diff and new files were reviewed. Raw `git diff --check` still
  reports preserved CRLF source lines as trailing whitespace. No actual
  space/tab suffixes were found in the edited shell source/helper; existing
  line endings and file modes were preserved.

Files changed in this pass: shell capability, command-policy helper, shell test,
this investigation, draft ADR-0010, and the preceding governance-hardening report
to link its former shell finding to this resolution. Earlier working-tree changes
were retained. Review the restrictive behavior and draft ADR next; do not expose
generic shell or the bundled server to the external-reasoner fixture.
