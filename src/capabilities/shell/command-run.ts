import { spawn } from 'node:child_process';
import {
  isAbsolute,
  relative,
  resolve,
} from 'node:path';

import { Capability } from '../../runtime/registry/capability.js';

interface ShellCommandRunInput {
  command: string;
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

export const shellCommandRunCapability: Capability<
  ShellCommandRunInput,
  ShellCommandRunResult
> = {
  name: 'shell.command.run',

  description:
    'Run an approved executable with a separate argument list inside the configured Operator workspace, without invoking a shell',

  risk: 'read',

  inputSchema: {
    command: {
      type: 'string',
      required: true,
      description:
        'Executable name only, for example "git", "node", "npm", "pnpm", "python3", "dotnet" or "docker". Do not include arguments or spaces. For "git status", use command="git" and args=["status"].',
    },

    args: {
      type: 'array',
      required: false,
      description:
        'Command arguments as separate strings. Example: for "git status", use ["status"]. Do not include shell operators such as &&, |, > or ;.',
    },

    cwd: {
      type: 'string',
      required: false,
      description:
        'Optional working directory inside the configured Operator filesystem root. Prefer a relative path.',
    },
  },

  async execute(input, context) {
    if (!input?.command) {
      throw new Error(
        'command is required'
      );
    }

    if (
      !ALLOWED_COMMANDS.has(
        input.command
      )
    ) {
      throw new Error(
        `Command is not allowed: ${input.command}`
      );
    }

    const args = input.args ?? [];

    if (
      !Array.isArray(args) ||
      args.some(
        (arg) =>
          typeof arg !== 'string'
      )
    ) {
      throw new Error(
        'args must be an array of strings'
      );
    }

    const cwd = resolveSafeCwd(
      input.cwd
    );

    context?.logger.info(
      'Running approved command',
      {
        command: input.command,
        args,
        cwd,
      }
    );

    const result =
      await new Promise<ShellCommandRunResult>(
        (resolvePromise, reject) => {
          const child = spawn(
            input.command,
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
              stdout += chunk.toString();
            }
          );

          child.stderr.on(
            'data',
            (chunk) => {
              stderr += chunk.toString();
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
                command:
                  input.command,
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
        command:
          input.command,
        exitCode:
          result.exitCode,
      }
    );

    return result;
  },
};