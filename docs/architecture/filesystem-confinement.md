---
title: Filesystem read confinement
---
# Filesystem read confinement

The source-tree `filesystem.file.read` capability delegates to the internal
`readConfinedFile` provider. It remains a read-risk capability governed by the
existing runtime authorizer. Neither the capability nor this provider is exported
from the Core package. No ExecutionPlan, authorization or result contract changed.

## Bounds and confinement

`OPERATOR_FILES_ROOT` is captured when the capability module loads; it defaults
to the process working directory. The host must configure and protect that root,
its ancestors, and the mount namespace. A host-configured root is canonicalized;
user-selected child components cannot be symbolic links, including links whose
targets remain inside the root. Directories, hard-linked files (`nlink != 1`),
FIFOs, sockets and other special files are rejected. User-selected paths must stay
inside the root, contain no NUL, and use at most 64 components. Windows alternate
data streams are rejected.

The provider rejects files larger than 200,000 bytes, reads into one fixed
200,001-byte buffer, detects growth past the bound, and returns at most the
existing 50,000 JavaScript string code units. Large files previously read in full
and truncated are now rejected. All opened handles are closed on success/failure.
These are per-invocation limits, not a process-wide memory or concurrency quota.

On Linux, directory handles pin parent lookup through `/proc/self/fd` and every
child is opened with `O_NOFOLLOW`; directories also require `O_DIRECTORY`.
Nonblocking opens prevent a raced FIFO from blocking the reader. The opened file
is checked for regular-file type, link count, size and canonical containment
before/after reading. Missing procfs fails closed, without a lexical fallback.

On macOS/Windows, Node does not expose portable descriptor-relative no-follow
parent traversal. The provider checks every component and canonical path, compares
device/inode identities against the opened file, and repeats checks after the
bounded read. Those platforms require host-owned, quiescent directories. These
checks are **not race-free confinement against a concurrent hostile filesystem
writer**. A deployment needing that threat model must isolate/protect the tree or
use an OS-specific reviewed provider. Privileged mount changes, network-filesystem
behavior, file-content snapshot consistency and host compromise are outside the
guarantee on every platform. SDK timeout middleware is not IO cancellation.

## Evidence

`test/filesystem-confinement.test.ts` covers ordinary/Unicode reads, lexical
escapes, final/parent/internal symlinks, hard links, directories, oversized sparse
files, and governed V1/V2 exploit rejection. Policy denial asserts zero opens and
no capability-start event. Linux tests additionally cover FIFO/socket rejection,
parent replacement, final-symlink replacement between inspection/open, and growth
after stat. The Linux tests pass locally; macOS/Windows execution requires those
hosts and must be recorded separately. CI has a dedicated platform matrix.

The 2026-10-24 release-hardening rerun passed all nine tests on Linux x86_64/WSL2
with Node v24.18.1 after a clean lockfile install (zero failures/skips). This includes
the Linux simulation of portable identity checks; no native macOS or Windows run
was available. The four common platform tests remain unconditional in the matrix.
Core v0.4.0 targets Linux execution only. Windows and macOS are unqualified;
native host results are required before qualifying either platform, including
platform-specific symlink privileges and Windows path/identity behavior. Linux success does not
establish those semantics or relax the quiescent-directory requirement.
