// Host-only preparation. No inference, source modification, or executable project config.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const original = path.resolve(process.argv[2] || '/home/mustapha/dev/mizan/mizan');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'veil-mizan-faq-'));
  await fs.chmod(root, 0o700);
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'private'), { mode: 0o700 });
  const readable = ['src/App.tsx', 'src/index.css'];
  const manifest = {};
  for (const name of readable) {
    const data = await fs.readFile(path.join(original, name));
    if (data.length > 49152) throw Error('Unexpected source size');
    manifest[name] = { sha256: hash(data), bytes: data.length };
    await fs.writeFile(path.join(workspace, name), data, { flag: 'wx', mode: 0o400 });
  }
  const compiler = await fs.readFile(path.join(original, 'node_modules/typescript/lib/typescript.js'));
  const compilerHash = 'f316520790d4db220a10d890c5f85310e26a1bd3c104b8d3b5eb62ba0491651b';
  if (hash(compiler) !== compilerHash) throw Error('TypeScript 5.6.3 changed; review required');
  const tests = await fs.readFile(path.join(__dirname, 'host-tests/faq-search.cjs'));
  const compilerPath = path.join(root, 'private/compiler.cjs'), testPath = path.join(root, 'private/tests.cjs');
  await fs.writeFile(compilerPath, compiler, { mode: 0o400, flag: 'wx' });
  await fs.writeFile(testPath, tests, { mode: 0o400, flag: 'wx' });
  const profile = { repository: workspace, readable, writable: readable, acceptance: [],
    componentAcceptance: { file: readable[0], component: 'Faqs', baselineSHA256: manifest[readable[0]].sha256,
      styleFile: readable[1], styleSHA256: manifest[readable[1]].sha256,
      compilerPath, compilerSHA256: compilerHash, testPath, testSHA256: hash(tests) },
    maxTurns: 24, maxVerifications: 4, reasonerTimeoutMs: 30000, maxDurationMs: 480000,
    limits: { runtimeMounts: ['/usr/lib', '/lib', '/lib64'].map(source => ({ source, target: source })),
      wallMs: 8000, cpuSeconds: 6, addressSpaceBytes: 2 * 1024 ** 3, outputBytes: 8192,
      snapshotBytes: 65536, snapshotFiles: 4 } };
  const inference = { model: 'gpt-4.1-mini-2025-04-14', limits: { inputTokens: 250000, outputTokens: 16000,
    outputPerCall: 3500, costUSD: 0.25, observationBytes: 262144, responseBytes: 65536, transcriptBytes: 33554432 } };
  const task = `Add searchable FAQs to Mizan's discipline pages. Modify only the existing Faqs function in src/App.tsx and append scoped styles to src/index.css. Preserve all source outside that function and all existing CSS bytes. Keep the existing FAQ heading and accordion visual patterns.
Provide a controlled type=search input with an accessible text label, filtering question OR answer by a literal case-insensitive substring after trimming the query. Blank/whitespace queries show all FAQs in original order. Do not alter FAQ data. Show a polite live result count with text "N of T questions". For zero results show "No questions found.". A button named "Clear search" clears the input and restores all entries. Search changes and clear must close any open answer. Keep at most one answer open; clicking the same question closes it. Each question button exposes boolean aria-expanded; answers appear only when open and correspond to the selected question after filtering. Support empty FAQ arrays. Add responsive styles for search controls, count and empty state using existing design tokens, with visible keyboard focus.
Use the existing useState/useMemo imports and ordinary JSX/event handlers within Faqs; no new imports, helpers outside Faqs, effects, network, storage, booking changes or dependencies. The offline verifier compiles the component and exercises its element/handler contract with a minimal useState/useMemo/JSX harness and synthetic FAQ data, not a browser or full React renderer. No DOM access is available. Styles must be appended and cannot load external resources. Use workspace.patch for minimal edits, then verification.sandbox.run with {}. Finish only on the verified final revision.`;
  for (const [name, data] of Object.entries({ 'profile.json': JSON.stringify(profile, null, 2), 'inference.json': JSON.stringify(inference, null, 2),
    'source-manifest.json': JSON.stringify({ original, files: manifest, compilerSHA256: compilerHash, testSHA256: hash(tests) }, null, 2), 'task.txt': task })) {
    await fs.writeFile(path.join(root, name), data + '\n', { flag: 'wx', mode: 0o400 });
  }
  console.log(root);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
