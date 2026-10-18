import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRepositoryTask, type RepositoryProfile } from '../apps/repository-task/runner.js';
import { capabilityAction as action } from '../apps/repository-task/trial.js';

const original = `import React from 'not-installed';
throw new Error('APPLICATION_MUST_NEVER_EXECUTE');
function Header() { return <><nav aria-label="Main navigation">Links</nav><button aria-controls="main-navigation">Menu</button></>; }
export default Header;
`;
const corrected = original.replace('<nav ', '<nav id="main-navigation" ');
const verify = action('verification.sandbox.run');
const finish = '{"type":"finish"}';
const write = (content: string) => action('workspace.write', { path: 'src/App.tsx', content });
async function fixture(body: (p: RepositoryProfile) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'veil-tsx-test-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/App.tsx'), original);
  const profile: RepositoryProfile = { repository: root, readable: ['src/App.tsx'], writable: ['src/App.tsx'], acceptance: [],
    tsxAcceptance: { file: 'src/App.tsx', baselineSHA256: createHash('sha256').update(original).digest('hex'), component: 'Header',
      control: { tag: 'button', attribute: 'aria-controls', value: 'main-navigation' },
      target: { tag: 'nav', attribute: 'aria-label', value: 'Main navigation' }, targetId: 'main-navigation' },
    maxTurns: 10, maxVerifications: 2, reasonerTimeoutMs: 2000, maxDurationMs: 30000,
    limits: { runtimeMounts: ['/usr/lib', '/lib', '/lib64'].map(source => ({ source, target: source })),
      wallMs: 2000, cpuSeconds: 2, addressSpaceBytes: 1024 ** 3, outputBytes: 8192, snapshotBytes: 32768, snapshotFiles: 4 } };
  try { await body(profile); assert.equal(await readFile(join(root, 'src/App.tsx'), 'utf8'), original); }
  finally { await rm(root, { recursive: true, force: true }); }
}
const run = (p: RepositoryProfile, actions: string[]) => runRepositoryTask('Fix the navigation relationship only', p, async () => actions.shift() ?? finish);

test('TSX: real sandbox rejects original defect, accepts only correction without importing or executing source', async () => fixture(async p => {
  const report = await run(p, [verify, write(corrected), verify, finish]);
  assert.equal((report.feedback[0].result as any).accepted, false);
  assert.equal((report.feedback[2].result as any).accepted, true, JSON.stringify(report));
  assert.equal(report.classification, 'verified');
  assert.equal(report.finalRevision, report.verifiedRevision);
  assert.deepEqual(report.filesChanged, ['src/App.tsx']);
  assert.equal(report.originalUnchanged, true);
  assert.match(report.patch, /id="main-navigation"/);
}));

test('TSX: duplicate/missing IDs, wrong target, invalid syntax and unrelated changes fail closed', async () => fixture(async p => {
  const variants = [original, corrected.replace('<button ', '<button id="main-navigation" '),
    corrected.replace('<nav ', '<nav id="main-navigation" '), corrected.replace('id="main-navigation"', 'id="other"'),
    corrected.replace('<nav ', '<nav {...props} '), corrected.replace('Links', 'Unrelated copy'),
    corrected.replace("'not-installed'", "'different-import'"), corrected + '\nconst unrelated = 1;',
    corrected + '\n// unrelated comment', corrected.replace('return <>', 'return <'),
    original.replace('<button ', '<button id="main-navigation" ')];
  for (const content of variants) {
    const report = await run(p, [write(content), verify, finish]);
    assert.equal(report.classification, 'failed', content);
    assert.equal((report.feedback[1].result as any).accepted, false);
    assert.equal(report.verifiedRevision, undefined);
  }
}));

test('TSX: path authorization and verifier configuration injection denied, safe recovery permitted', async () => fixture(async p => {
  const report = await run(p, [action('workspace.read', { path: '../outside' }),
    action('workspace.write', { path: 'other.tsx', content: corrected }),
    action('verification.sandbox.run', { command: '/bin/sh', plugins: ['jsx'], targetId: 'other' }),
    write(corrected), verify, finish]);
  assert.ok(report.feedback.slice(0, 3).every(f => !f.authorized && f.result === undefined));
  assert.equal(report.classification, 'verified');
}));

test('TSX: any edit after acceptance invalidates revision, including formatting-only edits', async () => fixture(async p => {
  const report = await run(p, [write(corrected), verify, write(corrected + '\n'), finish]);
  assert.equal(report.classification, 'failed');
  assert.equal(report.verifiedRevision, undefined);
}));

test('TSX: baseline mismatch, extra rules and unreviewed mounts rejected before reasoning', async () => fixture(async p => {
  for (const mutate of [(q: RepositoryProfile) => { q.tsxAcceptance!.baselineSHA256 = '0'.repeat(64); },
    (q: RepositoryProfile) => { (q.tsxAcceptance as any).plugins = ['evil']; },
    (q: RepositoryProfile) => { q.limits.runtimeMounts = [{ source: '/home', target: '/opt/deps' }]; },
    (q: RepositoryProfile) => { q.readable.push('other.tsx'); }]) {
    const profile = structuredClone(p); mutate(profile);
    let calls = 0;
    const report = await runRepositoryTask('Fix', profile, async () => { calls++; return finish; });
    assert.notEqual(report.classification, 'verified');
    assert.equal(calls, 0);
  }
}));

test('TSX: model observes bounded summary, never private baseline, rules, parser paths or diagnostics', async () => fixture(async p => {
  let observation = '';
  const actions = [verify, finish];
  const report = await runRepositoryTask('Fix', p, async context => {
    observation += JSON.stringify(context); return actions.shift()!;
  });
  const result = report.feedback[0].result as any;
  assert.equal(result.stdout, 'Host TSX acceptance did not pass');
  assert.equal(result.stderr, '');
  for (const secret of ['APPLICATION_MUST_NEVER_EXECUTE', p.tsxAcceptance!.baselineSHA256,
    'baselineSHA256', 'targetId', '/opt/deps', p.repository, 'SyntaxError', 'checkAst']) assert.ok(!observation.includes(secret), secret);
}));
