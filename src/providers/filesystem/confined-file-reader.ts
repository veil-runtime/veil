import { constants } from 'node:fs';
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// Four UTF-8 bytes per returned character; never read an unbounded file first.
export const MAX_FILE_BYTES = 200_000;
const MAX_CHARACTERS = 50_000;

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function regular(stat: Awaited<ReturnType<FileHandle['stat']>>): void {
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('Only regular, single-link files may be read');
  if (stat.size > MAX_FILE_BYTES) throw new Error('File exceeds the 200000-byte read limit');
}

/** Internal provider, not a public sandbox. The configured root/ancestors and
 * mount namespace are trusted host configuration. Linux traversal pins parents
 * through procfs and opens each child with O_NOFOLLOW. Portable checks additionally
 * compare identities before/after reading, but require quiescent directories:
 * Node exposes no portable openat/no-follow-parent primitive. Neither path promises
 * an atomic snapshot of concurrently edited files or protection from host mounts.
 */
export async function readConfinedFile(root: string, input: string): Promise<{ path: string; content: string }> {
  if (typeof input !== 'string' || !input || input.includes('\0')) throw new Error('A file path is required');
  const requested = resolve(root, input);
  if (!inside(resolve(root), requested)) throw new Error('Path is outside allowed root');
  const parts = relative(resolve(root), requested).split(sep);
  if (parts.length > 64 || (process.platform === 'win32' && parts.some(part => /[:]/.test(part)))) {
    throw new Error('Unsupported file path');
  }
  const canonicalRoot = await realpath(root);
  const path = resolve(canonicalRoot, ...parts);
  const handles: FileHandle[] = [];
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  try {
    let file: FileHandle;
    let verify: () => Promise<void>;
    if (process.platform === 'linux') {
      const directory = await open(canonicalRoot, flags | constants.O_DIRECTORY);
      handles.push(directory);
      if (await realpath(`/proc/self/fd/${directory.fd}`) !== canonicalRoot) throw new Error('Filesystem root changed');
      let parent = directory;
      for (let index = 0; index < parts.length; index++) {
        const last = index === parts.length - 1;
        const selected = `/proc/self/fd/${parent.fd}/${parts[index]}`;
        const stat = await lstat(selected);
        if (stat.isSymbolicLink() || (!last && !stat.isDirectory())) throw new Error('File path contains a link or non-directory');
        if (last) regular(stat);
        const child = await open(selected, flags | (last ? 0 : constants.O_DIRECTORY));
        handles.push(child);
        parent = child;
      }
      file = parent;
      verify = async () => {
        if (!inside(canonicalRoot, await realpath(`/proc/self/fd/${file.fd}`))) throw new Error('Opened file is outside allowed root');
        regular(await file.stat());
      };
    } else {
      // Inspect every user-selected component, not only the final realpath.
      const inspect = async () => {
        const stats = [];
        let current = canonicalRoot;
        for (let index = 0; index < parts.length; index++) {
          current = resolve(current, parts[index]!);
          const stat = await lstat(current);
          if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())) throw new Error('File path contains a link or non-directory');
          stats.push(stat);
        }
        regular(stats.at(-1)!);
        if (await realpath(path) !== path) throw new Error('File path changed or contains a link');
        return stats;
      };
      const before = await inspect();
      file = await open(path, flags);
      handles.push(file);
      verify = async () => {
        const after = await inspect();
        const opened = await file.stat();
        regular(opened);
        if (after.some((stat, index) => stat.dev !== before[index]!.dev || stat.ino !== before[index]!.ino) ||
            opened.dev !== before.at(-1)!.dev || opened.ino !== before.at(-1)!.ino) throw new Error('File path identity changed');
      };
    }
    await verify();
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_FILE_BYTES) throw new Error('File exceeds the 200000-byte read limit');
    await verify();
    return { path: requested, content: buffer.subarray(0, length).toString('utf8').slice(0, MAX_CHARACTERS) };
  } finally {
    // Attempt every close even if a filesystem reports one close failure.
    const results = await Promise.allSettled(handles.map(handle => handle.close()));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
}
