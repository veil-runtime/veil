export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE';

export interface HttpRequestOptions {
  method: HttpMethod;

  url: string;

  headers?: Record<string, string>;

  query?: Record<string, string>;

  body?: unknown;

  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;

  headers: Record<string, string>;

  body: unknown;

  url: string;
}

export interface HttpProvider {
  request(
    options: HttpRequestOptions
  ): Promise<HttpResponse>;
}