# Veil emergence kernel: local foundation

## Scope and reproduction

This is a bounded application layer in `src/emergence`. It uses the existing
`OperatorRuntime`, capability descriptors, ExecutionPlan 2.0 admission,
authorization, Job outcomes, and Job events. It does not change the locked
runtime contracts or any Experiment 005 source or evidence.

```sh
npm run typecheck
npx tsc --project tsconfig.test.json
node --test --test-isolation=none .tmp/test-build/test/emergence-kernel.test.js
node --import tsx tools/emergence-demo.mjs --approve-fixture-writes
```

Without `--approve-fixture-writes`, the demo stops at the first approval
request and prints its journal path. The flag is an explicit local operator
grant for the pinned temporary fixture. The demo does not call a model, use a
shell capability, access the network, or edit a repository file.

## Foundation audit and gap analysis

| Concern | Existing foundation | Gap addressed here / remaining gap |
| --- | --- | --- |
| Execution | `ExecutionPlan`, validation, `OperatorRuntime.executePlan`, Job steps and outcomes | Bounded repeated decisions with observed feedback. Veil remains the only executor. |
| Discovery | Detached `listCapabilities()` descriptors with risk and shallow input fields | Per-worker filtered discovery and peer directory. Descriptors do not express output shapes or resource-specific permissions. |
| Governance | Per-step `ExecutionAuthorizer`, caller context, plan admission, v2 governed value capture | Host-owned worker scopes, exact-proposal authorization and approval gate. An authenticated host must implement the gate in production. |
| Reasoning | Planners, strategies, router, OpenAI-compatible planner; external-reasoner host protocol | `ReasoningProvider` accepts state and proposes an action. The demo uses an offline deterministic policy. No model adapter or token accounting is bundled. |
| Persistence | Optional SQLite JobStore and retained Job events | Atomic JSON goal journal with decisions, delegation, approvals and verification evidence. Single writer only; no multi-process lease or transactional tie to effects. |
| Observability | Job events, runtime event bus, API routes and starter UI panels | Typed goal state and sequenced journal events. No operational UI is built because the existing UI components are plan/job examples, while the separate Veil UI lab has its own design scope. |
| Development tools | TypeScript, `tsx`, Node test runner, Playwright, MCP SDK, SQLite | Reused TypeScript and Node tools. No additional orchestration or memory package was necessary for this narrow loop. MCP can supply capabilities through its existing adapter. |

Experiment 004 showed governed coding with constrained capabilities, but its
task-specific agent and fixtures are not a general autonomous operating loop.
Experiment 005 Phase 3 v1.2 recorded 4/12 control and 1/12 treatment shared
objective completions; greater peer visibility and communication did not
establish better coordination. Its study did not meet the three-contributor
emergence criterion. Candidate 002 of Phase 4 is an offline implementation
candidate, with no live model trial and a recorded no-go pending independent
gates. None of those results proves general autonomy or scientific emergence.

## Architecture

```mermaid
flowchart LR
    H[Human operator / trusted host] -->|exact approval request| K[Emergence kernel]
    R[Reasoning provider] -->|proposal only| K
    K -->|filtered descriptors| R
    K -->|one-step ExecutionPlan 2.0| V[OperatorRuntime]
    V -->|admission and authorization| C[Scoped capability]
    V -->|Job and events| K
    K --> J[Atomic goal journal]
    K -->|independent read plan| V
```

The kernel repeats **discover → reason → propose → authorize → execute →
observe → adapt**. The host supplies the goal, fixed worker roster, budget,
policy, and read-only verification specification. The reasoner sees passive
descriptors and prior journal events; it never receives the runtime, caller
credentials, approval gate, or capability implementation. Its proposals are
checked against the active worker's allowlist. Every operation reaches Veil as
a single-step plan. For writes and destructive operations, the kernel stops
and persists an exact request. A trusted host authenticates the operator and
passes the request through `approvalGate`; Veil then receives a narrowly
matching authorizer for that action. Additional host policy can still deny it.

