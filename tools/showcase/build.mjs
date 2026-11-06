import { build } from 'esbuild';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const packageRoot = resolve(here, 'node_modules/@veil-runtime/ui');
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(resolve(here, 'package-lock.json'), 'utf8'));
const integrity = 'sha512-DTPTsIZiB0QYdBIPIABI89pL1kT9TNWDoYIj0jQ8s1ALFcsT3Kis3jGNfuRHxF8UrNgRdKZhXCAtIO4dTHkhBw==';
const locked = lock.packages['node_modules/@veil-runtime/ui'];
if (manifest.version !== '0.4.2' || locked.version !== manifest.version || locked.integrity !== integrity
  || locked.resolved !== 'https://registry.npmjs.org/@veil-runtime/ui/-/ui-0.4.2.tgz') throw Error('Unexpected UI artifact');
const sourceNames = ['integration.mjs', 'agent.mjs', 'definition.mjs'];
const sources = Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, await readFile(resolve(root, 'docs/assets/showcase', name), 'utf8')])));
const options = {
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'eof', metafile: true,
  alias: { '@veil-runtime/ui/dom': resolve(packageRoot, 'dist/dom.js'), '@veil-runtime/ui/interface': resolve(packageRoot, 'dist/interface.js') },
};
const backendNames = ['backend-integration.mjs', 'backend.mjs'];
const backendSources = Object.fromEntries(await Promise.all(backendNames.map(async name => [name, await readFile(resolve(root, 'docs/assets/showcase', name), 'utf8')])));
const labSources = Object.fromEntries(await Promise.all(['lab.mjs', 'lab-definition.mjs'].map(async name => [name, await readFile(resolve(root, 'docs/assets/showcase', name), 'utf8')])));
const builds = [
  ['docs/assets/playground/source.mjs', 'docs/assets/playground/playground.js'],
  ['docs/assets/showcase/shell.mjs', 'docs/assets/showcase/showcase.js'],
  ['docs/assets/showcase/backend-shell.mjs', 'docs/assets/showcase/backend.js'],
  ['docs/assets/showcase/lab-shell.mjs', 'docs/assets/showcase/lab.js'],
];
const artifacts = {};
for (const [entry, output] of builds) {
  const result = await build({ ...options, entryPoints: [resolve(root, entry)], outfile: resolve(root, output),
    plugins: [{ name: 'actual-host-source', setup(builder) {
      builder.onResolve({ filter: /^showcase:sources$/ }, () => ({ path: 'sources', namespace: 'showcase' }));
      builder.onLoad({ filter: /.*/, namespace: 'showcase' }, () => ({ contents: `export const sources = ${JSON.stringify(sources)};`, loader: 'js' }));
      builder.onResolve({ filter: /^lab:sources$/ }, () => ({ path: 'labSources', namespace: 'lab' }));
      builder.onLoad({ filter: /.*/, namespace: 'lab' }, () => ({ contents: `export const sources = ${JSON.stringify(labSources)};`, loader: 'js' }));
      builder.onResolve({ filter: /^backend:sources$/ }, () => ({ path: 'backendSources', namespace: 'backend' }));
      builder.onLoad({ filter: /.*/, namespace: 'backend' }, () => ({ contents: `export const backendSources = ${JSON.stringify(backendSources)};`, loader: 'js' }));
    } }],
  });
  if (Object.keys(result.metafile.inputs).some(path => /node_modules\/(?:@veil-runtime\/core|zod)\//.test(path))) throw Error('Unexpected runtime dependency');
  artifacts[output] = createHash('sha256').update(await readFile(resolve(root, output))).digest('hex');
}
for (const file of ['LICENSE', 'NOTICE']) await copyFile(resolve(packageRoot, file), resolve(root, `docs/assets/playground/UI-${file}.txt`));
await writeFile(resolve(root, 'docs/assets/showcase/provenance.json'), JSON.stringify({ version: manifest.version, integrity, artifacts,
  sources: Object.fromEntries(Object.entries({ ...sources, ...backendSources, ...labSources }).map(([name, source]) => [name, createHash('sha256').update(source).digest('hex')])) }, null, 2) + '\n');
console.log('Built playground and showcase from published UI 0.4.2; no Core or Zod in browser bundles.');
