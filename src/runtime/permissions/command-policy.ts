interface CommandPolicyResult {
  allowed: boolean;
  reason?: string;
}

// Complete invocations, not prefixes or a claim about ambient process effects.
// Adding any option/operand requires a separately reviewed tuple.
const ALLOWED_INVOCATIONS: readonly (readonly string[])[] = [
  ['git', 'status'],
  ['git', 'log'],
  ['git', 'diff'],
  ['git', 'branch'],
  ['git', 'show'],
  ['docker', 'ps'],
  ['docker', 'images'],
  ['node', '--version'],
  ['npm', '--version'],
  ['pnpm', '--version'],
  ['python', '--version'],
  ['python3', '--version'],
  ['dotnet', '--info'],
];

export function evaluateCommandPolicy(
  command: string,
  args: string[]
): CommandPolicyResult {
  const allowed = Array.isArray(args) && ALLOWED_INVOCATIONS.some(invocation =>
    invocation[0] === command && invocation.length === args.length + 1 &&
    invocation.slice(1).every((argument, index) => argument === args[index])
  );
  return allowed
    ? { allowed: true }
    : { allowed: false, reason: 'Command invocation is not permitted by exact policy' };
}
