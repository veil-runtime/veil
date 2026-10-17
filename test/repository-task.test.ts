import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { runRepositoryTask, type RepositoryProfile, type Reasoner, type TaskReport } from '../apps/repository-task/runner.js';

const action = (capability: string, input: Record<string, unknown> = {}) => JSON.stringify({ type: 'capability', capability, input });
const finish = JSON.stringify({ type: 'finish', summary: 'Model claims success' });
const sequence = (...actions: string[]): Reasoner => async () => actions.shift() ?? finish;
const verify = action('verification.sandbox.run');
const write = (content: string, path = 'src/calc.ts') => action('workspace.write', { path, content });
const correct = 'export function add(a: number,b: number) { return a+b; }\nexport function clamp(v: number,a: number,b: number) { return Math.min(Math.max(v,Math.min(a,b)),Math.max(a,b)); }\n';

async function fixture(body: (p: RepositoryProfile, root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'veil-runner-test-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/calc.ts'), 'export function add(a: number,b: number) { return a+b; }\n');
  await writeFile(join(root, 'contract.txt'), 'Clamp accepts bounds in either order. Preserve add.');
  await writeFile(join(root, '.env'), 'SYNTHETIC_SECRET=not-copied');
  const p: RepositoryProfile = {
    repository: root, readable: ['src/calc.ts', 'contract.txt'], writable: ['src/calc.ts'],
    acceptance: [
      { file: 'src/calc.ts', export: 'add', args: [2, 3], expected: 5 },
      ...[[5,0,10,5],[-1,0,10,0],[12,0,10,10],[5,10,0,5],[-1,10,0,0],[12,10,0,10]].map(([v,a,b,expected]) => ({ file: 'src/calc.ts', export: 'clamp', args: [v,a,b], expected })),
    ],
    limits: { runtimeMounts: ['/usr/lib','/lib','/lib64'].map(source => ({ source, target: source })), wallMs: 2000,
      cpuSeconds: 2, addressSpaceBytes: 1024 ** 3, outputBytes: 65536, snapshotBytes: 65536, snapshotFiles: 100 },
    maxTurns: 15, maxVerifications: 3, reasonerTimeoutMs: 2000,
  };
  try { await body(p, root); } finally { await rm(root, { recursive: true, force: true }); }
}

// Files for child output avoid this environment's broken socket-backed capture.
async function gitApply(root: string, patch: string): Promise<void> {
  await writeFile(join(root, 'result.patch'), patch);
  const fd = await open(join(root, 'git.log'), 'w');
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('/usr/bin/git', ['apply', '--', 'result.patch'], { cwd: root, stdio: ['ignore', fd.fd, fd.fd], env: { PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', HOME: root } });
      child.on('error', reject); child.on('close', resolve);
    });
    assert.equal(code, 0, await readFile(join(root, 'git.log'), 'utf8'));
  } finally { await fd.close(); }
}

function accepted(report: TaskReport) {
  assert.equal(report.classification, 'verified', JSON.stringify(report));
  assert.equal(report.finalRevision, report.verifiedRevision);
  assert.equal(report.originalUnchanged, true);
  assert.ok(report.feedback.filter(f => f.status === 'completed').every(f => f.authorized));
}

test('004G loop discovers, reads, edits, receives failure, corrects, and returns an applicable patch', async () => fixture(async (p, root) => {
  let step = 0;
  const reasoner: Reasoner = async ({ feedback }) => {
    step++;
    if (step === 1) return action('workspace.list', { path: '.' });
    if (step === 2) { assert.deepEqual((feedback.at(-1)?.result as any).entries, ['contract.txt', 'src']); return action('workspace.list', { path: 'src' }); }
    if (step === 3) return action('workspace.read', { path: 'src/calc.ts' });
    if (step === 4) return write(correct.replace('Math.min(a,b)', 'a').replace('Math.max(a,b)', 'b'));
    if (step === 5) return verify;
    if (step === 6) { assert.equal((feedback.at(-1)?.result as any).accepted, false); return action('workspace.read', { path: 'contract.txt' }); }
    if (step === 7) return write(correct);
    if (step === 8) return verify;
    return finish;
  };
  const report = await runRepositoryTask('Add clamp; discover the contract and preserve addition', p, reasoner);
  accepted(report);
  assert.equal(await readFile(join(root, 'src/calc.ts'), 'utf8'), 'export function add(a: number,b: number) { return a+b; }\n');
  await gitApply(root, report.patch);
  assert.equal(await readFile(join(root, 'src/calc.ts'), 'utf8'), correct);
}));

