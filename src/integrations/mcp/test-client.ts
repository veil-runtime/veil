import {
  Client,
} from '@modelcontextprotocol/sdk/client/index.js';

import {
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport =
    new StdioClientTransport({
      command:
        '/home/mustapha/.nvm/versions/node/v24.18.1/bin/node',

      args: [
        'node_modules/tsx/dist/cli.mjs',
        'src/integrations/mcp/stdio-server.ts',
      ],

      cwd:
        '/home/mustapha/dev/ai/playwright-lab',

      env: {
        JOB_STORE: 'sqlite',
      },
    });

  const client =
    new Client({
      name: 'veil-mcp-test-client',
      version: '0.1.0',
    });

  await client.connect(
    transport
  );

  const tools =
    await client.listTools();

  console.log(
    JSON.stringify(
      tools,
      null,
      2
    )
  );

  const result =
    await client.callTool({
        name: 'filesystem.file.read',
        arguments: {
        path: 'README.md',
        },
    });

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});