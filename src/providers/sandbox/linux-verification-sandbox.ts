import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { verificationFilter } from './seccomp.js';

export interface VerificationProfile {
  /** Trusted, quiescent input tree. Symlinks and special files are rejected. */
  workspace: string;
  /** Host-owned executable, mounted at /runtime/verifier. */
  executable: string;
  args: readonly string[];
  /** Reviewed OS/runtime/dependency directories only; never a home or repository parent. */
  runtimeMounts: readonly { source: string; target: string }[];
  wallMs: number;
  cpuSeconds: number;
  addressSpaceBytes: number;
  outputBytes: number;
  snapshotBytes: number;
  snapshotFiles: number;
}

export interface VerificationResult {
  status: 'passed' | 'failed' | 'timeout' | 'output-limit' | 'unavailable';
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
  diagnostic?: string;
}

function checkedProfile(profile: VerificationProfile): VerificationProfile {
  const p = structuredClone(profile);
  for (const key of ['wallMs', 'cpuSeconds', 'addressSpaceBytes', 'outputBytes', 'snapshotBytes', 'snapshotFiles'] as const) {
    if (!Number.isSafeInteger(p[key]) || p[key] <= 0) throw new Error(`Invalid ${key}`);
  }
  if (p.wallMs > 2_147_483_647) throw new Error('wallMs exceeds timer range');
  if (p.outputBytes < 2) throw new Error('outputBytes must be at least two');
  if (!isAbsolute(p.workspace) || !isAbsolute(p.executable)) throw new Error('Absolute host paths required');
  if (!Array.isArray(p.args) || p.args.some(x => typeof x !== 'string' || x.includes('\0'))) throw new Error('Invalid arguments');
  for (const mount of p.runtimeMounts) {
    if (!isAbsolute(mount.source) || !/^\/(usr\/lib(?:\/[^.][^/]*)*|lib|lib64|opt\/deps)$/.test(mount.target)) {
      throw new Error('Runtime mounts must target reviewed library paths or /opt/deps');
    }
  }
  return p;
}

// Directory-fd traversal pins every parent. O_NOFOLLOW prevents raced symlinks
// from turning snapshot reads into host reads. No project code is imported.
async function snapshot(source: string, destination: string, p: VerificationProfile): Promise<void> {
  let bytes = 0;
  let files = 0;
  async function copy(from: string, to: string, depth: number): Promise<void> {
    if (depth > 64 || ++files > p.snapshotFiles) throw new Error('Snapshot entry limit exceeded');
    const handle = await open(from, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await handle.stat();
      if (stat.isDirectory()) {
        await mkdir(to);
        for (const name of await readdir(`/proc/self/fd/${handle.fd}`)) {
          if (['.git', '.ssh', '.aws', '.azure', '.config', '.npmrc', '.netrc'].includes(name) || name === '.env' || name.startsWith('.env.')) continue;
          await copy(`/proc/self/fd/${handle.fd}/${name}`, join(to, name), depth + 1);
        }
      } else if (stat.isFile()) {
        if (stat.nlink !== 1) throw new Error('Hard-linked input files are unsupported');
        if (stat.size > p.snapshotBytes - bytes) throw new Error('Snapshot byte limit exceeded');
        const chunks: Buffer[] = [];
        while (true) {
          const buffer = Buffer.alloc(Math.min(65536, p.snapshotBytes - bytes + 1));
          const { bytesRead } = await handle.read(buffer);
          if (!bytesRead) break;
          bytes += bytesRead;
          if (bytes > p.snapshotBytes) throw new Error('Snapshot byte limit exceeded');
          chunks.push(buffer.subarray(0, bytesRead));
        }
        await writeFile(to, Buffer.concat(chunks), { mode: 0o400, flag: 'wx' });
      } else throw new Error('Special input files are unsupported');
    } finally { await handle.close(); }
  }
  await copy(source, destination, 0);
}

