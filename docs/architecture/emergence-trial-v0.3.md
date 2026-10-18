# Veil Emergence v0.3: first unscripted trial preparation

## Architecture

The local runner in `src/emergence/trial.ts` accepts a workspace, goal, exact
file allowlist, independent verifier, reasoner, journal directory and budget.
It registers four narrow Veil capabilities: list permitted files, read one
permitted file, replace an exact substring in one permitted file, and return a
boolean acceptance result. All four execute through `OperatorRuntime`; the
v0.2 kernel supplies discovery, one-step plans, caller scopes, exact-action
authorization, approvals, budgets, recovery and an atomic journal. The reasoner
receives only the goal, capability descriptors and accumulated observations.
The kernel no longer places the host's verification rule in `goal.started`.

The three host-owned tasks are slug normalization, config parsing and invoice
arithmetic. They have different semantics and source repairs. Each is seeded
into a new temporary workspace. Acceptance cases live in `trial-tasks.ts`,
outside the workspace and reasoning context. Checks run in a child Node process
with permission mode, read access only to the isolated workspace, no inherited
environment, a restricted VM context for the source function, and a two-second
timeout. A timeout kills the verifier process group and waits for its close.
Acceptance comparisons run in the verifier host realm, so source code cannot
replace the assertion's `Boolean` or `JSON.stringify` builtins.
Spawn errors, signals, timeouts and unexpected exit codes are recorded as
verifier infrastructure failures, distinct from acceptance failures. The live
CLI additionally requires a working `bwrap` network namespace and mounts only
the workspace and runtime system paths read-only into the check child. Its
preflight runs a harmless source function through the same bubblewrap, Node
permission, VM and timeout path used by real checks. It refuses paid calls
when that path fails. Each live task also runs its own verifier once on the
seeded workspace before the first model call. The check returns only pass or
fail to the reasoner.
The runner calls the independent verifier again after the kernel stops, so a
model `finish` proposal or completed Veil job is insufficient for success.

The journal stores full proposals, approval requests, execution events,
failures, observations, usage and verification. `report.md` in each temporary
run directory summarizes those events; the adjacent `journal/<goal-id>.json`
preserves the full record. Neither file contains a model API key. Live model
calls use the existing OpenAI-compatible adapter. The CLI requires a terminal,
an explicit paid-call phrase, and `APPROVE` for each exact source replacement.
It has no shell or general filesystem capability, and uses no deployment or
publication path. Exact path equality, a startup workspace scan and Veil's
exact write approval guard the file allowlist. Reads open the final file
without following a symlink; replacements atomically rename a new file after
another path check.

## Configuration and commands

Node.js 24 or newer is required for permission-mode checks; the live command
also requires Linux bubblewrap with working user and network namespaces. The
command defaults to one `slug` task; `--task config` and `--task invoice`
select another single task. `--all` runs all three, and live mode additionally
requires `VEIL_TRIAL_MULTI=YES` and a separate interactive confirmation. The
configured limits are
**per task**: 12 decisions/model calls, 8 Veil jobs, 2 delegations, 60,000
input tokens, 8,000 output tokens, 1,500,000 micro-USD ($1.50), 20 seconds
cumulative job execution, 120 seconds elapsed, 4,096 proposal bytes. Each
model response is capped at 640 output tokens and 15 seconds. The nominal
single-task spending ceiling is **$1.50** and the three-task ceiling is **$4.50**.
The consent prompt names the selected tasks and calculates the total cap from
the configured budget. Operator-supplied price rates must
match the chosen provider's current billing rates. Usage metadata and final
provider invoices should be reconciled after the trial.

Offline verification, with no model calls:

```sh
npx tsc --project tsconfig.test.json
node --test --test-isolation=none .tmp/test-build/test/emergence-trial.test.js
node --import tsx tools/emergence-trial.mjs --baseline --all
npm run check
npm run quality -- --base dce45be
```

Single opt-in command for a **future** paid trial, to run in an interactive
terminal only after setting `VEIL_MODEL_ENDPOINT`, `VEIL_MODEL_NAME`,
`VEIL_MODEL_API_KEY`, `VEIL_INPUT_MICROS_PER_MILLION`, and
`VEIL_OUTPUT_MICROS_PER_MILLION` to reviewed values:

