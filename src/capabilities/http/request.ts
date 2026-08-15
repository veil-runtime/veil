import { isIP } from 'node:net';

import { Capability } from '../../runtime/registry/capability.js';
import {
  HttpMethod,
} from '../../providers/http/http-provider.js';
import { httpProvider } from '../../providers/http/fetch-http-provider.js';

interface HttpRequestInput {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

interface HttpRequestResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  url: string;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname
    .split('.')
    .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 168
    ) ||
    (
      a === 169 &&
      b === 254
    )
  );
}

function validateUrl(
  rawUrl: string
): URL {
  const url = new URL(rawUrl);

  if (
    !['http:', 'https:'].includes(
      url.protocol
    )
  ) {
    throw new Error(
      'Only HTTP and HTTPS URLs are supported'
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    (
      isIP(hostname) === 4 &&
      isPrivateIpv4(hostname)
    ) ||
    isIP(hostname) === 6
  ) {
    throw new Error(
      'Local and private network addresses are not permitted by http.request'
    );
  }

  return url;
}

export const httpRequestCapability: Capability<
  HttpRequestInput,
  HttpRequestResult
> = {
  name: 'http.request',

  version: '1.0.0',

  description:
    'Send an HTTP request to a public HTTP or HTTPS endpoint and return the structured response',

  risk: 'read',

  inputSchema: {
    method: {
      type: 'string',
      required: true,
      description:
        'HTTP method: GET, POST, PUT, PATCH or DELETE',
    },

    url: {
      type: 'string',
      required: true,
      description:
        'Full public HTTP or HTTPS URL. Localhost and private network addresses are not allowed.',
    },

    headers: {
      type: 'object',
      required: false,
      description:
        'Optional request headers as string key/value pairs',
    },

    query: {
      type: 'object',
      required: false,
      description:
        'Optional URL query parameters as string key/value pairs',
    },

    body: {
      type: 'object',
      required: false,
      description:
        'Optional JSON request body',
    },

    timeoutMs: {
      type: 'number',
      required: false,
      description:
        'Optional request timeout in milliseconds',
    },
  },

  async execute(input, context) {
    if (!input?.method) {
      throw new Error(
        'method is required'
      );
    }

    if (!input?.url) {
      throw new Error(
        'url is required'
      );
    }

    const method =
      input.method.toUpperCase() as HttpMethod;

    if (
      ![
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
      ].includes(method)
    ) {
      throw new Error(
        `Unsupported HTTP method: ${input.method}`
      );
    }

    const url =
      validateUrl(input.url);

    context?.logger.info(
      'Sending HTTP request',
      {
        method,
        url: url.toString(),
      }
    );

    const response =
      await httpProvider.request({
        method,
        url: url.toString(),
        headers: input.headers,
        query: input.query,
        body: input.body,
        timeoutMs: input.timeoutMs,
      });

    context?.logger.info(
      'HTTP request completed',
      {
        method,
        url: response.url,
        status: response.status,
      }
    );

    return response;
  },
};
