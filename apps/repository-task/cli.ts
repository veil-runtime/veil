import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { runRepositoryTask, type RepositoryProfile } from './runner.js';

/** JSON-lines transport. No model-selected modules, commands or identity enter the host. */
async function main(): Promise<void> {
  const [profilePath, objective] = process.argv.slice(2);
  if (!profilePath || !objective) throw new Error('Usage: node cli.js APPROVED_PROFILE.json "objective"');
  const profile: RepositoryProfile = JSON.parse(await readFile(profilePath, 'utf8'));
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const queue: string[] = [];
  let closed = false;
  let wake: (() => void) | undefined;
  let transportError: string | undefined;
  let bytes = 0;
  const byteLimit = profile.maxTurns * (profile.limits.snapshotBytes * 2 + 4096);
  process.stdin.on('data', chunk => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > byteLimit) { transportError = 'Transport byte budget exceeded'; input.close(); process.stdin.pause(); }
  });
  input.on('line', line => {
    if (queue.length >= profile.maxTurns) { transportError = 'Transport queue budget exceeded'; input.close(); process.stdin.pause(); }
    else queue.push(line);
    wake?.();
  });
  input.on('close', () => { closed = true; wake?.(); });
  try {
    const report = await runRepositoryTask(objective, profile, async (context) => {
      process.stdout.write(JSON.stringify({ type: 'reason', context }) + '\n');
      while (!queue.length && !closed) await new Promise<void>(resolve => { wake = resolve; });
      if (transportError) throw new Error(transportError);
      const line = queue.shift();
      if (line === undefined) throw new Error('Reasoner transport closed before finish');
      return line;
    });
    process.stdout.write(JSON.stringify({ type: 'result', report }) + '\n');
    process.exitCode = report.classification === 'verified' ? 0 : 1;
  } finally { input.close(); }
}
main().catch(error => { console.error(String(error)); process.exitCode = 1; });
