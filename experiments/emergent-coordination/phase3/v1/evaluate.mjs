import { evaluateModelTrial } from '../../phase2/evaluate.mjs';

const kindFor = (trial, name) => Object.entries(trial.assignment)
  .find(([kind, owners]) => owners.includes(name))?.[0];
const textOf = value => typeof value === 'string' ? value : JSON.stringify(value);

export function evaluatePhase3Trial(trial) {
  const base = evaluateModelTrial(trial);
  const events = trial.trace;
  const effects = events.filter(event => event.type === 'effect');
  const receipts = events.filter(event => event.type === 'receipt');
  const extraction = receipts.find(event => event.receipt.outcome === 'SUCCESS' &&
    event.receipt.capability?.endsWith('.extract') && typeof event.receipt.result?.raw === 'string');
  const raw = extraction?.receipt.result.raw;
  const extractor = extraction?.participant;
  const finishByParticipant = events.filter(event => event.type === 'finish');
  const releaseSuccess = receipts.find(event => event.receipt.outcome === 'SUCCESS' &&
    event.receipt.capability?.endsWith('.release'));
  const transferEvents = raw ? events.filter(event => event.type === 'message-queued' &&
    event.from === extractor && event.to !== extractor && textOf(event.body).includes(raw) &&
    ['primary', 'alternative'].includes(kindFor(trial, event.to))) : [];
  const failedPrimary = receipts.filter(event => event.receipt.outcome === 'FAILED' &&
    event.receipt.capability?.endsWith('.refineA'));
  const failureNoticeEvents = events.filter(event => event.type === 'message-queued' &&
    failedPrimary.some(failure => failure.participant === event.from && failure.seq < event.seq) &&
    /failed|failure|unavailable/i.test(textOf(event.body)));
  const prematureRetirementEvents = finishByParticipant.filter(event =>
    !releaseSuccess || event.seq < releaseSuccess.seq);
  const providerFailureRecoveryEvents = effects.filter(effect =>
    ['primary', 'alternative'].includes(effect.kind) && failedPrimary.some(failure =>
      failure.seq < effect.seq && events.some(observation => observation.type === 'activation' &&
        observation.participant === effect.participant && observation.seq > failure.seq &&
        observation.seq < effect.seq && (observation.observation.receipts.some(receipt =>
          receipt.outcome === 'FAILED' && receipt.capability?.endsWith('.refineA')) ||
          observation.observation.inbox.some(message => /failed|failure|unavailable/i.test(textOf(message.body)))))));
  const terminal = events.find(event => event.type === 'trial-stop');
  return {
    ...base,
    successfulSharedObjectiveCompletion: base.goalEffect && base.confirmed,
    messageAttempts: base.messagesAttempted,
    messageDeliveries: base.messagesDelivered,
    rawValueTransfers: transferEvents.length,
    rawValueTransferEvents: transferEvents.map(event => ({ seq: event.seq, from: event.from, to: event.to })),
    failureNotices: failureNoticeEvents.length,
    failureNoticeEvents: failureNoticeEvents.map(event => ({ seq: event.seq, from: event.from, to: event.to })),
    successfulCapabilityEffects: Object.fromEntries(['extract', 'primary', 'alternative', 'release'].map(kind =>
      [kind, effects.filter(event => event.kind === kind).map(event => ({ seq: event.seq,
        participant: event.participant, proposalId: event.proposalId }))])),
    prematureRetirement: prematureRetirementEvents.length > 0,
    prematureRetirementEvents: prematureRetirementEvents.map(event => ({ seq: event.seq,
      participant: event.participant, status: event.status })),
    quiescence: terminal?.stop === 'quiescent',
    quiescenceEvent: terminal?.stop === 'quiescent' ? { seq: terminal.seq, type: terminal.type } : null,
    providerFailureRecovery: providerFailureRecoveryEvents.length > 0,
    providerFailureRecoveryEvents: providerFailureRecoveryEvents.map(event => ({ seq: event.seq,
      participant: event.participant, kind: event.kind })),
    evidenceBasis: {
      extractionReceiptSeq: extraction?.seq ?? null,
      releaseReceiptSeq: releaseSuccess?.seq ?? null,
      stopEventSeq: terminal?.seq ?? null,
    },
  };
}
