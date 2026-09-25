import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixtureHost } from './fixture-host.mjs';


const prefix = process.argv[2] ?? 'fixture.records';
const fixture = await createFixtureHost(prefix);

const cwd = await mkdtemp(join(tmpdir(), 'veil-reasoner-'));
const child = spawn(process.execPath, [fileURLToPath(new URL('./reasoner.mjs', import.meta.url))], {
  cwd, env: {}, stdio: ['pipe', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', bytes => { stderr += bytes.toString(); });
let chain = Promise.resolve();
let failure;
const timeout = setTimeout(() => { failure = new Error('Reasoner protocol timeout'); child.kill(); }, 15000);
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  chain = chain.then(async () => {
    const { response } = await fixture.request(line);
    child.stdin.write(JSON.stringify(response) + '\n');
  }).catch(error => { failure = error; child.kill(); });
});
try {
  const code = await new Promise((res, rej) => { child.on('error', rej); child.on('close', res); });
  await chain;
  if (failure) throw failure;
  if (code !== 0) throw new Error(`Reasoner failed (${code}): ${stderr}\nTrace: ${JSON.stringify(fixture.report().trace)}`);
  const { trace, counts, records } = fixture.report();
  assert.equal(records.locked, 'untouched');
  process.stdout.write(JSON.stringify({ fixture: 'external-reasoner', trace, counts,
    records, reasonerExit: code }, null, 2) + '\n');
} finally {
  clearTimeout(timeout); lines.close(); child.kill(); await rm(cwd, { recursive: true, force: true });
  await fixture.close();
}
