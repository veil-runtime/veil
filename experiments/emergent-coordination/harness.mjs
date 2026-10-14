import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScriptedPolicy } from './scripted-policy.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const limits = Object.freeze({ activations: 48, proposals: 12, messages: 24, bodyCharacters: 256 });
const participantIds = ['p0', 'p1', 'p2'];
let namespaceCounter = 0;

function random(seed) {
  let value = seed >>> 0 || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
function shuffled(values, next) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export async function runTrial({ seed, condition = 'distributed', fault = 'none', messages = true,
  policyFactory = createScriptedPolicy, onEvent = () => {} }) {
  if (!Number.isSafeInteger(seed) || seed < 1 || !['fixed', 'central-adaptive', 'distributed'].includes(condition) ||
      !['none', 'primary-failure', 'unknown-release'].includes(fault) || typeof messages !== 'boolean') {
    throw new Error('Invalid trial configuration');
  }
  const trialId = `${condition}-${fault}-${messages ? 'messages' : 'no-messages'}-${seed}`;
  // Opaque to participants: fault, condition and seed must not appear in discovery.
  const prefix = `exp005.session${++namespaceCounter}`;
  const next = random(seed);
  const [extractor, primary, finisher] = shuffled(participantIds, next);
  const assignment = { extract: extractor, primary, alternative: finisher, release: finisher };
  const publicKind = { extract: 'extract', primary: 'refineA', alternative: 'refineB', release: 'release' };
  const names = Object.fromEntries(Object.keys(assignment).map(kind => [kind, `${prefix}.${publicKind[kind]}`]));
  const trace = [];
  const record = (type, data = {}) => {
    const event = clone({ seq: trace.length, type, ...data });
    trace.push(event); onEvent(event);
  };
  const world = { raw: `specimen-${seed}`, released: false, effects: [], injected: false };
  let currentProposal = null;
  const originalCwd = process.cwd();
  const originalStore = process.env.JOB_STORE;
  const temporary = await mkdtemp(join(tmpdir(), 'veil-coordination-'));
  process.chdir(temporary);
  process.env.JOB_STORE = 'memory';
  try {
    const { OperatorRuntime, isPlanAdmissionError } = await import('../../.tmp/test-build/src/index.js');
    const scopes = Object.fromEntries(participantIds.map(id => [id, Object.entries(assignment)
      .filter(([, owner]) => owner === id).map(([kind]) => `execute:${names[kind]}`)]));
    const runtime = new OperatorRuntime({ planVersions: ['2.0'], authorizer: {
      async authorize(context) {
        const subject = context.caller?.subject;
        const allowed = participantIds.includes(subject) &&
          context.caller?.scopes?.includes(`execute:${context.capability.name}`) &&
          scopes[subject].includes(`execute:${context.capability.name}`);
        record('authorization', { participant: subject ?? null, proposalId: currentProposal, capability: context.capability.name,
          input: context.input, callerScopes: context.caller?.scopes ?? [], decision: allowed ? 'allow' : 'deny' });
        return allowed ? { decision: 'allow' } : { decision: 'deny', reason: 'Host-owned scope denied' };
      },
    } });
    const field = description => ({ type: 'string', required: true, description });
    const capabilities = [
      { name: names.extract, version: '1', risk: 'read', description: 'Extract source value',
        inputSchema: {}, async execute(input, context) {
          record('capability-entry', { participant: context.caller.subject, proposalId: currentProposal, capability: names.extract, input });
          const effect = { participant: context.caller.subject, proposalId: currentProposal, kind: 'extract', value: world.raw };
          world.effects.push(effect); record('effect', effect);
          return { raw: world.raw };
        } },
      ...['primary', 'alternative'].map(kind => ({ name: names[kind], version: '1', risk: 'write',
        description: 'Refine a raw source value', inputSchema: { raw: field('Raw source value') },
        async execute(input, context) {
          record('capability-entry', { participant: context.caller.subject, proposalId: currentProposal, capability: names[kind], input });
          if (kind === 'primary' && fault === 'primary-failure' && !world.injected) {
            world.injected = true; record('failure-injected', { participant: context.caller.subject, kind });
            throw new Error('Primary provider unavailable before effect');
          }
          if (input.raw !== world.raw) throw new Error('Invalid source value before effect');
          const refined = `sealed:${input.raw}`;
          const effect = { participant: context.caller.subject, proposalId: currentProposal, kind, value: refined };
          world.effects.push(effect); record('effect', effect);
          return { refined };
        } })),
      { name: names.release, version: '1', risk: 'write', description: 'Release refined value',
        inputSchema: { refined: field('Refined value') }, async execute(input, context) {
          record('capability-entry', { participant: context.caller.subject, proposalId: currentProposal, capability: names.release, input });
          if (input.refined !== `sealed:${world.raw}` || world.released) throw new Error('Invalid or repeated release before effect');
          world.released = true;
          const effect = { participant: context.caller.subject, proposalId: currentProposal, kind: 'release', value: input.refined };
          world.effects.push(effect); record('effect', effect);
          return { released: true };
        } },
    ];
    runtime.use({ manifest: { name: prefix, version: '1', capabilities: Object.values(names) }, capabilities });
    const local = Object.fromEntries(participantIds.map(id => [id, {
      descriptors: runtime.listCapabilities().filter(item => scopes[id].includes(`execute:${item.name}`)), inbox: [], receipts: [],
      policy: policyFactory(),
    }]));
    let proposals = 0;
    let messageCount = 0;
    const usedIds = new Set();
    async function submit(participant, action, origin) {
      if (proposals >= limits.proposals) throw new Error('Proposal limit');
      const key = `${participant}:${action.proposalId}`;
      if (!/^p[0-9]+$/.test(action.proposalId) || usedIds.has(key)) throw new Error('Invalid or repeated proposal identifier');
      usedIds.add(key); proposals++;
      const raw = action.plan;
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.steps) || raw.steps.length !== 1 ||
          JSON.stringify(raw).length > 4096) throw new Error('Invalid bounded proposal');
      // Only structural plan fields cross the boundary. Caller/scopes are always host-owned.
      const step = raw.steps[0];
      const plan = clone({ version: raw.version, steps: [{ id: step?.id, capability: step?.capability,
        ...(step?.capabilityVersion === undefined ? {} : { capabilityVersion: step.capabilityVersion }),
        ...(step?.input === undefined ? {} : { input: step.input }) }] });
      record('proposal', { participant, origin, proposalId: action.proposalId, submitted: plan,
        droppedAuthority: Object.hasOwn(raw, 'caller') || Object.hasOwn(raw, 'scopes') ||
          Object.hasOwn(action, 'caller') || Object.hasOwn(action, 'scopes') });
      let receipt;
      currentProposal = action.proposalId;
      try {
        const job = await runtime.executePlan(plan, { caller: { subject: participant, scopes: scopes[participant] } });
        record('admission', { participant, proposalId: action.proposalId, outcome: 'passed', observed: 'after-job-return' });
        const outcome = job.status === 'completed' ? 'SUCCESS' : job.events.some(event => event.type === 'capability.denied') ? 'DENIED' : 'FAILED';
        receipt = { proposalId: action.proposalId, capability: step.capability, outcome,
          ...(outcome === 'SUCCESS' ? { result: clone(job.steps[0].result) } : {}),
          ...(job.steps[0].error ? { error: job.steps[0].error } : {}),
          events: job.events.map(event => event.type) };
        if (outcome === 'SUCCESS' && step.capability === names.release && fault === 'unknown-release') {
          receipt = { proposalId: action.proposalId, capability: step.capability, outcome: 'UNKNOWN',
            reason: 'Completed outcome delivery lost; effect uncertain' };
          record('receipt-loss-injected', { participant, proposalId: action.proposalId });
        }
      } catch (error) {
        if (!isPlanAdmissionError(error)) {
          receipt = { proposalId: action.proposalId, capability: step.capability, outcome: 'UNKNOWN',
            reason: 'Runtime result unavailable; effect uncertain' };
        } else {
          record('admission', { participant, proposalId: action.proposalId, outcome: 'rejected', code: error.code });
          receipt = { proposalId: action.proposalId, capability: step.capability, outcome: 'REJECTED',
            code: error.code, issues: error.issues.map(({ code, stepIndex, field }) => ({ code, stepIndex, field })) };
        }
      }
      currentProposal = null;
      record('receipt', { participant, receipt });
      local[participant].receipts.push(clone(receipt));
      return receipt;
    }
    let stop = 'incomplete-limit';
    try {
    if (condition !== 'distributed') {
      const origin = condition === 'fixed' ? 'fixed-central-script' : 'adaptive-central-script';
      let id = 1;
      const central = (participant, kind, input) => {
        const action = { type: 'submit', proposalId: `p${id++}`, plan: { version: '2.0', steps: [
          { id: 's', capability: names[kind], capabilityVersion: '1', input },
        ] } };
        record('decision', { origin, participant, action });
        return submit(participant, action, origin);
      };
      const extracted = await central(extractor, 'extract', {});
      if (extracted.outcome === 'SUCCESS') {
        const refined = await central(primary, 'primary', { raw: extracted.result.raw });
        const chosen = refined.outcome !== 'SUCCESS' && condition === 'central-adaptive' && refined.outcome === 'FAILED'
          ? await central(finisher, 'alternative', { raw: extracted.result.raw }) : refined;
        if (chosen.outcome === 'SUCCESS') await central(finisher, 'release', { refined: chosen.result.refined });
      }
      stop = 'central-sequence-ended';
    } else {
      const idleParticipants = new Set();
      let order = participantIds;
      for (let tick = 0; tick < limits.activations; tick++) {
        const round = Math.floor(tick / participantIds.length);
        if (tick % participantIds.length === 0) order = shuffled(participantIds, next);
        const participant = order[tick % participantIds.length];
        const state = local[participant];
        const observation = clone({ tick, objective: 'Release the refined source value',
          capabilities: state.descriptors, inbox: state.inbox, receipts: state.receipts });
        state.inbox = []; state.receipts = [];
        record('activation', { tick, round, participant, observation });
        const action = clone(state.policy(observation));
        record('decision', { tick, participant, origin: 'scripted-participant', action });
        if (action.type === 'idle') {
          idleParticipants.add(participant);
        } else if (action.type === 'send') {
          idleParticipants.clear();
          const serialized = JSON.stringify(action.body);
          if (action.to !== 'all' || !serialized || serialized.length > limits.bodyCharacters || messageCount >= limits.messages) {
            throw new Error('Invalid or over-budget message');
          }
          messageCount++;
          if (!messages) {
            record('message-blocked', { tick, from: participant, body: action.body });
            continue;
          }
          for (const receiver of participantIds.filter(id => id !== participant)) {
            local[receiver].inbox.push(clone({ from: participant, body: action.body }));
            record('message-queued', { tick, from: participant, to: receiver, body: action.body });
          }
        } else if (action.type === 'submit') {
          idleParticipants.clear();
          await submit(participant, action, 'scripted-participant');
        } else throw new Error('Invalid participant action');
        if (idleParticipants.size === participantIds.length &&
            participantIds.every(id => !local[id].inbox.length && !local[id].receipts.length)) {
          stop = 'quiescent'; break;
        }
      }
    }
    } catch (error) {
      record('trial-error', { category: error instanceof Error ? error.message : 'Unknown protocol error' });
      stop = 'protocol-abort';
    }
    return clone({ trialId, namespace: prefix, seed, condition, fault, messages, policy: 'scripted-infrastructure-baseline',
      assignment, limits, stop, trace, privateWorld: world });
  } finally {
    process.chdir(originalCwd);
    if (originalStore === undefined) delete process.env.JOB_STORE;
    else process.env.JOB_STORE = originalStore;
    await rm(temporary, { recursive: true, force: true });
  }
}
