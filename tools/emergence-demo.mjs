import { createRepairDemo } from '../src/emergence/demo.ts';

const { directory, kernel, names } = await createRepairDemo();
let state = await kernel.start('Diagnose and fix the failing addition test', 'coordinator', {
  worker: 'verifier', capability: names.test, expected: { passed: true },
});
while (state.status === 'awaiting-approval') {
  const request = state.approvals.find((item) => !item.granted);
  if (!request || request.capability !== names.patch) throw new Error('Unexpected approval request');
  if (!process.argv.includes('--approve-fixture-writes')) {
    console.log(JSON.stringify({ directory, stateFile: `${directory}/journal/${state.id}.json`,
      status: state.status, approvalRequest: request }, null, 2));
    console.log('Review the request and rerun with --approve-fixture-writes for the isolated fixture.');
    process.exit(0);
  }
  state = await kernel.grantApproval(state.id, request.id, 'local-operator');
}
console.log(JSON.stringify({ directory, stateFile: `${directory}/journal/${state.id}.json`,
  status: state.status, verified: state.verified, decisions: state.decisions,
  jobs: state.jobs, delegations: state.delegations,
  eventTypes: state.events.map((event) => event.type) }, null, 2));
if (state.status !== 'verified') process.exitCode = 1;
