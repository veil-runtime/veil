import {
  Client,
} from '@modelcontextprotocol/sdk/client/index.js';
import {
  InMemoryTransport,
} from '@modelcontextprotocol/sdk/inMemory.js';
import {
  McpAdapter,
  type Job,
} from '@veil-runtime/core';

import type { ServiceHealthResult } from './capabilities.js';
import { runtime } from './runtime.js';

export interface McpServiceHealthRequest {
  readonly name: 'service.health';
  readonly arguments: {
    readonly serviceName: string;
  };
}

export interface McpServiceHealthExecution {
  readonly request: McpServiceHealthRequest;
  readonly job: Job;
  readonly result: ServiceHealthResult;
}

function isServiceHealthResult(value: unknown): value is ServiceHealthResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  return typeof result.serviceName === 'string'
    && result.status === 'healthy'
    && result.checked === true;
}

function isTextContent(value: unknown): value is {
  readonly type: 'text';
  readonly text: string;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const content = value as Record<string, unknown>;
  return content.type === 'text'
    && typeof content.text === 'string';
}

function textFromMcpResponse(response: unknown): string {
  if (!response || typeof response !== 'object') {
    throw new Error('MCP response was malformed.');
  }

  const content = (response as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    throw new Error('MCP response did not include content.');
  }

  const text = content.find(isTextContent);
  if (!text) {
    throw new Error('MCP response did not include a text result.');
  }

  return text.text;
}

export async function runMcpServiceHealth(
  serviceName: string,
): Promise<McpServiceHealthExecution> {
  const request: McpServiceHealthRequest = {
    name: 'service.health',
    arguments: { serviceName },
  };
  const knownJobIds = new Set(
    (await runtime.listJobs()).map((job) => job.id),
  );
  const adapter = new McpAdapter(runtime);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({
    name: 'veil-starter-mcp-client',
    version: '1.0.0',
  });

  try {
    await Promise.all([
      adapter.server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const response = await client.callTool(request);
    const result: unknown = JSON.parse(textFromMcpResponse(response));
    if (!isServiceHealthResult(result)) {
      throw new Error('MCP response did not include a service health result.');
    }

    const job = (await runtime.listJobs()).find((entry) => (
      !knownJobIds.has(entry.id)
      && entry.steps.length === 1
      && entry.steps[0]?.capability === request.name
      && isServiceHealthResult(entry.result)
      && entry.result.serviceName === serviceName
    ));
    if (!job) {
      throw new Error('MCP execution did not produce a Veil job.');
    }

    return { request, job, result };
  } finally {
    await client.close();
  }
}
