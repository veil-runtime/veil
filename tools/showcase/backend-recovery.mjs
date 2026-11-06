import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BACKEND_URL || 'http://127.0.0.1:4188/veil/backend-lab/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const api = [];
  page.on('request', request => { if (request.url().includes('/api/')) api.push({ method: request.method(), url: request.url() }); });
  page.on('response', response => { if (response.url().includes('/api/')) api.push({ status: response.status(), url: response.url() }); });
  await page.goto(`${base}?mode=http`);
  const ui = page.locator('#backend-interface');
  const phase = text => page.waitForFunction(value => document.querySelector('#backend-interface .veil-interface-status')?.textContent.includes(value), text);
  await phase('3 records loaded.');
  const invalid = await page.evaluate(async () => {
    const response = await fetch('/api/records', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x', detail: 'short' }) });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(invalid.status, 422);
  assert.match(invalid.body.error, /Title must be/);

  await context.setOffline(true);
  await ui.getByLabel('Filter records').fill('queue');
  const search = ui.getByRole('button', { name: 'Search', exact: true });
  await search.focus(); await page.keyboard.press('Enter');
  await phase('Request failed.');
  assert.equal(await ui.locator('[role="alert"]').count(), 0);
  assert.match(await ui.textContent(), /Check the connection and retry/);
  await context.setOffline(false);
  const retry = ui.getByRole('button', { name: 'Retry loading', exact: true });
  await retry.focus(); await page.keyboard.press('Enter');
  await phase('1 records loaded.');
  assert.match(await ui.textContent(), /Queue backlog/);
  assert.ok(api.some(item => item.status === 422), 'server validation response was observed');
  assert.ok(api.some(item => item.status === 200 && item.url.includes('q=queue')), 'retry returned an actual filtered HTTP response');
  await page.screenshot({ path: '/tmp/veil-backend-http-recovery.png', fullPage: true });
  await page.close();

  const simulation = await context.newPage();
  const simulationApi = [];
  simulation.on('request', request => { if (request.url().includes('/api/')) simulationApi.push(request.url()); });
  await simulation.goto(base);
  const sim = simulation.locator('#backend-interface');
  assert.equal(await simulation.locator('#mode-label').textContent(), 'Pages simulation');
  await sim.getByLabel('Filter records').fill('queue');
  const simSearch = sim.getByRole('button', { name: 'Search', exact: true });
  await simSearch.focus(); await simulation.keyboard.press('Enter');
  await simulation.waitForFunction(() => document.querySelector('#backend-interface .veil-interface-status')?.textContent.includes('1 records loaded.'));
  assert.match(await sim.textContent(), /Queue backlog/);
  assert.deepEqual(simulationApi, [], 'simulation must make no backend request');
  await simulation.screenshot({ path: '/tmp/veil-backend-pages-simulation.png', fullPage: true });
  console.log('Backend Lab recovery: server 422 observed, offline error surfaced safely, explicit retry succeeded over HTTP; Pages simulation filtered locally with zero API requests.');
  await context.close();
} finally { await browser.close(); }
