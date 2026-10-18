# First Mizan trial: prepared, not executed live

The TSX blocker is removed. The real application's original defect and a scripted
correction have been checked through the existing governed runner and Linux
sandbox. No paid inference, source checkout modifications, commits, merges,
deployments, or production access occurred.

## Verification policy

The optional host-owned `tsxAcceptance` profile field selects a single-file
source check; `acceptance` must be empty, and only that file may be readable.
Writable paths must still be a subset of readable paths. Parser settings,
executable, command arguments, and sandbox limits never come from model actions.
`verification.sandbox.run` continues to accept only `{}`.

The generic adapter supports one literal JSX ID addition to a host-selected
relationship. The Mizan values live in the prepared profile, not adapter code:

```json
{
  "file": "src/App.tsx",
  "baselineSHA256": "a411ef0d461002afc2319db1add694f8d40f148d35d95a954b1c2c0407074057",
  "component": "Header",
  "control": {"tag":"button", "attribute":"aria-controls", "value":"main-navigation"},
  "target": {"tag":"nav", "attribute":"aria-label", "value":"Main navigation"},
  "targetId": "main-navigation"
}
```

Before reasoning, the initial source must match that SHA-256. Both baseline and
candidate are parsed as TSX inside the sandbox, without importing or executing
application code. The named function, control, and target must each be unique;
selectors use literal attributes. The target/control cannot use JSX spreads.
The original target must have no ID. The candidate must have exactly one literal
ID attribute matching the control's `aria-controls`, on the selected navigation.
There must be exactly one occurrence of that literal ID across JSX elements in
the file. Missing, duplicate, dynamic or wrong target IDs fail.

Remove only that added ID attribute from the candidate AST, then require full
AST equality to the original. Only `start`, `end`, `loc`, and parser `extra`
metadata are ignored. Imports, code, other attributes, JSX text, comment contents
and attachment, and all other AST structure remain compared. Nonsemantic
formatting/quote changes can pass; JSX whitespace represented as text cannot.
This proves the narrow source correction, not browser behavior, a complete build,
or general accessibility compliance. The immutable baseline already contains the
existing conditional menu rendering and toggle behavior.

Acceptance still requires the private host completion marker and a successful
sandbox result. The runner binds it to the full current approved-tree digest;
any later content edit invalidates it, including formatting-only changes. The
model sees only a fixed pass/fail summary, empty stderr, and standard bounded
execution metadata. Private rules, baseline text, parser errors and sandbox
paths are not included in verifier feedback.

## Parser and sandbox review

Reuses installed `@babel/parser` 8.0.6, `lib/index.js`, 481,329 bytes. SHA-256:
`a6993b23a0d162cc93e49f72ef927c947c2026cd146cfe9c02cd695a4258411d`.

The reviewed file is standalone ESM. Source inspection and an AST inventory found
no runtime imports, require calls, dynamic import/evaluation, or network calls.
The package's `@babel/types` dependency is only for type definitions and is not
needed at runtime. The adapter reads and checksum-validates the installed parser,
copies only those bytes to a private directory, and mounts that directory
read-only at `/opt/deps`. No application dependencies/configuration are mounted.
Parser upgrades fail closed until explicitly reviewed and repinned.

The TSX adapter additionally restricts supplied runtime mounts to matching
`/usr/lib`, `/lib`, and `/lib64` pairs. It adds its own private parser mount.
Existing network/PID namespaces, seccomp restrictions, cleared environment,
read-only root/workspace, `--jitless`, process restrictions, wall/CPU/memory/output
limits, and cleanup remain unchanged. No shell is registered. The parser is
trusted code, but parses untrusted source under the existing resource limits.

## Prepared local artifacts

Root: `/tmp/veil-mizan-trial-4yizxdst`

- `workspace/src/App.tsx`: the only application file, copied byte-for-byte from
  clean Mizan commit `aa8494e1e9ba894f960ddbd6d58d24411dd789c7`.
- `profile.json`: explicit read/write allowlist, baseline-bound policy and limits.
- `inference.json`: model/token/estimated-cost limits, no credential.
- `task.txt`, `source-manifest.json`: public task and source provenance.
- `offline/record.json`, `offline/summary.json`, `offline/changes.patch`:
  scripted decisions, synthetic accounting, real sandbox evidence and patch.
