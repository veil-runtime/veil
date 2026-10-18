import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';

export interface AcceptanceContract {
  file: string;
  exportName: string;
  cases: { args: unknown[]; expected: unknown }[];
}

/** Host data, never model-generated test code. Each check gets a fresh restricted
 * process and VM. No host objects/functions are passed into the VM. */
export async function verifyAcceptance(workspace: string, contract: AcceptanceContract): Promise<boolean> {
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
    const child = spawn(process.execPath, ['--permission', `--allow-fs-read=${file}`, '--max-old-space-size=32', '-e', code],
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
