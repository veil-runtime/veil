import { resolve } from 'node:path';
import { readConfinedFile } from '../../providers/filesystem/confined-file-reader.js';
import {
  createCapability,
} from '../../sdk/index.js';

interface FileReadInput {
  path: string;
}

interface FileReadResult {
  path: string;
  content: string;
}

const ALLOWED_ROOT = resolve(
  process.env.OPERATOR_FILES_ROOT ??
    process.cwd()
);

export const filesystemFileReadCapability =
  createCapability<
    FileReadInput,
    FileReadResult
  >({
    name: 'filesystem.file.read',

    version: '1.0.0',

    description:
      'Read a UTF-8 text file from the configured Operator filesystem root using a relative project path',

    risk: 'read',

    inputSchema: {
      path: {
        type: 'string',
        required: true,
        description:
          'Path to a text file inside the configured Operator filesystem root. Prefer paths relative to the root, for example README.md or docs/architecture.md. Do not invent absolute paths.',
      },
    },

    timeoutMs: 5000,

    async execute({
      input,
      context,
    }) {
      if (!input?.path) {
        throw new Error(
          'path is required'
        );
      }

      const { path, content } = await readConfinedFile(ALLOWED_ROOT, input.path);

      context?.logger.info(
        'Filesystem file read completed',
        {
          path,
          characters:
            content.length,
        }
      );

      return {
        path,
        content:
          content.slice(
            0,
            50000
          ),
      };
    },
  });
