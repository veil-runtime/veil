const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
  });

  const context = await browser.newContext({
    storageState: 'playwright/.auth/linkedin.json',
  });

  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/feed/');

  await page.waitForTimeout(5000);

  await browser.close();
})();