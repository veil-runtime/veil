#!/usr/bin/env node
// Disposable, local-only operational exercise for the apply --execute CLI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { audit, digestPlan, planAudit, sha } from './steward.mjs';

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'veil-steward-qualification-'));
const results = [];
function run(bin, args, cwd) {
  const result = spawnSync(bin, args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.error) throw result.error;
  return { code: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
function git(cwd, ...args) {
  const result = run('git', args, cwd);
  assert.equal(result.code, 0, `${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}
function fixture(name, failingValidator = false) {
  const dir = path.join(root, name);
  const remote = path.join(root, `${name}.git`);
  fs.mkdirSync(dir);
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.name', 'Qualification');
  git(dir, 'config', 'user.email', 'qualification@example.invalid');
  git(dir, 'init', '--bare', '-q', remote);
  git(dir, 'remote', 'add', 'origin', remote);
  fs.mkdirSync(path.join(dir, 'docs/getting-started'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.writeFileSync(path.join(dir, 'docs/getting-started/evaluate.md'), 'Current Core 0.5.0 release guidance.\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'Historical Core 0.4.0 release.\n');
  fs.writeFileSync(path.join(dir, 'tools/verify-documentation.py'), failingValidator ? 'raise SystemExit(17)\n' : 'print("fixture documentation check passed")\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'disposable release docs');
  git(dir, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const config = { repositories: { core: { path: dir, package: '@veil-runtime/core', github: 'disposable/core' } }, capture: {
    npm: { core: JSON.stringify({ 'dist-tags': { latest: '0.6.0' }, versions: { '0.6.0': { name: '@veil-runtime/core', dist: { integrity: 'sha512-fixture', tarball: 'file:///disposable.tgz' } } } }) },
    github: { core: '[]' }
  } };
  const report = audit(config);
  const finding = report.findings.find(item => item.kind === 'stale-current-claim');
  assert.ok(finding);
  assert.equal(finding.status, 'suspected');
  finding.status = 'verified'; // A synthetic reviewer authorizes this one exact statement.
  finding.replacement = 'Current Core 0.6.0 release guidance.';
  const plan = planAudit(report);
  assert.equal(plan.changes.length, 1);
  const before = snapshot(dir, remote);
  return { dir, remote, plan, before };
}
function snapshot(dir, remote) {
  return {
    head: git(dir, 'rev-parse', 'HEAD'),
    status: git(dir, 'status', '--porcelain'),
    trackedTree: git(dir, 'rev-parse', 'HEAD^{tree}'),
    fileSha256: sha(fs.readFileSync(path.join(dir, 'docs/getting-started/evaluate.md'))),
    remoteMain: git(remote, 'rev-parse', 'refs/heads/main'),
    remoteRefs: git(remote, 'show-ref'),
    tags: git(dir, 'tag', '--list')
  };
}
function apply(f, plan = f.plan, approval = plan.digest) {
  const planFile = path.join(root, `${path.basename(f.dir)}-plan.json`);
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n');
  return run(process.execPath, [cli, 'apply', '--plan', planFile, '--approve', approval, '--execute'], root);
}
function rejected(name, mutate, expected) {
  const f = fixture(name);
  const plan = structuredClone(f.plan);
  mutate(f, plan);
  const result = apply(f, plan);
  assert.equal(result.code, 1, `${name}: ${result.stdout}`);
  assert.match(result.stderr, expected);
  const after = snapshot(f.dir, f.remote);
  // Cases that deliberately move the source or remote compare against state immediately before apply.
  assert.deepEqual(after, f.expectedBeforeApply || f.before);
  assert.equal(git(f.dir, 'worktree', 'list', '--porcelain').split('worktree ').length - 1, 1);
  results.push({ case: name, outcome: 'rejected', error: result.stderr, before: f.before, after });
}

try {
  const f = fixture('approved');
  const result = apply(f);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout, JSON.stringify(result));
  const output = JSON.parse(result.stdout);
  assert.equal(output.dryRun, false);
  const worktree = output.results.core.worktree;
  assert.equal(fs.readFileSync(path.join(worktree, 'docs/getting-started/evaluate.md'), 'utf8'), 'Current Core 0.6.0 release guidance.\n');
  assert.equal(git(worktree, 'diff', '--name-only'), 'docs/getting-started/evaluate.md');
  assert.equal(git(worktree, 'diff', '--check'), '');
  assert.deepEqual(snapshot(f.dir, f.remote), f.before);
  const diffSha256 = sha(output.results.core.diff);
  git(f.dir, 'worktree', 'remove', '--force', worktree);
  assert.deepEqual(snapshot(f.dir, f.remote), f.before);
  results.push({ case: 'approved', outcome: 'executed', planDigest: f.plan.digest, diffSha256, before: f.before, after: snapshot(f.dir, f.remote) });

  const badApproval = fixture('wrong-approval');
  const wrong = apply(badApproval, badApproval.plan, '0'.repeat(64));
  assert.equal(wrong.code, 1); assert.match(wrong.stderr, /plan digest approval mismatch/);
  assert.deepEqual(snapshot(badApproval.dir, badApproval.remote), badApproval.before);
  results.push({ case: 'wrong-approval', outcome: 'rejected', error: wrong.stderr, before: badApproval.before, after: snapshot(badApproval.dir, badApproval.remote) });
  rejected('tampered-digest', (_f, plan) => { plan.changes[0].proposed = 'Current Core 9.9.9 release guidance.'; }, /plan digest approval mismatch/);
  rejected('stale-statement', (_f, plan) => { plan.changes[0].current = 'Current Core 0.1.0 release guidance.'; plan.digest = digestPlan(plan); }, /ambiguous or stale statement/);
  rejected('nonallowlisted', (_f, plan) => { plan.changes[0].file = 'tools/verify-documentation.py'; plan.digest = digestPlan(plan); }, /unauthorized file/);
  rejected('changed-commit', (f) => {
    fs.writeFileSync(path.join(f.dir, 'other.txt'), 'changed\n'); git(f.dir, 'add', '.'); git(f.dir, 'commit', '-qm', 'local source moves');
    f.expectedBeforeApply = snapshot(f.dir, f.remote);
  }, /stale source/);
  rejected('dirty-checkout', (f) => {
    fs.appendFileSync(path.join(f.dir, 'README.md'), 'uncommitted\n');
    f.expectedBeforeApply = snapshot(f.dir, f.remote);
  }, /dirty source/);
  rejected('moved-remote', (f) => {
    git(f.dir, 'commit', '--allow-empty', '-qm', 'remote moves');
    git(f.dir, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
    git(f.dir, 'reset', '--hard', f.before.head);
    f.expectedBeforeApply = snapshot(f.dir, f.remote);
  }, /stale remote metadata|stale or unverified remote/);
  rejected('moved-advertised-ref', (f) => {
    git(f.dir, 'commit', '--allow-empty', '-qm', 'advertised main moves');
    const moved = git(f.dir, 'rev-parse', 'HEAD');
    git(f.dir, 'push', '-q', 'origin', 'HEAD:refs/heads/side');
    git(f.remote, 'update-ref', 'refs/heads/main', moved);
    git(f.dir, 'reset', '--hard', f.before.head);
    f.expectedBeforeApply = snapshot(f.dir, f.remote);
    assert.equal(git(f.dir, 'rev-parse', 'refs/remotes/origin/main'), f.before.remoteMain);
  }, /stale or unverified remote/);
  const failed = fixture('validator-failure', true);
  const failure = apply(failed);
  assert.equal(failure.code, 1); assert.match(failure.stderr, /python3 tools\/verify-documentation.py failed/);
  assert.deepEqual(snapshot(failed.dir, failed.remote), failed.before);
  assert.equal(git(failed.dir, 'worktree', 'list', '--porcelain').split('worktree ').length - 1, 1);
  results.push({ case: 'validator-failure', outcome: 'rejected-and-cleaned', error: failure.stderr, before: failed.before, after: snapshot(failed.dir, failed.remote) });
  process.stdout.write(JSON.stringify({ toolSourceSha256: sha(fs.readFileSync(new URL('./steward.mjs', import.meta.url))), cliSha256: sha(fs.readFileSync(cli)), fixtureRoot: root, results }, null, 2) + '\n');
} catch (error) { process.stderr.write(`${error.stack}\nFixture root: ${root}\n`); process.exitCode = 1; }
