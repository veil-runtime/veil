import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { baselinePath, checkGovernance, inspectSource, inspectTree, parseBaseline } from './quality-governance.mjs';

const path = 'src/example.ts';
async function baseline(source, file = path) {
  return JSON.stringify({ version: 1, sites: (await inspectSource(file, source)).map(({ path, anchor, kind }) => ({
    path, anchor, kind, classification: 'TEST_OR_FIXTURE', reason: 'Explicit test fixture site',
  })) });
}
async function compare(source, current, { candidateBaseline, candidatePath = path } = {}) {
  const original = new Map([[path, source], [baselinePath, await baseline(source)]]);
  const candidate = new Map([[candidatePath, current], [baselinePath, candidateBaseline ?? original.get(baselinePath)]]);
  return checkGovernance({ paths: [...new Set([...original.keys(), ...candidate.keys()])],
    before: (file) => original.get(file), after: (file) => candidate.get(file) });
}

for (const [label, source] of [
  ['direct execute', 'obj.execute(input);'],
  ['optional receiver', 'obj?.execute(input);'],
  ['optional call', 'obj.execute?.(input);'],
  ['computed literal', 'obj["execute"](input);'],
  ['computed template', 'obj[`execute`](input);'],
  ['extracted execute', 'const fn = obj.execute;'],
  ['destructured execute', 'const { execute: fn } = obj;'],
  ['quoted destructured execute', 'const { "execute": fn } = obj;'],
  ['computed destructured execute', 'const { ["execute"]: fn } = obj;'],
  ['bound execute', 'const fn = obj.execute.bind(obj);'],
  ['receiver renaming', 'const innocent = obj; innocent.execute(input);'],
  ['type assertion', '(obj as any).execute(input);'],
  ['escaped identifier', 'obj.ex\\u0065cute(input);'],
]) {
  test(`governance rejects ${label}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 1);
    assert.match(result.output, /VEIL-GOV-001 src\/example.ts:1:\d+: execution-method reference/);
  });
}

test('each destructured execution reference is an individual site', async () => {
  const sites = await inspectSource(path, 'const {execute: a, execute: b} = cap;');
  assert.equal(sites.length, 2);
  assert.notEqual(sites.at(0).anchor, sites.at(1).anchor);
});

const original = 'function oldRoute() { return cap.execute(input); }';
for (const [label, source, candidatePath] of [
  ['move to another file', original, 'examples/hidden.ts'],
  ['move to another function', original.replace('oldRoute', 'newRoute'), path],
  ['copy a bypass', `${original}\nfunction copied() { return cap.execute(input); }`, path],
  ['second reference beside approved site', original.replace('return ', 'cap.execute(input); return '), path],
  ['replace receiver in approved site', original.replace('cap.execute', 'other.execute'), path],
  ['move statement position', `unrelated();\n${original}`, path],
]) {
  test(`governance allowances cannot transfer: ${label}`, async () => {
    const result = await compare(original, source, { candidatePath });
    assert.equal(result.status, 1);
    assert.match(result.output, /no trusted individual allowance/);
  });
}

for (const expression of ['jm.execute(jobId)', 'jm.executePlan(plan)', 'jm["executePlan"](plan)',
  'jm?.executePlan(plan)', 'const fn = jm.executePlan', 'const {executePlan: fn} = jm',
  'const alias = jm; alias.executePlan(plan)']) {
  test(`governance rejects direct JobManager entrance: ${expression}`, async () => {
    const result = await compare('', `import { jobManager as jm } from './runtime/jobs/job-manager.js'; ${expression};`);
    assert.equal(result.status, 1);
    assert.match(result.output, /direct JobManager execution entrance/);
  });
}

test('namespace and destructured namespace aliases still identify JobManager', async () => {
  for (const source of [
    "import * as jobs from './job-manager.js'; jobs.jobManager.executePlan(plan);",
    "import * as jobs from './job-manager.js'; const { jobManager: jm } = jobs; jm.executePlan(plan);",
    "import * as jobs from './job-manager.js'; const other = jobs; const jm = other.jobManager; jm.executePlan(plan);",
    'jobManager.executePlan(plan);',
  ]) assert.equal((await compare('', source)).status, 1);
});

test('ordinary runtime executePlan and capability definitions are not execution references', async () => {
  assert.equal((await compare('', 'runtime.executePlan(plan); const cap = { async execute(input) { return input; } };')).status, 0);
});

for (const source of ['obj[key](input);', 'obj?.[key]?.(input);', 'const fn = obj[key];',
  'const value = data[key];',
  'const fn = obj[key].bind(obj);', 'obj[key].call(obj);', 'obj[key].apply(obj, args);',
  'const value = data[key]; value(input);', 'const fn = obj[key]; fn?.();',
  'const fn = obj[key]; const alias = fn; alias();',
  'let fn; fn = obj[key]; fn();', '(obj[key]! as Fn)();',
  'const fn = obj[key]; typeof fn; (fn! as Fn)();',
  'const fn = obj[key]; function nested(fn) { return fn; }',
  'const fn = obj[key]; { class fn {} }', 'new (obj[key])();', 'obj[key]`template`;',
  'const fn = obj[key]; const alias = fn;', 'const fn = obj[key]; fn.bind(obj);',
  'const { [key]: fn } = obj;',
  'obj["exe" + "cute"](input);', 'Reflect.get(obj, "execute")(input);',
  'Object.getOwnPropertyDescriptor(obj, "execute");', 'import(moduleName);',
  'const jm = require("./job-manager.js"); jm.executePlan(plan);',
  'export { jobManager } from "./job-manager.js";']) {
  test(`governance fails closed on unsupported access: ${source}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 2);
    assert.match(result.output, /VEIL-GOV-001.*unsupported/);
  });
}