Workers are a fixed roster. A worker sees peers' permitted capability names
and can propose a bounded delegation with a capped evidence message. The
kernel records the reason, peer inventory, message and return. Workers cannot
create workers or change their own scopes. The coordinator's local policy
selects diagnostic and repair workers from observed events; the kernel itself
contains no software-repair sequence.

The demo creates a temporary calculator and test module. The diagnostic worker
observes `{passed:false}` and reads source. The repair worker proposes a patch
whose exact-match precondition fails; it then uses the observed source to
revise the patch. The verifier independently runs the pinned test capability
through Veil and compares its result with the host-owned `{passed:true}`
criterion. A completed Veil job alone never marks the goal verified.

## State and UI integration contract

`EmergenceState` in `src/emergence/types.ts` is the read model. The local
`src/emergence/index.ts` barrel exposes the typed integration surface without
changing the frozen package root. The state contains the
goal, status, budget, counters, queue, approval requests, verification rule,
and ordered events. Each event has `sequence`, `at`, `type`, optional `worker`,
and typed `data` at the TypeScript boundary. `FileJournal.load(id)` returns
the snapshot; a UI adapter can poll it or tail changes. Useful panels are:

| Panel | Fields / events |
| --- | --- |
| Goals and workers | `goal`, `status`, `queue`, `work.delegated`, `work.returned` |
| Capabilities | `capabilities.discovered`, `availableCapabilities`, worker roster |
| Plans and evidence | `reasoning.decision`, `execution.started`, `execution.completed`, `execution.failed`, nested Veil Job events |
| Approval | `approval.requested`, request ID and exact input; `approval.granted`, approver |
| Outcome and usage | `verification.completed`, `goal.completed` or `goal.failed`, decision/job/delegation counters and elapsed time |

An HTTP integration should expose read-only `GET /goals/:id` and event paging
by sequence. `POST /goals/:id/approvals/:requestId` belongs in a trusted,
authenticated host and must call `grantApproval` with the authenticated
identity. The endpoint should use a compare-and-swap or lease before enabling
concurrent operators. Do not expose `approvalGate` or raw journal writes to a
browser.

## Limits and next steps

### Local verification record (2026-10-18)

Type checking and the four focused kernel tests passed. The demo finished
`verified` with 9 decisions, 5 Veil jobs and 2 delegations; its journal shows
one failed patch and a later successful patch. `npm run check` reached the
root test stage, where 27 test files passed and the two existing external
reasoner files failed because this sandbox rejects their nested process
creation. `npm run verify:package` built the package, then its subprocess
returned empty JSON to the verifier. `npm run quality -- --base HEAD` reported
the expected new source/test growth and review-required governance references
in the new kernel/demo: kernel calls are to Veil's `executePlan` or the local
method that wraps it; the demo dynamically imports only its newly created,
pinned temporary fixture modules. No verification control or frozen source
file was edited. These quality findings need maintainer review before a
release.

### Limitations

The journal has one process writer and atomic file replacement, but no durable
transaction shared with Veil effects. An unmatched `execution.started` after
restart ends the goal as uncertain; an operator must inspect the external
effect before trying a new goal. There is no automatic replay of completed
mutations. A process that hangs inside a capability still needs that
capability's own timeout middleware. The current budgets cover decisions,
Veil jobs, delegations, proposal bytes and elapsed time, not model tokens or money. A real
model provider must be configured explicitly and enforce its own token and
cost reservations before calls; no such provider is enabled here.

Next: add a SQLite goal store with leases and an outbox for action receipts;
add capability-specific timeouts and effect reconciliation; expose an
authenticated read/event API; adapt an opt-in local model provider with
strict schema parsing and budget accounting; evaluate varied tasks and worker
rosters. Only after these gates should coordination quality be studied against
baselines. This demonstration is an engineering observation of one useful
bounded workflow, not evidence of scientific emergence or open-ended autonomy.
