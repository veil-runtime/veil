# Mizan FAQ search: bounded trial prepared, not executed live

The disposable trial is ready for review and paid-run approval. No inference was
requested. The original Mizan checkout remains clean at
`aa8494e1e9ba894f960ddbd6d58d24411dd789c7`. No production access, commits,
deployments or edits to earlier evidence were made. Veil's pre-existing pending
changes were preserved. The repository-wide gate is **not green**; see limitations.

1. **Feature and value.** Add search to the FAQs on each discipline page so visitors
   can find a question by its wording or answer. Preserve the current accordion,
   add result/empty states and a clear action, and style the controls consistently.
   Estimated ordinary developer effort: 30–45 minutes including state edge cases,
   styling and tests. This requires decisions about filtering, state identity,
   reset behaviour, accessible controls and layout; the live model receives no
   reference implementation or prescribed edit.

2. **Exact source permissions.** Read/write `src/App.tsx` and `src/index.css` only.
   Acceptance further confines edits to the existing top-level `Faqs` function
   and an appended CSS suffix. The existing function signature, JSX structure,
   local state and filtering implementation remain model choices. No helpers or
   imports outside the function can change. All source outside it and all original
   CSS must be byte-identical. No other application files, datasets, environment
   files, assets, dependencies, credentials or Git metadata enter the workspace.
   These two source files total 45,251 bytes. Source contains environment variable
   *names*, not values; no application imports or booking code execute.

3. **Public behavioural requirements.** A controlled, accessibly labelled search
   input filters question OR answer using trimmed, case-insensitive literal
   substring matching. Blank queries restore original order. A polite live count
   reads `N of T questions`; zero results show `No questions found.`. `Clear search`
   clears input and restores results. Query changes and clear close any answer.
   At most one answer opens, clicking it again closes it, and `aria-expanded`
   agrees with the answer shown after filtering. Empty arrays are supported.
   Existing FAQ heading/patterns stay; appended responsive styles use existing
   tokens and retain visible keyboard focus. No network, storage or booking work.

4. **Verification.** The new internal `componentAcceptance` profile reuses
   `runLiveTask` → `runRepositoryTask` → `OperatorRuntime.executePlan` → the existing
   Linux verification sandbox. There is no new planner, framework or command tool.
   A pinned TypeScript 5.6.3 compiler parses the whole source, checks edit scope,
   and transpiles the selected component inside the sandbox. A separate pinned
   host oracle runs synthetic props and events in a VM with bounded execution,
   minimal `useState`/`useMemo` semantics and JSX elements. Candidate code receives
   no host functions, filesystem access, imports, `process`, or test implementation.
   Assertions and expected results remain in the trusted realm. Compiler and tests
   are private mounts, never workspace-readable. This is a component contract test,
   **not full React rendering, browser testing, a TypeScript typecheck, a Vite build,
   visual verification or production verification**. CSS checks cover appended
   rules and no external resources; responsive appearance/focus styling and heading
   preservation within the editable function still need patch review.

   Feedback distinguishes transpilation without acceptance from successful
   behavioural checks plus host acceptance. Tests use different datasets and order,
   answer-only matches, case/whitespace, a literal `[`, no matches, clear, empty data,
   accordion toggle and resetting an answer that remains among filtered results.
   Private test assertions, fixtures, paths, hashes, compiler errors and stack traces
   are not returned to the model. Final host acceptance requires successful sandbox
   exit, an unpredictable completion marker and the exact final tree digest. Any
   subsequent edit, including CSS-only changes, invalidates acceptance.

5. **Security.** Explicit two-file allowlists, existing canonical-path checks and
   governed authorization apply to every action. No shell or arbitrary model-selected
   script is available; `verification.sandbox.run` accepts only `{}`. The host owns
   and checksum-binds the compiler, oracle, baseline and limits. Profiles remain
   private authority, not model-editable instructions. Runtime mounts are restricted
   to matching `/usr/lib`, `/lib`, `/lib64` plus the adapter's private dependency
   directory. Network/PID isolation, seccomp, cleared environment, read-only root
   and workspace, disabled dynamic VM code generation, `--jitless`, memory/CPU/wall/
   output limits and cleanup remain active. The VM narrows the component surface;
   Linux remains the security boundary. Private artifact root is mode 0700 and
   input/config/compiler/oracle files are mode 0400. No original source is modified.

6. **Budget.** Pinned model `gpt-4.1-mini-2025-04-14`, existing live adapter.

   | Limit | Value |
   |---|---:|
   | Model turns | 24 |
   | Verification attempts | 4 |
   | Input/output tokens | 250,000 / 16,000 |
   | Output per call | 3,500 |
   | Monetary admission/reservation threshold | $0.25 |
   | Changed files | At most 2, enforced by writable list |
   | Task duration / per-turn reasoning timeout | 480 s / 30 s |
   | Source workspace / snapshot entries | 64 KiB / 4 (root, src, two files) |
   | Verification wall / CPU | 8 s / 6 s |
   | Address space / Node heap | 2 GiB / 192 MiB |
   | Verifier output | 8 KiB |
   | Observation / response / evidence | 256 KiB / 64 KiB / 32 MiB |

   Existing pinned accounting rates are $0.40/$1.60 per million input/output
   tokens. The full token envelope estimates **$0.1256**. Conservatively retaining
   all 24 per-call output reservations plus maximum input is **$0.2344**, below
   $0.25. This is adapter admission accounting, not a billing cap or a claim about
   current provider prices. Actual inference spend here: **$0**. Repeated full-file
   observations explain the input budget; minimal patches keep output economical.
   Private compiler/test bytes are separate from the model source workspace and
   capped at 12 MiB/64 KiB by the adapter.

