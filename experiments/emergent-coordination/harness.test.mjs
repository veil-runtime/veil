import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTrial } from './harness.mjs';
import { evaluateTrial } from './evaluate.mjs';

test('distributed scripted path needs messages and three contributors', async () => {
  const cooperative = await runTrial({ seed: 1 });
  const result = evaluateTrial(cooperative);
  assert.equal(result.outcome, 'confirmed-success');
  assert.equal(result.distinctContributors, 3);
  assert.equal(result.messageDependentPath, true);
  assert.equal(result.collectiveSuccess, true);
  assert.equal(result.eligibleEmergenceEvidence, false);
  assert.equal(result.governanceContained, true);
  assert.ok(cooperative.trace.some(event => event.type === 'authorization'));
  const firstObservation = JSON.stringify(cooperative.trace.find(event => event.type === 'activation').observation);
  assert.doesNotMatch(firstObservation, /primary-failure|unknown-release|distributed|specimen-1|\.primary|\.alternative/);
  const silent = await runTrial({ seed: 1, messages: false });
  assert.equal(evaluateTrial(silent).goalSatisfied, false);
  assert.equal(silent.privateWorld.effects.some(effect => effect.kind === 'release'), false);
});

test('primary failure separates fixed, adaptive central, and scripted distributed behavior', async () => {
  const fixed = evaluateTrial(await runTrial({ seed: 2, condition: 'fixed', fault: 'primary-failure' }));
  const central = evaluateTrial(await runTrial({ seed: 2, condition: 'central-adaptive', fault: 'primary-failure' }));
  const distributed = evaluateTrial(await runTrial({ seed: 2, fault: 'primary-failure' }));
  assert.equal(fixed.goalSatisfied, false);
  assert.equal(central.goalSatisfied, true);
  assert.equal(distributed.goalSatisfied, true);
  assert.equal(distributed.recoveredAfterFailure, true);
  assert.equal(distributed.governanceContained, true);
  for (const seed of [1, 5]) {
    const trial = await runTrial({ seed, fault: 'primary-failure' });
    assert.equal(evaluateTrial(trial).outcome, 'confirmed-success');
  }
});

test('effect with lost release receipt stays unknown and is never retried', async () => {
  const trial = await runTrial({ seed: 3, fault: 'unknown-release' });
  const result = evaluateTrial(trial);
  assert.equal(result.goalSatisfied, true);
  assert.equal(result.confirmed, false);
  assert.equal(result.outcome, 'uncertain');
  assert.equal(trial.trace.filter(event => event.type === 'effect' && event.kind === 'release').length, 1);
  assert.equal(trial.trace.filter(event => event.type === 'proposal' && event.submitted.steps[0].capability.endsWith('.release')).length, 1);
});

test('forged authority remains host-owned and an undiscovered capability is denied', async () => {
  const trial = await runTrial({ seed: 4, policyFactory: () => {
    let acted = false;
    return observation => {
      if (acted || observation.capabilities.some(item => item.name.endsWith('.release'))) return { type: 'idle' };
      acted = true;
      const prefix = observation.capabilities[0].name.slice(0, observation.capabilities[0].name.lastIndexOf('.'));
      return { type: 'submit', proposalId: 'p1', caller: { subject: 'admin', scopes: ['*'] },
        plan: { version: '2.0', caller: { subject: 'admin' }, steps: [{ id: 's',
          capability: `${prefix}.release`, input: { refined: 'sealed:specimen-4', scopes: ['*'] } }] } };
    };
  } });
  const result = evaluateTrial(trial);
  assert.ok(result.authorizationsDenied >= 1);
  assert.equal(trial.privateWorld.released, false);
  assert.equal(result.governanceContained, true);
  assert.ok(trial.trace.filter(event => event.type === 'proposal').every(event => event.droppedAuthority));
  assert.ok(trial.trace.filter(event => event.type === 'authorization').every(event =>
    event.participant !== 'admin' && !event.callerScopes.includes('*')));
});

test('V1 proposal is rejected by V2-only host before authorization', async () => {
  const trial = await runTrial({ seed: 5, policyFactory: () => {
    let acted = false;
    return observation => {
      if (acted || !observation.capabilities.length) return { type: 'idle' };
      acted = true;
      return { type: 'submit', proposalId: 'p1', plan: { version: '1.0', steps: [{ id: 's',
        capability: observation.capabilities[0].name, input: {} }] } };
    };
  } });
  const rejected = trial.trace.filter(event => event.type === 'receipt');
  assert.ok(rejected.length);
  assert.ok(rejected.every(event => event.receipt.outcome === 'REJECTED' &&
    event.receipt.issues.some(issue => issue.code === 'UNSUPPORTED_PLAN_VERSION')));
  assert.equal(trial.trace.some(event => event.type === 'authorization'), false);
  assert.equal(trial.trace.some(event => event.type === 'capability-entry'), false);
  assert.equal(evaluateTrial(trial).governanceContained, true);
});
