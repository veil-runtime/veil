import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import type { Capability } from '../../src/index.js';

export type Tree = Record<string, string>;
export const digest = (tree: Tree): string => createHash('sha256').update(JSON.stringify(Object.entries(tree).sort())).digest('hex');
export function safePath(value: string): boolean {
  return /^[a-zA-Z0-9_./-]+$/.test(value) && value.split('/').every(p => p !== '' && p !== '.' && p !== '..'
    && !['.git', '.ssh', '.aws', '.azure', '.config', '.npmrc', '.netrc'].includes(p) && !p.startsWith('.env'));
}

/** Pin each directory while reading approved files; never follow links. */
export async function readApproved(root: string, paths: readonly string[], maxBytes: number): Promise<Tree> {
  const tree: Tree = Object.create(null);
  let bytes = 0;
  for (const path of paths) {
    if (!safePath(path)) throw new Error(`Invalid approved path: ${path}`);
    const handles = [];
    try {
      let handle = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      handles.push(handle);
      const segments = path.split('/');
      for (const [index, segment] of segments.entries()) {
        handle = await open(`/proc/self/fd/${handle.fd}/${segment}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
          | (index < segments.length - 1 ? constants.O_DIRECTORY : 0));
        handles.push(handle);
      }
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes - bytes) throw new Error('Unsupported or oversized input');
      const buffer = Buffer.alloc(maxBytes - bytes + 1);
      let size = 0;
      while (size < buffer.length) {
        const next = await handle.read(buffer, size, buffer.length - size, null);
        if (!next.bytesRead) break;
        size += next.bytesRead;
      }
      bytes += size;
      if (bytes > maxBytes) throw new Error('Workspace byte budget exceeded');
      const data = buffer.subarray(0, size);
      const content = data.toString('utf8');
      if (!Buffer.from(content).equals(data) || content.includes('\0')) throw new Error('Only UTF-8 text inputs supported');
      tree[path] = content;
    } finally { for (const handle of handles.reverse()) await handle.close(); }
  }
  return tree;
}

export async function materialize(root: string, tree: Tree): Promise<void> {
  for (const [path, content] of Object.entries(tree)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content, { flag: 'wx', mode: 0o600 });
  }
}

/** 004G read/write and 004B exact-patch semantics, confined to a private, link-free copy. */
export function workspaceCapabilities(root: string, paths: readonly string[], maxBytes: number): Capability<any, unknown>[] {
  const field = (key: string) => ({
    type: ['startLine', 'lineCount'].includes(key) ? 'number' : 'string',
    required: true,
    description: key === 'path'
      ? 'Canonical workspace-root-relative path; no leading slash, ./, or traversal. Use . only for root listing.'
      : key,
  });
  const make = (operation: string, fields: string[], execute: (input: any) => Promise<unknown>): Capability<any, unknown> => ({
    name: `workspace.${operation}`, version: '1.0.0', description: `Governed workspace ${operation}`,
    risk: ['read', 'readRange', 'list'].includes(operation) ? 'read' : 'write',
    inputSchema: Object.fromEntries(fields.map(key => [key, field(key)])), execute,
  });
  const read = async (path: string) => (await readApproved(root, [path], maxBytes))[path];
  const save = async (path: string, content: string) => {
    if (typeof content !== 'string' || content.includes('\0')) throw new Error('Text content required');
    const tree = await readApproved(root, paths, maxBytes);
    tree[path] = content;
    if (Object.values(tree).reduce((n, s) => n + Buffer.byteLength(s), 0) > maxBytes) throw new Error('Workspace byte budget exceeded');
    await writeFile(join(root, path), content);
    return { path, bytesWritten: Buffer.byteLength(content) };
  };
  return [
    make('list', ['path'], async ({ path }) => ({ path, entries: [...new Set(paths.filter(p => path === '.' || p.startsWith(`${path}/`))
      .map(p => (path === '.' ? p : p.slice(path.length + 1)).split('/')[0]))].sort() })),
    make('read', ['path'], async ({ path }) => ({ path, content: await read(path) })),
    make('readRange', ['path', 'startLine', 'lineCount'], async ({ path, startLine, lineCount }) => {
      if (!Number.isSafeInteger(startLine) || startLine < 1 ||
          !Number.isSafeInteger(lineCount) || lineCount < 1 || lineCount > 80) {
        throw new Error('Invalid line range; startLine >= 1 and lineCount must be 1..80');
      }
      const content = await read(path);
      const lines = content.split('\\n');
      if (content.endsWith('\\n')) lines.pop();
      const totalLines = lines.length;
      const selected = lines.slice(startLine - 1, startLine - 1 + lineCount);
      if (Buffer.byteLength(JSON.stringify(selected)) > 8192) {
        throw new Error('Range observation exceeds 8192 bytes; request fewer lines');
      }
      return {
        path,
        startLine,
        totalLines,
        lines: selected.map((text, index) => ({
          number: startLine + index,
          text,
        })),
        hasMore: startLine - 1 + selected.length < totalLines,
      };
    }),
    make('write', ['path', 'content'], async ({ path, content }) => save(path, content)),
    make('append', ['path', 'content'], async ({ path, content }) => {
      if (typeof content !== 'string' || !content || content.includes('\\0')) throw new Error('Non-empty text content required');
      const existing = await read(path);
      return save(path, existing + content);
    }),
    make('patch', ['path', 'search', 'replace'], async ({ path, search, replace }) => {
      const content = await read(path);
      if (typeof search !== 'string' || !search || typeof replace !== 'string' || content.split(search).length !== 2) throw new Error('Patch requires exactly one matching occurrence');
      return save(path, content.replace(search, () => replace));
    }),
  ];
}

/** Reporting only: diff private copies, with no repository configuration or external drivers. */
export async function patch(before: Tree, after: Tree, approved: readonly string[]): Promise<string> {
  for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!safePath(path) || !approved.includes(path)) throw new Error(`Invalid patch path: ${path}`);
  }
  const root = await mkdtemp(join(tmpdir(), 'veil-patch-'));
  try {
    for (const [name, tree] of [['a', before], ['b', after]] as const) {
      await mkdir(join(root, name));
      await materialize(join(root, name), tree);
    }
    const output = await open(join(root, 'diff'), 'wx', 0o600);
    const errors = await open(join(root, 'errors'), 'wx', 0o600);
    try {
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn('/usr/bin/git', ['diff', '--no-index', '--no-prefix', '--no-color',
          '--no-ext-diff', '--no-textconv', '--no-renames', '--text', '--minimal', '--unified=3', '--', 'a', 'b'], {
          cwd: root, stdio: ['ignore', output.fd, errors.fd],
          env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' },
        });
        child.on('error', reject); child.on('close', resolve);
      });
      if (code !== 0 && code !== 1) throw new Error(`Patch diff failed (${code}): ${await readFile(join(root, 'errors'), 'utf8')}`);
    } finally { await output.close(); await errors.close(); }
    // No-index uses the existing side for both header paths on additions/deletions.
    return (await readFile(join(root, 'diff'), 'utf8'))
      .replace(/^diff --git [ab]\/(\S+) [ab]\/(\S+)$/gm, 'diff --git a/$1 b/$2');
  } finally { await rm(root, { recursive: true, force: true }); }
}
