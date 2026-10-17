import { constants } from 'node:fs';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
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
  const field = (description: string) => ({ type: 'string', required: true, description });
  const make = (operation: string, fields: string[], execute: (input: any) => Promise<unknown>): Capability<any, unknown> => ({
    name: `workspace.${operation}`, version: '1.0.0', description: `Governed workspace ${operation}`,
    risk: operation === 'read' || operation === 'list' ? 'read' : 'write',
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
    make('write', ['path', 'content'], async ({ path, content }) => save(path, content)),
    make('patch', ['path', 'search', 'replace'], async ({ path, search, replace }) => {
      const content = await read(path);
      if (typeof search !== 'string' || !search || typeof replace !== 'string' || content.split(search).length !== 2) throw new Error('Patch requires exactly one matching occurrence');
      return save(path, content.replace(search, () => replace));
    }),
  ];
}

/** Full-file unified hunks keep the artifact dependency-free and git-apply compatible. */
export function patch(before: Tree, after: Tree): string {
  const lines = (text: string, prefix: string) => text === '' ? '' : text.split('\n').slice(0, text.endsWith('\n') ? -1 : undefined)
    .map(line => `${prefix}${line}\n`).join('') + (text.endsWith('\n') ? '' : '\\ No newline at end of file\n');
  const count = (text: string) => text === '' ? 0 : text.split('\n').length - Number(text.endsWith('\n'));
  return Object.keys(before).sort().filter(p => before[p] !== after[p]).map(p => {
    const a = count(before[p]), b = count(after[p]);
    return `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -${a ? 1 : 0},${a} +${b ? 1 : 0},${b} @@\n${lines(before[p], '-')}${lines(after[p], '+')}`;
  }).join('');
}
