# Governed verification sandbox — Phase 1

Status: tested Linux x86_64, **single-process verification profile**. This is
not a general shell, container platform, or replacement for Veil authorization.
No locked runtime/public contracts, package exports, dependencies, or research
artefacts are changed. The host imports the factory from this source tree.

## Mechanism and trusted boundary

`createLinuxVerificationSandbox` captures a detached host profile. Every run
copies reviewed inputs into a fresh private temporary directory. Directory-fd
traversal and `O_NOFOLLOW` reject symlinks, including raced parent replacements;
hard links and special files are rejected. Entry, depth and byte limits bound
snapshot construction. Common credential/config names (`.env*`, `.ssh`, `.aws`,
`.azure`, `.config`, `.npmrc`, `.netrc`) and `.git` are excluded at every depth.
This is not a general secret scanner: the host must supply a quiescent tree
containing only approved inputs, without credentials under other names.

`unshare --user --map-root-user --net` creates an empty network namespace.
Bubblewrap then creates nested user, mount, PID, IPC, UTS and cgroup namespaces,
disables further user namespaces, drops all capabilities, starts a new session,
and installs a persistent seccomp filter. It fails closed if setup is unavailable;
there is no unsandboxed fallback, sudo, Docker daemon, or external service.

The sandbox sees only:

- `/workspace`: read-only disposable snapshot; not the source checkout.
- `/runtime/verifier`: one host-selected executable, read-only.
- `/runtime/prlimit`: the OS limit setter, read-only.
- Explicit reviewed library/dependency mounts, read-only.
- A read-only PID-namespace-local `/proc`, empty read-only `/tmp`, and only
  `/dev/null` and `/dev/urandom` devices.

The root filesystem is read-only. No home, `/etc`, host `/run`, `/sys`, Windows
mounts, Docker socket, repository parent, or policy file is mounted. The host
profile is never accepted as capability input or mounted in the sandbox.
Library mount **sources** are trusted host choices: do not point them at homes,
credential stores, or mutable/unreviewed dependencies. Library mount targets
are constrained to library paths and `/opt/deps`.

The environment is cleared. Only PATH, HOME, LANG and PYTHONDONTWRITEBYTECODE
are explicitly set; Bubblewrap adds PWD and Python can add LC_CTYPE. No inherited
API keys, loader settings, Node options, or proxy settings are passed.

## Resource controls

| Resource | Enforcement |
| --- | --- |
| Wall time | Host timer sends SIGKILL to launcher process group; Bubblewrap parent-death/PID namespace lifecycle terminates verifier and threads |
| CPU | Hard/soft RLIMIT_CPU, summed process CPU time (not a percentage/quota) |
| Memory | Hard/soft RLIMIT_AS, including threads' shared virtual address space |
| Threads | Hard/soft RLIMIT_NPROC=32; UID accounting can cause earlier failure |
| Processes | seccomp denies fork/vfork and non-thread clone; clone3 returns ENOSYS |
| Output/disk | Each output file has RLIMIT_FSIZE=floor(outputBytes/2); no writable project/scratch mounts |
| Descriptors/core | RLIMIT_NOFILE=64, RLIMIT_CORE=0 |
| Snapshot | Host byte/entry caps and depth limit of 64 |

Seccomp also denies sockets (IPv4, IPv6, Unix), socketpair, namespace/mount
changes, ptrace/process-memory access, io_uring, memfd, selected SysV IPC and
privileged kernel interfaces. Non-x86_64 and x32 syscall ABIs fail closed.
Threads using CLONE_THREAD remain available for Node/libc. The tests exercise
fork, clone, clone3, thread exhaustion and selected prohibited syscalls.

Output uses inherited **regular file descriptors**, not Node socket-backed
child pipes. This avoids lost async stdout across this environment's network
boundary and puts a kernel disk bound underneath host output capture. A stream
reaching its allocated cap is conservatively classified `output-limit`, even
if the command exits zero. Code catching EFBIG cannot grow the file and remains
subject to CPU/wall limits. Output is returned after execution, not streamed.

`wallMs` bounds launched execution, not filesystem snapshot preparation.
Results contain status, exit code, signal, stdout/stderr, elapsed milliseconds,
and setup diagnostics. `elapsedMs` includes snapshot/setup, but excludes cleanup.
Temporary inputs, filters and outputs are removed in `finally` before the
promise returns. Cleanup errors reject rather than reporting false success.

## Host usage

```ts
import { OperatorRuntime } from './src/runtime/operator-runtime.js';
import { createSandboxVerificationCapability } from './src/capabilities/verification/sandbox-verify.js';

// Construct only in trusted host code; never from model output.
const verify = createSandboxVerificationCapability({
  workspace: '/absolute/path/to/approved-inputs',
  executable: process.execPath,
  args: [
    '--jitless', '--disable-wasm-trap-handler', '--max-old-space-size=64',
    '/workspace/acceptance.mjs',
  ],
  runtimeMounts: ['/usr/lib', '/lib', '/lib64'].map(path => ({ source: path, target: path })),
  wallMs: 5000, cpuSeconds: 2, addressSpaceBytes: 1024 * 1024 * 1024,
  outputBytes: 65536, snapshotBytes: 8 * 1024 * 1024, snapshotFiles: 1000,
});
const runtime = new OperatorRuntime({
  planVersions: ['2.0'],
  authorizer: {
    async authorize({ caller, capability }) {
      return { decision: caller?.subject === 'approved-task'
        && capability.name === verify.name ? 'allow' : 'deny' };
    },
  },
});
runtime.use({ manifest: { name: 'verification', version: '1.0.0',
  capabilities: [verify.name] }, capabilities: [verify] });
const job = await runtime.executePlan({ version: '2.0', steps: [
  { id: 'verify', capability: verify.name, input: {} },
] }, { caller: { subject: 'approved-task' } });
// Check job failure AND result.status. A completed capability can return
// failed, unavailable, timeout, or output-limit verification.
```

