import { createLinkedInSession } from '../../browser/browser.js';

export async function checkLinkedInAuthentication() {
  const session = await createLinkedInSession();

  try {
    await session.page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
    });

    await session.page.waitForTimeout(2000);

    const currentUrl = session.page.url();

    const authenticated =
      currentUrl.includes('/feed') &&
      !currentUrl.includes('/login') &&
      !currentUrl.includes('/checkpoint');

    return {
      authenticated,
      url: currentUrl,
      title: await session.page.title(),
    };
  } finally {
   await session.close();
  }
}