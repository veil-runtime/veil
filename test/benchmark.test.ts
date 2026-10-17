import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { taskBank, getTask, benchmarkFixture } from '../apps/repository-task/benchmark-tasks.js';
import { metrics, runBenchmark, sessionDefaults, type BenchmarkOptions } from '../apps/repository-task/benchmark.js';
import { offlineTransport, solutions } from '../apps/repository-task/benchmark-simulated.js';
import { runLiveTask, replay, type Transport } from '../apps/repository-task/live.js';
import { trialLimits, trialModel, simulated, capabilityAction as a } from '../apps/repository-task/trial.js';
const originalTmp = process.env.TMPDIR;
let root: string;
before(async () => { root = await mkdtemp(join(tmpdir(), 'veil-benchmark-tests-')); process.env.TMPDIR = root; });
after(async () => { if (originalTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = originalTmp; await rm(root, {recursive:true,force:true}); });
const verify = a('verification.sandbox.run'), finish = '{"type":"finish"}';
const write = a('workspace.write', {path:'src/task.ts',content:solutions['bounded-integer']});
async function run(actions: string[], change?: (p: Awaited<ReturnType<typeof benchmarkFixture>>['profile']) => void, transport?: Transport) {
  const f = await benchmarkFixture(getTask('bounded-integer'), 'standard');
  try { change?.(f.profile); return await runLiveTask(f.objective, f.profile, trialModel, trialLimits, transport ?? simulated(actions), 'simulated'); }
  finally { await f.cleanup(); }
}
function options(overrides: Partial<BenchmarkOptions> = {}): BenchmarkOptions {
  return {mode:'simulated',model:trialModel,tasks:taskBank.map(t=>t.id),condition:'standard',policy:'continue-model-failures',outputDirectory:root,
    transport:id=>offlineTransport(id,'standard'),...overrides};
}
test('benchmark bank: five distinct broken seeds and meaningful host oracles', async () => {
  assert.equal(taskBank.length, 5); assert.equal(new Set(taskBank.map(t=>t.category)).size, 5);
  for(const task of taskBank) {
    assert.ok(task.cases.length >= 3);
    const f = await benchmarkFixture(task,'standard');
    try {
      const baseline = await readFile(join(f.profile.repository,'src/task.ts'),'utf8');
      const r = await runLiveTask(f.objective,f.profile,trialModel,trialLimits,simulated([verify,finish]),'simulated');
      assert.equal(r.report.classification,'failed',task.id);
      assert.equal(metrics(r,0).outcome,'failure-without-recovery');
      assert.equal(r.report.originalUnchanged,true);
      assert.equal(await readFile(join(f.profile.repository,'src/task.ts'),'utf8'),baseline);
      const feedback = r.report.feedback[0].result as any;
      assert.equal(feedback.accepted,false); assert.equal(feedback.stderr,'');
      assert.equal(feedback.stdout,'Host acceptance did not pass');
      const context = JSON.parse(r.exchanges[1].request.input.split('\n').at(-1)!);
      assert.equal(context.profile,undefined); assert.equal(context.acceptance,undefined);
      assert.doesNotMatch(r.exchanges[1].request.input,/deepStrictEqual|expected|AssertionError/);
    } finally { await f.cleanup(); }
  }
});
test('benchmark session: five first-pass successes, complete evidence, exact totals and exclusive output', async () => {
  const report = await runBenchmark(options());
  assert.deepEqual(report.denominators,{selected:5,attempted:5,verified:5,firstPass:5,recovered:0});
  assert.equal(report.stopReason,'completed'); assert.deepEqual(report.notRun,[]);
  assert.equal(report.totals.turns,30); assert.equal(report.totals.verifications,5);
  assert.equal(report.totals.inputTokens,3000); assert.equal(report.totals.outputTokens,3000);
  assert.ok(Math.abs(report.totals.estimatedUSD-0.006)<1e-10);
  for(const row of report.results) {
    const path = join(report.directory,row.evidence);
    const raw = await readFile(path,'utf8'); const evidence=JSON.parse(raw);
    assert.equal((await stat(path)).mode & 0o777,0o600);
    assert.equal(row.metrics.outcome,'first-pass-success'); assert.equal(row.metrics.revisionIntegrity,true);
    assert.equal(row.metrics.originalSourcePreserved,true); assert.ok(row.metrics.durationMs>0);
    assert.ok(evidence.record.report.patch); assert.equal(row.specificationSHA256.length,64);
    assert.ok(evidence.record.exchanges.every((e:any)=>e.response&&e.action&&e.request));
    assert.equal(evidence.record.report.profile.acceptance.length,getTask(row.taskId).cases.length);
  }
  const again = await runBenchmark(options({tasks:['bounded-integer']}));
  assert.notEqual(report.directory,again.directory);
  assert.deepEqual(JSON.parse(await readFile(join(report.directory,'report.json'),'utf8')),report);
});
test('benchmark recovery: failed acceptance, changed revision, pass; replay stays explicitly non-independent', async () => {
  const report = await runBenchmark(options({tasks:['bounded-integer'],condition:'recovery',transport:id=>offlineTransport(id,'recovery')}));
  const row=report.results[0]; assert.equal(row.metrics.outcome,'recovered-success'); assert.equal(row.metrics.firstPassSuccess,false);
  assert.equal(row.metrics.recoveryConditionFollowed,true); assert.equal(row.metrics.verificationAttempts,2);
  const {record}=JSON.parse(await readFile(join(report.directory,row.evidence),'utf8'));
  const f=await benchmarkFixture(getTask('bounded-integer'),'recovery');
  try { const r=await replay(record,f.profile); assert.equal(r.independentReproduction,false); assert.equal(r.report.classification,'verified'); }
  finally { await f.cleanup(); }
});
test('benchmark terminal classifications: failure, budget, protocol, infrastructure and accounting', async () => {
  const samples = [
    [await run([finish]),'failure-without-recovery'],
    [await run([write],p=>{p.maxTurns=1;}),'budget-exhaustion'],
    [await run([verify,verify],p=>{p.maxVerifications=1;}),'budget-exhaustion'],
    [await run(['not json']),'protocol-failure'],
    [await run([a('shell.run')]),'protocol-failure'],
    [await run([],undefined,{count:async()=>100,generate:async()=>{throw Error('synthetic transport');}}),'infrastructure-failure'],
    [await run([],undefined,{count:async()=>NaN,generate:async()=>{throw Error('must not run');}}),'accounting-failure'],
    [await run([],undefined,{count:async()=>100,generate:async()=>({})}),'accounting-failure'],
  ] as const;
  for(const [record,outcome] of samples) { assert.equal(metrics(record,0).outcome,outcome,record.report.reason); assert.equal(metrics(record,0).verified,false); }
  assert.equal(metrics(samples[3][0],0).rejectedActions,1);
});
test('benchmark rejects unauthorized writes and stale verification; integrity failure cannot be success', async () => {
  const r=await run([a('workspace.write',{path:'../escape',content:'bad'}),write,verify,a('workspace.write',{path:'src/task.ts',content:solutions['bounded-integer']+'\n'}),finish]);
  assert.equal(metrics(r,0).rejectedActions,1); assert.equal(metrics(r,0).verified,false);
  const valid=await run([write,verify,finish]); valid.report.originalUnchanged=false;
  assert.equal(metrics(valid,0).outcome,'integrity-failure'); assert.equal(metrics(valid,0).verified,false);
  valid.report.originalUnchanged=true;
  const check=valid.report.feedback.find(f=>f.capability==='verification.sandbox.run')!;
  check.result={status:'unavailable',accepted:false};
  assert.equal(metrics(valid,0).outcome,'infrastructure-failure'); assert.equal(metrics(valid,0).verified,false);
});
test('benchmark host policies: continue model failure, stop failure, always stop protocol/accounting failure', async () => {
  for(const [policy,action,count] of [['continue-model-failures',finish,2],['stop-on-failure',finish,1],['continue-model-failures','bad JSON',1]] as const) {
    const r=await runBenchmark(options({tasks:['bounded-integer','group-totals'],policy,transport:()=>simulated([action])}));
    assert.equal(r.denominators.attempted,count); assert.equal(r.notRun.length,2-count);
  }
  const r=await runBenchmark(options({transport:()=>({count:async()=>NaN,generate:async()=>{throw Error();}})}));
  assert.equal(r.denominators.attempted,1); assert.equal(r.stopReason,'accounting-failure');
});
test('benchmark session admission enforces every cumulative budget before requesting inference', async () => {
  for(const [key,value] of Object.entries({tasks:1,turns:12,verifications:3,inputTokens:30000,outputTokens:12000,reservedUSD:0.04,durationMs:120000})) {
    const r=await runBenchmark(options({sessionLimits:{...sessionDefaults,[key]:value}}));
    assert.ok(r.denominators.attempted<=1,key); assert.equal(r.stopReason,'session-budget-exhaustion');
    assert.equal(r.notRun.length,5-r.denominators.attempted);
  }
});
test('benchmark preflight rejects unknown tasks/model, duplicate tasks and invalid recovery before transport', async () => {
  let calls=0; const transport=()=>{calls++;return simulated([finish]);};
  for(const override of [{model:'unknown'},{tasks:['missing']},{tasks:['bounded-integer','bounded-integer']},{condition:'recovery' as const},{sessionLimits:{...sessionDefaults,turns:NaN}}]) {
    await assert.rejects(runBenchmark(options({...override,transport})));
  }
  assert.equal(calls,0);
});
test('benchmark oracle rejects mutation even when returned values are correct', async () => {
  const f=await benchmarkFixture(getTask('group-totals'),'standard');
  try {
    const source=solutions['group-totals'].replace('return [...m].map(([key,total])=>({key,total}));','const result=[...m].map(([key,total])=>({key,total})); rows.length=0; return result;');
    const r=await runLiveTask(f.objective,f.profile,trialModel,trialLimits,simulated([a('workspace.write',{path:'src/task.ts',content:source}),verify,finish]),'simulated');
    assert.equal(r.report.classification,'failed'); assert.equal((r.report.feedback[1].result as any).accepted,false);
  } finally { await f.cleanup(); }
});
test('benchmark unexpected host failure is retained and stops the session', async () => {
  const r=await runBenchmark(options({transport:()=>{throw Error('private host details');}}));
  assert.equal(r.stopReason,'infrastructure-failure'); assert.equal(r.denominators.attempted,1);
  assert.equal(r.results[0].metrics.tokens.reliable,false); assert.doesNotMatch(JSON.stringify(r),/private host details/);
  assert.equal(JSON.parse(await readFile(join(r.directory,'manifest.json'),'utf8')).tasks.length,5);
});

test('benchmark session: reconciled provider actuals govern subsequent task admission and metrics', async () => {
  const report = await runBenchmark(options({
    tasks: ['bounded-integer', 'group-totals'],
    sessionLimits: { ...sessionDefaults, inputTokens: trialLimits.inputTokens + 100 },
    transport: () => {
      const t = simulated([finish]);
      return { count: t.count, generate: async (...args) => {
        const response = await t.generate(...args) as any;
        response.usage.input_tokens = 123;
        return response;
      } };
    },
  }));
  assert.equal(report.stopReason, 'session-budget-exhaustion');
  assert.equal(report.denominators.attempted, 1);
  assert.deepEqual(report.notRun, ['group-totals']);
  assert.deepEqual(report.results[0].metrics.tokens, { input: 123, output: 100, reliable: true });
  assert.equal(report.totals.inputTokens, 123);
  assert.equal(report.totals.outputTokens, 100);
  assert.equal(report.totals.estimatedUSD, (123 * 0.4 + 100 * 1.6) / 1e6);
  assert.equal(report.totals.reservedUSD, (100 * 0.4 + 1500 * 1.6) / 1e6);
});