for (const [label, source] of [
  ['bare dynamic data read', 'input[field]; object[key]; array[index]; totals[kind];'],
  ['dynamic data comparison', 'if (input[field] === expected) report();'],
  ['dynamic array access', 'function read(index) { return array[index]; }'],
  ['data declaration and return', 'function read() { const value = input[field]; return value; }'],
  ['data binding with executable-looking names', 'const fn = cap[key]; if (fn === expected) report();'],
  ['formatted data', 'const value = input[field]; JSON.stringify(value);'],
  ['validated data', 'const value = input[field]; if (!validate(value)) report();'],
  ['numeric accumulator', 'const total = totals[kind]; total.before += count;'],
  ['data member traversal', 'function read() { let value = result; value = value[key]; return value; }'],
  ['scoped data declarations', '{ const value = input[field]; report(value); } { const value = other[key]; report(value); }'],
  ['data alias', 'const value = input[field]; const alias = value; if (alias === expected) report();'],
  ['nullish data use', 'const value = input[field] ?? ""; JSON.stringify(value);'],
  ['data as argument', 'canonical(object[key]);'],
]) {
  test(`governance permits ${label} without an allowance`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 0, result.output);
  });
}

test('adding executable use to an existing data binding fails closed', async () => {
  const source = 'const value = input[field]; if (value === expected) report();';
  const result = await compare(source, `${source}\nvalue(input);`);
  assert.equal(result.status, 2);
  assert.match(result.output, /VEIL-GOV-001.*dynamic invocation or executable extraction/);
});

test('a specifically reviewed validator call cannot authorize another dynamic call', async () => {
  const source = 'const check = validators[type]; check(value);';
  assert.equal((await compare(source, source)).status, 0);
  assert.equal((await compare(source, `${source}\nother[key](value);`)).status, 2);
});

test('candidate baseline expansion cannot self-authorize', async () => {
  const source = 'cap.execute(input);';
  const result = await compare('', source, { candidateBaseline: await baseline(source) });
  assert.equal(result.status, 1);
  assert.match(result.output, /no trusted individual allowance/);
});

test('candidate dynamic allowance cannot self-authorize', async () => {
  const source = 'const fn = obj[key]; fn();';
  const result = await compare('', source, { candidateBaseline: await baseline(source) });
  assert.equal(result.status, 2);
  assert.match(result.output, /no trusted individual allowance/);
});

test('initial adoption never trusts the candidate baseline', async () => {
  const source = 'cap.execute(input);';
  const candidate = new Map([[path, source], [baselinePath, await baseline(source)]]);
  const result = await checkGovernance({ paths: [...candidate.keys()], before: () => undefined, after: (p) => candidate.get(p) });
  assert.equal(result.status, 1);
  assert.match(result.output, /base has no baseline/);
  assert.match(result.output, /no trusted individual allowance/);
});

