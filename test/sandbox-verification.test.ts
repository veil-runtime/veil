import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLinuxVerificationSandbox, type VerificationProfile } from '../src/providers/sandbox/linux-verification-sandbox.js';
import { createSandboxVerificationCapability } from '../src/capabilities/verification/sandbox-verify.js';
import { OperatorRuntime } from '../src/runtime/operator-runtime.js';

// These are real Linux integration tests: unavailable isolation FAILS, never skips.
const mounts = ['/usr/lib', '/lib', '/lib64'].map(path => ({ source: path, target: path }));
async function fixture(run: (root: string, profile: VerificationProfile) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'veil-adversarial-'));
  await mkdir(join(root, 'project'));
  await writeFile(join(root, 'secret'), 'synthetic-secret-do-not-expose');
  const profile: VerificationProfile = {
    workspace: join(root, 'project'), executable: '/usr/bin/python3', args: ['check.py'],
    runtimeMounts: mounts, wallMs: 3000, cpuSeconds: 2,
    addressSpaceBytes: 128 * 1024 * 1024, outputBytes: 16384,
    snapshotBytes: 1024 * 1024, snapshotFiles: 100,
  };
  try { await run(root, profile); } finally { await rm(root, { recursive: true, force: true }); }
}
async function code(profile: VerificationProfile, source: string) {
  await writeFile(join(profile.workspace, 'check.py'), source);
  return createLinuxVerificationSandbox(profile)();
}

test('sandbox: authorized verification and cleanup', async () => fixture(async (_root, p) => {
  const before = (await readdir(tmpdir())).filter(x => x.startsWith('veil-verification-'));
  const result = await code(p, 'print(2 + 3)');
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.equal(result.stdout.trim(), '5');
  assert.deepEqual((await readdir(tmpdir())).filter(x => x.startsWith('veil-verification-')), before);
}));

test('sandbox: host secrets, traversal, mounts, environment and writes denied', async () => fixture(async (root, p) => {
  const secret = join(root, 'secret');
  await writeFile(join(p.workspace, '.env'), 'SYNTHETIC_TOKEN=must-not-enter');
  const result = await code(p, `
import os
for path in ${JSON.stringify([secret, `/proc/1/root${secret}`, '/workspace/.env', '/workspace/../secret', '/home', '/mnt', '/run', '/sys', '/etc/shadow'])}:
    assert not os.path.exists(path), path
for path in ['/workspace/check.py', '/tmp/escape', '${secret}', '/proc/sys/kernel/hostname']:
    try:
        open(path, 'w').write('escaped')
    except OSError:
        pass
    else:
        raise AssertionError(path)
assert not any('KEY' in k or 'TOKEN' in k or k in ['LD_PRELOAD', 'NODE_OPTIONS'] for k in os.environ)
assert set(os.environ) <= {'PATH','HOME','LANG','PYTHONDONTWRITEBYTECODE','LC_CTYPE','PWD'}, sorted(os.environ)
print('boundaries passed')
`);
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.equal(await readFile(secret, 'utf8'), 'synthetic-secret-do-not-expose');
}));

test('sandbox: input symlinks rejected before execution, including directory escape', async () => fixture(async (root, p) => {
  await symlink(join(root, 'secret'), join(p.workspace, 'link'));
  let result = await createLinuxVerificationSandbox(p)();
  assert.equal(result.status, 'unavailable');
  await rm(join(p.workspace, 'link'));
  await symlink(root, join(p.workspace, 'dir'));
  result = await createLinuxVerificationSandbox(p)();
  assert.equal(result.status, 'unavailable');
}));

test('sandbox: network and unrelated process access denied; PID/net namespaces differ', async () => fixture(async (_root, p) => {
  const hostNet = await import('node:fs/promises').then(fs => fs.readlink('/proc/self/ns/net'));
  const hostPid = await import('node:fs/promises').then(fs => fs.readlink('/proc/self/ns/pid'));
  const result = await code(p, `
import os, socket
assert os.readlink('/proc/self/ns/net') != ${JSON.stringify(hostNet)}
assert os.readlink('/proc/self/ns/pid') != ${JSON.stringify(hostPid)}
pids = [int(x) for x in os.listdir('/proc') if x.isdigit()]
assert len(pids) <= 3, pids
for pid in pids:
    assert b'node' not in open('/proc/%s/cmdline' % pid, 'rb').read()
for family in [socket.AF_INET, socket.AF_INET6, socket.AF_UNIX]:
    try:
        s = socket.socket(family)
    except PermissionError:
        continue
    raise AssertionError('socket creation allowed')
print('network/process isolation passed')
`);
  assert.equal(result.status, 'passed', JSON.stringify(result));
}));

