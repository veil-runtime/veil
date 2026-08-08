const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext(
    './browser-profile/linkedin',
    {
      channel: 'chrome',
      headless: false,
    }
  );

  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://www.linkedin.com/');

  console.log('Log in manually, then press Enter here.');

  process.stdin.resume();
  process.stdin.once('data', async () => {
    await context.storageState({
      path: 'playwright/.auth/linkedin.json',
    });

    await context.close();
    process.exit(0);
  });
})();