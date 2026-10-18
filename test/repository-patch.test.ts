import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { materialize, patch, type Tree } from '../apps/repository-task/workspace.js';

async function roundTrip(before: Tree, after: Tree): Promise<string> {
  const approved = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const result = await patch(before, after, approved);
  assert.equal(await patch(before, after, approved), result, 'deterministic output');
  const root = await mkdtemp(join(tmpdir(), 'veil-patch-test-'));
  try {
    const tree = join(root, 'tree');
    await materialize(root, { 'tree/.fixture': '' });
    await materialize(tree, before);
    await writeFile(join(root, 'changes.patch'), result);
    const log = await open(join(root, 'log'), 'w');
    try {
      for (const reverse of [false, true]) {
        for (const check of [true, false]) {
          const code = await new Promise<number | null>((resolve, reject) => {
            const child = spawn('/usr/bin/git', ['apply', ...(reverse ? ['--reverse'] : []),
              ...(check ? ['--check'] : []), '--', join(root, 'changes.patch')], {
              cwd: tree, stdio: ['ignore', log.fd, log.fd],
              env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
            });
            child.on('error', reject); child.on('close', resolve);
          });
          assert.equal(code, 0, await readFile(join(root, 'log'), 'utf8'));
        }
        const expected = reverse ? before : after;
        const files = (await readdir(tree, { recursive: true, withFileTypes: true }))
          .filter(e => e.isFile() && e.name !== '.fixture').map(e => join(e.parentPath, e.name).slice(tree.length + 1)).sort();
        assert.deepEqual(files, Object.keys(expected).sort());
        for (const [path, content] of Object.entries(expected)) {
          assert.deepEqual(await readFile(join(tree, path)), Buffer.from(content), `${reverse ? 'reverse' : 'forward'}: ${path}`);
        }
      }
    } finally { await log.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
  return result;
}

test('one-line edit emits only a minimal hunk with three context lines', async () => {
  const content = Array.from({ length: 217 }, (_, i) => `line ${i + 1}\n`).join('');
  const result = await roundTrip({ 'src/App.tsx': content }, { 'src/App.tsx': content.replace('line 100\n', 'changed\n') });
  assert.match(result, /--- a\/src\/App.tsx\n\+\+\+ b\/src\/App.tsx\n@@ -97,7 \+97,7 @@/);
  assert.equal(result.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length, 1);
  assert.equal(result.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length, 1);
  assert.ok(!result.includes('\n line 96\n') && !result.includes('\n line 104\n'));
});

test('unchanged trees including empty files produce no patch', async () => {
  assert.equal(await patch({ empty: '', same: 'unchanged\r\n' }, { empty: '', same: 'unchanged\r\n' }, ['empty', 'same']), '');
  assert.equal(await patch({}, {}, []), '');
});

test('multiple edits, additions, deletions and empty files apply and reverse', async () => {
  const result = await roundTrip(
    { same: 'unchanged\n', edit: 'before\n', removed: 'gone\n', removedEmpty: '', emptied: 'text', filled: '' },
    { same: 'unchanged\n', edit: 'after\n', 'nested/added': 'new\n', addedEmpty: '', emptied: '', filled: 'text' },
  );
  assert.ok(!result.includes('a/same'));
  for (const path of ['edit', 'removed', 'removedEmpty', 'emptied', 'filled', 'nested/added', 'addedEmpty']) {
    assert.ok(result.includes(`diff --git a/${path} b/${path}\n`));
  }
  assert.match(result, /new file mode/);
  assert.match(result, /deleted file mode/);
  assert.match(result, /--- \/dev\/null/);
  assert.match(result, /\+\+\+ \/dev\/null/);
});

test('LF, CRLF, mixed endings, Unicode and missing final newlines survive byte-for-byte', async () => {
  const result = await roundTrip(
    { lf: 'a\nb\nc\n', crlf: 'a\r\nb\r\nc\r\n', mixed: 'é\r\nb\nc', noFinal: 'old', addFinal: 'x', removeFinal: 'y\n', removed: 'gone' },
    { lf: 'a\nB\nc\n', crlf: 'a\r\nB\r\nc\r\n', mixed: 'é\r\nB\nc', noFinal: 'new', addFinal: 'x\n', removeFinal: 'y', added: 'new' },
  );
  assert.match(result, /-b\r\n\+B\r\n/);
  assert.match(result, /\\ No newline at end of file/);
});

test('unsafe and unapproved paths fail closed on either side, even when unchanged', async () => {
  for (const path of ['../escape', '/absolute', './alias', 'a//b', '.git/config', '.env', 'x\n+++ b/injected', 'unapproved']) {
    for (const [before, after] of [[{ [path]: 'old' }, {}], [{}, { [path]: 'new' }], [{ [path]: 'same' }, { [path]: 'same' }]]) {
      await assert.rejects(patch(before, after, path === 'unapproved' ? [] : [path]), /Invalid patch path/);
    }
  }
});