test('deleting a site retires its allowance without creating a spare allowance', async () => {
  assert.equal((await compare(original, '')).status, 0);
  assert.equal((await compare(original, 'elsewhere.execute(input);')).status, 1);
});

test('formatting, comments, quote style and CRLF do not change site identity', async () => {
  const source = 'function run() { return cap["execute"](input); }';
  const formatted = "// comment\r\nfunction run( ) {\r\n  return cap [ 'execute' ] ( input )\r\n}\r\n";
  assert.equal((await compare(source, formatted)).status, 0);
});

test('malformed syntax fails with a located VEIL-GOV-001 diagnostic', async () => {
  await assert.rejects(compare('', 'const broken = ;'), /VEIL-GOV-001 src\/example.ts:1:\d+: parser failure/);
});

test('invalid, duplicate and stale baselines fail closed', async () => {
  for (const text of ['{', '{}', '{"version":1,"sites":[{}]}']) {
    await assert.rejects(compare('', '', { candidateBaseline: text }), /VEIL-GOV-001 candidate: invalid/);
  }
  const valid = JSON.parse(await baseline(original));
  valid.sites.push(valid.sites.at(0));
  assert.throws(() => parseBaseline(JSON.stringify(valid), 'base'), /duplicate/);
  const obsolete = JSON.parse(await baseline('obj[key]();'));
  obsolete.sites.at(0).classification = 'data';
  assert.throws(() => parseBaseline(JSON.stringify(obsolete), 'candidate'), /invalid/);
  const text = await baseline(original);
  await assert.rejects(checkGovernance({ paths: [path, baselinePath],
    before: (p) => p === baselinePath ? '{}' : '', after: () => undefined }), /VEIL-GOV-001 base: invalid baseline/);
  await assert.rejects(checkGovernance({ paths: [path, baselinePath],
    before: (p) => p === baselinePath ? text : '', after: () => undefined }), /VEIL-GOV-001 base: stale allowance/);
});

test('JSX, TSX, module variants and TypeScript execution wrappers parse without stripping', async () => {
  for (const [file, source] of [
    ['view.tsx', 'const view = <button onClick={() => (cap as Capability).execute!({})} />;'],
    ['view.jsx', 'const view = <button onClick={() => cap.execute({})} />;'],
    ['module.mts', 'export const run = (cap satisfies Capability).execute;'],
    ['module.cts', 'const run = cap.execute;'],
    ['module.cjs', 'module.exports = cap.execute;'],
  ]) assert.equal((await inspectSource(file, source)).at(0).kind, 'execute');
});

test('unreadable analysis input fails closed', async () => {
  await assert.rejects(inspectTree(['outside.ts'], () => { throw new Error('Not a regular file'); }),
    /VEIL-GOV-001 outside.ts: unreadable analysis input/);
});

test('complete relevant repository parses and current individual sites classify correctly', async () => {
  const root = join(import.meta.dirname, '..');
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const read = (file) => readFileSync(join(root, file), 'utf8');
  const report = await inspectTree(new Set(paths), read);
  const sites = parseBaseline(read(baselinePath), 'inventory');
  const key = ({ path, anchor, kind }) => `${path}:${anchor}:${kind}`;
  assert.deepEqual(report.findings.map(key).sort(), sites.map(key).sort());
  assert.equal(sites.length, 16);
  assert.ok(!sites.some((site) => site.path === 'src/api/routes/execution.routes.ts'));
  assert.equal(sites.filter((site) => site.classification === 'LEGACY_BYPASS').length, 2);
  assert.deepEqual(sites.filter((site) => site.kind === 'dynamic').map((site) => site.path), [
    'src/runtime/execution/plan-validator.ts', 'test/fixtures/package-consumer/verify.mjs',
  ]);
  for (const file of ['src/api/routes/linkedin.routes.ts', 'src/api/routes/jobs.routes.ts']) {
    assert.ok(sites.some((site) => site.path === file && site.classification === 'LEGACY_BYPASS'));
  }
  console.log(`Parser compatibility: ${report.files} relevant repository files; ${sites.length} individually classified sites; Node ${process.versions.node}.`);
});

