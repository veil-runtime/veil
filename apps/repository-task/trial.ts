import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RepositoryProfile } from './runner.js';
import { type InferenceLimits, type Transport } from './live.js';

export const trialModel = 'gpt-4.1-mini-2025-04-14';
export const trialObjective = 'Fix uniqueLabels: trim labels, remove empty labels, and deduplicate case-insensitively while preserving the first spelling and order. Discover the implementation and verify the correction.';
export const trialLimits: InferenceLimits = { inputTokens: 30000, outputTokens: 12000, outputPerCall: 1500,
  costUSD: 0.04, observationBytes: 32768, responseBytes: 32768, transcriptBytes: 4 * 1024 * 1024 };
export async function trialFixture(): Promise<{ profile: RepositoryProfile; cleanup: () => Promise<void> }> {
  const repository = await mkdtemp(join(tmpdir(), 'veil-labels-trial-'));
  await mkdir(join(repository, 'src'));
  await writeFile(join(repository, 'src/labels.ts'), 'export function uniqueLabels(labels: string[]): string[] { return [...new Set(labels)]; }\n');
  const profile: RepositoryProfile = { repository, readable: ['src/labels.ts'], writable: ['src/labels.ts'],
    acceptance: [
      { file: 'src/labels.ts', export: 'uniqueLabels', args: [[' Alpha ', 'alpha', '', '  ', 'BETA', ' beta ', 'Gamma']], expected: ['Alpha', 'BETA', 'Gamma'] },
      { file: 'src/labels.ts', export: 'uniqueLabels', args: [[]], expected: [] },
      { file: 'src/labels.ts', export: 'uniqueLabels', args: [['__proto__', '__PROTO__', 'X', 'x']], expected: ['__proto__', 'X'] },
    ], maxTurns: 12, maxVerifications: 3, reasonerTimeoutMs: 20000, maxDurationMs: 120000,
    limits: { runtimeMounts: ['/usr/lib', '/lib', '/lib64'].map(source => ({ source, target: source })),
      wallMs: 2000, cpuSeconds: 2, addressSpaceBytes: 1024 ** 3, outputBytes: 8192, snapshotBytes: 8192, snapshotFiles: 10 } };
  return { profile, cleanup: () => rm(repository, { recursive: true, force: true }) };
}
export const capabilityAction = (capability: string, input: Record<string, unknown> = {}) => JSON.stringify({ type: 'capability', capability, input });
export const correctedLabels = 'export function uniqueLabels(labels: string[]): string[] { const seen = new Set<string>(); return labels.map(s => s.trim()).filter(s => { const key = s.toLowerCase(); if (!s || seen.has(key)) return false; seen.add(key); return true; }); }\n';
export function simulated(actions: string[]): Transport {
  const queue = [...actions];
  return { count: async () => 100, generate: async r => ({ model: r.model, status: 'completed', usage: { input_tokens: 100, output_tokens: 100 },
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: queue.shift() ?? '{"type":"finish"}' }] }] }) };
}
export const dryActions = () => [capabilityAction('workspace.list', { path: '.' }), capabilityAction('workspace.list', { path: 'src' }),
  capabilityAction('workspace.read', { path: 'src/labels.ts' }), capabilityAction('verification.sandbox.run'),
  capabilityAction('workspace.write', { path: 'src/labels.ts', content: correctedLabels }), capabilityAction('verification.sandbox.run'), '{"type":"finish"}'];
