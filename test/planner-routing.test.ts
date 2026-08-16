import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DefaultPlannerRouter } from '../src/runtime/planner/default-planner-router.js';
import { OperatorRuntime } from '../src/runtime/operator-runtime.js';
import { PlannerProvider } from '../src/runtime/planner/planner-provider.js';
import { plannerRegistry } from '../src/runtime/planner/planner-registry.js';
import { registerPlannerRouters } from '../src/runtime/planner/register-routers.js';
import { DirectStrategy } from '../src/runtime/planner/strategies/direct-strategy.js';
import { FallbackStrategy } from '../src/runtime/planner/strategies/fallback-strategy.js';

const suffix = `${process.pid}-${Date.now()}`;
const requestedId = `requested-${suffix}`;
const configuredId = `configured-${suffix}`;
const failingId = `failing-${suffix}`;
const ineligibleId = `ineligible-${suffix}`;

function planner(name: string, outcome = name): PlannerProvider {
  return {
    name,
    async plan(goal) {
      if (outcome === 'fail') throw new Error(`${name} failed`);
      return { version: '1.0', goal, metadata: { planner: outcome }, steps: [] };
    },
  };
}

plannerRegistry.register(
  { id: requestedId, type: 'test', enabled: true },
  planner(requestedId, 'requested')
);
plannerRegistry.register(
  { id: ineligibleId, type: 'test', enabled: false },
  planner(ineligibleId)
);
plannerRegistry.register(
  { id: configuredId, type: 'test', enabled: true },
  planner(configuredId, 'configured')
);
plannerRegistry.register(
  { id: failingId, type: 'test', enabled: true },
  planner(failingId, 'fail')
);

test('router honors explicit strategy, explicit planner, and default strategy', async () => {
  const router = new DefaultPlannerRouter('review', 'direct');

  assert.equal((await router.select({ goal: 'x', strategy: 'fallback', planner: requestedId })).strategy, 'fallback');
  assert.equal((await router.select({ goal: 'x', planner: requestedId })).strategy, 'direct');
  assert.equal((await router.select({ goal: 'x' })).strategy, 'review');
});

test('direct strategy uses a requested planner before its configured planner', async () => {
  const strategy = new DirectStrategy('direct-test', configuredId);

  const requested = await strategy.execute({ goal: 'x', planner: requestedId });
  const configured = await strategy.execute({ goal: 'x' });

  assert.equal(requested.metadata?.planner, 'requested');
  assert.equal(configured.metadata?.planner, 'configured');
});

test('direct strategy rejects an ineligible requested planner', async () => {
  const strategy = new DirectStrategy('direct-ineligible-test', configuredId);
  await assert.rejects(
    strategy.execute({ goal: 'x', planner: ineligibleId }),
    /not eligible/
  );
});

test('fallback strategy proceeds after a planner failure', async () => {
  const strategy = new FallbackStrategy('fallback-test', [failingId, configuredId]);
  const plan = await strategy.execute({ goal: 'x' });
  assert.equal(plan.metadata?.planner, 'configured');
});

test('fallback strategy reports all failures', async () => {
  const strategy = new FallbackStrategy('fallback-failure-test', [failingId]);
  await assert.rejects(
    strategy.execute({ goal: 'x' }),
    /No fallback planner succeeded.*failed/
  );
});

test('operator runtime reports an unknown explicit strategy clearly', async () => {
  registerPlannerRouters();
  const runtime = new OperatorRuntime();
  await assert.rejects(
    runtime.run('x', { strategy: `unknown-${suffix}` }),
    /Planner strategy not found/
  );
});
