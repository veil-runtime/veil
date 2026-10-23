import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:net';
import { OperatorRuntime } from '../src/index.js';
import { filesystemFileReadCapability } from '../src/capabilities/filesystem/file-read.js';
import { MAX_FILE_BYTES, readConfinedFile } from '../src/providers/filesystem/confined-file-reader.js';

async function fixture(body: (root: string, outside: string) => Promise<void>) {
  const base = await fs.mkdtemp(join(tmpdir(), 'veil-file-security-'));
  const root = join(base, 'root');
  const outside = join(base, 'outside');
  await fs.mkdir(root); await fs.mkdir(outside);
  await fs.writeFile(join(root, 'safe.txt'), 'inside');
  await fs.writeFile(join(outside, 'secret.txt'), 'SYNTHETIC_OUTSIDE_SECRET');
  try { await body(await fs.realpath(root), await fs.realpath(outside)); }
  finally { await fs.rm(base, { recursive: true, force: true }); }
}

test('filesystem confinement: relative and absolute files retain the result shape and character limit', async () => fixture(async root => {
  assert.deepEqual(await readConfinedFile(root, 'safe.txt'), { path: join(root, 'safe.txt'), content: 'inside' });
  assert.deepEqual(await readConfinedFile(root, join(root, 'safe.txt')), { path: join(root, 'safe.txt'), content: 'inside' });
  await fs.mkdir(join(root, '..legitimate'));
  await fs.writeFile(join(root, '..legitimate', 'file'), 'ok');
  assert.equal((await readConfinedFile(root, '..legitimate/file')).content, 'ok');
  await fs.writeFile(join(root, 'unicode.txt'), '😀'.repeat(50_000));
  assert.equal((await readConfinedFile(root, 'unicode.txt')).content.length, 50_000);
}));

test('filesystem confinement: traversal, final and parent symlinks and hard links fail closed', async () => fixture(async (root, outside) => {
  for (const input of ['../outside/secret.txt', join(outside, 'secret.txt'), '.', '', 'safe.txt\0']) {
    await assert.rejects(readConfinedFile(root, input));
  }
  await fs.symlink(join(outside, 'secret.txt'), join(root, 'link.txt'), 'file');
  await fs.symlink(outside, join(root, 'parent'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(join(root, 'safe.txt'), join(root, 'internal.txt'), 'file');
  await fs.link(join(outside, 'secret.txt'), join(root, 'hard.txt'));
  for (const input of ['link.txt', 'parent/secret.txt', 'internal.txt', 'hard.txt']) {
    await assert.rejects(readConfinedFile(root, input));
  }
}));

test('filesystem confinement: directories and oversized sparse files are rejected before reading', async t => fixture(async root => {
  const handle = await fs.open(join(root, 'large.txt'), 'w');
  await handle.truncate(MAX_FILE_BYTES + 1); await handle.close();
  const open = t.mock.method(fs, 'open');
  await assert.rejects(readConfinedFile(root, 'large.txt'), /read limit/);
  await assert.rejects(readConfinedFile(root, '.'), /outside allowed root/);
  await fs.mkdir(join(root, 'directory'));
  await assert.rejects(readConfinedFile(root, 'directory'), /regular/);
  assert.ok(open.mock.calls.every(call => !String(call.arguments[0]).endsWith('/large.txt')));
}));

test('filesystem confinement: governed symlink exploit is blocked and policy denial still precedes IO', async t => {
  const configured = resolve(process.env.OPERATOR_FILES_ROOT ?? process.cwd());
  const selected = await fs.mkdtemp(join(configured, '.veil-file-regression-'));
  const outside = await fs.mkdtemp(join(tmpdir(), 'veil-file-outside-'));
  t.after(async () => { await fs.rm(selected, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true }); });
  await fs.writeFile(join(outside, 'secret'), 'SYNTHETIC_OUTSIDE_SECRET');
  await fs.symlink(join(outside, 'secret'), join(selected, 'link'), 'file');
  const runtime = new OperatorRuntime({ planVersions: ['1.0', '2.0'] });
  runtime.use({ manifest: { name: 'file-security', version: '1', capabilities: [filesystemFileReadCapability.name] }, capabilities: [filesystemFileReadCapability] });
  for (const version of ['1.0', '2.0']) {
    const job = await runtime.executePlan({ version, steps: [{ id: 'read', capability: filesystemFileReadCapability.name, input: { path: join(selected, 'link') } }] });
    assert.equal(job.status, 'failed'); assert.equal(job.result, undefined);
    assert.ok(job.events.some(event => event.type === 'capability.failed'));
  }
  const open = t.mock.method(fs, 'open');
  const denied = await new OperatorRuntime({ authorizer: { async authorize() { return { decision: 'deny' }; } } }).executePlan({
    version: '1.0', steps: [{ id: 'denied', capability: filesystemFileReadCapability.name, input: { path: join(selected, 'link') } }],
  });
  assert.ok(denied.events.some(event => event.type === 'capability.denied'));
  assert.ok(!denied.events.some(event => event.type === 'capability.started'));
  assert.equal(open.mock.callCount(), 0);
});

if (process.platform === 'linux') {
  test('filesystem confinement: FIFO and socket inputs never reach open', async t => fixture(async root => {
    execFileSync('mkfifo', [join(root, 'pipe')]);
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(join(root, 'socket'), resolve);
    });
    t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const open = t.mock.method(fs, 'open');
    await assert.rejects(readConfinedFile(root, 'pipe'), /regular/);
    await assert.rejects(readConfinedFile(root, 'socket'), /regular/);
    assert.ok(open.mock.calls.every(call => !/\/(pipe|socket)$/.test(String(call.arguments[0]))));
  }));

  test('filesystem confinement: parent replacement cannot redirect a pinned directory to outside bytes', async t => fixture(async (root, outside) => {
    await fs.mkdir(join(root, 'parent'));
    await fs.writeFile(join(root, 'parent', 'secret.txt'), 'inside');
    const open = fs.open;
    let swapped = false;
    t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
      if (String(args[0]).startsWith('/proc/self/fd/') && String(args[0]).endsWith('/secret.txt')) {
        swapped = true;
        await fs.rename(join(root, 'parent'), join(root, 'moved'));
        await fs.symlink(outside, join(root, 'parent'), 'dir');
      }
      return open(...args);
    });
    assert.equal((await readConfinedFile(root, 'parent/secret.txt')).content, 'inside');
    assert.equal(swapped, true);
  }));

  test('filesystem confinement: final symlink replacement between inspection and open is denied', async t => fixture(async (root, outside) => {
    const open = fs.open;
    t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
      if (String(args[0]).endsWith('/safe.txt')) {
        await fs.unlink(join(root, 'safe.txt'));
        await fs.symlink(join(outside, 'secret.txt'), join(root, 'safe.txt'));
      }
      return open(...args);
    });
    await assert.rejects(readConfinedFile(root, 'safe.txt'));
  }));

  test('filesystem confinement: growth after stat cannot exceed the fixed read buffer', async t => fixture(async root => {
    const open = fs.open;
    t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args);
      if (String(args[0]).endsWith('/safe.txt')) {
        const read = handle.read.bind(handle);
        t.mock.method(handle, 'read', async (...readArgs: Parameters<typeof read>) => {
          await fs.writeFile(join(root, 'safe.txt'), Buffer.alloc(MAX_FILE_BYTES + 10));
          return read(...readArgs);
        });
      }
      return handle;
    });
    await assert.rejects(readConfinedFile(root, 'safe.txt'), /read limit/);
  }));
}
