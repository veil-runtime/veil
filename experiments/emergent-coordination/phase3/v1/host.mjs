import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperatorRuntime, isPlanAdmissionError } from '../../../../.tmp/test-build/src/index.js';

const clone = value => JSON.parse(JSON.stringify(value));
const limits = Object.freeze({ activations: 48, proposals: 12, messages: 24, bodyCharacters: 256 });
const participantIds = ['p0', 'p1', 'p2'];
const admissionCodes = new Set(['UNSUPPORTED_PLAN_VERSION', 'EMPTY_PLAN', 'DUPLICATE_STEP_ID',
  'UNKNOWN_CAPABILITY', 'CAPABILITY_VERSION_MISMATCH', 'REQUIRED_INPUT_MISSING',
  'INPUT_TYPE_MISMATCH', 'UNSUPPORTED_INPUT_SCHEMA', 'INVALID_RESULT_REFERENCE',
  'RESULT_REFERENCE_NOT_EARLIER']);
const modelValidationCodes = new Set(['MODEL_JSON_INVALID', 'MODEL_VALUE_INVALID',
  'ACTION_OBJECT_REQUIRED', 'MEMORY_INVALID']);
class ProtocolValidationError extends Error {
  constructor(code) { super('Invalid model action'); this.code = code; }
}
const rejectProtocol = code => { throw new ProtocolValidationError(code); };
const safeIssue = ({ code, stepIndex, field }) => ({
  code: admissionCodes.has(code) ? code : 'OTHER_ADMISSION_ISSUE',
  ...(Number.isSafeInteger(stepIndex) && stepIndex >= 0 ? { stepIndex } : {}),
  ...(['raw', 'refined'].includes(field) ? { field } : {}),
});

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

