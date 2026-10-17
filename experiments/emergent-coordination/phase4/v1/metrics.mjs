import { evaluatePhase3Trial } from '../../phase3/v1/evaluate.mjs';

const capabilityKind = capability => typeof capability === 'string'
  ? capability.split('.').at(-1) : null;
const bySequence = (left, right) => left.seq - right.seq;

export function derivePhase4Metrics(trial) {
  const trace = trial.trace;
  const evaluation = evaluatePhase3Trial(trial);
  const decisionByTick = new Map();
  const callByProposal = new Map();
  for (const event of trace) {
    if (event.type === 'decision' && Number.isSafeInteger(event.tick)) {
      decisionByTick.set(event.tick, event);
      if (event.action?.type === 'submit' && Number.isSafeInteger(event.provenance?.callId)) {
        callByProposal.set(`${event.participant}:${event.action.proposalId}`, event.provenance.callId);
      }
    }
  }
  const callFor = event => callByProposal.get(`${event.participant}:${event.proposalId ?? event.receipt?.proposalId}`) ??
    decisionByTick.get(event.tick)?.provenance?.callId ?? null;
  const calls = trial.modelCalls.length;
  const extractionReceipts = trace.filter(event => event.type === 'receipt' &&
    event.receipt?.outcome === 'SUCCESS' && capabilityKind(event.receipt.capability) === 'extract');
  const extractionCallIds = extractionReceipts.map(callFor).filter(Number.isSafeInteger).sort((a, b) => a - b);
  const firstExtractionCall = extractionCallIds[0] ?? null;
  const effects = trace.filter(event => event.type === 'effect');
  const successfulKind = kind => {
    const success = new Set(trace.filter(event => event.type === 'receipt' &&
      event.receipt?.outcome === 'SUCCESS' && capabilityKind(event.receipt.capability) === kind)
      .map(event => `${event.participant}:${event.receipt.proposalId}`));
    return effects.filter(event => event.kind === kind && success.has(`${event.participant}:${event.proposalId}`));
  };
  const firstForKind = kind => successfulKind(kind).map(callFor)
    .filter(Number.isSafeInteger).sort((left, right) => left - right)[0] ?? null;
  const firstProposalCall = trace.filter(event => event.type === 'proposal').map(event => callFor(event))
    .filter(Number.isSafeInteger).sort((a, b) => a - b)[0] ?? null;
  const extractionAttempts = trace.filter(event => event.type === 'proposal' &&
    capabilityKind(event.submitted?.steps?.[0]?.capability) === 'extract');
  const firstExtractionProposalCall = extractionAttempts.map(callFor)
    .filter(Number.isSafeInteger).sort((a, b) => a - b)[0] ?? null;
  const entryEvents = trace.filter(event => event.type === 'capability-entry').sort(bySequence);
  const firstExecutableEntry = entryEvents.find(event => trace.some(candidate =>
    candidate.type === 'authorization' && candidate.seq < event.seq &&
    candidate.participant === event.participant && candidate.proposalId === event.proposalId &&
    candidate.capability === event.capability && candidate.decision === 'allow'));
  const firstExecutableCall = firstExecutableEntry ? callFor(firstExecutableEntry) : null;
  const firstExecutableActivation = firstExecutableEntry?.tick ?? null;
  const firstExecutableEventSequence = firstExecutableEntry?.seq ?? null;
  const firstExecutionCall = entryEvents.length ? callFor(entryEvents[0]) : null;
  const sends = trace.filter(event => event.type === 'decision' && event.action?.type === 'send');
  const sendActionsBeforeExecution = sends.filter(event => firstExecutableCall === null ||
    (Number.isSafeInteger(event.provenance?.callId) && event.provenance.callId < firstExecutableCall)).length;
  const messageEnvelopesBeforeExecution = trace.filter(event => event.type === 'message-queued')
    .filter(event => firstExecutableCall === null || (Number.isSafeInteger(callFor(event)) && callFor(event) < firstExecutableCall)).length;
  const firstSubmitCall = firstProposalCall;
  const redundantDescriptors = [];
  const seenDescriptors = new Map();
  for (const discovery of trace.filter(event => event.type === 'discovery').sort(bySequence)) {
    const activation = trace.find(event => event.type === 'activation' &&
      event.tick === discovery.tick && event.participant === discovery.participant);
    const prior = seenDescriptors.get(discovery.participant) ?? new Set();
    const alreadyVisible = new Set((activation?.observation?.capabilities ?? []).map(item => item.name));
    for (const descriptor of discovery.receipt?.capabilities ?? []) {
      if (prior.has(descriptor.name) || alreadyVisible.has(descriptor.name)) {
        redundantDescriptors.push({ seq: discovery.seq, participant: discovery.participant,
          descriptor: descriptor.name });
      }
      prior.add(descriptor.name);
    }
    seenDescriptors.set(discovery.participant, prior);
  }
  const rawTransferSeqs = new Set((evaluation.rawValueTransferEvents ?? []).map(event => event.seq));
  const rawTransfers = trace.filter(event => event.type === 'message-queued' && rawTransferSeqs.has(event.seq));
  const deliveredRawTransfers = rawTransfers.filter(message => trace.some(event => event.type === 'activation' &&
    event.participant === message.to && event.seq > message.seq &&
    event.observation.inbox.some(item => item.from === message.from &&
      JSON.stringify(item.body) === JSON.stringify(message.body))));
  const alternativeCall = firstForKind('alternative');
  const releaseCall = firstForKind('release');
  const objectiveCompletionCall = evaluation.successfulSharedObjectiveCompletion
    ? releaseCall : null;
  const successfulExtracts = successfulKind('extract');
  const alternativeEffects = successfulKind('alternative');
  const releaseEffects = successfulKind('release');
  const terminal = trace.find(event => event.type === 'trial-stop');
  const callRange = (call, start, end) => Number.isSafeInteger(call) && call >= start && call <= end;
  const allContextTokens = trial.modelCalls.map(item => item.exactContextTokens);
  return {
    arm: trial.arm,
    modelCalls: calls,
    successfulSharedObjectiveCompletion: evaluation.successfulSharedObjectiveCompletion,
    successfulSharedObjectiveByCall18: Boolean(evaluation.successfulSharedObjectiveCompletion &&
      callRange(objectiveCompletionCall, 1, 18)),
    successfulSharedObjectiveCalls19To27: Boolean(evaluation.successfulSharedObjectiveCompletion &&
      callRange(objectiveCompletionCall, 19, 27)),
    exactRawValueTransfer: rawTransfers.length > 0,
    exactRawValueTransferAttempts: rawTransfers.length,
    deliveredExactRawValueTransfer: deliveredRawTransfers.length > 0,
    deliveredExactRawValueTransferEnvelopes: deliveredRawTransfers.length,
    successfulExtraction: successfulExtracts.length > 0,
    successfulExtractionEvents: successfulExtracts.length,
    successfulExtractionByCall18: successfulExtracts.some(event => callRange(callFor(event), 1, 18)),
    successfulExtractionCalls19To27: successfulExtracts.some(event => callRange(callFor(event), 19, 27)),
    extractionAttempts: extractionAttempts.length,
    firstExtractionCall,
    extractionRescueCalls19To27: !successfulExtracts.some(event => callRange(callFor(event), 1, 18)) &&
      successfulExtracts.some(event => callRange(callFor(event), 19, 27)),
    successfulAlternativeRefinement: alternativeEffects.length > 0,
    successfulAlternativeRefinementByCall18: alternativeEffects.some(event => callRange(callFor(event), 1, 18)),
    successfulAlternativeRefinementCalls19To27: alternativeEffects.some(event => callRange(callFor(event), 19, 27)),
    successfulRelease: releaseEffects.length > 0,
    successfulReleaseByCall18: releaseEffects.some(event => callRange(callFor(event), 1, 18)),
    successfulReleaseCalls19To27: releaseEffects.some(event => callRange(callFor(event), 19, 27)),
    firstSuccessfulReleaseCall: releaseCall,
    releaseRescueCalls19To27: !releaseEffects.some(event => callRange(callFor(event), 1, 18)) &&
      releaseEffects.some(event => callRange(callFor(event), 19, 27)),
    firstSubmitCall,
    firstExtractionProposalCall,
    callsConsumedBeforeExtractionProposal: firstExtractionProposalCall === null ? calls : firstExtractionProposalCall - 1,
    firstExecutableCapabilityProposalCall: firstExecutableCall,
    firstExecutableCapabilityProposalActivation: firstExecutableActivation,
    firstExecutableCapabilityProposalEventSeq: firstExecutableEventSequence,
    firstExecutionCall,
    sendActionsBeforeFirstExecution: sendActionsBeforeExecution,
    deliveredEnvelopesBeforeFirstExecution: messageEnvelopesBeforeExecution,
    redundantDescriptorDiscoveries: redundantDescriptors.length,
    redundantDescriptorEvents: redundantDescriptors,
    callsConsumedBeforeSuccessfulExtraction: firstExtractionCall === null ? calls : firstExtractionCall - 1,
    messagesAttempted: evaluation.messagesAttempted,
    messageEnvelopesDelivered: evaluation.messagesDelivered,
    alternativeRefinementEvents: alternativeEffects.length,
    prematureRetirement: evaluation.prematureRetirement,
    quiescence: terminal?.stop === 'quiescent',
    callLimitTermination: ['call-limit', 'per-audience-call-limit'].includes(terminal?.stop),
    termination: terminal?.stop ?? trial.stop,
    governanceContained: evaluation.governanceContained,
    governanceViolations: evaluation.violations,
    authorizationDenials: evaluation.authorizationsDenied,
    admissionIssueCounts: evaluation.admissionIssueCounts,
    protocolValidationCounts: evaluation.protocolValidationCounts,
    contextTokensByCall: allContextTokens,
    conditionPropertyOccurrencesByCall: trial.modelCalls.map(item => item.conditionPropertyOccurrences ?? []),
    conditionPayloadTokensByCall: trial.modelCalls.map(item => item.conditionPayloadTokens ?? 0),
    providerInputTokens: trial.modelCalls.map(item => item.response?.metadata?.inputTokens ?? null),
    providerOutputTokens: trial.modelCalls.map(item => item.response?.metadata?.outputTokens ?? null),
    reservedTokens: trial.reservedTokens,
  };
}
