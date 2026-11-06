import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const base = process.env.BACKEND_URL || 'http://127.0.0.1:4188/veil/backend-lab/';
const staticBase = process.env.STATIC_BACKEND_URL || 'http://127.0.0.1:4189/veil/backend-lab/';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit }).filter(([name]) => !process.env.BROWSER || name === process.env.BROWSER)) {
  const browser = await engine.launch(name === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : {});
  const evidence = { browser: name, version: browser.version(), requests: [], responses: [], accessibility: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage(), errors = [];
    // Test-only transport fault: retain real HTTP, but deliver one response late even after abort.
    await page.addInitScript(() => {
      window.__trace = [];
      window.__backendTrace = entry => window.__trace.push(entry);
      const original = window.fetch.bind(window);
      window.fetch = async (url, options) => {
        if (window.__holdNext && String(url).includes('/api/records?q=')) {
          window.__holdNext = false;
          const response = await original(url, { ...options, signal: undefined });
          window.__held = true;
          await new Promise(resolve => { window.__release = resolve; });
          return response;
        }
        return original(url, options);
      };
      document.addEventListener('click', event => {
        const button = event.target.closest('#backend-interface button');
        if (button) window.__trace.push({ stage: 'native.click', detail: button.textContent });
      }, true);
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/')) evidence.requests.push({ method: request.method(), url: request.url(), body: request.postData() }); });
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const entry = { status: response.status(), url: response.url() };
        evidence.responses.push(entry);
        responses.push((async () => {
          let timeout;
          try { entry.body = await Promise.race([response.json(), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Response body unavailable after transport interruption')), 5000); })]); }
          catch (error) { entry.bodyUnavailable = error.message; }
          finally { clearTimeout(timeout); }
        })());
      }
    });
    await page.goto(`${base}?mode=http`);
    const ui = page.locator('#backend-interface');
    const button = label => ui.getByRole('button', { name: label, exact: true });
    const phase = text => page.waitForFunction(value => document.querySelector('#backend-interface .veil-interface-status')?.textContent.includes(value), text, { timeout: 10000 });
    const search = async query => { await ui.getByLabel('Filter records').fill(query); await button('Search').click(); };
    await phase('3 records loaded.');
    assert.equal(await page.locator('.boundary h2').textContent(), 'Real local HTTP');
    // Repeat the original blur-then-mouse-activation trigger, without focus/keyboard workarounds.
    for (let i = 0; i < 10; i++) {
      await search(i % 2 ? 'cache' : 'queue');
      await phase('1 records loaded.');
      await page.waitForFunction(title => document.querySelector('#backend-interface table')?.textContent.includes(title), i % 2 ? 'Cache refresh' : 'Queue backlog');
    }
    evidence.mouseSearchRepetitions = 10;
    await ui.getByLabel('New incident title').fill('');
    await ui.getByLabel('Describe the incident').fill('short');
    await button('Submit incident').click();
    assert.equal(await ui.locator('[aria-invalid="true"]').count(), 2);
    await ui.getByLabel('New incident title').fill('Browser validation test');
    await ui.getByLabel('Describe the incident').fill('A sufficiently detailed service request');
    // Mutate only the outgoing test request: the actual Node service must reject it and the host must display 422.
    await page.route('**/api/records', route => route.continue({ postData: JSON.stringify({ title: 'x', detail: 'short' }) }), { times: 1 });
    await button('Submit incident').click(); await phase('Request failed.');
    assert.match(await ui.textContent(), /Title must be 4–80 characters/);
    await button('Submit incident').click(); await phase('Submitted successfully.');
    assert.match(await ui.textContent(), /Browser validation test/);

    await page.evaluate(() => { window.__holdNext = true; window.__held = false; });
    await search('queue'); await page.waitForFunction(() => window.__held);
    await search('cache'); await phase('1 records loaded.');
    const current = await ui.textContent();
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__trace.some(entry => entry.stage === 'request.ignored'));
    assert.equal(await ui.textContent(), current, 'late response must not overwrite newer records');
    evidence.staleResponseSuppression = true;

    await page.evaluate(() => { window.__holdNext = true; window.__held = false; });
    await search('queue'); await page.waitForFunction(() => window.__held);
    await button('Cancel request').click(); await phase('Request cancelled.');
    const cancelled = await ui.textContent();
    const ignored = await page.evaluate(() => window.__trace.filter(entry => entry.stage === 'request.ignored').length);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(count => window.__trace.filter(entry => entry.stage === 'request.ignored').length > count, ignored);
    assert.equal(await ui.textContent(), cancelled, 'cancelled response must not update UI');
    evidence.cancellation = true;

    await context.setOffline(true); await search('queue'); await phase('Request failed.');
    assert.match(await ui.textContent(), /Check the connection and retry/);
    await context.setOffline(false); await button('Retry loading').click(); await phase('1 records loaded.');
    assert.match(await ui.textContent(), /Queue backlog/);
    assert.equal(await page.locator('#feedback').textContent(), '');
    evidence.offlineRetry = true;
    await search(''); await phase('4 records loaded.');

    const isolatedContext = await browser.newContext();
    const isolated = await isolatedContext.newPage();
    await isolated.goto(`${base}?mode=http`);
    await isolated.waitForFunction(() => document.querySelector('#backend-interface .veil-interface-status')?.textContent.includes('3 records loaded.'));
    assert.doesNotMatch(await isolated.locator('#backend-interface table').textContent(), /Browser validation test/);
    await isolatedContext.close(); evidence.sessionIsolation = true;

    if (!process.env.AXE_PATH) throw Error('AXE_PATH required for Backend Lab qualification');
    await page.evaluate(await readFile(process.env.AXE_PATH, 'utf8'));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const perspective of ['Experience', 'Definition', 'Host Integration', 'Architecture']) {
        await page.getByRole('tab', { name: perspective, exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width} ${perspective} overflow`);
        const result = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
        evidence.accessibility.push({ width, perspective, violations: result.violations, incomplete: result.incomplete });
        assert.deepEqual(result.violations.map(v => v.id), [], `${name} ${width} ${perspective}`);
        assert.deepEqual(result.incomplete.map(v => v.id), [], `${name} ${width} ${perspective} incomplete`);
      }
      await page.getByRole('tab', { name: 'Experience', exact: true }).click();
      // Exercise an action at mobile widths as well as checking layout.
      await search('queue'); await phase('1 records loaded.');
      await page.screenshot({ path: `/tmp/veil-backend-${name}-${width}.png`, fullPage: true });
    }
    await Promise.all(responses);
    console.log(`${name}: HTTP, responsive and accessibility assertions complete`);
    assert.ok(evidence.responses.some(r => r.status === 422));
    assert.ok(evidence.responses.some(r => r.status === 201));
    assert.deepEqual(errors, []);
    evidence.trace = await page.evaluate(() => window.__trace);
    assert.ok(evidence.trace.filter(entry => entry.stage === 'native.click' && entry.detail === 'Search').length >= 10);

    // Separate static-only server: Node HTTP service cannot receive these requests.
    const simulation = await context.newPage(), api = [], simErrors = [];
    simulation.on('request', r => { if (r.url().includes('/api/')) api.push(r.url()); });
    simulation.on('pageerror', error => simErrors.push(error.message));
    await simulation.goto(staticBase);
    const sim = simulation.locator('#backend-interface');
    assert.equal(await simulation.locator('#mode-label').textContent(), 'Pages simulation');
    await sim.getByLabel('Filter records').fill('queue');
    await sim.getByRole('button', { name: 'Search', exact: true }).click();
    await simulation.waitForFunction(() => document.querySelector('#backend-interface .veil-interface-status')?.textContent.includes('1 records loaded.'));
    assert.match(await sim.textContent(), /Queue backlog/);
    await sim.getByLabel('New incident title').fill('Static simulation incident');
    await sim.getByLabel('Describe the incident').fill('This is deterministic browser sample data.');
    await sim.getByRole('button', { name: 'Submit incident', exact: true }).click();
    await simulation.waitForFunction(() => document.querySelector('#backend-interface .veil-interface-status')?.textContent.includes('Submitted successfully.'));
    assert.match(await sim.textContent(), /Submitted \(simulation\)/);
    assert.deepEqual(api, []); assert.deepEqual(simErrors, []);
    await simulation.screenshot({ path: `/tmp/veil-backend-${name}-pages-simulation.png`, fullPage: true });
    evidence.staticSimulation = { origin: staticBase, apiRequests: api, submission: true };
    console.log(`${name} ${evidence.version}: PASS — mouse search 10/10, submission/422, late response, cancellation, offline/retry, session isolation, responsive/a11y, independent static simulation`);
    await context.close();
  } finally {
    await writeFile(`/tmp/veil-backend-${name}-qualification.json`, JSON.stringify(evidence, null, 2));
    await browser.close();
  }
}
