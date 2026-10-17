import { randomBytes } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readApproved, materialize } from './workspace.js';
import { createLinuxVerificationSandbox, type VerificationProfile, type VerificationResult } from '../../src/providers/sandbox/linux-verification-sandbox.js';
import { createSandboxVerificationCapability } from '../../src/capabilities/verification/sandbox-verify.js';
import type { Capability } from '../../src/index.js';

export interface AcceptanceCase { file: string; export: string; args: unknown[]; expected: unknown; unchangedArgs?: boolean }
export interface AcceptanceResult extends VerificationResult { accepted: boolean }

/** Fixed single-process oracle: generated modules receive no imports or host objects.
 * VM limits the supported language surface; Linux remains the security boundary.
 */
export function acceptanceCapability(workspace: string, cases: readonly AcceptanceCase[], limits: Omit<VerificationProfile, 'workspace' | 'executable' | 'args'>, feedback?: 'summary'): Capability<Record<string, never>, AcceptanceResult> {
  const marker = randomBytes(32).toString('hex');
  const script = `
    const fs = require('node:fs');
    const vm = require('node:vm');
    const assert = require('node:assert/strict');
    (async () => {
      const cases = ${JSON.stringify(cases)};
      for (const c of cases) {
        const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
        const source = fs.readFileSync('/workspace/' + c.file, 'utf8');
        const module = new vm.SourceTextModule(source, { context });
        await module.link(() => { throw Error('Imports are outside this profile'); });
        await module.evaluate();
        // Arguments enter as JSON literals; results are cloned by the trusted realm.
        context.fn = module.namespace[c.export];
        const args = vm.runInContext('(' + JSON.stringify(c.args) + ')', context);
        context.args = args;
        const actual = vm.runInContext('fn(...args)', context);
        assert.deepStrictEqual(structuredClone(actual), c.expected);
        if (c.unchangedArgs) assert.deepStrictEqual(structuredClone(args), c.args);
      }
      process.stdout.write(${JSON.stringify(marker)});
    })().catch(error => { console.error(String(error)); process.exitCode = 1; });
  `;
  const profile = { ...limits, workspace, executable: process.execPath,
    args: ['--jitless', '--disable-wasm-trap-handler', '--max-old-space-size=64', '--experimental-vm-modules', '--no-warnings', '-e', script] };
  const capability = createSandboxVerificationCapability(profile);
  return { ...capability, async execute(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Reflect.ownKeys(input).length) throw new Error('Verification accepts only {}');
    const prepared = await mkdtemp(join(tmpdir(), 'veil-task-acceptance-'));
    try {
      const tree = await readApproved(workspace, [...new Set(cases.map(c => c.file))], limits.snapshotBytes);
      // Node's native stripper requires WASM, unavailable under --jitless. Parse data
      // in the host; never import/evaluate source or resolve project configuration.
      try { for (const file of Object.keys(tree)) tree[file] = stripTypeScriptTypes(tree[file]); }
      catch (error) { return { status: 'failed', exitCode: null, signal: null, stdout: '', stderr: feedback === 'summary' ? 'TypeScript parsing failed' : String(error), elapsedMs: 0, accepted: false }; }
      await materialize(prepared, tree);
      const result = await createLinuxVerificationSandbox({ ...profile, workspace: prepared })();
      const accepted = result.status === 'passed' && result.stdout === marker;
      return { ...result, stdout: feedback === 'summary' ? (accepted ? 'All host acceptance cases passed' : 'Host acceptance did not pass') : result.stdout === marker ? 'All host acceptance cases passed' : result.stdout,
        stderr: feedback === 'summary' ? '' : result.stderr, accepted };
    } finally { await rm(prepared, { recursive: true, force: true }); }
  } };
}
