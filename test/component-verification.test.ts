import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
const test: typeof nodeTest = ((name: string, body: () => Promise<void>) => nodeTest(name,
  { skip: !process.env.VEIL_TEST_TYPESCRIPT && 'Set VEIL_TEST_TYPESCRIPT to the reviewed TypeScript 5.6.3 compiler' }, body)) as typeof nodeTest;
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runRepositoryTask, type RepositoryProfile } from '../apps/repository-task/runner.js';
import { hash } from '../apps/repository-task/component-verification.js';
import { capabilityAction as action } from '../apps/repository-task/trial.js';

// Host-authored positive control, never supplied to the live reasoner.
export const positiveControl = `function Faqs({ faqs }: { faqs: {question: string; answer: string}[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const filtered = faqs.filter(f => [f.question, f.answer].some(text => text.toLowerCase().includes(query.trim().toLowerCase())));
  return <section><label>Search questions<input type="search" value={query} onChange={e => { setQuery(e.target.value); setOpen(null); }} /></label>
    <button type="button" onClick={() => { setQuery(''); setOpen(null); }}>Clear search</button>
    <p role="status">{filtered.length} of {faqs.length} questions</p>
    {filtered.length === 0 && <p>No questions found.</p>}
    {filtered.map(f => <div key={f.question}><button type="button" aria-expanded={open === f.question}
      onClick={() => setOpen(open === f.question ? null : f.question)}>{f.question}</button>{open === f.question && <p>{f.answer}</p>}</div>)}
  </section>;
}`;
const baseline = 'function Faqs({ faqs }: any) { return <section>{faqs.map(f => <p>{f.question}</p>)}</section>; }';
const style = '.existing { color: black; }\n';
const newStyle = style + 'input[type="search"] { width: 100%; }\n';
const verify = action('verification.sandbox.run'), finish = '{"type":"finish"}';
const write = (content: string) => action('workspace.write', { path: 'src/App.tsx', content });
const styles = action('workspace.write', { path: 'src/index.css', content: newStyle });
async function fixture(body: (p: RepositoryProfile) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'veil-component-test-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/App.tsx'), baseline); await writeFile(join(root, 'src/index.css'), style);
  const compilerPath = process.env.VEIL_TEST_TYPESCRIPT!;
  const testPath = resolve('apps/repository-task/host-tests/faq-search.cjs');
  const p: RepositoryProfile = { repository: root, readable: ['src/App.tsx', 'src/index.css'], writable: ['src/App.tsx', 'src/index.css'], acceptance: [],
    componentAcceptance: { file: 'src/App.tsx', component: 'Faqs', baselineSHA256: hash(baseline), styleFile: 'src/index.css', styleSHA256: hash(style),
      compilerPath, compilerSHA256: 'f316520790d4db220a10d890c5f85310e26a1bd3c104b8d3b5eb62ba0491651b', testPath, testSHA256: hash(await readFile(testPath)) },
    maxTurns: 16, maxVerifications: 4, reasonerTimeoutMs: 2000, maxDurationMs: 60000,
    limits: { runtimeMounts: ['/usr/lib', '/lib', '/lib64'].map(source => ({ source, target: source })),
      wallMs: 8000, cpuSeconds: 6, addressSpaceBytes: 2 * 1024 ** 3, outputBytes: 8192, snapshotBytes: 65536, snapshotFiles: 4 } };
  try { await body(p); assert.equal(await readFile(join(root, 'src/App.tsx'), 'utf8'), baseline); }
  finally { await rm(root, { recursive: true, force: true }); }
}
const run = (p: RepositoryProfile, steps: string[]) => runRepositoryTask('FAQ search', p, async () => steps.shift() ?? finish);

test('component: compilation alone fails; behaviour plus styles passes in real sandbox', async () => fixture(async p => {
  const report = await run(p, [styles, verify, write(positiveControl), verify, finish]);
  assert.equal((report.feedback[1].result as any).accepted, false);
  assert.match((report.feedback[1].result as any).stdout, /compilation passed/);
  assert.equal(report.classification, 'verified', JSON.stringify(report));
  assert.deepEqual(report.filesChanged, ['src/App.tsx', 'src/index.css']);
  assert.equal(report.finalRevision, report.verifiedRevision);
}));

test('component: incomplete implementations fail independent acceptance', async () => fixture(async p => {
  for (const source of [positiveControl.replace('[f.question, f.answer]', '[f.question]'),
    positiveControl.replace('query.trim().toLowerCase()', 'query'),
    positiveControl.replace('setQuery(e.target.value); setOpen(null);', 'setQuery(e.target.value);'),
    positiveControl.replace('setQuery(\'\'); setOpen(null);', 'setOpen(null);'),
    positiveControl.replace('filtered.length} of', 'faqs.length} of'),
    positiveControl.replace('No questions found.', 'Nothing'),
    positiveControl.replace('open === f.question && <p>', 'true && <p>'),
    positiveControl.replace('return <section>', 'return <')]) {
    const r = await run(p, [styles, write(source), verify, finish]);
    assert.equal(r.classification, 'failed', source);
  }
}));

test('component: permissions, immutable surrounding source, styles and stale acceptance', async () => fixture(async p => {
  const r = await run(p, [action('workspace.read', { path: '../private' }), action('workspace.write', { path: 'host-tests/test.cjs', content: '' }),
    action('verification.sandbox.run', { command: 'true' }), styles, write(positiveControl), verify,
    action('workspace.patch', { path: 'src/index.css', search: 'width: 100%', replace: 'width: 90%' }), finish]);
  assert.ok(r.feedback.slice(0, 3).every(f => !f.authorized));
  assert.equal((r.feedback[5].result as any).accepted, true);
  assert.equal(r.classification, 'failed');
  for (const source of [positiveControl + '\nthrow Error("outside");', positiveControl.replace('const [query', 'while(true) {} const [query'),
    positiveControl.replace('const [query', 'process.stdout.write("fake"); const [query'),
    positiveControl.replace('const [query', 'React.createElement.constructor("return process")(); const [query')]) {
    const result = await run(p, [styles, write(source), verify, finish]);
    assert.notEqual(result.classification, 'verified');
  }
  assert.equal((await run(p, [write(positiveControl), verify, finish])).classification, 'failed');
}));

test('component: hash and mount tampering fail before reasoning; private oracle never observed', async () => fixture(async p => {
  for (const mutate of [(q: RepositoryProfile) => { q.componentAcceptance!.testSHA256 = '0'.repeat(64); },
    (q: RepositoryProfile) => { q.componentAcceptance!.compilerSHA256 = '0'.repeat(64); },
    (q: RepositoryProfile) => { q.componentAcceptance!.baselineSHA256 = '0'.repeat(64); },
    (q: RepositoryProfile) => { q.limits.runtimeMounts = [{ source: '/home', target: '/opt/deps' }]; }]) {
    const q = structuredClone(p); mutate(q); let calls = 0;
    await runRepositoryTask('FAQ search', q, async () => { calls++; return finish; }); assert.equal(calls, 0);
  }
  let observed = ''; const steps = [styles, verify, finish];
  await runRepositoryTask('FAQ search', p, async context => { observed += JSON.stringify(context); return steps.shift()!; });
  for (const hidden of ['notebook', 'Zebra', p.componentAcceptance!.testPath, p.componentAcceptance!.testSHA256, p.repository, '/opt/deps', 'AssertionError']) {
    assert.ok(!observed.includes(hidden), hidden);
  }
}));
