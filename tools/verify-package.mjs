import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const temporary = join(root, '.tmp', `package-verification-${process.pid}`);
const fixtureDirectory = join(temporary, 'consumer');
const cacheDirectory = join(root, '.tmp', 'npm-cache');
const npmCli = process.env.npm_execpath;

assert.ok(npmCli, 'npm_execpath is required; run this verifier through npm');

mkdirSync(temporary, { recursive: true });
mkdirSync(cacheDirectory, { recursive: true });

try {
  const packOutput = execFileSync(
    process.execPath,
    [npmCli, 'pack', '--json', '--pack-destination', temporary, '--cache', cacheDirectory],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );

  const [pack] = JSON.parse(packOutput);
  const files = pack.files.map(({ path }) => path).sort();

  assert.equal(pack.name, '@veil-runtime/core');
  assert.equal(pack.version, '0.1.1');
  assert.ok(files.includes('dist/index.js'));
  assert.ok(files.includes('dist/index.d.ts'));
  assert.ok(files.includes('README.md'));
  assert.ok(files.includes('LICENSE'));
  assert.ok(files.includes('NOTICE'));
  assert.ok(files.includes('package.json'));
  assert.ok(!files.some((path) => path.startsWith('src/')));
  assert.ok(!files.some((path) => path.startsWith('test/')));
  assert.ok(!files.some((path) => path.startsWith('tools/')));
  assert.ok(!files.some((path) => path.startsWith('.github/')));
  assert.ok(!files.some((path) => path.startsWith('docs/')));
  assert.ok(!files.some((path) => path.startsWith('dist/api/')));
  const publicIntegrationFiles = new Set([
    'dist/integrations/mcp/inbound/capability-schema.d.ts',
    'dist/integrations/mcp/inbound/capability-schema.js',
    'dist/integrations/mcp/inbound/mcp-adapter.d.ts',
    'dist/integrations/mcp/inbound/mcp-adapter.js',
  ]);
  assert.ok(!files.some(
    (path) => path.startsWith('dist/integrations/')
      && !publicIntegrationFiles.has(path),
  ));
  assert.ok(!files.some((path) => path.startsWith('dist/capabilities/')));
  assert.ok(
    !files.some(
      (path) =>
        path.startsWith('dist/providers/')
        && !path.startsWith('dist/providers/storage/sqlite-job-store.'),
    ),
  );

  cpSync(
    join(root, 'test', 'fixtures', 'package-consumer'),
    fixtureDirectory,
    { recursive: true },
  );

  execFileSync(
    process.execPath,
    [
      npmCli,
      'install',
      join(temporary, pack.filename),
      '--no-package-lock',
      '--cache',
      cacheDirectory,
      '--prefer-offline',
    ],
    { cwd: fixtureDirectory, stdio: 'inherit' },
  );

  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--project',
      join(fixtureDirectory, 'tsconfig.json'),
    ],
    { cwd: fixtureDirectory, stdio: 'inherit' },
  );

  execFileSync(
    process.execPath,
    [join(fixtureDirectory, 'verify.mjs')],
    {
      cwd: fixtureDirectory,
      stdio: 'inherit',
    },
  );

  console.log(`Verified ${pack.filename} (${files.length} files)`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}