```sh
VEIL_TRIAL_ENABLE=YES node --import tsx tools/emergence-trial.mjs --live --task slug
```

The command itself asks for the paid-call phrase and then separately displays
each exact proposed write for approval. Omitting either approval stops that
dependent action. It was **not run** during implementation.

## Offline comparison and interpretation

The v0.2 `RepairReasoner` was used unchanged as the deterministic baseline,
with its `test`, `read`, and `patch` names mapped to the same check, read and
replace capabilities given to the future model trial. The worker roster,
goals, task seeds, file allowlists and budgets are identical. Its existing
calculator-specific policy delegated to diagnosis, ran the check, then
proposed a read without the now-required path input. Veil rejected that
proposal before execution. Result: **0/3 independently verified**, 3
decisions and 1 Veil job per task, no writes and zero model cost. This is an
honest comparison to the existing baseline; it is a weak software-engineering
baseline and does not predict model performance. The live side has no result
until the opt-in command is authorized and run.

The offline harness tests feed controlled proposals to establish that each
fixture can be repaired and independently verified, and that an unapproved
write leaves the workspace untouched. These tests do not claim that a model
chose those repairs. A future report should compare the model's event-by-event
selections and independent successes against the above baseline.

## Offline verification in the implementation container

TypeScript test compilation and the focused trial suite pass (21 tests). The
unchanged deterministic baseline remains 0/3 independently verified, with
three decisions, one Veil job and zero model cost for each task. The default
CLI selects only `slug`; `--task config` selects one other task, and `--all`
reproduces the original three-task baseline. `npm pack --json --dry-run`
produces the expected package inventory.

`npm run check` cannot finish here: two external reasoner suites fail when
their nested child process receives `EPERM` or exits with unsettled top-level
await. The 30 other test files pass. `npm run verify:package` builds but its
nested `npm pack` returns empty output in this container, so JSON parsing
fails. The bubblewrap preflight also fails here with `NETLINK_ROUTE: Operation
not permitted`. These environment failures do not establish a passing full
gate on the operator's WSL machine. `npm run quality -- --base 0c160af`
reports the changed trial test file for review and unchanged governance
inventory findings; it exits with review required.

## Limits and remaining risks

- Offline Node permission mode does not isolate network access, so offline
  verification must run in a network-restricted environment. The live CLI
  enforces bubblewrap preflight and uses its network namespace for checks.
  The checked module can still consume CPU until its child is killed. The
  verifier command line contains host-owned acceptance expressions; they are
  absent from model context, and credentials never enter the verifier
  environment. A same-user host process can inspect those command-line
  expressions. The restricted VM keeps source code from directly using Node
  process, filesystem, module and network APIs; bubblewrap is the live process
  isolation boundary.
- The bubblewrap preflight fails in this tool container because namespace setup
  cannot create a NETLINK_ROUTE socket. The operator's WSL host was reported
  to support bubblewrap. The live command repeats the full preflight there.
- A separate same-user process able to mutate the private temporary workspace
  could race a parent-directory check and rename. The model has no capability
  to create directories or symlinks, and the verifier mount is read-only.
  Defending against a hostile same-user process requires descriptor-relative
  filesystem operations beyond this Node implementation.
- The journal is a single-writer atomic snapshot, without a transaction tied
  to a file mutation. An uncertain started execution fails closed on restart;
  an operator must inspect it before a new run.
- Provider token accounting depends on reported usage and configured prices.
  Pre-call reservation limits expected spend; it cannot guarantee a provider's
  invoice or account for a failed request with no usage metadata. Do not infer
  an exact external billing ceiling from the nominal $4.50 cap.
- The CLI creates new workspaces for each invocation and does not resume an
  interrupted CLI session automatically. The underlying kernel can resume
  recorded goals, subject to its fail-closed uncertain-effect rule.
- The three fixtures are small, single-file tasks. This trial tests bounded
  capability selection and repair, not general software engineering or
  scientific emergence.
