import {
  HttpProvider,
  HttpRequestOptions,
  HttpResponse,
} from './http-provider.js';

export class FetchHttpProvider
  implements HttpProvider
{
  async request(
    options: HttpRequestOptions
  ): Promise<HttpResponse> {
    const url = new URL(options.url);

    for (
      const [key, value]
      of Object.entries(options.query ?? {})
    ) {
      url.searchParams.set(
        key,
        value
      );
    }

    const controller =
      new AbortController();

    const timeoutMs =
      options.timeoutMs ?? 30000;

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const response = await fetch(
        url,
        {
          method: options.method,

          headers: {
            ...options.headers,

            ...(
              options.body !== undefined
                ? {
                    'content-type':
                      options.headers?.[
                        'content-type'
                      ] ??
                      'application/json',
                  }
                : {}
            ),
          },

          body:
            options.body !== undefined
              ? JSON.stringify(
                  options.body
                )
              : undefined,

          signal:
            controller.signal,
        }
      );

      const responseHeaders =
        Object.fromEntries(
          response.headers.entries()
        );

      const contentType =
        response.headers.get(
          'content-type'
        ) ?? '';

      let body: unknown;

      if (
        contentType.includes(
          'application/json'
        )
      ) {
        body =
          await response.json();
      } else {
        body =
          await response.text();
      }

      return {
        status:
          response.status,

        headers:
          responseHeaders,

        body,

        url:
          response.url,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const httpProvider =
  new FetchHttpProvider();