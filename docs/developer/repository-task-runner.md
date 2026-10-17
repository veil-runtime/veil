# Phase 2 verification record — 17 October 2026

Implementation and usage: [repository-task host](../../apps/repository-task/README.md).
Baseline: clean `feat/secure-verification-sandbox`, HEAD
`4ae623ad7b388b9de57c0c8aa8277957e49f907f`. No core, sandbox, dependency,
package export, historical experiment or experimental evidence changes.

## Results

| Check | Result |
| --- | --- |
| `npm run typecheck` (through check) | Pass |
| `tsc --project apps/repository-task/tsconfig.json` | Pass, standalone host/CLI build |
| `tsc --project tsconfig.test.json` | Pass, includes host via integration imports |
| `node .tmp/test-build/test/repository-task.test.js` | 8/8 pass, zero skips |
| `node .tmp/test-build/test/sandbox-verification.test.js` | 10/10 pass, zero skips |
| JSON-lines CLI smoke task | Exit 0, verified, original file preserved |
| `npm run check` | 19/21 test workers pass; same two baseline failures |
| `npm run verify:package` | Build passes; existing captured-output JSON parse failure |
| Direct `npm pack --json` redirected to regular file | Pass, valid core package manifest, 106 files |
| `npm run quality -- --base 4ae623a` | Review required for new test and app tsconfig; see quality notes below |

Eight deterministic integration tests cover: 004G-style autonomous discovery,
source read, incomplete clamp implementation, actual failing acceptance feedback,
contract inspection, correction and fresh passing acceptance; a separate slug
TypeScript task using exact patch; unauthorized write/traversal denial followed by
safe recovery; file/parent symlink rejection before reasoning; edit-after-verify
invalidation; real sandbox timeout; both turn and verification exhaustion; and
import/process-exit/command-injection rejection, malformed protocol and transport
deadline. Successful patches are applied with real `git apply`, including a file
without a trailing newline. Tests use independent temporary fixtures, never
historical fixtures. These prove deterministic loop behavior, not live model skill.
No paid calls were made.

Security regression coverage remains the original ten sandbox tests: filesystem
and credential isolation, namespaces, network denial, process/thread controls,
timeout teardown, memory/CPU/output caps, snapshot checks, and Veil authorization.
The sandbox and its tests were not weakened or changed.

## Baseline failure investigation

The baseline check was run before edits: 18/20 test workers passed. Both failing
files are unchanged from the pre-sandbox commit `5f5bbf6`; `git diff 5f5bbf6 4ae623a`
shows no changes to those tests, external-reasoner fixture or package verifier.

- `external-model-reasoner.test.ts`: direct execution reports child-process
  `spawnSync ... node EPERM` and empty captured output.
- `external-reasoner.test.ts`: direct execution reports the same EPERM plus
  reasoner exit 13, unsettled top-level await at `reasoner.mjs:12`, and empty trace.
  This occurs before discovery completes, in the child IPC transport.
- A minimal independent `execFileSync(node, ['-e','console.log(123)'])` reproduces
  EPERM, child status 0 and empty stdout in this agent environment.
- `verify:package`: TypeScript build succeeds, then `tools/verify-package.mjs:24`
  parses empty captured npm output (`SyntaxError: Unexpected end of JSON input`).
  The same npm pack run with stdout redirected to a regular file emits valid JSON
  and the expected package name and files.

Evidence supports environmental child stdio/IPC restrictions, not a sandbox or
runner regression. No unrelated harness repair was made. The package-consumer
installation/typecheck/runtime checks after that parse have **not** completed;
full `npm run check` is **not green**.

## Quality and scope

Comparison base is the requested `4ae623a`. No dependencies/lockfile changes and
no core-source growth. The tool counts +139 test LOC; application LOC sits outside
its source-growth bucket and must be reviewed separately. New integration tests
and `apps/repository-task/tsconfig.json` are verification controls requiring review;
no quality allowlist or control was relaxed. Initial findings for direct capability
delegation and dynamic CLI adapter loading were corrected: the authorized
capability now calls its sandbox provider, and CLI transport is JSON-lines data.

Review files: `apps/repository-task/{runner,workspace,acceptance,cli}.ts`, its
`tsconfig.json` and `README.md`, `test/repository-task.test.ts`, and this record.
Everything remains uncommitted for review; no push or merge was performed.
