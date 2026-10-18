import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';

export interface AcceptanceContract {
  file: string;
  exportName: string;
  cases: { args: unknown[]; expected: unknown }[];
}

/** Host data, never model-generated test code. Each check gets a fresh restricted
 * process and VM. No host objects/functions are passed into the VM. */
export async function verifyAcceptance(workspace: string, contract: AcceptanceContract, isolated = false): Promise<boolean> {
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(contract.file) || contract.file.split('/').includes('..') ||
    !/^[a-zA-Z_$][\w$]*$/.test(contract.exportName) || !contract.cases.length || contract.cases.length > 100) {
    throw new Error('Invalid host acceptance contract');
  }
  const file = join(workspace, contract.file);
  const stat = await lstat(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 8192 || await realpath(file) !== file) throw new Error('Unsafe acceptance source');
  const code = `const {readFileSync}=require('node:fs');
    const {Script,createContext}=require('node:vm');
    const {randomBytes}=require('node:crypto');
    const {isDeepStrictEqual}=require('node:util');
    const spec=JSON.parse(readFileSync(0,'utf8'));
    const source=readFileSync(spec.file,'utf8');
    try {
      const context=createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
      const serializer='s'+randomBytes(32).toString('hex');
      new Script('const '+serializer+'=JSON.stringify;').runInContext(context,{timeout:500});
      new Script(source.replace(/\\bexport\\s+(?=function\\s)/g,'')).runInContext(context,{timeout:500});
      for(const c of spec.contract.cases) {
        const expression=serializer+'('+spec.contract.exportName+'(...'+JSON.stringify(c.args)+'))';
        const actual=new Script(expression).runInContext(context,{timeout:500});
        if(typeof actual!=='string' || !isDeepStrictEqual(JSON.parse(actual),c.expected)) process.exit(2);
      }
      process.exit(0);
    } catch {process.exit(2);}`;
  return new Promise((resolve, reject) => {
    const args = ['--permission', `--allow-fs-read=${file}`, '--max-old-space-size=32', '-e', code];
    const child = spawn(isolated ? 'bwrap' : process.execPath, isolated ? ['--unshare-all', '--die-with-parent', '--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib', '--ro-bind', '/lib64', '/lib64', '--ro-bind', process.execPath, '/node', '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--ro-bind', workspace, workspace, '/node', ...args] : args,
      { cwd: workspace, env: {}, stdio: ['pipe', 'ignore', 'ignore'] });
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
    child.stdin.on('error', () => { /* Process may fail closed before consuming input. */ });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0 || code === 2) resolve(code === 0);
      else reject(new Error(`Acceptance process failed closed (${code})`));
    });
    child.stdin.end(JSON.stringify({ file, contract }));
  });
}

/** Probe the same restricted verifier with a known successful program before paid calls. */
export async function checkAcceptanceSandbox(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'veil-verifier-preflight-'));
  try {
    await writeFile(join(root, 'probe.mjs'), 'export function probe() { return 42; }');
    if (!await verifyAcceptance(root, { file: 'probe.mjs', exportName: 'probe', cases: [{ args: [], expected: 42 }] }, true)) throw new Error('Verifier preflight failed');
  } catch { throw new Error('Network-isolated verifier preflight failed; Bubblewrap and user/network namespaces must be available. No paid call was made.'); }
  finally { await rm(root, { recursive: true, force: true }); }
}