for (const source of [
  'const jm = jobs[key]; jm.executePlan(plan);',
  'const neutral = values[key]; neutral?.["executePlan"]?.(plan);',
  'const neutral = values[key]; const run = neutral.executePlan; run(plan);',
  'function run(fn = obj[key]) { fn(); }',
  'const { fn = obj[key] } = input; fn();',
  'const [fn = obj[key]] = input; fn();',
  'const run = (fn = obj[key]) => fn?.();',
  'let fn; ({ fn = obj[key] } = input); fn();',
  'Reflect.apply(cap[key], cap, [input]);',
  'Reflect?.["apply"]?.((obj[key] as Function), obj, []);',
  'const fn = obj[key]; Reflect.apply(fn, obj, []);',
  'Reflect.construct(obj[key], []);',
  'Reflect.construct(Fn, [], obj[key]);',
  'function run({ fn = obj[key] } = {}) { fn(); }',
  'function run([fn = obj[key]] = []) { fn(); }',
]) {
  test(`external review execution regression: ${source}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 2, result.output);
    assert.match(result.output, /VEIL-GOV-001.*unsupported/);
  });
}
for (const extension of ['cjsx', 'mjsx', 'ctsx', 'mtsx']) {
  test(`external review JSX extension regression: ${extension}`, async () => {
    const sites = await inspectSource(`view.${extension}`, 'const view = <button onClick={() => obj.execute(input)} />;');
    assert.equal(sites.length, 1);
    assert.equal(sites[0].kind, 'execute');
  });
}

for (const source of [
  'function read(value = obj[key]) { return value === expected; }',
  'const { value = obj[key] } = input; report(value);',
  'const [value = obj[key]] = input; report(value);',
  'Reflect.apply(fn, obj[key], []);',
  'Reflect.apply(fn, obj, [input[key]]);',
  'Reflect.construct(fn, [input[key]]);',
]) {
  test(`external review data remains allowed: ${source}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 0, result.output);
  });
}

for (const operator of ['=', '||=', '&&=', '??=']) {
  for (const use of ['(obj[key] OP fallback)();', 'const fn = (obj[key] OP fallback); fn();', '(obj[key] OP fallback)?.();']) {
    const source = use.replace('OP', operator);
    test(`second review assignment execution: ${source}`, async () => {
      const result = await compare('', source);
      assert.equal(result.status, 2, result.output);
      assert.match(result.output, /VEIL-GOV-001.*unsupported/);
    });
  }
  test(`second review assignment data: ${operator}`, async () => {
    const result = await compare('', `obj[key] ${operator} fallback; const value = (obj[key] ${operator} fallback); report(value);`);
    assert.equal(result.status, 0, result.output);
  });
}
for (const source of [
  'function invoke(manager = jobManager) { return manager.executePlan(plan); }',
  'const invoke = (manager = jobManager) => manager?.executePlan(plan);',
  'function invoke({ manager = jobManager } = {}) { manager.executePlan(plan); }',
  'function invoke([manager = jobManager] = []) { manager.executePlan(plan); }',
  'function invoke(first = jobManager, second = first) { second.executePlan(plan); }',
  'function invoke(manager = (jobManager as Manager)) { manager["executePlan"](plan); }',
  'const { manager = jobManager } = input; manager.executePlan(plan);',
  'let manager; ({ manager = jobManager } = input); manager.executePlan(plan);',
  'import { jobManager as original } from "./job-manager.js"; function invoke(manager = original) { manager.executePlan(plan); }',
  'import * as jobs from "./job-manager.js"; function invoke(namespace = jobs) { const { jobManager: manager } = namespace; manager.executePlan(plan); }',
]) {
  test(`second review manager default: ${source}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /VEIL-GOV-001.*direct JobManager execution entrance/);
  });
}

test('second review assignment RHS invocation follows the expression result', async () => {
  const result = await compare('', 'let fn; (fn = obj[key])(); report(fn);');
  assert.equal(result.status, 2, result.output);
  assert.match(result.output, /VEIL-GOV-001.*unsupported/);
});
test('second review unrelated parameter defaults remain allowed', async () => {
  const result = await compare('', 'function invoke(manager = runtime) { return manager.executePlan(plan); }');
  assert.equal(result.status, 0, result.output);
});

for (const source of [
  'const { jobManager: jm = fallback } = jobs; jm.executePlan(plan);',
  'const { "jobManager": neutral = fallback } = jobs; neutral?.["executePlan"]?.(plan);',
  'const { ["jobManager"]: neutral = fallback } = jobs; neutral.executePlan(plan);',
  'let neutral; ({ jobManager: neutral = fallback } = jobs); neutral.executePlan(plan);',
  'function invoke({ jobManager: neutral = fallback } = jobs) { neutral.executePlan(plan); }',
  'const alias = jobs; const { jobManager: neutral = fallback } = alias; neutral.executePlan(plan);',
]) {
  test(`third review namespace default: ${source}`, async () => {
    const result = await compare('', `import * as jobs from './job-manager.js'; ${source}`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /VEIL-GOV-001.*direct JobManager execution entrance/);
  });
}
for (const source of [
  'obj[0](input);',
  'const fn = obj[0]; fn();',
  'const fn = obj[0];',
  'obj?.[0]?.(input);',
  'const fn = obj[0].bind(obj);',
  'Reflect.apply(obj[0], obj, []);',
  'obj[0x0](input);',
  'obj[-1](input);',
  'obj[0n](input);',
]) {
  test(`third review numeric execution: ${source}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 2, result.output);
    assert.match(result.output, /VEIL-GOV-001.*unsupported/);
  });
}
for (const source of [
  'const value = array[0]; report(value);',
  'if (array[0] === expected) report();',
  'function read() { return array[0]; }',
  'const value = array[0]; returnValue(value === expected);',
  'array[0] = value; array[0] += 1;',
  'function read() { return array[0n]; }',
  'import * as jobs from "./job-manager.js"; const { other: neutral = fallback } = jobs; neutral.executePlan(plan);',
  'const { jobManager: neutral = fallback } = data; neutral.executePlan(plan);',
]) {
  test(`third review ordinary data or unrelated binding: ${source}`, async () => {
    const result = await compare('', source);
    assert.equal(result.status, 0, result.output);
  });
}

