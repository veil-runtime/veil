import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyAcceptance } from '../src/emergence/acceptance.js';

for (const [name, source] of [
  ['incorrect result', 'export function compute(a) { return a - 1; }'],
  ['tampered JSON', 'JSON.stringify=()=>"4"; export function compute(a) { return 0; }'],
  ['process escape', 'export function compute() { return process.exit(0); }'],
  ['constructor escape', 'export function compute() { return this.constructor.constructor("return process")().exit(0); }'],
  ['infinite source', 'while(true){}; export function compute(){return 4;}'],
  ['infinite function', 'export function compute(){while(true){}}'],
  ['dynamic import', 'export function compute(){return import("node:fs");}'],
]) {
  test(`acceptance rejects ${name}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'veil-acceptance-'));
    await writeFile(join(root, 'code.mjs'), source);
    const passed = await verifyAcceptance(root, {file:'code.mjs',exportName:'compute',cases:[{args:[2],expected:4}]}).catch(() => false);
    assert.equal(passed, false);
    assert.equal(await readFile(join(root, 'code.mjs'), 'utf8'), source);
  });
}
test('host-owned cases accept an unseen pure function', async () => {
  const root = await mkdtemp(join(tmpdir(), 'veil-acceptance-'));
  await writeFile(join(root, 'code.mjs'), 'export function twice(n){return n * 2;}');
  assert.equal(await verifyAcceptance(root, {file:'code.mjs',exportName:'twice',cases:[{args:[2],expected:4},{args:[-3],expected:-6}]}), true);
});
