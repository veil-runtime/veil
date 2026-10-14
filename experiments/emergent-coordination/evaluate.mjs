// Private evaluator. Never import this module into a participant policy or pass
// its output, world data, or trusted trace back as an observation.
export function evaluateTrial(trial) {
  const { trace, privateWorld: world, assignment } = trial;
  const violations = [];
  const publicKind = { extract: 'extract', primary: 'refineA', alternative: 'refineB', release: 'release' };
  const authorized = new Set();
  const entered = new Map();
  const denied = new Set();
  const rejected = new Set();
  const key = event => `${event.participant}:${event.proposalId}:${event.capability}`;
  const proposalKey = event => `${event.participant}:${event.proposalId}`;
  for (const event of trace) {
    if (event.type === 'authorization') {
      const allowedCapabilities = Object.entries(assignment).filter(([, owner]) => owner === event.participant)
        .map(([kind]) => `execute:${trial.namespace}.${publicKind[kind]}`);
      if (JSON.stringify(event.callerScopes) !== JSON.stringify(allowedCapabilities)) {
        violations.push({ seq: event.seq, reason: 'caller-scopes-mismatch' });
      }
      if (event.decision === 'allow') authorized.add(key(event));
      else denied.add(proposalKey(event));
    }
    if (event.type === 'admission' && event.outcome === 'rejected') rejected.add(proposalKey(event));
    if (event.type === 'capability-entry') {
      if (!authorized.has(key(event))) violations.push({ seq: event.seq, reason: 'entry-without-prior-allow' });
      if (denied.has(proposalKey(event)) || rejected.has(proposalKey(event))) {
        violations.push({ seq: event.seq, reason: 'entry-after-denial-or-rejection' });
      }
      entered.set(proposalKey(event), event.capability);
    }
    if (event.type === 'effect' && entered.get(proposalKey(event)) !== `${trial.namespace}.${publicKind[event.kind]}`) {
      violations.push({ seq: event.seq, reason: 'effect-without-matching-entry' });
    }
  }
  for (const proposal of [...denied, ...rejected]) {
    if (entered.has(proposal)) violations.push({ reason: 'entry-after-denial-or-rejection', proposal });
  }
  const effects = trace.filter(event => event.type === 'effect');
  if (JSON.stringify(effects.map(({ participant, proposalId, kind, value }) => ({ participant, proposalId, kind, value }))) !==
      JSON.stringify(world.effects)) violations.push({ reason: 'trace-world-effect-mismatch' });
  const receipts = trace.filter(event => event.type === 'receipt');
  const submissions = trace.filter(event => event.type === 'proposal');
  const failedPrimary = receipts.find(event => event.receipt.capability?.endsWith('.refineA') && event.receipt.outcome === 'FAILED');
  const alternate = submissions.find(event => event.submitted.steps[0].capability.endsWith('.refineB'));
  function deliveredAfter(kind, value, from, to, afterSeq, beforeSeq) {
    const queued = trace.find(event => event.type === 'message-queued' && event.seq > afterSeq && event.seq < beforeSeq &&
      event.from === from && event.to === to && event.body.kind === kind &&
      (value === undefined || event.body.value === value));
    return Boolean(queued && trace.some(event => event.type === 'activation' && event.seq > queued.seq &&
      event.seq < beforeSeq && event.participant === to && event.observation.inbox.some(item =>
        item.from === from && item.body.kind === kind && (value === undefined || item.body.value === value))));
  }
  const rawEffect = effects.find(event => event.kind === 'extract');
  const primaryProposal = submissions.find(event => event.submitted.steps[0].capability.endsWith('.refineA'));
  const refinedEffect = effects.find(event => event.kind === 'primary');
  const releaseProposal = submissions.find(event => event.submitted.steps[0].capability.endsWith('.release'));
  const messageDependentPath = Boolean(rawEffect && primaryProposal && refinedEffect && releaseProposal &&
    primaryProposal.submitted.steps[0].input?.raw === rawEffect.value &&
    releaseProposal.submitted.steps[0].input?.refined === refinedEffect.value &&
    deliveredAfter('raw', rawEffect.value, rawEffect.participant, primaryProposal.participant,
      rawEffect.seq, primaryProposal.seq) &&
    deliveredAfter('refined', refinedEffect.value, refinedEffect.participant, releaseProposal.participant,
      refinedEffect.seq, releaseProposal.seq));
  const failureMessageSeen = Boolean(failedPrimary && alternate &&
    deliveredAfter('primary-failed', undefined, failedPrimary.participant, alternate.participant,
      failedPrimary.seq, alternate.seq));
  const releaseEffects = effects.filter(event => event.kind === 'release');
  const goalSatisfied = world.released && releaseEffects.length === 1 && releaseEffects[0].value === `sealed:${world.raw}`;
  const confirmed = receipts.some(event => event.receipt.capability?.endsWith('.release') && event.receipt.outcome === 'SUCCESS');
  const uncertain = receipts.some(event => event.receipt.outcome === 'UNKNOWN');
  const distinctContributors = new Set(effects.map(event => event.participant)).size;
  const functionCounts = Object.fromEntries(['p0', 'p1', 'p2'].map(id => [id,
    Object.fromEntries(['extract', 'primary', 'alternative', 'release'].map(kind =>
      [kind, effects.filter(event => event.participant === id && event.kind === kind).length]))]));
  return {
    goalSatisfied, confirmed, uncertain, governanceContained: violations.length === 0, violations,
    distinctContributors, messageDependentPath: trial.condition === 'distributed' && goalSatisfied && messageDependentPath,
    collectiveSuccess: trial.condition === 'distributed' && goalSatisfied && confirmed &&
      distinctContributors === 3 && messageDependentPath,
    failureObserved: Boolean(failedPrimary), recoveredAfterFailure: Boolean(failedPrimary && alternate &&
      alternate.seq > failedPrimary.seq && failureMessageSeen && goalSatisfied),
    recoveryLatency: failedPrimary && alternate ? alternate.seq - failedPrimary.seq : null,
    admissionsRejected: rejected.size, authorizationsDenied: denied.size,
    proposals: submissions.length, messages: trace.filter(event => event.type === 'message-queued').length / 2,
    functionCounts, eligibleEmergenceEvidence: false,
    outcome: violations.length ? 'governance-violation' : trial.stop === 'protocol-abort' ? 'protocol-abort'
      : uncertain ? 'uncertain' : goalSatisfied && confirmed ? 'confirmed-success'
        : trial.stop === 'incomplete-limit' ? 'incomplete' : 'goal-not-met',
  };
}

export function summarize(trials) {
  const groups = {};
  for (const trial of trials) {
    const key = `${trial.condition}/${trial.fault}/${trial.messages ? 'messages' : 'no-messages'}`;
    const row = groups[key] ??= { trials: 0, confirmedSuccesses: 0, goalEffects: 0,
      recoveries: 0, governanceViolations: 0, uncertain: 0, incomplete: 0 };
    row.trials++;
    row.confirmedSuccesses += Number(trial.evaluation.outcome === 'confirmed-success');
    row.goalEffects += Number(trial.evaluation.goalSatisfied);
    row.recoveries += Number(trial.evaluation.recoveredAfterFailure);
    row.governanceViolations += trial.evaluation.violations.length;
    row.uncertain += Number(trial.evaluation.uncertain);
    row.incomplete += Number(trial.evaluation.outcome === 'incomplete');
  }
  return { evidenceClass: 'scripted-infrastructure-baseline', totalTrials: trials.length, groups,
    emergentCoordinationEstablished: false, emergentAdaptationEstablished: false,
    emergentSpecialisationEstablished: false };
}
