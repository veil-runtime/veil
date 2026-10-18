import { z } from 'zod';

const rationale = z.string().regex(/\S/, 'Must not be blank');

/** Shared runtime validation, TypeScript type, and model-facing JSON Schema. */
export const proposalSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('execute'), capability: rationale,
    input: z.unknown().optional(), reason: rationale }),
  z.strictObject({ kind: z.literal('delegate'), peer: rationale, task: rationale,
    evidence: z.string(), reason: rationale }),
  z.strictObject({ kind: z.literal('finish'), reason: rationale }),
]);

export type Proposal = z.infer<typeof proposalSchema>;

export const proposalContract = {
  schema: z.toJSONSchema(proposalSchema),
  constraints: 'Required names, tasks, and reasons must contain non-whitespace text. Execute only current worker capabilities; delegate only listed peers. Capability inputSchema uses Veil field rules (type, required, description). Discovery is not authorization; writes require approval and all execution is governed by Veil.',
  examples: [
    { kind: 'execute', capability: '<listed capability name>', input: {}, reason: 'Read evidence' },
    { kind: 'delegate', peer: '<listed peer id>', task: 'Inspect the failure',
      evidence: 'Observed failing test', reason: 'Peer has the required capability' },
    { kind: 'finish', reason: 'Observed evidence establishes the assigned task is complete' },
  ] satisfies Proposal[],
};
