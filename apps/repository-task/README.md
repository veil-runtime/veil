# Governed repository task host

A small source-tree application around Veil, derived from Experiment 004G's
one-action → V2 plan → governed execution → feedback → correction loop. It does
not change the locked runtime, npm exports, sandbox, or historical experiments.
No model calls, deployments, commits, or network services are built in.

For the developer-facing CLI, offline example, artifacts, and opt-in adapter, see
[One bounded developer task](WORKFLOW.md). The JSON-lines interface below remains
available for trusted transports.

## Run a task

Requirements: Node 24, Linux x86_64, the working Bubblewrap/unshare setup described
in [the sandbox guide](../../docs/developer/verification-sandbox.md), and installed
repository development dependencies. Run one CLI process per task.

```sh
./node_modules/.bin/tsc --project apps/repository-task/tsconfig.json
node .tmp/task-build/apps/repository-task/cli.js /absolute/approved-profile.json \
  'Normalize slug input: trim, lowercase, and replace whitespace runs with a hyphen'
```

The host emits JSON lines on stdout. A `{"type":"reason","context":...}` record
requests one JSON action line on stdin. Connect an existing reasoner transport to
these streams; it must treat project content and verification output as untrusted
data. The host never imports adapter code supplied through the protocol. A
`{"type":"result","report":...}` record is terminal. Exit status is zero only
for `verified`. Logs/warnings go to stderr. To replay deterministic actions:

```sh
node .tmp/task-build/apps/repository-task/cli.js /absolute/approved-profile.json \
  'Normalize slug input' < /absolute/actions.jsonl > /tmp/task-transcript.jsonl
```

Example **host-reviewed** profile for an existing `src/slug.ts` file:

```json
{
  "repository": "/absolute/path/to/project",
  "readable": ["src/slug.ts"],
  "writable": ["src/slug.ts"],
  "acceptance": [
    {"file":"src/slug.ts","export":"slug","args":[" Hello World "],"expected":"hello-world"},
    {"file":"src/slug.ts","export":"slug","args":["A   B"],"expected":"a-b"}
  ],
  "limits": {
    "runtimeMounts": [
      {"source":"/usr/lib","target":"/usr/lib"},
      {"source":"/lib","target":"/lib"},
      {"source":"/lib64","target":"/lib64"}
    ],
    "wallMs":2000,"cpuSeconds":2,"addressSpaceBytes":1073741824,
    "outputBytes":65536,"snapshotBytes":65536,"snapshotFiles":100
  },
  "maxTurns":15,"maxVerifications":3,"reasonerTimeoutMs":30000
}
```

Example action lines (a real reasoner chooses each action using prior feedback):

```jsonl
{"type":"capability","capability":"workspace.list","input":{"path":"."}}
{"type":"capability","capability":"workspace.read","input":{"path":"src/slug.ts"}}
{"type":"capability","capability":"workspace.write","input":{"path":"src/slug.ts","content":"export const slug = (s: string): string => s.trim().toLowerCase().replace(/\\s+/g, '-');\n"}}
{"type":"capability","capability":"verification.sandbox.run","input":{}}
{"type":"finish"}
```

`workspace.patch` takes `path`, `search`, and `replace`; the search must match
exactly once. `workspace.list` discovers only approved names. There is no shell,
command selection, dependency installation, model-selected verifier, or policy
mutation. To use an existing in-process trusted transport, call
`runRepositoryTask(objective, profile, reasoner)`; the reasoner receives a detached
context and AbortSignal and returns a JSON string. Transport code is trusted host
code, not generated code. It must honor cancellation and bound network requests,
retries and token use. No live model has been run here; choose an explicit opt-in
adapter and estimate its model/token cost before any paid run.

Extract `report.patch` from the terminal record and review it with the report.
Apply it separately with `git apply` against the matching original revision.
The runner neither applies patches to the original nor writes result files there.