test('third review BigInt site identities ignore literal formatting', async () => {
  const result = await compare('obj[0n](input);', 'obj[0x0n](input);');
  assert.equal(result.status, 0, result.output);
});

for (const source of [
  "import jm = require('../../runtime/jobs/job-manager.js'); jm.executePlan(plan);",
  "export import jm = require('./job-manager.js'); jm.executePlan(plan);",
]) test(`final review import equals: ${source}`, async () => {
  const result = await compare('', source);
  assert.equal(result.status, 2, result.output);
  assert.match(result.output, /VEIL-GOV-001.*unsupported/);
});
for (const expression of ['jobManager || fallback', 'jobManager && fallback', 'fallback ?? jobManager',
  'condition ? jobManager : fallback', 'condition ? fallback : jobManager',
  '(condition ? jobManager : fallback) || other']) {
  test(`final review manager expression: ${expression}`, async () => {
    const result = await compare('', `const jm = ${expression}; jm.executePlan(plan);`);
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /VEIL-GOV-001/);
  });
}

for (const source of [
  'import * as jobs from "./job-manager.js"; import jm = jobs.jobManager; jm.executePlan(plan);',
  'import jm = Other.Manager; jm.executePlan(plan);',
]) test(`final review related import equals fails closed: ${source}`, async () => {
  assert.equal((await compare('', source)).status, 2);
});
for (const source of [
  'import type jm = require("./job-manager.js");',
  'const runtime = condition ? firstRuntime : secondRuntime; runtime.executePlan(plan);',
  'const runtime = firstRuntime || secondRuntime; runtime.executePlan(plan);',
  'const runtime = jobManager ? firstRuntime : secondRuntime; runtime.executePlan(plan);',
]) test(`final review unrelated expression or type import allowed: ${source}`, async () => {
  assert.equal((await compare('', source)).status, 0);
});
for (const source of [
  'const first = jobManager; const neutral = condition ? first : fallback; neutral.executePlan(plan);',
  '(jobManager || fallback).executePlan(plan);',
  'function invoke(neutral = condition ? jobManager : fallback) { neutral.executePlan(plan); }',
]) test(`final review adjacent local manager expression: ${source}`, async () => {
  assert.equal((await compare('', source)).status, 1);
});
