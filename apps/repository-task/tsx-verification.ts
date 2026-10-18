import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLinuxVerificationSandbox, type VerificationProfile } from '../../src/providers/sandbox/linux-verification-sandbox.js';
import { createSandboxVerificationCapability } from '../../src/capabilities/verification/sandbox-verify.js';
import { safePath } from './workspace.js';
import type { AcceptanceResult } from './acceptance.js';
import type { Capability } from '../../src/index.js';

/** Host-owned single-file policy. No parser options, commands, or executable rules. */
export interface TsxAcceptance {
  file: string;
  baselineSHA256: string;
  component: string;
  control: { tag: string; attribute: string; value: string };
  target: { tag: string; attribute: string; value: string };
  targetId: string;
}
// Reviewed @babel/parser 8.0.6 lib/index.js: standalone ESM, no runtime imports,
// filesystem/network access, dynamic evaluation, or project configuration loading.
export const parserSHA256 = 'a6993b23a0d162cc93e49f72ef927c947c2026cd146cfe9c02cd695a4258411d';
const sha256 = (source: string | Buffer) => createHash('sha256').update(source).digest('hex');

export function validateTsxPolicy(rule: TsxAcceptance): void {
  const exact = (value: object, keys: string[]) => value && typeof value === 'object'
    && Object.keys(value).sort().join(',') === keys.sort().join(',');
  if (!exact(rule, ['file', 'baselineSHA256', 'component', 'control', 'target', 'targetId'])
    || typeof rule.file !== 'string' || !safePath(rule.file) || !/^[a-f0-9]{64}$/.test(rule.baselineSHA256)
    || !/^[A-Za-z_$][\w$]{0,63}$/.test(rule.component) || !/^[A-Za-z][\w-]{0,63}$/.test(rule.targetId)) throw Error('Invalid TSX policy');
  for (const selector of [rule.control, rule.target]) {
    if (!exact(selector, ['tag', 'attribute', 'value']) || !/^[a-z][a-z0-9-]{0,31}$/.test(selector.tag)
      || !/^[a-z][a-z0-9-]{0,63}$/.test(selector.attribute) || typeof selector.value !== 'string'
      || !selector.value || selector.value.length > 128) throw Error('Invalid TSX selector');
  }
  if (rule.control.attribute !== 'aria-controls' || rule.control.value !== rule.targetId || rule.target.attribute === 'id') throw Error('Invalid TSX relationship');
}

/** Serialized into the fixed sandbox program. Traverses parsed data only. */
function checkAst(baseline: any, candidate: any, rule: TsxAcceptance): boolean {
  const nodes = (root: any, type: string): any[] => {
    const found: any[] = [];
    const visit = (value: any): void => {
      if (!value || typeof value !== 'object') return;
      if (value.type === type) found.push(value);
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(root); return found;
  };
  const attributes = (node: any, name: string) => node.attributes.filter((a: any) => a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === name);
  const literal = (node: any, name: string): string | undefined => {
    const attrs = attributes(node, name);
    return attrs.length === 1 && attrs[0].value?.type === 'StringLiteral' ? attrs[0].value.value : undefined;
  };
  const select = (ast: any) => {
    const components = nodes(ast, 'FunctionDeclaration').filter(node => node.id?.name === rule.component);
    if (components.length !== 1) throw Error('component');
    const elements = nodes(components[0].body, 'JSXOpeningElement');
    const one = (selector: TsxAcceptance['target']) => {
      const matches = elements.filter(node => node.name.type === 'JSXIdentifier' && node.name.name === selector.tag
        && literal(node, selector.attribute) === selector.value);
      if (matches.length !== 1 || matches[0].attributes.some((a: any) => a.type === 'JSXSpreadAttribute')) throw Error('selector');
      return matches[0];
    };
    return { control: one(rule.control), target: one(rule.target) };
  };
  const before = select(baseline), after = select(candidate);
  if (before.control === before.target || after.control === after.target || attributes(before.target, 'id').length
    || literal(after.target, 'id') !== rule.targetId) return false;
  const ids = nodes(candidate, 'JSXOpeningElement').flatMap(node => attributes(node, 'id'))
    .filter(attr => attr.value?.type === 'StringLiteral' && attr.value.value === rule.targetId);
  if (ids.length !== 1) return false;
  // Only the selected target's literal id may be added. All other AST structure,
  // comments, imports, literals, JSX text and executable code must remain equal.
  after.target.attributes = after.target.attributes.filter((a: any) => a !== attributes(after.target, 'id')[0]);
  const normalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !['start', 'end', 'loc', 'extra'].includes(key))
      .map(([key, child]) => [key, normalize(child)]));
  };
  return JSON.stringify(normalize(baseline)) === JSON.stringify(normalize(candidate));
}

export async function tsxAcceptanceCapability(workspace: string, baseline: string, approved: TsxAcceptance,
  limits: Omit<VerificationProfile, 'workspace' | 'executable' | 'args'>): Promise<Capability<Record<string, never>, AcceptanceResult>> {
  const rule = structuredClone(approved);
  validateTsxPolicy(rule);
  if (sha256(baseline) !== rule.baselineSHA256) throw Error('TSX baseline revision mismatch');
  if (!limits.runtimeMounts.every(m => ['/usr/lib', '/lib', '/lib64'].includes(m.source) && m.target === m.source)) throw Error('Unreviewed TSX runtime mount');
  // Read trusted installed code as data, pin it, then expose only this exact file.
  const parser = await readFile(require.resolve('@babel/parser'));
  if (sha256(parser) !== parserSHA256) throw Error('TSX parser checksum mismatch; review required');
  const marker = randomBytes(32).toString('hex');
  const script = `
    const fs = require('node:fs');
    const __name = (target, name) => Object.defineProperty(target, 'name', { value: name, configurable: true });
    (async () => {
      const { parse } = await import('file:///opt/deps/parser.mjs');
      const options = { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: false };
      const baseline = parse(${JSON.stringify(baseline)}, options);
      const source = fs.readFileSync(${JSON.stringify('/workspace/' + rule.file)}, 'utf8');
      const candidate = parse(source, options);
      if (!(${checkAst.toString()})(baseline, candidate, ${JSON.stringify(rule)})) throw Error('rejected');
      process.stdout.write(${JSON.stringify(marker)});
    })().catch(() => { process.exitCode = 1; });
  `;
  const profile = { ...limits, workspace, executable: process.execPath,
    args: ['--no-experimental-strip-types', '--jitless', '--disable-wasm-trap-handler', '--max-old-space-size=64', '--no-warnings', '-e', script] };
  return { ...createSandboxVerificationCapability(profile), async execute(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Reflect.ownKeys(input).length) throw Error('Verification accepts only {}');
    const dependencies = await mkdtemp(join(tmpdir(), 'veil-tsx-parser-'));
    try {
      await writeFile(join(dependencies, 'parser.mjs'), parser, { flag: 'wx', mode: 0o400 });
      const result = await createLinuxVerificationSandbox({ ...profile,
        runtimeMounts: [...profile.runtimeMounts, { source: dependencies, target: '/opt/deps' }] })();
      const accepted = result.status === 'passed' && result.stdout === marker;
      return { ...result, accepted, stdout: accepted ? 'Host TSX acceptance passed' : 'Host TSX acceptance did not pass',
        stderr: '', diagnostic: result.status === 'unavailable' ? 'TSX sandbox unavailable' : undefined };
    } finally { await rm(dependencies, { recursive: true, force: true }); }
  } };
}