The capability is destructive-risk, not automatically registered, and accepts
only `{}`. A model cannot choose commands, mounts, paths, environment, or limits.
The host may construct a separate process/profile for another task. Registry
names remain process-global under the existing runtime contract.

## Verification record (17 October 2026)

Environment: Ubuntu 26.04 on WSL2, kernel
`6.18.54.1-microsoft-standard-WSL2`, Bubblewrap 0.11.1, Node 24.18.1,
Python 3.14. Session has NoNewPrivs=1, seccomp mode 2, zero capabilities.
Unprivileged user namespaces work. Direct Bubblewrap `--unshare-all` fails:
`loopback: Failed to create NETLINK_ROUTE socket: Operation not permitted`.
The external unshare network namespace plus Bubblewrap works, and the test
checks that its network namespace differs from the launcher's. Docker's WSL
integration is unavailable; no local Docker/Podman socket or rootless runtime
was found. Cgroup controls are not writable, so no cgroup memory claim is made.

The real security suite passes **10/10**, with zero skips:

1. Authorized Python execution and removal of temporary run directories.
2. Synthetic outside secret and `/proc/1/root` escape inaccessible; traversal,
   host mount access and writes denied; in-tree `.env` excluded; minimal env.
3. File and directory symlink inputs rejected before execution.
4. Distinct network/PID namespaces, no visible Node host processes, and socket
   creation denied for IPv4, IPv6 and Unix families.
5. Fork denied; threads work; timeout terminates execution; independent host
   procfs scan finds no surviving process in the terminated PID namespace.
6. A 256 MiB allocation fails under 128 MiB RLIMIT_AS; CPU spin is SIGKILLed
   under a one-second hard CPU limit; excessive output is bounded/classified.
7. Alternate process/namespace syscalls denied; thread creation exhausts below
   32 with virtual memory well below its ceiling.
8. Fixed Node JavaScript acceptance script succeeds and output is preserved.
9. Snapshot size enforcement and detached host configuration.
10. Veil denial occurs before capability start; command injection input is
    rejected; authorized V2 execution succeeds.

Observed simple Python run totals were approximately 18–31 ms; Node approximately
31–54 ms in development runs. These include tiny-fixture copying and setup, and
are not isolated overhead measurements or throughput benchmarks. The complete
suite takes approximately 4.5 seconds, mostly deliberate timeout/CPU tests.

Commands, from repository root (no models/network services required):

```sh
npm run typecheck
./node_modules/.bin/tsc --project tsconfig.test.json
node .tmp/test-build/test/sandbox-verification.test.js
node --test .tmp/test-build/test/sandbox-verification.test.js
npm run check
npm run verify:package
npm run quality -- --base 5f5bbf6
```

Full `npm run check`: typecheck/test compilation succeeds; 18 test-file workers
pass, including the sandbox; two unchanged external-reasoner workers fail.
Direct diagnostics show `spawnSync ... EPERM` and, in the external-reasoner
host, an unsettled top-level await after interrupted IPC. These are not skipped
or repaired by changing frozen apparatus. Full check is **not green**.
Separate package verification builds successfully, then fails at
`tools/verify-package.mjs:24` parsing empty captured npm output. Quality exits 1
for the new test verification control requiring review, with no unapproved
execution references and no dependency/lockfile changes. Its baseline is unchanged.

## Limits and readiness

- Shared kernel isolation is not protection against kernel/Bubblewrap/library
  vulnerabilities, side channels, or malicious privileged host administrators.
- RLIMIT_AS is virtual address space, **not** cgroup RSS/kernel-memory accounting.
  No machine-wide memory quota or CPU percentage claim is made. Kernel-visible
  procfs statistics are not completely hidden. Thread/FD/input/output caps narrow
  resource exposure but are not a formal host denial-of-service proof.
- Socket denial is also imposed by this enclosing agent session. Tests prove
  denial here plus a distinct network namespace; they do not alone attribute
  every denial to this filter. Re-run the suite on each deployment host.
- Normal cleanup and timeout cleanup are tested. SIGKILL of the host itself can
  leave private temporary directories; automatic crash scavenging is absent.
- Inputs must be stable while snapshotted; fd traversal contains path races but
  does not promise a transactionally consistent snapshot of concurrent edits.
- No writable scratch/build tree, subprocesses, npm scripts, dependency
  installation, package-manager CLI, browser, or ordinary tsx CLI is supported.
  Such workloads require a new reviewed profile, not removal of restrictions.
- Exit zero means the selected process exited zero, not that arbitrary generated
  code is correct. Untrusted modules may deliberately terminate or print forged
  results. A trusted task-level acceptance oracle must bind success to the
  intended task/revision; sandboxing alone does not supply that oracle.
- This factory is source-tree host infrastructure, not a newly exported npm API.

Ready for bounded single-process Python/Node verification on this tested host.
**Not a drop-in replacement for 004G's tsx subprocess runner.** The smallest
next step is a separate (non-frozen) 004G-derived host adapter with a fixed
single-process Node/native-TypeScript acceptance entrypoint and trusted final
success predicate. Keep the historical 004G implementation/evidence unchanged.
General subprocess/build support remains blocked until delegated cgroups or
equivalent aggregate controls are available and tested.
