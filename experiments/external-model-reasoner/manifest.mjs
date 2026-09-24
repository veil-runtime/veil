import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from './trace.mjs';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export async function sourceManifest() {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard',
    'src', 'experiments', 'test', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.test.json',
    'docs/architecture/external-model-reasoner-experiment-design.md'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  async function built(directory) {
    const results = [];
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, item.name);
      if (item.isDirectory()) results.push(...await built(path));
      else if (item.isFile()) results.push(relative(root, path));
    }
    return results;
  }
  paths.push(...await built(resolve(root, '.tmp/test-build/src')));
  const files = {};
  for (const path of [...new Set(paths)].sort()) files[path] = hash(await readFile(resolve(root, path)));
  return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirtyStatus: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }),
    files, contentHash: hash(JSON.stringify(files)) };
}
