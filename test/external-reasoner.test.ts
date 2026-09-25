import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

test('external reasoner fixture rejects rich graphs before runtime entry', () => {
  execFileSync(process.execPath, ['--test', 'experiments/external-reasoner/passive.test.mjs'], { encoding: 'utf8', env: {} });
});
for (const prefix of ['fixture.records', 'different.discovered.surface']) {
  test(`external reasoner discovers and remains governed: ${prefix}`, () => {
    const output = execFileSync(process.execPath, ['experiments/external-reasoner/host.mjs',
      prefix], { encoding: 'utf8', timeout: 25000, env: { JOB_STORE: 'memory' } });
    const run = JSON.parse(output);
    assert.equal(run.reasonerExit, 0);
    assert.equal(run.records.locked, 'untouched');
    assert.equal(run.trace.length, 19);
    assert.deepEqual(run.counts, { lookup: 3, update: 6, effects: 5, authorization: 12, total: 9 });
    for (const entry of run.trace) {
      if (['DENIED', 'REJECTED'].includes(entry.feedback.outcome)) {
        assert.equal(entry.after.total, entry.before.total, entry.reasoner.decision);
      }
      for (const auth of entry.veil.filter((e: { phase: string }) => e.phase === 'authorization')) {
        assert.equal(auth.caller.subject, 'fixture-reasoner');
        assert.deepEqual(auth.caller.scopes, ['read:public', 'write:editable']);
      }
    }
    for (const [id, code] of [['p1', 'INPUT_TYPE_MISMATCH'], ['p13', 'CAPABILITY_VERSION_MISMATCH']]) {
      const feedback = run.trace.find((e: any) => e.reasoner.proposalId === id).feedback;
      assert.equal(feedback.code, 'PLAN_ADMISSION_REJECTED');
      assert.equal(feedback.issues[0].code, code);
      assert.equal(Object.hasOwn(feedback, 'reason'), false);
      assert.equal(Object.hasOwn(feedback, 'stack'), false);
    }
    const partial = run.trace.find((e: any) => e.reasoner.decision === 'Exercise partial failure');
    assert.equal(partial.effects.length, 1);
    const repaired = run.trace.find((e: any) => e.reasoner.decision.startsWith('Preserve completed'));
    assert.equal(repaired.after.update - repaired.before.update, 1);
    assert.equal(repaired.after.authorization - repaired.before.authorization, 1);
    const replan = run.trace.find((e: any) => e.reasoner.decision.startsWith('Adapt denial'));
    assert.equal(replan.after.authorization - replan.before.authorization, 1);
    const composed = run.trace.find((e: any) => e.reasoner.decision.startsWith('Compose reference'));
    assert.equal(composed.veil.filter((e: any) => e.phase === 'authorization')[1].input.resource, 'editable');
    const uncertain = run.trace.find((e: any) => e.feedback.outcome === 'UNKNOWN');
    assert.equal(uncertain.effects.length, 1);
    assert.equal(run.trace.filter((e: any) => e.effects.some((x: any) => x.value === 'first-part')).length, 1);
    assert.ok(run.trace.some((e: any) => e.feedback.outcome === 'FAILED' && e.effects[0]?.operation === 'lookup'));
  });
}
