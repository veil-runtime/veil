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

test('patch-only profile omits write while retaining read, list, patch, and verification', async () => fixture(async p => {
  p.patchOnly = true;
  const contexts: import('../apps/repository-task/runner.js').ReasonerContext[] = [];
  const report = await runRepositoryTask('Clamp', p, async context => {
    contexts.push(context);
    if (contexts.length === 1) return action('workspace.patch', { path: 'src/calc.ts',
      search: 'export function add(a: number,b: number) { return a+b; }\n', replace: correct });
    if (contexts.length === 2) return verify;
    return finish;
  });
  accepted(report);
  assert.deepEqual(contexts[0].capabilities.map(c => c.name), [
    'workspace.list', 'workspace.read', 'workspace.readRange', 'workspace.patch', 'verification.sandbox.run',
  ]);
  assert.equal(report.feedback[0].capability, 'workspace.patch');
  assert.equal(report.feedback[0].authorized, true);
}));

test('patchOnly false preserves workspace.write and invalid option types fail before reasoner entry', async () => fixture(async p => {
  p.patchOnly = false;
  let exposed: string[] = [];
  const report = await runRepositoryTask('Clamp', p, async context => {
    exposed = context.capabilities.map(c => c.name);
    return write(correct);
  });
  assert.ok(exposed.includes('workspace.write'));
  assert.equal(report.feedback[0].authorized, true);
  (p as any).patchOnly = 'true';
  let calls = 0;
  assert.equal((await runRepositoryTask('Invalid patch policy', p, async () => { calls++; return finish; })).classification, 'blocked');
  assert.equal(calls, 0);
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

test('workflow context gives canonical permissions, bounded recovery and unchanged-write guidance', async () => fixture(async p => {
  const contexts: import('../apps/repository-task/runner.js').ReasonerContext[] = [];
  const actions = [action('workspace.read', { path: './src/calc.ts' }),
    write('bad', 'contract.txt'), action('workspace.list', { path: '.' }), verify,
    write('export function add(a: number,b: number) { return a+b; }\n'), verify,
    action('workspace.patch', { path: 'src/calc.ts', search: 'return a+b;', replace: 'return a+b;' }),
    write(correct), verify, finish];
  const report = await runRepositoryTask('Clamp', p, async context => {
    contexts.push(context);
    return actions.shift()!;
  });
  accepted(report);
  assert.deepEqual(report.filesChanged, ['src/calc.ts']);
  assert.deepEqual(contexts[0].workspace.readable, p.readable);
  assert.deepEqual(contexts[0].workspace.writable, p.writable);
  assert.match(contexts[0].workspace.pathInstructions, /never \/src/);
  assert.equal(report.feedback[0].authorized, false);
  assert.equal(report.feedback[1].authorized, false);
  assert.match(contexts[1].feedback[0].guidance!, /exact paths/);
  assert.equal(contexts[4].recovery.currentRevisionFailed, true);
  assert.equal(contexts[4].remainingVerifications, 2);
  assert.equal(contexts[4].remainingTurns, p.maxTurns - 4);
  assert.match(contexts[5].feedback.at(-1)!.guidance!, /Unchanged write/);
  assert.equal(contexts[6].feedback.at(-1)!.repeatedFailedRevision, report.initialRevision);
  assert.match(contexts[7].feedback.at(-1)!.guidance!, /Unchanged write/);
  assert.equal(contexts[8].recovery.currentRevisionFailed, false);
  assert.equal(contexts[9].remainingVerifications, 0);
  assert.equal(contexts[9].verifiedRevision, contexts[9].revision);
  const observations = JSON.stringify(contexts);
  for (const hidden of [p.repository, 'SYNTHETIC_SECRET', 'AssertionError', 'deepStrictEqual', 'expected']) assert.ok(!observations.includes(hidden), hidden);
}));

test('default verification feedback never exposes private acceptance values or errors', async () => fixture(async p => {
  p.acceptance = [{ file: 'src/calc.ts', export: 'add', args: ['HOST_PRIVATE_ARGUMENT'], expected: 'HOST_PRIVATE_EXPECTED' }];
  let observed = '';
  const actions = [verify, finish];
  const report = await runRepositoryTask('Fix addition', p, async context => {
    observed += JSON.stringify(context);
    return actions.shift()!;
  });
  assert.equal(report.classification, 'failed');
  for (const hidden of ['HOST_PRIVATE_ARGUMENT', 'HOST_PRIVATE_EXPECTED', 'AssertionError', 'deepStrictEqual']) assert.ok(!observed.includes(hidden), hidden);
  assert.equal((report.feedback[0].result as any).stderr, '');
  p.acceptanceFeedback = 'raw' as any;
  let calls = 0;
  assert.equal((await runRepositoryTask('Invalid feedback', p, async () => { calls++; return finish; })).classification, 'blocked');
  assert.equal(calls, 0);
}));

test('premature finish recovery requires host verification of final revision', async () => fixture(async p => {
  p.recoverPrematureFinish = true;

  const report = await runRepositoryTask(
    'Add clamp with verified finish',
    p,
    sequence(
      write(correct),
      finish,
      verify,
      finish,
    ),
  );

  accepted(report);
  assert.equal(report.feedback.length, 3);
  assert.equal(report.feedback[0].capability, 'workspace.write');
  assert.equal(report.feedback[1].capability, 'finish');
  assert.equal(report.feedback[1].status, 'rejected');
  assert.equal(report.feedback[1].authorized, false);
  assert.match(report.feedback[1].guidance ?? '', /verification\.sandbox\.run/);
  assert.equal(report.feedback[2].capability, 'verification.sandbox.run');
  assert.equal((report.feedback[2].result as { accepted: boolean }).accepted, true);
  assert.equal(report.finalRevision, report.verifiedRevision);
}));

test('premature finish recovery cannot mark an unverified revision successful', async () => fixture(async p => {
  p.recoverPrematureFinish = true;
  p.maxTurns = 3;

  const report = await runRepositoryTask(
    'Add clamp without verification',
    p,
    sequence(write(correct), finish, finish),
  );

  assert.notEqual(report.classification, 'verified');
  assert.equal(report.verifiedRevision, undefined);
  assert.equal(report.feedback.filter(f => f.capability === 'finish').length, 2);
  assert.equal(report.originalUnchanged, true);
}));

test('repeated identical failed patches trigger circuit breaker', async () => fixture(async p => {
  p.maxTurns = 12;

  const badPatch = action('workspace.patch', {
    path: 'src/calc.ts',
    search: 'THIS_TEXT_DOES_NOT_EXIST',
    replace: 'replacement',
  });

  const report = await runRepositoryTask(
    'Test repeated patch failure protection',
    p,
    sequence(badPatch, badPatch, badPatch, badPatch, badPatch, badPatch),
  );

  assert.equal(report.classification, 'failed');
  assert.equal(report.reason, 'Repeated identical patch attempts without progress');
  assert.equal(report.feedback.length, 4);
  assert.equal(report.feedback[0].status, 'failed');
  assert.ok(report.feedback.slice(1).every(f => f.status === 'rejected'));
  assert.equal(report.originalUnchanged, true);
}));

test('append is absent unless explicitly enabled', async () => fixture(async p => {
  const reasoner: Reasoner = async ({ capabilities }) => {
    assert.equal(capabilities.some(c => c.name === 'workspace.append'), false);
    return finish;
  };
  await runRepositoryTask('Inspect capabilities', p, reasoner);
}));

test('patch-only permits explicitly enabled append but not write', async () => fixture(async p => {
  p.patchOnly = true;
  p.allowAppend = true;

  const reasoner: Reasoner = async ({ capabilities }) => {
    assert.equal(capabilities.some(c => c.name === 'workspace.append'), true);
    assert.equal(capabilities.some(c => c.name === 'workspace.write'), false);
    return finish;
  };
  await runRepositoryTask('Inspect capabilities', p, reasoner);
}));

test('append preserves original bytes and remains confined to disposable workspace', async () => fixture(async (p, root) => {
  p.allowAppend = true;

  const original = await readFile(join(root, 'src/calc.ts'), 'utf8');
  const suffix = '\n// appended safely\n';

  const report = await runRepositoryTask(
    'Append text',
    p,
    sequence(action('workspace.append', { path: 'src/calc.ts', content: suffix }), finish),
  );

  assert.equal(report.feedback[0].status, 'completed');
  assert.equal(report.originalUnchanged, true);
  assert.equal(await readFile(join(root, 'src/calc.ts'), 'utf8'), original);
  assert.equal(report.filesChanged.includes('src/calc.ts'), true);
  assert.match(report.patch, /appended safely/);
  assert.notEqual(report.classification, 'verified');
}));

test('append rejects unauthorized paths and oversized content', async () => fixture(async (p, root) => {
  p.allowAppend = true;
  p.limits.snapshotBytes = 4096;

  const original = await readFile(join(root, 'src/calc.ts'), 'utf8');

  const report = await runRepositoryTask(
    'Test append restrictions',
    p,
    sequence(
      action('workspace.append', { path: 'contract.txt', content: 'forbidden' }),
      action('workspace.append', { path: 'src/calc.ts', content: 'x'.repeat(5000) }),
      finish,
    ),
  );

  assert.equal(report.feedback[0].authorized, false);
  assert.notEqual(report.feedback[0].status, 'completed');
  assert.notEqual(report.feedback[1].status, 'completed');
  assert.deepEqual(report.filesChanged, []);
  assert.equal(report.originalUnchanged, true);
  assert.equal(await readFile(join(root, 'src/calc.ts'), 'utf8'), original);
}));

test('readRange returns numbered lines and enforces boundaries', async () => fixture(async p => {
  const observed: any[] = [];
  const requests = [
    { path: 'src/calc.ts', startLine: 1, lineCount: 1 },
    { path: 'src/calc.ts', startLine: 2, lineCount: 1 },
    { path: 'src/calc.ts', startLine: 0, lineCount: 1 },
    { path: 'src/calc.ts', startLine: 1, lineCount: 81 },
    { path: 'src/calc.ts', startLine: 1, lineCount: '1' },
    { path: 'contract.txt', startLine: 1, lineCount: 1 },
    { path: '.env', startLine: 1, lineCount: 1 },
  ];

  let step = 0;
  const report = await runRepositoryTask('Inspect approved source', p, async context => {
    observed.push(context);
    if (step < requests.length)
      return action('workspace.readRange', requests[step++] as Record<string, unknown>);
    return finish;
  });

  const entries = report.feedback.filter(f => f.capability === 'workspace.readRange');
  assert.equal(entries.length, requests.length);
  assert.equal((entries[0].result as any).lines[0].number, 1);
  assert.match((entries[0].result as any).lines[0].text, /export function add/);
  assert.equal((entries[0].result as any).hasMore, false);
  assert.deepEqual((entries[1].result as any).lines, []);
  assert.ok(entries.slice(2, 5).every(f => f.status !== 'completed'));
  assert.equal(entries[5].status, 'completed');
  assert.equal(entries[6].authorized, false);
  assert.equal(report.originalUnchanged, true);
}));

test('readRange rejects oversized observations without changing source', async () => fixture(async (p, root) => {
  await writeFile(join(root, 'contract.txt'), 'x'.repeat(10000));
  const report = await runRepositoryTask('Inspect large source', p,
    sequence(action('workspace.readRange', { path: 'contract.txt', startLine: 1, lineCount: 1 }), finish));

  const entry = report.feedback[0];
  assert.notEqual(entry.status, 'completed');
  assert.match(JSON.stringify(entry), /8192 bytes/);
  assert.equal(await readFile(join(root, 'contract.txt'), 'utf8'), 'x'.repeat(10000));
  assert.equal(report.originalUnchanged, true);
}));

test('compaction retains distinct current-revision ranges and full audit', async () => {
  const { compactFeedback } = await import('../apps/repository-task/runner.js');
  const make = (turn: number, revision: string, startLine: number) => ({
    turn, capability: 'workspace.readRange', authorized: true,
    revision, status: 'completed',
    input: { path: 'src/calc.ts', startLine, lineCount: 20 },
    result: { lines: [{ number: startLine, text: 'source' }] },
  });
  const history = [
    make(1, 'old', 1),
    make(2, 'current', 1),
    make(3, 'current', 21),
    make(4, 'current', 1),
  ];
  const original = structuredClone(history);
  const compact = compactFeedback(history, 'current');

  assert.deepEqual(history, original);
  assert.equal(compact.filter(f => f.result !== undefined).length, 3);
  assert.ok(compact.some(f => f.input.startLine === 21 && f.result));
  assert.ok(compact.some(f => f.input.startLine === 1 && f.result));
  assert.equal(compact[0].result, undefined);
});

test('compaction retains distinct current-revision ranges and full audit', async () => {
  const { compactFeedback } = await import('../apps/repository-task/runner.js');
  const make = (turn: number, revision: string, startLine: number) => ({
    turn, capability: 'workspace.readRange', authorized: true,
    revision, status: 'completed',
    input: { path: 'src/calc.ts', startLine, lineCount: 20 },
    result: { lines: [{ number: startLine, text: 'source' }] },
  });
  const history = [
    make(1, 'old', 1),
    make(2, 'current', 1),
    make(3, 'current', 21),
    make(4, 'current', 1),
  ];
  const original = structuredClone(history);
  const compact = compactFeedback(history, 'current');

  assert.deepEqual(history, original);
  assert.equal(compact.filter(f => f.result !== undefined).length, 3);
  assert.ok(compact.some(f => f.input.startLine === 21 && f.result));
  assert.ok(compact.some(f => f.input.startLine === 1 && f.result));
  assert.equal(compact[0].result, undefined);
});
