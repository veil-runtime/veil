import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export type TrialTaskId = 'slug' | 'config' | 'invoice';
export interface TrialTask {
  id: TrialTaskId;
  goal: string;
  file: string;
  seed: string;
  verify(workspace: string): Promise<boolean>;
}

let liveSandboxReady = false;
export function isLiveVerifierSandboxReady(): boolean { return liveSandboxReady; }

// Seeds and acceptance cases are host-owned. Only goal and workspace files reach the reasoner.
export const trialTasks: readonly TrialTask[] = [
  {
    id: 'slug', file: 'src/slug.mjs',
    goal: 'Repair the slug function so it converts titles into lowercase URL slugs: trim surrounding whitespace, turn each run of spaces or hyphens into one hyphen, and remove leading or trailing hyphens.',
    seed: 'export function slug(title) { return title.toLowerCase().replaceAll(" ", "-"); }\n',
    verify: (root) => sandboxCheck(root, 'src/slug.mjs',
      `slug('  Hello   WORLD  ') === 'hello-world' && slug('--Already--There--') === 'already-there' && slug(' A - B ') === 'a-b'`),
  },
  {
    id: 'config', file: 'src/config.mjs',
    goal: 'Repair parseConfig so it reads newline separated key=value settings, skips blank lines and lines starting with #, trims keys and values, and keeps any additional equals signs in a value.',
    seed: 'export function parseConfig(text) { return Object.fromEntries(text.split("\\n").map(line => line.split("="))); }\n',
    verify: (root) => sandboxCheck(root, 'src/config.mjs',
      `JSON.stringify(parseConfig(' # note\\n name = Ada \\n token=a=b=c\\n\\nempty= \\n')) === JSON.stringify({ name: 'Ada', token: 'a=b=c', empty: '' })`),
  },
  {
    id: 'invoice', file: 'src/invoice.mjs',
    goal: 'Repair invoiceTotalCents so it sums quantity times unitCents for active items only, subtracts discountCents once, and never returns a negative total.',
    seed: 'export function invoiceTotalCents(items, discountCents = 0) { return items.reduce((sum, item) => sum + item.unitCents, 0) - discountCents; }\n',
    verify: (root) => sandboxCheck(root, 'src/invoice.mjs',
      `invoiceTotalCents([{ quantity: 2, unitCents: 125, active: true }, { quantity: 7, unitCents: 999, active: false }], 30) === 220 && invoiceTotalCents([{ quantity: 1, unitCents: 10, active: true }], 50) === 0 && invoiceTotalCents([], 0) === 0`),
  },
];

async function sandboxCheck(root: string, file: string, expression: string): Promise<boolean> {
  const strict = liveSandboxReady;
  const source = join(strict ? '/work' : root, file);
  const functionName = file.includes('slug') ? 'slug' : file.includes('config') ? 'parseConfig' : 'invoiceTotalCents';
  const code = `import { readFileSync } from 'node:fs'; import { runInNewContext } from 'node:vm';
    const source = readFileSync(${JSON.stringify(source)}, 'utf8');
    if (!source.startsWith(${JSON.stringify(`export function ${functionName}(`)})) process.exit(2);
    try { const result = runInNewContext(source.replace(/^export\\s+/, '') + ${JSON.stringify(`\nBoolean(${expression})`)},
      Object.create(null), { timeout: 1500, contextCodeGeneration: { strings: false, wasm: false } });
      process.exit(result === true ? 0 : 2); } catch { process.exit(2); }`;
  const command = strict ? 'bwrap' : process.execPath;
  const args = strict ? [...bubblewrapArgs(root), '/node', '--permission', '--allow-fs-read=/work',
    '--input-type=module', '-e', code] :
    ['--permission', `--allow-fs-read=${root}`, '--input-type=module', '-e', code];
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env: {}, stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), 2000);
    child.on('error', () => { clearTimeout(timer); resolve(false); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}

function bubblewrapArgs(root: string): string[] {
  return ['--unshare-all', '--die-with-parent', '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/lib', '/lib', '--ro-bind', '/lib64', '/lib64',
    '--ro-bind', process.execPath, '/node', '--ro-bind', root, '/work',
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--chdir', '/work'];
}

/** Fail closed before paid calls if a network-isolated verifier cannot start. */
export async function checkLiveVerifierSandbox(workspace: string): Promise<void> {
  const child = spawn('bwrap', [...bubblewrapArgs(workspace), '/node', '-e', 'process.exit(0)'],
    { cwd: workspace, env: {}, stdio: 'ignore' });
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => child.kill(), 2000);
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (status) => { clearTimeout(timer); resolve(status); });
  });
  if (code !== 0) throw new Error('Network-isolated verifier sandbox is unavailable');
  liveSandboxReady = true;
}

export async function seedTask(task: TrialTask, workspace: string): Promise<void> {
  await mkdir(join(workspace, 'src'), { recursive: true });
  await writeFile(join(workspace, task.file), task.seed, { flag: 'wx' });
}