test('sandbox: fork denied, threads supported, wall timeout kills namespace', async () => fixture(async (_root, p) => {
  const result = await code(p, `
import os, threading, time
try:
    os.fork()
except PermissionError:
    pass
else:
    raise AssertionError('fork allowed')
t = threading.Thread(target=lambda: print('thread-ok', flush=True))
t.start(); t.join()
print(os.readlink('/proc/self/ns/pid'), flush=True)
while True: time.sleep(0.01)
`);
  assert.equal(result.status, 'timeout', JSON.stringify(result));
  assert.match(result.stdout, /thread-ok/);
  const namespace = result.stdout.match(/pid:\[\d+\]/)?.[0];
  assert.ok(namespace);
  const fs = await import('node:fs/promises');
  // Wait for the killed namespace's reaper to finish, then independently check procfs.
  await new Promise(resolve => setTimeout(resolve, 100));
  for (const pid of await readdir('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    try { assert.notEqual(await fs.readlink(`/proc/${pid}/ns/pid`), namespace); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && (error as NodeJS.ErrnoException).code !== 'EACCES') throw error; }
  }
}));

test('sandbox: memory, CPU and output bounds enforced', async () => fixture(async (_root, p) => {
  const memory = await code(p, `
import resource
assert resource.getrlimit(resource.RLIMIT_AS) == (${p.addressSpaceBytes}, ${p.addressSpaceBytes})
try:
    x = bytearray(256 * 1024 * 1024)
except MemoryError:
    print('allocation denied')
else:
    raise AssertionError('memory limit bypassed')
`);
  assert.equal(memory.status, 'passed', JSON.stringify(memory));
  const cpu = await code({ ...p, cpuSeconds: 1, wallMs: 4000 }, 'import resource\nassert resource.getrlimit(resource.RLIMIT_CPU) == (1, 1)\nprint("cpu-ready", flush=True)\nwhile True: pass');
  assert.equal(cpu.status, 'failed', JSON.stringify(cpu));
  assert.match(cpu.stdout, /cpu-ready/);
  assert.ok(cpu.signal === 'SIGKILL' || cpu.exitCode === 137, JSON.stringify(cpu));
  assert.ok(cpu.elapsedMs < 3500, JSON.stringify(cpu));
  const output = await code(p, 'while True: print("x" * 4096, flush=True)');
  assert.equal(output.status, 'output-limit', JSON.stringify(output));
  assert.ok(Buffer.byteLength(output.stdout) + Buffer.byteLength(output.stderr) <= p.outputBytes);
}));

test('sandbox: thread exhaustion and alternate process/namespace syscalls denied', async () => fixture(async (_root, p) => {
  const result = await code({ ...p, addressSpaceBytes: 4 * 1024 * 1024 * 1024 }, `
import ctypes, errno, threading, resource, os
libc = ctypes.CDLL(None, use_errno=True)
for number in [57, 58, 272, 308, 319, 29, 425]:
    assert libc.syscall(number, 0, 0, 0, 0, 0) == -1
    assert ctypes.get_errno() == errno.EPERM, number
assert libc.syscall(435, 0, 0) == -1
assert ctypes.get_errno() == errno.ENOSYS
assert libc.syscall(56, 17, 0, 0, 0, 0) == -1
assert ctypes.get_errno() == errno.EPERM
assert resource.getrlimit(resource.RLIMIT_NPROC) == (32, 32)
threading.stack_size(65536)
event = threading.Event()
threads = []
try:
    for _ in range(64):
        t = threading.Thread(target=event.wait)
        t.start(); threads.append(t)
except RuntimeError:
    assert 24 <= len(threads) < 32, len(threads)
    virtual_bytes = int(open('/proc/self/statm').read().split()[0]) * os.sysconf('SC_PAGE_SIZE')
    assert virtual_bytes < resource.getrlimit(resource.RLIMIT_AS)[0] * 0.75
    print('thread limit enforced', len(threads))
else:
    raise AssertionError('thread limit not enforced')
finally:
    event.set()
    for t in threads: t.join()
`);
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.match(result.stdout, /thread limit enforced/);
}));

test('sandbox: Node verifier supports a fixed JavaScript acceptance script', async () => fixture(async (_root, p) => {
  await writeFile(join(p.workspace, 'acceptance.mjs'), 'import assert from "node:assert/strict"; assert.equal(2+3,5); console.log("node verified");');
  const result = await createLinuxVerificationSandbox({ ...p, executable: process.execPath,
    args: ['--jitless', '--disable-wasm-trap-handler', '--max-old-space-size=64', '/workspace/acceptance.mjs'],
    addressSpaceBytes: 1024 * 1024 * 1024 })();
  assert.equal(result.status, 'passed', JSON.stringify(result));
  assert.match(result.stdout, /node verified/);
}));

test('sandbox: snapshot limits and immutable host profile', async () => fixture(async (_root, p) => {
  await writeFile(join(p.workspace, 'check.py'), 'print("original")');
  const runner = createLinuxVerificationSandbox(p);
  // Mutation of the original object cannot affect captured configuration.
  (p.args as string[])[0] = 'absent.py';
  assert.equal((await runner()).status, 'passed');
  const tooLarge = await createLinuxVerificationSandbox({ ...p, snapshotBytes: 1 })();
  assert.equal(tooLarge.status, 'unavailable');
}));

test('sandbox: Veil authorization and empty-input boundary', async () => fixture(async (_root, p) => {
  await writeFile(join(p.workspace, 'check.py'), 'print("verified")');
  const capability = createSandboxVerificationCapability(p);
  const runtime = new OperatorRuntime({ planVersions: ['2.0'], authorizer: {
    async authorize({ caller }) { return { decision: caller?.subject === 'trusted-verifier' ? 'allow' : 'deny' }; },
  } });
  runtime.use({ manifest: { name: 'sandbox-test', version: '1', capabilities: [capability.name] }, capabilities: [capability] });
  const plan = (input: unknown) => ({ version: '2.0', steps: [{ id: 'verify', capability: capability.name, input }] });
  const denied = await runtime.executePlan(plan({}));
  assert.equal(denied.status, 'failed');
  assert.ok(!denied.events.some(e => e.type === 'capability.started'));
  const invalid = await runtime.executePlan(plan({ command: 'sh' }), { caller: { subject: 'trusted-verifier' } });
  assert.equal(invalid.status, 'failed');
  const allowed = await runtime.executePlan(plan({}), { caller: { subject: 'trusted-verifier' } });
  assert.equal(allowed.status, 'completed');
  assert.equal((allowed.result as { status: string }).status, 'passed');
}));
