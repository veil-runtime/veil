import { spawn } from 'node:child_process';
import {
  isAbsolute,
  relative,
  resolve,
} from 'node:path';

import { Capability } from '../../runtime/registry/capability.js';
import { evaluateCommandPolicy } from '../../runtime/permissions/command-policy.js';

interface ShellCommandRunInput {
  command: string | string[];
  args?: string[];
  cwd?: string;
}

interface ShellCommandRunResult {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface NormalizedCommand {
  command: string;
  args: string[];
}

const ALLOWED_COMMANDS = new Set([
  'git',
  'node',
  'npm',
  'npx',
  'pnpm',
  'python',
  'python3',
  'dotnet',
  'docker',
]);

const ALLOWED_ROOT = resolve(
  process.env.OPERATOR_FILES_ROOT ??
    process.cwd()
);

function resolveSafeCwd(
  requested?: string
): string {
  if (!requested) {
    return ALLOWED_ROOT;
  }

  const candidate = isAbsolute(requested)
    ? resolve(requested)
    : resolve(ALLOWED_ROOT, requested);

  const rel = relative(
    ALLOWED_ROOT,
    candidate
  );

  if (
    rel.startsWith('..') ||
    isAbsolute(rel)
  ) {
    throw new Error(
      `Working directory is outside allowed root: ${ALLOWED_ROOT}`
    );
  }

  return candidate;
}

function parseCommandParts(
  command: string | string[]
): string[] {
  if (Array.isArray(command)) {
    if (
      command.length === 0 ||
      command.some(
        (part) =>
          typeof part !== 'string'
      )
    ) {
      throw new Error(
        'command array must contain strings'
      );
    }

    return command;
  }

  const trimmed = command.trim();

  if (!trimmed) {
    throw new Error(
      'command is required'
    );
  }

  /*
   * Some planners may return:
   *
   * ["git", "status"]
   *
   * as a JSON-encoded string.
   */
  if (
    trimmed.startsWith('[') &&
    trimmed.endsWith(']')
  ) {
    try {
      const parsed = JSON.parse(trimmed);

      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (part) =>
            typeof part === 'string'
        )
      ) {
        return parsed;
      }
    } catch {
      // Fall through to normal command parsing.
    }
  }

  return trimmed
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeCommand(
  input: ShellCommandRunInput
): NormalizedCommand {
  if (!input?.command) {
    throw new Error(
      'command is required'
    );
  }

  if (
    input.args !== undefined &&
    (
      !Array.isArray(input.args) ||
      input.args.some(
        (arg) =>
          typeof arg !== 'string'
      )
    )
  ) {
    throw new Error(
      'args must be an array of strings'
    );
  }

  const commandParts =
    parseCommandParts(input.command);

  const command =
    commandParts[0];

  if (!command) {
    throw new Error(
      'command is required'
    );
  }

  const embeddedArgs =
    commandParts.slice(1);

  const suppliedArgs =
    input.args ?? [];

  /*
   * Explicit args win when provided.
   *
   * This avoids:
   *
   * command = "git status"
   * args = ["status"]
   *
   * becoming:
   *
   * ["status", "status"]
   */
  const args =
    suppliedArgs.length > 0
      ? suppliedArgs
      : embeddedArgs;

  return {
    command,
    args,
  };
}

export const shellCommandRunCapability: Capability<
  ShellCommandRunInput,
  ShellCommandRunResult
> = {
  name: 'shell.command.run',

  version: '1.0.0',

  description:
    'Run an approved executable inside the configured Operator workspace without invoking a shell. Operator safely normalizes common command representations before policy evaluation.',

  risk: 'read',

  inputSchema: {
    command: {
      type: 'string',
      required: true,
      description:
        'Command to execute. Preferred form: command="git" with args=["status"]. Simple forms such as "git status" may also be normalized safely.',
    },

    args: {
      type: 'array',
      required: false,
      description:
        'Optional command arguments as separate strings. Example: ["status"]. Preserve requested subcommands and do not include shell operators.',
    },

    cwd: {
      type: 'string',
      required: false,
      description:
        'Optional working directory inside the configured Operator filesystem root. Prefer a relative path.',
    },
  },

  async execute(input, context) {
    const {
      command,
      args,
    } = normalizeCommand(input);

    if (!ALLOWED_COMMANDS.has(command)) {
      throw new Error(
        `Command is not allowed: ${command}`
      );
    }

    const policy =
      evaluateCommandPolicy(
        command,
        args
      );

    if (!policy.allowed) {
      throw new Error(
        policy.reason ??
          'Command is not permitted by policy'
      );
    }

    context?.logger.info(
      'Command policy evaluated',
      {
        command,
        args,
        risk: policy.risk,
      }
    );

    const cwd =
      resolveSafeCwd(input.cwd);

    context?.logger.info(
      'Running approved command',
      {
        command,
        args,
        cwd,
      }
    );

    const result =
      await new Promise<ShellCommandRunResult>(
        (
          resolvePromise,
          reject
        ) => {
          const child = spawn(
            command,
            args,
            {
              cwd,
              shell: false,
              env: process.env,
            }
          );

          let stdout = '';
          let stderr = '';

          child.stdout.on(
            'data',
            (chunk) => {
              stdout +=
                chunk.toString();
            }
          );

          child.stderr.on(
            'data',
            (chunk) => {
              stderr +=
                chunk.toString();
            }
          );

          child.on(
            'error',
            reject
          );

          child.on(
            'close',
            (exitCode) => {
              resolvePromise({
                command,
                args,
                cwd,
                exitCode:
                  exitCode ?? -1,
                stdout:
                  stdout.slice(
                    0,
                    50000
                  ),
                stderr:
                  stderr.slice(
                    0,
                    50000
                  ),
              });
            }
          );
        }
      );

    context?.logger.info(
      'Approved command completed',
      {
        command,
        args,
        exitCode:
          result.exitCode,
      }
    );

    return result;
  },
};
