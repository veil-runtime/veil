import { Capability } from '../../core/capability.js';
import { createPublicSession } from '../../browser/browser.js';

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

  description:
    'Open a public web page and return its title, final URL and visible text',

  risk: 'read',

  async execute(input) {
    if (!input?.url) {
      throw new Error('url is required');
    }

    const url = new URL(input.url);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(
        'Only HTTP and HTTPS URLs are supported'
      );
    }

    const session = await createPublicSession();

    try {
      await session.page.goto(url.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const title = await session.page.title();

      const text = await session.page
        .locator('body')
        .innerText()
        .catch(() => '');

      return {
        title,
        url: session.page.url(),
        text: text.trim().slice(0, 20000),
      };
    } finally {
      await session.close();
    }
  },
};