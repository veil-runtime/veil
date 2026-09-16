import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Inspect files as data. Never load candidate code or run package scripts.
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const split = (value) => value.split('\0').filter(Boolean);
const normalize = (value) => value.replace(/\r\n/g, '\n');
const lines = (value) => value === '' ? 0 : value.split('\n').length - Number(value.endsWith('\n'));
const label = (value) => JSON.stringify(value);
const categories = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const harness = new Set(['tools/quality.mjs', 'tools/quality.test.mjs',
  'tools/quality-governance.mjs', 'tools/quality-governance.test.mjs']);
const code = /\.(?:[cm]?[jt]sx?)$/;

function group(path) {
  if (harness.has(path)) return 'harness';
  if (path.startsWith('src/') && code.test(path)) return 'source';
  if (path.startsWith('test/') && code.test(path)) return 'test';
}

function control(path) {
  return harness.has(path) || path === 'tools/quality-governance-baseline.json'
    || path === 'AGENTS.md' || path === 'tools/verify-package.mjs'
    || /(^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(path)
    || path.startsWith('test/') || path === 'src/index.ts'
    || /^src\/sdk\/(?:.*\/)?index\.ts$/.test(path);
}

function manifest(text, where) {
  if (text === undefined) throw new Error(`${where}: package.json is missing`);
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where}: package.json must be an object`);
  }
  for (const key of [...categories, 'scripts']) {
    const entries = value[key];
    if (entries !== undefined && (!entries || typeof entries !== 'object'
      || Array.isArray(entries) || Object.values(entries).some((v) => typeof v !== 'string'))) {
      throw new Error(`${where}: invalid ${key}`);
    }
  }
  return value;
}

// Stable object ordering avoids treating JSON key reordering as metadata drift.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

async function compare(baseArgument) {
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel').trim();
  const base = git(root, 'rev-parse', '--verify', '--end-of-options', `${baseArgument}^{commit}`).trim();
  const beforePaths = new Set(split(git(root, 'ls-tree', '-r', '--name-only', '-z', base)));
  const tracked = new Set(split(git(root, 'ls-files', '--cached', '-z')));
  const untracked = new Set(split(git(root, 'ls-files', '--others', '--exclude-standard', '-z')));
  const paths = [...new Set([...beforePaths, ...tracked, ...untracked])].sort();
  const before = (path) => beforePaths.has(path)
    ? normalize(git(root, 'show', `${base}:${path}`)) : undefined;
  const after = (path) => {
    try {
      const absolute = join(root, path);
      if (!lstatSync(absolute).isFile()) throw new Error(`Not a regular file: ${path}`);
      return normalize(readFileSync(absolute, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    }
  };
  const oldPackage = manifest(before('package.json'), 'base');
  const newPackage = manifest(after('package.json'), 'working tree');
  const output = [`Base: ${base}`, 'Direct dependencies — INFORMATIONAL (package.json)'];
  let dependencyChanges = 0;
  for (const category of categories) {
    const old = oldPackage[category] ?? {};
    const current = newPackage[category] ?? {};
    for (const name of [...new Set([...Object.keys(old), ...Object.keys(current)])].sort()) {
      if (old[name] === current[name]) continue;
      dependencyChanges++;
      const action = old[name] === undefined ? 'added' : current[name] === undefined ? 'removed' : 'version changed';
      output.push(`  ${category}: ${action} ${label(name)}: ${label(old[name])} -> ${label(current[name])}`);
    }
  }
  const names = new Set(categories.flatMap((key) => [
    ...Object.keys(oldPackage[key] ?? {}), ...Object.keys(newPackage[key] ?? {}),
  ]));
  for (const name of [...names].sort()) {
    const old = categories.filter((key) => Object.hasOwn(oldPackage[key] ?? {}, name));
    const current = categories.filter((key) => Object.hasOwn(newPackage[key] ?? {}, name));
    if (old.length && current.length && !equal(old, current)) {
      output.push(`  category transition ${label(name)}: ${old.join(', ')} -> ${current.join(', ')}`);
    }
  }
  if (!dependencyChanges) output.push('  none');
  output.push('Lockfile — INFORMATIONAL (separate from direct dependencies)');
  const oldLock = before('package-lock.json');
  const newLock = after('package-lock.json');
  for (const content of [oldLock, newLock]) {
    if (content !== undefined) JSON.parse(content);
  }
  output.push(`  package-lock.json: ${oldLock === newLock ? 'unchanged' : oldLock === undefined ? 'added' : newLock === undefined ? 'removed' : 'changed'}`);

  // Git computes line edits; disabling renames makes additions/removals explicit.
  const edits = new Map();
  const diff = git(root, 'diff', '--no-ext-diff', '--no-textconv', '--no-renames',
    '--ignore-cr-at-eol', '--numstat', '-z', base, '--');
  for (const entry of split(diff)) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('Could not parse Git line statistics');
    edits.set(match[3], [match[1], match[2]]);
  }
  output.push('Growth — INFORMATIONAL (physical lines, including blank/comment lines)');
  const totals = Object.fromEntries(['source', 'test', 'harness'].map((key) =>
    [key, { before: 0, after: 0, additions: 0, removals: 0 }]));
  const reviews = [];
  for (const path of paths) {
    const kind = group(path);
    if (!kind && !control(path)) continue;
    const old = before(path);
    const current = after(path);
    if (control(path) && old !== current) reviews.push(path);
    if (!kind) continue;
    const oldLines = lines(old ?? '');
    const newLines = lines(current ?? '');
    let [additions, removals] = edits.get(path) ?? ['0', '0'];
    if (old === undefined) [additions, removals] = [newLines, 0];
    if (current === undefined) [additions, removals] = [0, oldLines];
    if (additions === '-' || removals === '-') throw new Error(`Binary code file cannot be measured: ${path}`);
    additions = Number(additions);
    removals = Number(removals);
    const total = totals[kind];
    total.before += oldLines;
    total.after += newLines;
    total.additions += additions;
    total.removals += removals;
    if (old !== current) {
      const state = old === undefined ? 'added' : current === undefined ? 'deleted' : 'modified';
      output.push(`  ${kind} ${state} ${label(path)}: ${oldLines} -> ${newLines} LOC; +${additions} -${removals}; net ${newLines - oldLines}${untracked.has(path) ? ' (untracked)' : ''}`);
    }
  }
  for (const [kind, total] of Object.entries(totals)) {
    output.push(`  ${kind} totals: ${total.before} -> ${total.after} LOC; gross additions ${total.additions}; gross removals ${total.removals}; net ${total.after - total.before}`);
  }
  // Compare every script, including lifecycle hooks and helper scripts, conservatively.
  if (!equal(oldPackage.scripts, newPackage.scripts)) reviews.push('package.json scripts');
  for (const key of ['exports', 'main', 'types', 'typings', 'type', 'files', 'typesVersions', 'imports', 'bin']) {
    if (!equal(oldPackage[key], newPackage[key])) reviews.push(`package.json ${key}`);
  }
  output.push('Verification controls');
  for (const path of reviews) output.push(`  review required: ${label(path)}`);
  output.push(reviews.length
    ? 'review required — changes are not proven weakening.'
    : 'No verification-control changes detected.');
  let governance;
  try {
    const { checkGovernance } = await import('./quality-governance.mjs');
    governance = await checkGovernance({ paths, before, after });
  } catch (error) {
    governance = { output: `VEIL-GOV-001 analysis failed: ${error.message}`, status: 2 };
  }
  output.push(governance.output);
  return { output: output.join('\n'), status: Math.max(reviews.length ? 1 : 0, governance.status) };
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--base' || !args[1].trim() || args[1].startsWith('-')) {
    throw new Error('Usage: npm run quality -- --base <commit> (an explicit valid commit is required)');
  }
  const result = await compare(args[1]);
  console.log(result.output);
  process.exitCode = result.status;
} catch (error) {
  console.error(`Quality analysis failed: ${error.message}`);
  process.exitCode = 2;
}
