import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';

const base = process.env.VEIL_SITE_URL || 'http://127.0.0.1:4176/veil';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch(name === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/showcase/`);
    const ui = page.locator('#agent-interface');
    const button = label => ui.getByRole('button', { name: label, exact: true });
    const tab = label => page.getByRole('tab', { name: label, exact: true });
    async function phase(value) { await page.waitForFunction(v => document.querySelector('#agent-interface .veil-interface-status')?.textContent.startsWith(v), value); }
    await phase('IDLE');
    assert.equal(await ui.locator('.veil-interface-table').count(), 2);
    assert.equal(await button('Approve handoff').isVisible(), false);
    await button('Start simulation').click(); await button('Pause').click();
    await tab('Definition').click();
    const snapshot = JSON.parse(await page.locator('#snapshot-json').textContent());
    assert.equal(snapshot.data.pauseLabel, 'Resume');
    assert.equal(JSON.parse(await page.locator('#definition-json').textContent()).id, 'agent-monitor');
    await tab('Host Integration').click();
    assert.equal(await page.locator('#host-source').textContent(), readFileSync('docs/assets/showcase/integration.mjs', 'utf8'));
    for (const source of ['agent.mjs', 'definition.mjs']) {
      await page.selectOption('#source-file', source);
      assert.equal(await page.locator('#host-source').textContent(), readFileSync(`docs/assets/showcase/${source}`, 'utf8'));
    }
    await tab('Architecture').click();
    await page.keyboard.press('Home'); assert.equal(await tab('Experience').getAttribute('aria-selected'), 'true');
    await button('Advance one step').click();
    assert.match(await ui.textContent(), /3 services found/);
    await button('Advance one step').click(); await phase('FAILED');
    await button('Retry tool').click(); await button('Advance one step').click(); await phase('APPROVAL');
    await page.screenshot({ path: `/tmp/veil-showcase-${name}-desktop.png`, fullPage: true });
    await button('Approve handoff').click(); await button('Advance one step').click(); await phase('COMPLETED');
    assert.match(await ui.textContent(), /4 of 4 steps complete/);
    await button('Test update safeguards').click();
    assert.match(await ui.textContent(), /Rejected a stale revision and invalid table data/);
    await phase('COMPLETED');
    await tab('Definition').click();
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export current interface JSON' }).click();
    const download = await downloadPromise; const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.id, 'agent-monitor'); assert.match(exported.data.status, /^COMPLETED/);
    await tab('Experience').click();
    await button('Reset simulation').click();
    await ui.getByLabel('Scenario for the next run').selectOption('success');
    await button('Start simulation').click(); await phase('APPROVAL');
    await button('Reject request').click(); await phase('REJECTED');
    assert.doesNotMatch(await ui.textContent(), /handoff.prepare →/);
    await button('Start simulation').click(); await button('Cancel execution').click(); await phase('CANCELLED');
    const cancelled = await ui.textContent(); await page.waitForTimeout(1200); assert.equal(await ui.textContent(), cancelled);
    await button('Start simulation').click(); await button('Reset simulation').click(); await phase('IDLE');
    await page.waitForTimeout(1200); await phase('IDLE');
    // Complete an automatic success run to exercise the actual timer scheduler.
    await ui.getByLabel('Scenario for the next run').selectOption('success');
    await button('Start simulation').click(); await phase('APPROVAL');
    await button('Approve handoff').click(); await phase('COMPLETED');
    await button('Reset simulation').click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const perspective of ['Experience', 'Definition', 'Host Integration', 'Architecture']) {
        await tab(perspective).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width} ${perspective} overflow`);
      }
      await tab('Experience').click();
      await page.screenshot({ path: `/tmp/veil-showcase-${name}-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await tab('Experience').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await tab('Definition').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home'); await button('Start simulation').focus(); await page.keyboard.press('Enter'); await phase('RUNNING');
    await button('Cancel execution').click();
    const blocked = await page.evaluate(async () => {
      window.probe = 0; const script = document.createElement('script'); script.textContent = 'window.probe=1'; document.body.append(script);
      let network = false; try { await fetch('https://example.com'); network = true; } catch {}
      return { script: window.probe, network };
    }); assert.deepEqual(blocked, { script: 0, network: false });
    if (!process.env.AXE_PATH) throw Error('AXE_PATH is required for showcase qualification');
    await page.evaluate(readFileSync(process.env.AXE_PATH, 'utf8'));
    const a11y = [];
    for (const perspective of ['Experience', 'Definition', 'Host Integration', 'Architecture']) {
      await tab(perspective).click();
      const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], `${name} ${perspective}`);
      assert.deepEqual(result.incomplete.map(v => v.id), [], `${name} ${perspective}: accessibility checks need review`);
      a11y.push({ perspective, incomplete: result.incomplete });
    }
    await tab('Experience').click(); await button('Reset simulation').click();
    await ui.getByLabel('Scenario for the next run').selectOption('success');
    await button('Start simulation').click(); await phase('APPROVAL');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      assert.deepEqual(result.violations.map(v => v.id), [], `${name} approval ${width}`);
      assert.deepEqual(result.incomplete.map(v => v.id), [], `${name} approval ${width} incomplete`);
      a11y.push({ perspective: `Approval ${width}`, incomplete: result.incomplete });
      await page.screenshot({ path: `/tmp/veil-showcase-${name}-approval-${width}.png`, fullPage: true });
    }
    writeFileSync(`/tmp/veil-showcase-${name}-a11y.json`, JSON.stringify(a11y, null, 2));
    // A real DOM commit exception must stop host scheduling and surface a safe error.
    await page.reload(); await phase('IDLE');
    await button('Start simulation').click();
    await page.evaluate(() => {
      const status = document.querySelector('#agent-interface .veil-interface-status');
      // UI 0.4.2 preserves the text node and updates nodeValue in place.
      Object.defineProperty(status.firstChild, 'nodeValue', { set() { throw new Error('Injected renderer failure'); } });
    });
    await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Reload to restart safely'));
    const frozen = await ui.textContent(); await page.waitForTimeout(1200); assert.equal(await ui.textContent(), frozen);
    assert.doesNotMatch(await page.locator('#feedback').textContent(), /Injected renderer failure/);
    console.log(`${name}: all showcase flows PASS; axe zero violations; incomplete: ${JSON.stringify(a11y.map(x => ({ perspective: x.perspective, checks: x.incomplete.map(i => i.id) })))}`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