7. **Exact future CLI invocation.** Prepared root: `/tmp/veil-mizan-faq-k0bAgP`.
   With separately approved paid access and `OPENAI_API_KEY` already in the host
   environment, run the following from `/home/mustapha/dev/ai/playwright-lab`.
   It has **not** been run. The output path must be new.

   ```sh
   ./node_modules/.bin/tsc --project apps/repository-task/tsconfig.json
   node .tmp/task-build/apps/repository-task/workflow-cli.js \
     --profile /tmp/veil-mizan-faq-k0bAgP/profile.json \
     --task "$(cat /tmp/veil-mizan-faq-k0bAgP/task.txt)" \
     --output /tmp/veil-mizan-faq-k0bAgP/live-output \
     --live-paid --inference /tmp/veil-mizan-faq-k0bAgP/inference.json
   ```

   This emits a reviewable patch; it does not apply it to Mizan. To prepare a fresh
   disposable root without inference, use
   `node apps/repository-task/prepare-mizan-faq.cjs /home/mustapha/dev/mizan/mizan`.
   Review its newly emitted manifest/profile before any future trial. Do not point
   the live command at the positive-control patch-check copy.

8. **Remaining blockers/limits.** Paid approval and host credentials remain pending;
   authentication/provider availability have not been exercised. Temporary artifacts
   must remain available. `npm run check` fails in the two previously reported
   external-reasoner subprocess test files; this must be accepted as an environment
   limitation or resolved before requiring a fully green repository gate. Package
   verification also fails while parsing empty subprocess output, described below.
   Quality requires review of test changes. Full browser/app/visual checks are outside
   this trial's acceptance claim and must precede any separately authorized adoption.
   No production application of the future patch is authorized by this preparation.

Offline evidence and checks:

- `offline/record.json`, `offline/summary.json`, `offline/changes.patch` under the
  prepared root contain explicitly **scripted host controls**, synthetic accounting
  and real sandbox results. They demonstrate verifier/workflow operation, not model
  implementation ability. The model-readable source remains the unimplemented
  original. Neither the oracle nor positive control enters live observations.
- Real-source incomplete component: compilation passes, behavioural acceptance
  fails. Correct positive control: both files change, sandbox acceptance passes.
  Final/verified digest:
  `d7ff53954685e8658edf880b248950e11667304b863c10892fc9e3ed0df8b6e5`.
- The actual workflow CLI replayed that record offline with a separately supplied
  approved profile; `cli-replay/summary.json` reports verified on the same digest.
- `patch-check.json`: `git apply --check`, apply, reverse-check and reverse all exit
  zero on a disposable copy; restored bytes match both baseline hashes. Original
  Mizan and disposable input hashes remain unchanged, and Mizan Git status is clean.
- `tsc --project apps/repository-task/tsconfig.json` and test compilation pass.
  Focused component tests: **4/4 pass**, including eight incomplete/invalid mutants,
  out-of-scope writes, verifier command injection, surrounding-source changes,
  missing styles, stale revision, infinite loop, process access, dynamic-evaluation
  escape attempt, dependency/baseline tampering, mount restrictions and confidentiality.
  Log: `/tmp/veil-component-final.log`. Reproduce with:

  ```sh
  ./node_modules/.bin/tsc --project tsconfig.test.json
  VEIL_TEST_TYPESCRIPT=/home/mustapha/dev/mizan/mizan/node_modules/typescript/lib/typescript.js \
    node --test --test-isolation=none .tmp/test-build/test/component-verification.test.js
  ```

  Tests explicitly require the reviewed app compiler; without the environment
  variable they are marked skipped, not counted as verified. No tests were skipped
  in this delivery's run. No compiler package was installed or added to dependencies.
- `VEIL_TEST_TYPESCRIPT=... npm run check`: typecheck passes; **26/28 test files pass**,
  including component, TSX, sandbox security, repository runner, live adapter,
  workflow and patch tests. Failures: `external-reasoner.test.js` and
  `external-model-reasoner.test.js`. Direct diagnostics show `spawnSync ... EPERM`
  and broken subprocess communication/unsettled top-level await. Logs:
  `/tmp/veil-faq-check-final.log`, `/tmp/veil-faq-baseline-failures.log`. The authoritative
  gate is not relabelled successful or weakened.
- Separately, `npm run verify:package`: production build passes, package verification
  fails at `tools/verify-package.mjs:24`, `SyntaxError: Unexpected end of JSON input`
  parsing subprocess output. Log: `/tmp/veil-faq-package.log`.
- `npm run quality -- --base d7c528c73633242b1ec6b3577a060b5e472d7166`: exit 1 for
  test review, no unapproved execution references/accesses. Measured core source and
  harness totals unchanged; tests +396 LOC across all pending changes, 100 from this
  task. Log: `/tmp/veil-faq-quality-final.log`. Its growth categories do not count the new
  app-local verifier/preparation/oracle code; those add 230 lines separately.

Current-task repository files: `component-verification.ts`, the small profile/
selection extension in `runner.ts`, `host-tests/faq-search.cjs`,
`prepare-mizan-faq.cjs`, `test/component-verification.test.ts`, and this report.
Earlier `MIZAN-TRIAL.md`, workflow documents and historical evidence were not edited.
