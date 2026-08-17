import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { URL } from 'node:url';

import {
  createDemoPlan,
  createGreetingPlan,
  createSupportPlan,
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

function objectBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  return body as Record<string, unknown>;
}

function requestedExecution(
  body: unknown,
): { capabilityName: string; input: Record<string, unknown> } | undefined {
  const request = objectBody(body);
  if (!request) {
    return undefined;
  }

  // Retain the Lesson 01 request shape for the greeting demonstration.
  if (typeof request.name === 'string') {
    return {
      capabilityName: 'demo.greet',
      input: { name: request.name },
    };
  }

  if (
    typeof request.capabilityName !== 'string'
    || !objectBody(request.input)
  ) {
    return undefined;
  }

  return {
    capabilityName: request.capabilityName,
    input: objectBody(request.input) as Record<string, unknown>,
  };
}

function createPlan(
  capabilityName: string,
  input: Record<string, unknown>,
) {
  return capabilityName === 'email.draft'
    ? createSupportPlan(input)
    : createDemoPlan(capabilityName, input);
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
    const capabilityName = url.searchParams.get('capabilityName');
    const inputParameter = url.searchParams.get('input');
    let plan = createGreetingPlan(url.searchParams.get('name') ?? '');

    if (capabilityName) {
      try {
        const input = inputParameter ? JSON.parse(inputParameter) : {};
        if (!objectBody(input)) {
          throw new Error('Input must be a JSON object.');
        }
        plan = createPlan(capabilityName, input);
      } catch (error) {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Invalid input.',
        });
        return;
      }
    }

    sendJson(response, 200, {
      capabilities: runtime.listCapabilities(),
      plan,
    });
    return;
  }

  if (
    request.method === 'POST'
    && url.pathname === '/api/execute'
  ) {
    try {
      const execution = requestedExecution(
        await readJson(request),
      );

      if (execution === undefined) {
        sendJson(response, 400, {
          error: 'Request body must contain capabilityName and an input object.',
        });
        return;
      }

      const plan = createPlan(
        execution.capabilityName,
        execution.input,
      );
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
