import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RepositoryProfile } from './runner.js';
import type { AcceptanceCase } from './acceptance.js';
import { benchmarkDiagnostics } from './benchmark-diagnostics.js';

export type Condition = 'standard' | 'recovery';
export type FeedbackCondition = 'sparse' | 'diagnostic';
export interface BenchmarkTask {
  id: string; difficulty: 'small' | 'small-intermediate'; category: string;
  objective: string; source: string; cases: AcceptanceCase[];
}
const file = 'src/task.ts';
const cases = (name: string, rows: [unknown[], unknown][]): AcceptanceCase[] => rows.map(([args, expected]) => ({ file, export: name, args, expected, unchangedArgs: ['groupTotals', 'normalizeRanges', 'coveredLength'].includes(name) }));
export const taskBank: readonly BenchmarkTask[] = [
  { id: 'bounded-integer', difficulty: 'small', category: 'Input validation and edge cases',
    objective: 'Implement parseBounded(text, min, max): accept only a complete optionally signed decimal integer after trimming whitespace, with a safe integer value inside inclusive safe-integer bounds. Return the number, or null for invalid text, reversed/unsafe bounds, or out-of-range values. Empty input, fractions, exponents and trailing characters are invalid.',
    source: 'export function parseBounded(text: string, min: number, max: number): number | null { return parseInt(text); }\n',
    cases: cases('parseBounded', [[[' +12 ', 0, 12], 12], [['12x', 0, 20], null], [['', 0, 1], null], [['1e2', 0, 100], null], [['2.5', 0, 3], null], [['-4', -4, 4], -4], [['5', 0, 4], null], [['2', 3, 1], null], [['9007199254740992', 0, 9007199254740992], null], [['1', 0.5, 2], null]]) },
  { id: 'group-totals', difficulty: 'small', category: 'Data transformations',
    objective: 'Implement groupTotals(rows): rows have string keys and finite numeric amounts. Sum amounts by exact key and return {key,total} entries in first occurrence order. Keys such as __proto__ are ordinary keys; zero and negative totals remain. Do not mutate rows.',
    source: 'export function groupTotals(rows: {key:string; amount:number}[]): {key:string; total:number}[] { return rows.map(r => ({key:r.key,total:r.amount})); }\n',
    cases: cases('groupTotals', [[[[{ key: 'b', amount: 3 }, { key: 'a', amount: 2 }, { key: 'b', amount: -3 }]], [{ key: 'b', total: 0 }, { key: 'a', total: 2 }]], [[[]], []], [[[{ key: '__proto__', amount: 2 }, { key: '__proto__', amount: 4 }, { key: 'constructor', amount: -1 }]], [{ key: '__proto__', total: 6 }, { key: 'constructor', total: -1 }]]]) },
  { id: 'interval-union', difficulty: 'small-intermediate', category: 'Multiple interacting functions',
    objective: 'Implement normalizeRanges(ranges) and coveredLength(ranges). Ranges are finite numeric [start,end] pairs: discard reversed and zero-length pairs, sort by start, and merge overlapping or touching ranges. Return fresh arrays without mutating input. coveredLength returns the total length of this union, counting overlap once.',
    source: 'export function normalizeRanges(ranges: number[][]): number[][] { return ranges; }\nexport function coveredLength(ranges: number[][]): number { return ranges.reduce((n,r) => n+r[1]-r[0],0); }\n',
    cases: [...cases('normalizeRanges', [[[[[5, 7], [1, 3], [3, 6], [9, 9], [8, 2]]], [[1, 7]]], [[[]], []], [[[[2, 4], [-3, -1], [2, 3]]], [[-3, -1], [2, 4]]]]), ...cases('coveredLength', [[[[[1, 4], [2, 6], [8, 10]]], 7], [[[]], 0], [[[[4, 2], [-2, 0], [0, 2]]], 4]])] },
  { id: 'reservation-ledger', difficulty: 'small-intermediate', category: 'State transitions and invariants',
    objective: 'Implement ledger(capacity, events) for a nonnegative integer capacity. Start with no reservations. A reserve event {type:"reserve",id,quantity} succeeds only for a new id, positive integer quantity, and enough available capacity. A release event {type:"release",id} removes an existing reservation. Invalid events are ignored. Return {available,reservations}, where reservations is an array of {id,quantity} in successful reservation order. Released ids can be reused; no event may cause overbooking.',
    source: 'export function ledger(capacity: number, events: any[]): any { return {available:capacity,reservations:[]}; }\n',
    cases: cases('ledger', [[[5, [{ type: 'reserve', id: 'a', quantity: 3 }, { type: 'reserve', id: 'b', quantity: 3 }]], { available: 2, reservations: [{ id: 'a', quantity: 3 }] }], [[3, [{ type: 'reserve', id: 'a', quantity: 2 }, { type: 'reserve', id: 'a', quantity: 1 }, { type: 'release', id: 'a' }, { type: 'reserve', id: 'a', quantity: 3 }]], { available: 0, reservations: [{ id: 'a', quantity: 3 }] }], [[2, [{ type: 'release', id: 'missing' }, { type: 'reserve', id: 'x', quantity: -1 }, { type: 'reserve', id: 'y', quantity: 0.5 }, { type: 'reserve', id: '__proto__', quantity: 1 }]], { available: 1, reservations: [{ id: '__proto__', quantity: 1 }] }], [[0, []], { available: 0, reservations: [] }]]) },
  { id: 'record-recovery', difficulty: 'small', category: 'Error handling and recovery',
    objective: 'Implement readRecords(lines): each line is independent JSON. Keep values from objects whose value property is a finite number (including zero). For malformed JSON or any other shape, append the zero-based line index to errors and continue processing subsequent lines. Return {values,errors}; do not throw because a line is bad.',
    source: 'export function readRecords(lines: string[]): any { return {values:lines.map(s => JSON.parse(s).value),errors:[]}; }\n',
    cases: cases('readRecords', [[[['{"value":1}', 'bad', '{"value":0}', '{"value":-2}']], { values: [1, 0, -2], errors: [1] }], [[[ 'null', '[]', '{"value":"2"}', '{}', '{"value":1e999}', '{"value":3}' ]], { values: [3], errors: [0, 1, 2, 3, 4] }], [[[]], { values: [], errors: [] }]]) },
];
export function getTask(id: string): BenchmarkTask {
  const task = taskBank.find(t => t.id === id);
  if (!task) throw Error('Unknown benchmark task');
  return structuredClone(task);
}
export async function benchmarkFixture(task: BenchmarkTask, condition: Condition, feedbackCondition: FeedbackCondition = 'sparse') {
  if (condition === 'recovery' && task.id !== 'bounded-integer') throw Error('Recovery condition is defined only for bounded-integer');
  if (!['sparse', 'diagnostic'].includes(feedbackCondition)) throw Error('Invalid feedback condition');
  const repository = await mkdtemp(join(tmpdir(), 'veil-benchmark-'));
  try {
    await mkdir(join(repository, 'src'));
    const source = condition === 'standard' ? task.source : 'export function parseBounded(text: string, min: number, max: number): number | null { const s=text.trim(); const n=Number(s); return /^[+-]?\\d+$/.test(s) && Number.isSafeInteger(n) && Number.isSafeInteger(min) && Number.isSafeInteger(max) && n>=min && n<max ? n : null; }\n';
    await writeFile(join(repository, file), source);
    const categories = benchmarkDiagnostics[task.id];
    if (feedbackCondition === 'diagnostic' && (!categories || categories.length !== task.cases.length)) throw Error('Invalid benchmark diagnostic mapping');
    const profile: RepositoryProfile = { repository, readable: [file], writable: [file], acceptance: task.cases,
      acceptanceFeedback: feedbackCondition === 'diagnostic' ? 'diagnostic' : 'summary',
      ...(feedbackCondition === 'diagnostic' ? { diagnosticCategories: categories } : {}),
      maxTurns: 12, maxVerifications: 3, reasonerTimeoutMs: 20000, maxDurationMs: 120000,
      limits: { runtimeMounts: ['/usr/lib', '/lib', '/lib64'].map(source => ({ source, target: source })), wallMs: 2000, cpuSeconds: 2,
        addressSpaceBytes: 1024 ** 3, outputBytes: 8192, snapshotBytes: 8192, snapshotFiles: 10 } };
    return { profile, source, objective: task.objective + (condition === 'recovery' ? ' For this recovery condition, run verification on the existing implementation before making edits, then choose any correction yourself.' : ''),
      cleanup: () => rm(repository, { recursive: true, force: true }) };
  } catch (error) { await rm(repository, { recursive: true, force: true }); throw error; }
}
