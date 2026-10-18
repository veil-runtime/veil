import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { main } from '../apps/repository-task/workflow-cli.js';

test('developer CLI produces a real sandbox-verified offline patch and refuses to overwrite evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'veil-workflow-test-'));
  const output = join(root, 'result');
  const log = await open(join(root, 'log'), 'w');
  const run = () => new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, [join(__dirname, '../apps/repository-task/workflow-cli.js'), '--offline-example', output],
      { stdio: ['ignore', log.fd, log.fd], env: { ...process.env, OPENAI_API_KEY: '' } });
    child.on('error', reject); child.on('close', resolve);
  });
  try {
    assert.equal(await run(), 0, await readFile(join(root, 'log'), 'utf8'));
    const summary = JSON.parse(await readFile(join(output, 'summary.json'), 'utf8'));
    const record = JSON.parse(await readFile(join(output, 'record.json'), 'utf8'));
    assert.equal(summary.actuallyVerified, true);
    assert.equal(summary.inferenceCostUSD, 0);
    assert.equal(summary.mode, 'simulated');
    assert.equal(summary.originalUnchanged, true);
    assert.deepEqual(summary.filesChanged, ['src/labels.ts']);
    assert.equal(summary.verification.length, 2);
    assert.equal(summary.verification[0].result.accepted, false);
    assert.equal(summary.verification[1].result.accepted, true);
    assert.equal(summary.verifiedRevision, summary.finalRevision);
    assert.equal(await readFile(join(output, 'changes.patch'), 'utf8'), record.report.patch);
    assert.match(record.report.patch, /diff --git a\/src\/labels.ts/);
    assert.equal(await run(), 1);
    assert.deepEqual(JSON.parse(await readFile(join(output, 'summary.json'), 'utf8')), summary);
  } finally { await log.close(); await rm(root, { recursive: true, force: true }); }
});

test('developer CLI requires explicit mode and rejects ambiguous paid/replay configuration before execution', async () => {
  for (const args of [[], ['--profile', 'p', '--task', 't', '--output', 'o'],
    ['--profile', 'p', '--task', 't', '--output', 'o', '--inference', 'i'],
    ['--profile', 'p', '--task', 't', '--output', 'o', '--live-paid', '--inference', 'i', '--replay', 'r'],
    ['--offline-example', 'o', '--live-paid']]) await assert.rejects(main(args), /Usage:/);
});
