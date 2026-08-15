import { Capability } from '../../runtime/registry/capability.js';
import { createPublicSession } from '../../providers/browser/browser-session.js';

interface WebPageReadInput {
  url: string;
}

interface WebPageReadResult {
  title: string;
  url: string;
  text: string;
}

export const webPageReadCapability: Capability<
  WebPageReadInput,
  WebPageReadResult
> = {
  name: 'web.page.read',

  version: '1.0.0',

  description:
    'Open a public web page and return its title, final URL and visible text',

  risk: 'read',

  inputSchema: {
    url: {
      type: 'string',
      required: true,
      description:
        'The full HTTP or HTTPS URL of the public web page to read',
    },
  },

  async execute(input, context) {
    if (!input?.url) {
      throw new Error('url is required');
    }

    const url = new URL(input.url);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(
        'Only HTTP and HTTPS URLs are supported'
      );
    }

    context?.logger.info(
      `Reading public web page: ${url}`
    );

    const session = await createPublicSession();

    try {
      await session.page.goto(url.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      context?.logger.info(
        `Page loaded: ${session.page.url()}`
      );

      const title = await session.page.title();

      const text = await session.page
        .locator('body')
        .innerText()
        .catch(() => '');

      context?.logger.info(
        'Public web page read completed'
      );

      return {
        title,
        url: session.page.url(),
        text: text.trim().slice(0, 20000),
      };
    } finally {
      context?.logger.debug(
        'Closing browser session'
      );

      await session.close();
    }
  },
};