test('separate TypeScript task uses exact patch and final acceptance', async () => fixture(async (p, root) => {
  await writeFile(join(root, 'src/slug.ts'), 'export const slug = (s: string): string => s;');
  p.readable = p.writable = ['src/slug.ts'];
  p.acceptance = [{ file: 'src/slug.ts', export: 'slug', args: [' Hello World '], expected: 'hello-world' }, { file: 'src/slug.ts', export: 'slug', args: ['A   B'], expected: 'a-b' }];
  const report = await runRepositoryTask('Normalize a slug', p, sequence(action('workspace.read', { path: 'src/slug.ts' }),
    action('workspace.patch', { path: 'src/slug.ts', search: '=> s;', replace: '=> s.trim().toLowerCase().replace(/\\s+/g, "-");' }), verify, finish));
  accepted(report);
  await gitApply(root, report.patch);
  assert.match(await readFile(join(root, 'src/slug.ts'), 'utf8'), /trim/);
}));

test('unauthorized write and traversal are denied before effects; safe recovery remains possible', async () => fixture(async p => {
  const report = await runRepositoryTask('Clamp', p, sequence(write('overwrite', 'contract.txt'), write('escape', '../outside'), write(correct), verify, finish));
  accepted(report);
  assert.deepEqual(report.feedback.slice(0, 2).map(f => f.authorized), [false, false]);
  assert.ok(report.feedback.slice(0, 2).every(f => f.revision === report.initialRevision));
}));

test('symlink file and parent escape fail closed before reasoner entry', async () => fixture(async (p, root) => {
  await symlink('/etc/passwd', join(root, 'src/link.ts'));
  p.readable = ['src/link.ts']; p.writable = []; p.acceptance = [{ file: 'src/link.ts', export: 'x', args: [], expected: 1 }];
  let calls = 0;
  assert.equal((await runRepositoryTask('Read link', p, async () => { calls++; return finish; })).classification, 'blocked');
  await symlink('/etc', join(root, 'escape'));
  p.readable = ['escape/passwd']; p.acceptance[0].file = 'escape/passwd';
  assert.equal((await runRepositoryTask('Read parent link', p, async () => { calls++; return finish; })).classification, 'blocked');
  assert.equal(calls, 0);
}));

test('edit after acceptance invalidates completion even when model claims success', async () => fixture(async p => {
  const report = await runRepositoryTask('Clamp', p, sequence(write(correct), verify, write(correct + '// later edit\n'), finish));
  assert.equal(report.classification, 'failed');
  assert.equal(report.verifiedRevision, undefined);
}));

test('execution timeout is evidence, not success', async () => fixture(async p => {
  p.limits.wallMs = 200;
  const report = await runRepositoryTask('Clamp', p, sequence(write('while(true) {}'), verify, finish));
  assert.equal((report.feedback[1].result as any).status, 'timeout');
  assert.equal(report.classification, 'failed');
  assert.equal(report.originalUnchanged, true);
}));

test('turn and verification budgets terminate without trusting finish', async () => fixture(async p => {
  p.maxTurns = 1;
  assert.equal((await runRepositoryTask('Clamp', p, sequence(write(correct), verify))).classification, 'exhausted');
  p.maxTurns = 10; p.maxVerifications = 1;
  const report = await runRepositoryTask('Clamp', p, sequence(verify, write(correct), verify, finish));
  assert.equal(report.classification, 'exhausted');
  assert.equal(report.feedback.filter(f => f.capability === 'verification.sandbox.run').length, 1);
}));

test('imports, process exit claims, malformed actions, and command injection cannot verify', async () => fixture(async p => {
  for (const content of ['process.exit(0)', 'import fs from "node:fs"; export const add = () => 5;']) {
    const report = await runRepositoryTask('Clamp', p, sequence(write(content), verify, finish));
    assert.equal(report.classification, 'failed');
  }
  const injected = await runRepositoryTask('Clamp', p, sequence(action('verification.sandbox.run', { command: 'touch /tmp/pwn' }), finish));
  assert.equal(injected.feedback[0].authorized, false);
  assert.equal(injected.classification, 'failed');
  assert.equal((await runRepositoryTask('Clamp', p, async () => 'not JSON')).classification, 'uncertain');
  p.reasonerTimeoutMs = 10;
  assert.equal((await runRepositoryTask('Clamp', p, async () => new Promise(() => {}))).classification, 'uncertain');
}));