## Architecture and trust

- `runner.ts`: approved profile copy, private task identity, budgets, one-step
  ExecutionPlans, authorization, feedback, revision tracking, terminal report,
  and cleanup. Unique internal capability names accommodate Veil's existing
  process-global registry without exposing other tasks to this reasoner.
- `workspace.ts`: 004G read/write/list and 004B exact-patch semantics adapted into
  local Veil capabilities. No dependency on the experimental directory. The
  original experimental operations are not core/public workspace factories;
  their semantics are reused without importing or modifying frozen apparatus.
- Approved existing UTF-8 files are copied using pinned directory descriptors,
  `O_NOFOLLOW`, regular-file/single-link checks and byte limits. No `.git`, common
  credential paths, unlisted files, symlinks or hard links enter the copy. The
  host must approve a stable, credential-free input set; this is not secret scanning.
- `acceptance.ts`: host-owned cases and limits. Inside the authorized capability,
  Node's native TypeScript parser strips bounded source **as data**. It does not
  import source, resolve project configuration or execute project code on the
  host. Native stripping requires WASM and cannot run under sandbox `--jitless`;
  this preparation step avoids weakening that profile. Parser/runtime versions
  remain part of the trusted computing base; parsing is byte-bounded, not covered
  by the sandbox wall/CPU limits.
- Generated JavaScript executes only through the unchanged Linux verification
  provider from `4ae623a`: read-only snapshot, cleared environment, no network,
  no original repository/credentials, process restrictions and resource limits.
- Each acceptance case uses a fresh VM module with imports and dynamic code
  generation disabled, no supplied host objects, JSON arguments, and trusted-realm
  cloning/comparison of results. A private per-task completion marker is emitted
  only after all cases pass; status/exit zero or forged output alone is insufficient.
  VM is an oracle separation mechanism, **not an OS security boundary**. Its
  integrity depends on the trusted Node implementation; Linux contains execution.
- Acceptance is recorded against the entire approved-tree SHA-256 revision.
  Any content edit invalidates it. Finish is verified only with a passing current
  revision; final original-input comparison, patch construction and cleanup must
  also succeed. Denied proposals may be recovered from; no denied effect executes.

Reports include the profile, objective, initial/final/verified revisions,
authorization decisions, action inputs, job IDs, results/errors, sandbox evidence,
unified patch and terminal reason. `originalUnchanged` compares approved source
inputs; independent tests also verify preservation and patch applicability.

Terminal classes: `verified` (finish plus current acceptance), `failed` (finish
without current acceptance), `blocked` (profile/preparation/sandbox unavailable),
`exhausted` (turn or verification budget), `uncertain` (protocol/transport/final
evidence or cleanup failure). A timeout is failed verification evidence and can
be corrected within the remaining budgets. An early finish never auto-passes.

## Deliberate limits

This slice supports existing text-file edits and synchronous exported functions
in standalone erasable-TypeScript modules with JSON-compatible inputs/results.
It does not support imports, async results, package builds, arbitrary npm tests,
new/deleted files, binary files, project-wide typechecking or test-file execution.
Acceptance cases define the verified claim; passing finite cases is not a proof
of arbitrary program correctness or resistance to test overfitting. The private
copy contains only approved files, not a full Git clone.

The trusted host/transport and same-user administrator are outside the adversary
model. Cancellation cannot forcibly stop arbitrary in-process trusted adapter
code. Use a fresh CLI process per task: Veil's global registry/job store retains
metadata until process exit. Cleanup on normal/error/timeout paths is implemented;
host SIGKILL can leave temporary directories. Source inputs must remain quiescent.
The existing sandbox's shared-kernel and RLIMIT_AS limitations still apply.

The developer workflow now wraps the existing opt-in reasoning adapter with
explicit token/cost limits and review artifacts. See [the delivery report](WORKFLOW-REPORT.md)
for the remaining boundary before a real application trial.
