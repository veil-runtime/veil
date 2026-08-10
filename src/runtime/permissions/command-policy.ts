import { CapabilityRisk } from '../registry/capability.js';

interface CommandPolicyResult {
  allowed: boolean;
  risk?: CapabilityRisk;
  reason?: string;
}

const READ_COMMANDS = new Set([
  'git status',
  'git log',
  'git diff',
  'git branch',
  'git show',
  'docker ps',
  'docker images',
  'docker model list',
  'node --version',
  'npm --version',
  'pnpm --version',
  'python --version',
  'python3 --version',
  'dotnet --info',
]);

const WRITE_COMMANDS = new Set([
  'git add',
  'git commit',
  'git push',
  'docker start',
  'docker stop',
]);

const DESTRUCTIVE_COMMANDS = new Set([
  'git reset',
  'docker rm',
  'docker rmi',
]);

export function evaluateCommandPolicy(
  command: string,
  args: string[]
): CommandPolicyResult {
  const firstArg = args[0];

  const key = firstArg
    ? `${command} ${firstArg}`
    : command;

  if (READ_COMMANDS.has(key)) {
    return {
      allowed: true,
      risk: 'read',
    };
  }

  if (WRITE_COMMANDS.has(key)) {
    return {
      allowed: false,
      risk: 'write',
      reason:
        `Write command requires approval and is not currently permitted: ${key}`,
    };
  }

  if (DESTRUCTIVE_COMMANDS.has(key)) {
    return {
      allowed: false,
      risk: 'destructive',
      reason:
        `Destructive command requires approval and is not currently permitted: ${key}`,
    };
  }

  return {
    allowed: false,
    reason: `Command is not covered by policy: ${key}`,
  };
}