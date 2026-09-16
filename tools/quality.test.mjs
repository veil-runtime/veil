import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const cli = join(import.meta.dirname, 'quality.mjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'veil-quality-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const initial = {
    scripts: { check: 'npm run typecheck && npm test', test: 'node --test' },
    devDependencies: { example: '^1.0.0' },
    exports: { '.': './dist/index.js' },
  };
  const packageChange = (change) => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    change(pkg);
    write('package.json', JSON.stringify(pkg));
  };
  write('package.json', JSON.stringify(initial));
  write('package-lock.json', '{"lockfileVersion":3,"packages":{}}\n');
  write('src/a.ts', 'const a = 1;\nconst b = 2;\n');
  write('tsconfig.json', '{"compilerOptions":{"strict":true}}\n');
  write('test/a.test.ts', 'test("example", () => {});\n');
  write('test/fixtures/package-consumer/index.ts', 'export {};\n');
  write('tools/verify-package.mjs', 'assert.ok(true);\n');
  write('tools/quality.mjs', '// original harness\n');
  write('src/index.ts', 'export {};\n');
  write('src/sdk/index.ts', 'export {};\n');
  write('AGENTS.md', 'Preserve contracts.\n');
  write('tools/quality-governance-baseline.json', '{"version":1,"sites":[]}\n');
  git('init', '--quiet');
  git('config', 'core.autocrlf', 'false');
  git('add', '.');
  git('-c', 'user.name=Quality Test', '-c', 'user.email=quality@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture');
  const base = git('rev-parse', 'HEAD');
  const run = (args = ['--base', base]) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { root, write, packageChange, run };
}

test('direct addition is informational and distinct from lockfile changes', (t) => {
  const f = fixture(t);
  f.packageChange((pkg) => { pkg.dependencies = { added: '^2.0.0' }; });
  const result = f.run();
  assert.equal(result.status, 0);
  assert.match(result.output, /dependencies: added "added"/);
  assert.match(result.output, /package-lock.json: unchanged/);
});

test('category transition reports production movement', (t) => {
  const f = fixture(t);
  f.packageChange((pkg) => {
    pkg.dependencies = pkg.devDependencies;
    delete pkg.devDependencies;
  });
  const result = f.run();
  assert.equal(result.status, 0);
  assert.match(result.output, /category transition "example": devDependencies -> dependencies/);
});

test('dependency removals and version changes are informational', (t) => {
  const f = fixture(t);
  f.packageChange((pkg) => { pkg.devDependencies.example = '^2.0.0'; });
  assert.match(f.run().output, /version changed "example"/);
  f.packageChange((pkg) => { delete pkg.devDependencies.example; });
  const result = f.run();
  assert.equal(result.status, 0);
  assert.match(result.output, /removed "example"/);
});

test('lockfile-only changes are reported separately', (t) => {
  const f = fixture(t);
  f.write('package-lock.json', '{"lockfileVersion":3,"packages":{"added":{}}}\n');
  const result = f.run();
  assert.equal(result.status, 0);
  assert.match(result.output, /\(package.json\)\n  none/);
  assert.match(result.output, /package-lock.json: changed/);
});

test('gross additions survive offsetting deletion and include untracked source', (t) => {
  const f = fixture(t);
  rmSync(join(f.root, 'src/a.ts'));
  f.write('src/new.ts', 'const x = 3;\nconst y = 4;\n');
  const result = f.run();
  assert.equal(result.status, 0);
  assert.match(result.output, /source deleted "src\/a.ts"/);
  assert.match(result.output, /source added "src\/new.ts".*\(untracked\)/);
  assert.match(result.output, /source totals: 4 -> 4 LOC; gross additions 2; gross removals 2; net 0/);
});

test('line replacements report gross additions and removals within one file', (t) => {
  const f = fixture(t);
  f.write('src/a.ts', 'const c = 3;\nconst d = 4;\n');
  assert.match(f.run().output, /"src\/a.ts": 2 -> 2 LOC; \+2 -2; net 0/);
});

test('verification script changes require review', (t) => {
  const f = fixture(t);
  f.packageChange((pkg) => { pkg.scripts.check = 'echo success'; });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /review required: "package.json scripts"/);
  assert.match(result.output, /not proven weakening/);
});

