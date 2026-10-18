import type { ReasoningContext, ReasoningProvider, Proposal } from './types.js';

/** No task table or capability names: a deliberately bounded offline language.
 * New files and edits are supplied in the human goal, not in this policy.
 */
export class OfflineEditReasoner implements ReasoningProvider {
  async decide(context: ReasoningContext): Promise<Proposal> {
    const match = /\breplace\s+`([^`]+)`\s+with\s+`([^`]*)`/is.exec(context.goal);
    if (!match) throw new Error('Offline goals must include: replace `existing text` with `replacement text`');
    const [, before, after] = match;
    const find = (description: string) => {
      const capability = context.capabilities.find(c => c.description.startsWith(description));
      if (!capability) throw new Error(`Required capability unavailable: ${description}`);
      return capability.name;
    };
    const list = find('List permitted');
    const read = find('Read one permitted');
    const replace = find('Replace one exact');
    const check = find('Run bounded acceptance');
    const observations = context.history.filter(e => e.type === 'execution.completed');
    const failed = context.history.find(e => e.type === 'execution.failed');
    if (failed) throw new Error('Execution failed; inspect evidence before starting another run');
    const execute = (capability: string, reason: string, input?: unknown): Proposal => ({ kind: 'execute', capability, reason, input });
    if (observations.some(e => e.data.capability === replace)) {
      return { kind: 'finish', reason: 'Approved edit executed; request host-owned acceptance verification' };
    }
    const listing = observations.find(e => e.data.capability === list)?.data.result as { files: string[] } | undefined;
    if (!listing) return execute(list, 'Discover bounded workspace files');
    if (!observations.some(e => e.data.capability === check)) return execute(check, 'Observe baseline acceptance before proposing a change');
    const reads = observations.filter(e => e.data.capability === read).map(e => e.data.result as {path: string; content: string});
    const unread = listing.files.find(path => !reads.some(r => r.path === path));
    if (unread) return execute(read, 'Inspect permitted source to ground the requested edit', { path: unread });
    const candidates = reads.filter(r => r.content.split(before).length === 2);
    const specified = candidates.filter(r => context.goal.includes(r.path));
    const selected = specified.length ? specified : candidates;
    if (selected.length !== 1) throw new Error('Goal must identify one unambiguous exact edit in the observed workspace');
    return execute(replace, 'Observed source contains the exact text requested by the human goal', { path: selected[0]!.path, before, after });
  }
}