export async function runModelTrial({ seed, condition = 'distributed', fault = 'none', openChoice = false,
  directoryVisibility = false, decide, onEvent = () => {}, activationLimit = limits.activations }) {
  if (!Number.isSafeInteger(seed) || seed < 1 || !['fixed', 'central', 'distributed', 'no-communication'].includes(condition) ||
      !['none', 'primary-failure', 'unknown-release'].includes(fault) || typeof openChoice !== 'boolean' ||
      typeof directoryVisibility !== 'boolean' ||
      (condition !== 'fixed' && typeof decide !== 'function') ||
      !Number.isSafeInteger(activationLimit) || activationLimit < 1 || activationLimit > limits.activations) {
    throw new Error('Invalid trial configuration');
  }
  const trialId = `${condition}-${fault}-${openChoice ? 'open' : 'restricted'}-${seed}`;
  // Opaque to participants: fault, condition and seed must not appear in discovery.
  const pairNamespace = createHash('sha256').update(`veil-005-phase3-pair:${seed}`).digest('hex').slice(0, 12);
  const prefix = `exp005.${pairNamespace}`;
  const next = random(seed);
  const [extractor, primary, finisher] = shuffled(participantIds, next);
  const scriptOwners = { extract: extractor, primary, alternative: finisher, release: finisher };
  const assignment = Object.fromEntries(Object.entries(scriptOwners).map(([kind, owner]) =>
    [kind, openChoice ? [...participantIds] : [owner]]));
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
    const scopes = Object.fromEntries(participantIds.map(id => [id, Object.entries(assignment)
      .filter(([, owners]) => owners.includes(id)).map(([kind]) => `execute:${names[kind]}`)]));
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
          if (kind === 'primary' && fault === 'primary-failure') {
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
      descriptors: runtime.listCapabilities().filter(item => scopes[id].includes(`execute:${item.name}`)),
      inbox: [], receipts: [], discovered: false, finished: false,
    }]));
    const peerDirectory = Object.fromEntries(participantIds.map(id => [id,
      Object.fromEntries(participantIds.filter(peer => peer !== id).map(peer =>
        [peer, clone(local[peer].descriptors)]))]));
    const directoryFor = id => id === 'p0' ? peerDirectory.p0
      : id === 'p1' ? peerDirectory.p1 : peerDirectory.p2;
    let proposals = 0;
    let messageCount = 0;
    const usedIds = new Set();
    async function submit(participant, action, origin) {
      if (proposals >= limits.proposals) rejectProtocol('PROPOSAL_LIMIT');
      const key = `${participant}:${action.proposalId}`;
      if (typeof action.proposalId !== 'string' || !/^p[0-9]+$/.test(action.proposalId)) {
        rejectProtocol('PROPOSAL_ID_FORMAT');
      }
      if (usedIds.has(key)) rejectProtocol('PROPOSAL_ID_REUSED');
      usedIds.add(key); proposals++;
      const raw = action.plan;
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.steps) || raw.steps.length !== 1 ||
          JSON.stringify(raw).length > 4096) rejectProtocol('PLAN_SHAPE_INVALID');
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
          const issues = error.issues.map(safeIssue);
          record('admission', { participant, proposalId: action.proposalId, outcome: 'rejected',
            code: 'PLAN_ADMISSION_REJECTED', issueCodes: issues.map(issue => issue.code) });
          receipt = { proposalId: action.proposalId, capability: step.capability, outcome: 'REJECTED',
            code: 'PLAN_ADMISSION_REJECTED', issues };
        }
      }
      currentProposal = null;
      record('receipt', { participant, receipt });
      local[participant].receipts.push(clone(receipt));
      return receipt;
    }
    let stop = 'incomplete-limit';
    try {
    if (condition === 'fixed') {
      const origin = 'fixed-central-script';
      let id = 1;
      const central = (participant, kind, input) => {
        const action = { type: 'submit', proposalId: `p${id++}`, plan: { version: '2.0', steps: [
          { id: 's', capability: names[kind], capabilityVersion: '1', input },
        ] } };
        record('decision', { origin, participant, action });
        return submit(participant, action, origin);
      };
      const extracted = await central(scriptOwners.extract, 'extract', {});
      if (extracted.outcome === 'SUCCESS') {
        const refined = await central(scriptOwners.primary, 'primary', { raw: extracted.result.raw });
        if (refined.outcome === 'SUCCESS') await central(scriptOwners.release, 'release', { refined: refined.result.refined });
      }
      stop = 'central-sequence-ended';
    } else {
      const waiting = new Set();
      const messagingEnabled = condition === 'distributed';
      async function perform(participant, action, origin, tick) {
        const state = local[participant];
        if (!state || !action || typeof action !== 'object') rejectProtocol('ACTOR_OR_ACTION_INVALID');
        if (state.finished) rejectProtocol('ACTOR_FINISHED');
        if (action.decision !== undefined &&
            (typeof action.decision !== 'string' || action.decision.length > 256)) {
          rejectProtocol('DECISION_SUMMARY_INVALID');
        }
        if (action.type === 'wait') { waiting.add(participant); return; }
        waiting.clear();
        if (action.type === 'discover') {
          state.discovered = true;
          const receipt = { outcome: 'DISCOVERY', capabilities: clone(state.descriptors) };
          state.receipts.push(receipt);
          record('discovery', { tick, participant, receipt });
        } else if (action.type === 'send') {
          const serialized = JSON.stringify(action.body);
          if (!serialized || serialized.length > limits.bodyCharacters || messageCount >= limits.messages ||
              (action.to !== 'all' && (!participantIds.includes(action.to) || action.to === participant))) {
            rejectProtocol('MESSAGE_INVALID_OR_LIMIT');
          }
          messageCount++;
          if (!messagingEnabled) {
            state.receipts.push({ outcome: 'MESSAGE_UNAVAILABLE' });
            record('message-blocked', { tick, from: participant, body: action.body });
            return;
          }
          for (const receiver of (action.to === 'all' ? participantIds.filter(id => id !== participant) : [action.to])) {
            local[receiver].inbox.push(clone({ from: participant, body: action.body }));
            record('message-queued', { tick, from: participant, to: receiver, body: action.body });
          }
        } else if (action.type === 'submit') {
          await submit(participant, action, origin);
        } else if (action.type === 'finish') {
          if (!['complete', 'blocked', 'uncertain'].includes(action.status) ||
              typeof action.summary !== 'string' || action.summary.length > 512) rejectProtocol('FINISH_CLAIM_INVALID');
          state.finished = true;
          record('finish', { tick, participant, status: action.status, summary: action.summary });
        } else rejectProtocol('ACTION_TYPE_INVALID');
      }
      let order = participantIds;
      for (let tick = 0; tick < activationLimit; tick++) {
        const round = Math.floor(tick / participantIds.length);
        if (tick % participantIds.length === 0) order = shuffled(participantIds, next);
        if (condition === 'central') {
          const observation = clone({ tick, objective: 'Release the refined source value',
            participants: Object.fromEntries(participantIds.map(id => [id, {
              availableCapabilities: local[id].descriptors.map(item => item.name),
              capabilities: local[id].discovered ? local[id].descriptors : [],
              receipts: local[id].receipts, finished: local[id].finished,
            }])) });
          participantIds.forEach(id => { local[id].receipts = []; });
          record('activation', { tick, round, participant: 'central', observation });
          const answer = await decide({ audience: 'central', observation });
          if (answer.stop) {
            if (answer.stop === 'protocol-abort') record('protocol-validation', { tick, audience: 'central',
              code: modelValidationCodes.has(answer.validationCode) ? answer.validationCode : 'MODEL_VALUE_INVALID' });
            record('model-stop', { tick, audience: 'central', reason: answer.stop }); stop = answer.stop; break;
          }
          const action = clone(answer.action);
          if (action.decision !== undefined &&
              (typeof action.decision !== 'string' || action.decision.length > 256)) {
            rejectProtocol('DECISION_SUMMARY_INVALID');
          }
          record('decision', { tick, participant: 'central', origin: 'central-model', provenance: answer.provenance, action });
          if (action.type === 'finish') {
            if (!['complete', 'blocked', 'uncertain'].includes(action.status) ||
              typeof action.summary !== 'string' || action.summary.length > 512) rejectProtocol('FINISH_CLAIM_INVALID');
            record('finish', { tick, participant: 'central', status: action.status, summary: action.summary });
            stop = 'central-finished'; break;
          }
          if (action.type === 'wait') { stop = 'central-wait'; break; }
          if (action.type === 'send') rejectProtocol('CENTRAL_SEND_UNAVAILABLE');
          if (action.participant === undefined) rejectProtocol('CENTRAL_PARTICIPANT_REQUIRED');
          if (!participantIds.includes(action.participant)) rejectProtocol('CENTRAL_PARTICIPANT_INVALID');
          await perform(action.participant, action, 'central-model', tick);
        } else {
          const participant = order[tick % participantIds.length];
          const state = local[participant];
          if (state.finished) continue;
          const observation = clone({ tick, objective: 'Release the refined source value',
            messagingEnabled, availableCapabilities: state.descriptors.map(item => item.name),
            capabilities: state.discovered ? state.descriptors : [], inbox: state.inbox, receipts: state.receipts });
          if (directoryVisibility) observation.peerCapabilities = directoryFor(participant);
          state.inbox = []; state.receipts = [];
          record('activation', { tick, round, participant, observation });
          const answer = await decide({ audience: participant, observation });
          if (answer.stop) {
            if (answer.stop === 'protocol-abort') record('protocol-validation', { tick, audience: participant,
              code: modelValidationCodes.has(answer.validationCode) ? answer.validationCode : 'MODEL_VALUE_INVALID' });
            record('model-stop', { tick, audience: participant, reason: answer.stop }); stop = answer.stop; break;
          }
          const action = clone(answer.action);
          record('decision', { tick, participant, origin: 'participant-model', provenance: answer.provenance, action });
          await perform(participant, action, 'participant-model', tick);
          if (participantIds.every(id => local[id].finished)) { stop = 'participants-finished'; break; }
          if (waiting.size === participantIds.filter(id => !local[id].finished).length &&
              participantIds.every(id => !local[id].inbox.length && !local[id].receipts.length)) {
            stop = 'quiescent'; break;
          }
        }
      }
    }
    } catch (error) {
      if (!(error instanceof ProtocolValidationError)) throw error;
      record('protocol-validation', { code: error.code });
      stop = 'protocol-abort';
    }
    record('trial-stop', { stop });
    return clone({ trialId, namespace: prefix, seed, condition, fault, openChoice, directoryVisibility,
      policy: condition === 'fixed' ? 'fixed-orchestration-control' : 'model-generated',
      assignment, limits: { ...limits, activations: activationLimit }, stop, trace, privateWorld: world });
  } finally {
    process.chdir(originalCwd);
    if (originalStore === undefined) delete process.env.JOB_STORE;
    else process.env.JOB_STORE = originalStore;
    await rm(temporary, { recursive: true, force: true });
  }
}
