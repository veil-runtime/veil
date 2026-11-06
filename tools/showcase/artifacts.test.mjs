import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
test('built assets and displayed host modules match provenance', async () => {
  const provenance = JSON.parse(await read('docs/assets/showcase/provenance.json'));
  assert.equal(provenance.version, '0.4.2');
  for (const [path, hash] of Object.entries(provenance.artifacts)) assert.equal(sha(await read(path)), hash, path);
  for (const [path, hash] of Object.entries(provenance.sources)) assert.equal(sha(await read('docs/assets/showcase/' + path)), hash, path);
  for (const path of Object.keys(provenance.artifacts)) {
    const source = await read(path);
    assert.doesNotMatch(source, /veil-ui-lab|\/home\/|api[_-]?key|node_modules\/@veil-runtime\/core/i);
  }
});