- `offline-demo.cjs`: reproducible host-scripted demonstration; output directory
  is exclusive, so use a fresh output location to repeat it.
- `cli-replay/`: successful offline replay through the actual CLI and profile.
- `run-live.sh`: exact future live command. **Not executed.**

Only `src/App.tsx` is model-readable/writable. No environment files, credentials,
application dependencies, database files, data modules, assets or unrelated
application files were copied. The source refers to environment variable names,
not values; its Supabase initialization and booking code are never executed.
The host API credential, when separately authorized, is read from
`OPENAI_API_KEY` and is not copied into configuration or evidence.

## Limits and future command

Model `gpt-4.1-mini-2025-04-14`; 10 turns; 2 verifications; 30,000 input tokens;
6,000 output tokens; 1,200 output tokens/call; adapter threshold $0.04; one
writable file; 32 KiB source snapshot; 4 snapshot entries; 120 s task duration;
20 s reasoning timeout. Each verification: 2 s wall, 2 s CPU, 1 GiB address-space
limit, 64 MiB Node heap, 8 KiB output. Observation/response/transcript limits:
256 KiB / 64 KiB / 16 MiB.

At the existing pinned $0.40/$1.60 per million input/output tokens, the nominal
token envelope estimates $0.0216. The $0.04 admission/reservation threshold is
not a provider billing cap. Pricing and live credentials were not remotely
validated; no inference requests have been made.

After explicit paid authorization and with the credential supplied in the host
environment, run:

```sh
sh /tmp/veil-mizan-trial-4yizxdst/run-live.sh
```

That script invokes the existing `workflow-cli.js` with the exact prepared task,
profile and inference configuration, and a new `live-output` directory. Live
mode and the scripted demonstration both use `runLiveTask` →
`runRepositoryTask` → governed `OperatorRuntime.executePlan`; only the reasoning
transport differs. Live execution produces a patch; it does not apply it.

## Validation and remaining limitations

- Application and test TypeScript compilation passed.
- Six new deterministic TSX tests passed, covering correction, original defect,
  duplicate/missing/wrong IDs, invalid syntax, unrelated AST/comment/import
  changes, spread attributes, path authorization, verifier command injection,
  source preservation, stale acceptance, baseline mismatch, unreviewed mounts,
  extra policy fields, and feedback confidentiality. A passing source fixture
  contains an unresolved import and top-level throw: neither executes.
- Relevant workflow, runner, adapter, diagnostics, and sandbox-security test
  files pass alongside TSX tests. Log: `/tmp/veil-tsx-focused.log`.
- Real Mizan offline run: six scripted turns, failed original verification,
  passed corrected verification, one changed file in the patch. Final/verified
  revision: `50b42316fd821fa55c29971f4971e721277a8f5b761f2f906f462bb680a04932`.
  Actual inference cost $0; simulated usage is explicitly labeled.
- `npm run check`: typecheck passed, 24/26 test files passed. Only the previously
  established baseline subprocess tests fail: `external-reasoner` and
  `external-model-reasoner` (`spawnSync EPERM`/broken subprocess capture in this
  environment). The full gate is not green; package verification is not reached.
  These experimental paths are not used by the prepared source-tree trial.
- `npm run quality -- --base d7c528c73633242b1ec6b3577a060b5e472d7166`: no new
  governance violation; exit 1 for test review required. Core source and harness
  totals unchanged; tests +206 LOC versus that base, of which this task adds 100.
  Existing pending test changes account for the remainder. No controls relaxed.
- Mizan Git status remains clean and source SHA-256 remains equal to the copied
  baseline after both demonstrations. Disposable input also remains unchanged.

Current-task repository changes: `tsx-verification.ts`, `runner.ts`,
`test/tsx-verification.test.ts`, `WORKFLOW.md`, and this document. Earlier pending
workflow edits were preserved. No new implementation blocker remains for this
narrow trial; live provider authentication/availability still awaits the
explicitly authorized live execution. Temporary artifacts must remain present.
