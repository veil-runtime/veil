import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { URL } from 'node:url';

import {
  createGreetingPlan,
  runtime,
} from './veil/runtime.js';

const port = Number(process.env.PORT ?? 3334);

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readJson(
  request: IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function requestedName(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const name = (body as Record<string, unknown>).name;
  return typeof name === 'string'
    ? name
    : undefined;
}

const server = createServer(async (
  request,
  response,
) => {
  const url = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? '127.0.0.1'}`,
  );

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, undefined);
    return;
  }

  if (
    request.method === 'GET'
    && url.pathname === '/api/capabilities'
  ) {
    const name = url.searchParams.get('name') ?? '';
    sendJson(response, 200, {
      capabilities: runtime.listCapabilities(),
      plan: createGreetingPlan(name),
    });
    return;
  }

  if (
    request.method === 'POST'
    && url.pathname === '/api/execute'
  ) {
    try {
      const name = requestedName(
        await readJson(request),
      );

      if (name === undefined) {
        sendJson(response, 400, {
          error: 'Request body must contain a string name.',
        });
        return;
      }

      const plan = createGreetingPlan(name);
      const job = await runtime.executePlan(plan);

      sendJson(response, 200, {
        kind: 'job',
        plan,
        job,
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unknown execution error';

      sendJson(response, 422, {
        kind: 'rejected',
        error: message,
      });
    }
    return;
  }

  sendJson(response, 404, {
    error: 'Not found',
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `Veil Starter server listening on http://127.0.0.1:${port}`,
  );
});
