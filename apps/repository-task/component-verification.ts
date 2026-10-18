import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { createLinuxVerificationSandbox, type VerificationProfile } from '../../src/providers/sandbox/linux-verification-sandbox.js';
import { createSandboxVerificationCapability } from '../../src/capabilities/verification/sandbox-verify.js';
import { safePath, type Tree } from './workspace.js';
import type { AcceptanceResult } from './acceptance.js';
import type { Capability } from '../../src/index.js';

/** Private host authority, never included in reasoning observations. Test code
 * and compiler are read as bytes, pinned, and executed only inside the sandbox. */
export interface ComponentAcceptance {
  file: string;
  component: string;
  baselineSHA256: string;
  styleFile: string;
  styleSHA256: string;
  compilerPath: string;
  compilerSHA256: string;
  testPath: string;
  testSHA256: string;
}
export const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
export function validateComponentPolicy(p: ComponentAcceptance): void {
  if (!p || Object.keys(p).sort().join(',') !== ['file', 'component', 'baselineSHA256', 'styleFile', 'styleSHA256',
    'compilerPath', 'compilerSHA256', 'testPath', 'testSHA256'].sort().join(',')
    || !safePath(p.file) || !safePath(p.styleFile) || p.file === p.styleFile
    || !/^[A-Za-z_$][\w$]{0,63}$/.test(p.component)
    || ![p.baselineSHA256, p.styleSHA256, p.compilerSHA256, p.testSHA256].every(h => /^[a-f0-9]{64}$/.test(h))
    || !isAbsolute(p.compilerPath) || !isAbsolute(p.testPath)) throw Error('Invalid component policy');
}

export async function componentAcceptanceCapability(workspace: string, baseline: Tree, approved: ComponentAcceptance,
  limits: Omit<VerificationProfile, 'workspace' | 'executable' | 'args'>): Promise<Capability<Record<string, never>, AcceptanceResult>> {
  const rule = structuredClone(approved);
  validateComponentPolicy(rule);
  if (hash(baseline[rule.file]) !== rule.baselineSHA256 || hash(baseline[rule.styleFile]) !== rule.styleSHA256) throw Error('Component baseline mismatch');
  if (!limits.runtimeMounts.every(m => ['/usr/lib', '/lib', '/lib64'].includes(m.source) && m.target === m.source)) throw Error('Unreviewed component runtime mount');
  const compiler = await readFile(rule.compilerPath), tests = await readFile(rule.testPath);
  if (compiler.length > 12 * 1024 * 1024 || tests.length > 65536
    || hash(compiler) !== rule.compilerSHA256 || hash(tests) !== rule.testSHA256) throw Error('Component dependency checksum mismatch');
  const marker = randomBytes(32).toString('hex');
  const script = `
    const fs = require('node:fs');
    const ts = require('/opt/deps/compiler.cjs');
    const rule = ${JSON.stringify(rule)};
    let compiled = false;
    try {
      const baseline = ${JSON.stringify(baseline[rule.file])};
      const source = fs.readFileSync('/workspace/' + rule.file, 'utf8');
      const select = text => {
        const ast = ts.createSourceFile('App.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        if (ast.parseDiagnostics.length) throw Error('syntax');
        const matches = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === rule.component);
        if (matches.length !== 1) throw Error('component');
        const node = matches[0];
        return { before: text.slice(0, node.getStart(ast)), body: text.slice(node.getStart(ast), node.end), after: text.slice(node.end) };
      };
      const before = select(baseline), after = select(source);
      if (before.before !== after.before || before.after !== after.after) throw Error('scope');
      const style = fs.readFileSync('/workspace/' + rule.styleFile, 'utf8');
      const oldStyle = ${JSON.stringify(baseline[rule.styleFile])};
      if (!style.startsWith(oldStyle) || !style.slice(oldStyle.length).trim()) throw Error('styles');
      const output = ts.transpileModule(after.body, { fileName: 'component.tsx', reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
          jsxFactory: 'React.createElement', jsxFragmentFactory: 'React.Fragment' } });
      if (output.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error('compile');
      compiled = true;
      require('/opt/deps/tests.cjs')({ source: output.outputText, component: rule.component, style: style.slice(oldStyle.length) });
      process.stdout.write(${JSON.stringify(marker)} + ':accepted');
    } catch {
      process.stdout.write(${JSON.stringify(marker)} + (compiled ? ':compiled' : ':rejected'));
      process.exitCode = 1;
    }
  `;
  const profile = { ...limits, workspace, executable: process.execPath,
    args: ['--jitless', '--disable-wasm-trap-handler', '--max-old-space-size=192', '--no-warnings', '-e', script] };
  return { ...createSandboxVerificationCapability(profile), async execute(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Reflect.ownKeys(input).length) throw Error('Verification accepts only {}');
    const dependencies = await mkdtemp(join(tmpdir(), 'veil-component-deps-'));
    try {
      await writeFile(join(dependencies, 'compiler.cjs'), compiler, { flag: 'wx', mode: 0o400 });
      await writeFile(join(dependencies, 'tests.cjs'), tests, { flag: 'wx', mode: 0o400 });
      const result = await createLinuxVerificationSandbox({ ...profile,
        runtimeMounts: [...profile.runtimeMounts, { source: dependencies, target: '/opt/deps' }] })();
      const accepted = result.status === 'passed' && result.stdout === marker + ':accepted';
      const compiled = accepted || result.stdout === marker + ':compiled';
      return { ...result, accepted, stdout: accepted ? 'Component compilation passed; behavioural tests passed; host acceptance passed'
        : compiled ? 'Component compilation passed; host acceptance did not pass' : 'Component verification did not pass',
        stderr: '', diagnostic: result.status === 'unavailable' ? 'Component sandbox unavailable' : undefined };
    } finally { await rm(dependencies, { recursive: true, force: true }); }
  } };
}