/** Host-only factory. No command, path, environment or limit comes from a plan. */
export function createLinuxVerificationSandbox(profile: VerificationProfile): () => Promise<VerificationResult> {
  const p = checkedProfile(profile);
  return async () => {
    const started = performance.now();
    const unavailable = (error: unknown): VerificationResult => ({
      status: 'unavailable', exitCode: null, signal: null, stdout: '', stderr: '',
      elapsedMs: performance.now() - started,
      diagnostic: error instanceof Error ? error.message : String(error),
    });
    if (process.platform !== 'linux' || process.arch !== 'x64') return unavailable('Requires Linux x86_64');
    let temporary: string | undefined;
    let filter: Awaited<ReturnType<typeof open>> | undefined;
    const outputs: Awaited<ReturnType<typeof open>>[] = [];
    try {
      temporary = await mkdtemp(join(tmpdir(), 'veil-verification-'));
      const work = join(temporary, 'workspace');
      await snapshot(p.workspace, work, p);
      const filterPath = join(temporary, 'seccomp');
      await writeFile(filterPath, verificationFilter(), { mode: 0o600 });
      filter = await open(filterPath, 'r');
      // Real files avoid socket-backed Node child stdio crossing a net namespace.
      // Kernel RLIMIT_FSIZE caps each inherited output file, even if JS stalls.
      const outputPaths = [join(temporary, 'stdout'), join(temporary, 'stderr')];
      for (const path of outputPaths) outputs.push(await open(path, 'wx', 0o600));
      const perStreamBytes = Math.floor(p.outputBytes / 2);
      const args = ['--user', '--map-root-user', '--net', '/usr/bin/bwrap',
        '--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--unshare-cgroup',
        '--disable-userns', '--die-with-parent', '--new-session', '--cap-drop', 'ALL',
        '--clearenv', '--setenv', 'PATH', '/runtime', '--setenv', 'HOME', '/nonexistent',
        '--setenv', 'LANG', 'C', '--setenv', 'PYTHONDONTWRITEBYTECODE', '1',
        '--ro-bind', await realpath(p.executable), '/runtime/verifier',
        '--ro-bind', '/usr/bin/prlimit', '/runtime/prlimit'];
      for (const mount of p.runtimeMounts) args.push('--ro-bind', await realpath(mount.source), mount.target);
      args.push('--ro-bind', work, '/workspace', '--proc', '/proc', '--remount-ro', '/proc',
        '--dir', '/tmp', '--ro-bind', '/dev/null', '/dev/null',
        '--ro-bind', '/dev/urandom', '/dev/urandom', '--remount-ro', '/',
        '--chdir', '/workspace', '--seccomp', '3', '--', '/runtime/prlimit',
        `--as=${p.addressSpaceBytes}:${p.addressSpaceBytes}`,
        `--cpu=${p.cpuSeconds}:${p.cpuSeconds}`, '--core=0:0', `--fsize=${perStreamBytes}:${perStreamBytes}`, '--nofile=64:64', '--nproc=32:32',
        '--', '/runtime/verifier', ...p.args);
      return await new Promise<VerificationResult>((resolve) => {
        const child = spawn('/usr/bin/unshare', args, {
          detached: true, env: {}, stdio: ['ignore', outputs[0]!.fd, outputs[1]!.fd, filter!.fd],
        });
        let termination: 'timeout' | 'output-limit' | undefined;
        const kill = () => {
          if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ } }
        };
        const timer = setTimeout(() => { termination ??= 'timeout'; kill(); }, p.wallMs);
        child.on('error', error => { clearTimeout(timer); resolve(unavailable(error)); });
        child.on('close', async (exitCode, signal) => {
          clearTimeout(timer);
          try {
            const [stdout, stderr] = await Promise.all(outputPaths.map(path => readFile(path)));
            if (stdout!.length >= perStreamBytes || stderr!.length >= perStreamBytes) termination = 'output-limit';
            resolve({ status: termination ?? (exitCode === 0 ? 'passed' : 'failed'), exitCode, signal,
              stdout: stdout!.toString('utf8'), stderr: stderr!.toString('utf8'),
              elapsedMs: performance.now() - started });
          } catch (error) { resolve(unavailable(error)); }
        });
      });
    } catch (error) { return unavailable(error); }
    finally {
      await filter?.close();
      for (const output of outputs) await output.close();
      if (temporary) await rm(temporary, { recursive: true, force: true });
    }
  };
}
