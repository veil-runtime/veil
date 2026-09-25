import { spawn } from 'node:child_process';
import {
  isAbsolute,
  relative,
  resolve,
} from 'node:path';

import { Capability } from '../../runtime/registry/capability.js';
import { evaluateCommandPolicy } from '../../runtime/permissions/command-policy.js';

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

interface NormalizedCommand {
  command: string;
  args: string[];
}

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

// Accept a single representation. Policy and dispatch must not reinterpret a
// command string or discard embedded arguments after runtime authorization.
function normalizeCommand(input: ShellCommandRunInput): NormalizedCommand {
  const command = input?.command;
  if (typeof command !== 'string' || !/^[a-z][a-z0-9-]*$/.test(command)) {
    throw new Error('command must be a single executable basename; supply arguments separately');
  }
  const suppliedArgs = input.args ?? [];
  if (!Array.isArray(suppliedArgs)) {
    throw new Error('args must be an array of strings');
  }
  const args = Array.from(suppliedArgs);
  if (args.some(arg => typeof arg !== 'string')) {
    throw new Error('args must be a dense array of strings');
  }
  return { command, args };
}

export const shellCommandRunCapability: Capability<
  ShellCommandRunInput,
  ShellCommandRunResult
> = {
  name: 'shell.command.run',

  version: '1.0.0',

  description:
    'Run an explicitly authorized, exact command invocation without a shell. Only reviewed executable and argument tuples are supported; executable, environment and workspace contents must be trusted.',

  // Ambient executable/configuration effects are not proven read-only.
  risk: 'destructive',

  inputSchema: {
    command: {
      type: 'string',
      required: true,
      description:
        'Single executable basename, for example "git". Command lines, paths and encoded arrays are rejected; supply args separately.',
    },

    args: {
      type: 'array',
      required: false,
      description:
        'Complete argument vector as separate strings, for example ["status"]. Only exact reviewed tuples are permitted; extra options or operands are rejected.',
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
        args: [...args],
      }
    );

    const cwd =
      resolveSafeCwd(input.cwd);

    context?.logger.info(
      'Running approved command',
      {
        command,
        args: [...args],
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
        args: [...args],
        exitCode:
          result.exitCode,
      }
    );

    return result;
  },
};