for (const path of [
  'tsconfig.json', 'tools/quality.mjs', 'tools/quality.test.mjs', 'test/a.test.ts',
  'tools/verify-package.mjs', 'test/fixtures/package-consumer/index.ts',
  'AGENTS.md', 'src/index.ts', 'src/sdk/index.ts',
]) {
  test(`verification control requires review: ${path}`, (t) => {
    const f = fixture(t);
    f.write(path, path === 'tsconfig.json' ? '{"compilerOptions":{"strict":false}}' : '// changed\n');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.ok(result.output.includes(`review required: ${JSON.stringify(path)}`));
  });
}

test('package export metadata requires review', (t) => {
  const f = fixture(t);
  f.packageChange((pkg) => { pkg.exports['./internal'] = './dist/internal.js'; });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /review required: "package.json exports"/);
});

test('missing, malformed, invalid and tree bases fail closed', (t) => {
  const f = fixture(t);
  for (const args of [[], ['--base'], ['--base', ''], ['--base', '--help'],
    ['--base', 'does-not-exist'], ['--base', 'HEAD^{tree}'], ['--base', 'HEAD', 'extra']]) {
    const result = f.run(args);
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.match(result.output, /Quality analysis failed/);
  }
});

test('CRLF-only changes produce no growth or review findings', (t) => {
  const f = fixture(t);
  f.write('src/a.ts', 'const a = 1;\r\nconst b = 2;\r\n');
  f.write('tsconfig.json', '{"compilerOptions":{"strict":true}}\r\n');
  const result = f.run();
  assert.equal(result.status, 0);
  assert.match(result.output, /source totals: 4 -> 4 LOC; gross additions 0; gross removals 0; net 0/);
});

test('malformed candidate manifest fails closed', (t) => {
  const f = fixture(t);
  f.write('package.json', '{');
  assert.equal(f.run().status, 2);
});

test('test and harness growth are separated from source', (t) => {
  const f = fixture(t);
  f.write('test/new.test.mjs', '// test\n');
  f.write('tools/quality.test.mjs', '// harness test\n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /test totals: 2 -> 3 LOC; gross additions 1; gross removals 0; net 1/);
  assert.match(result.output, /harness totals: 1 -> 2 LOC; gross additions 1; gross removals 0; net 1/);
});

for (const path of ['src/new.ts', 'examples/helper.ts', 'tools/helper.mjs', 'outside.ts', 'test/hidden.test.ts']) {
  test(`governance scans untracked code across the candidate tree: ${path}`, (t) => {
    const f = fixture(t);
    f.write(path, 'renamed.execute(input);\n');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.ok(result.output.includes(`VEIL-GOV-001 ${path}:1:1`));
  });
}

test('governance parser failure fails closed without suppressing informational findings', (t) => {
  const f = fixture(t);
  f.write('examples/broken.ts', 'const value = ;');
  const result = f.run();
  assert.equal(result.status, 2);
  assert.match(result.output, /Direct dependencies — INFORMATIONAL/);
  assert.match(result.output, /VEIL-GOV-001.*parser failure/);
});

test('baseline changes are verification controls and invalid candidates fail closed', (t) => {
  const f = fixture(t);
  f.write('tools/quality-governance-baseline.json', '{}');
  const result = f.run();
  assert.equal(result.status, 2);
  assert.match(result.output, /review required: "tools\/quality-governance-baseline.json"/);
  assert.match(result.output, /VEIL-GOV-001.*invalid baseline/);
});

test('untracked dynamic data uses need no baseline entries', (t) => {
  const f = fixture(t);
  f.write('examples/data.ts', 'const value = input[field]; if (value === expected) report(value);');
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /No unapproved execution references or unsupported accesses/);
});

test('untracked dynamic invocation still fails closed after data-use refinement', (t) => {
  const f = fixture(t);
  f.write('examples/invoke.ts', 'const value = input[field]; if (value) value();');
  const result = f.run();
  assert.equal(result.status, 2);
  assert.match(result.output, /VEIL-GOV-001 examples\/invoke.ts:1:\d+: unsupported dynamic invocation or executable extraction/);
});
