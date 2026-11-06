import { chromium, webkit } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.VEIL_SITE_URL || 'http://127.0.0.1:4176/veil';
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch(name === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : {});
  try {
    const page = await browser.newPage(); const evidence = [];
    await page.goto(`${base}/playground/`);
    await page.evaluate(readFileSync(process.env.AXE_PATH, 'utf8'));
    for (const width of [195, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#editor').scrollIntoViewIfNeeded();
      const result = await page.evaluate(async () => {
        const editor = document.querySelector('#editor'), style = getComputedStyle(editor);
        const color = text => text.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const fg = luminance(color(style.color)), bg = luminance(color(style.backgroundColor));
        const rect = editor.getBoundingClientRect();
        const hitTargets = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]].map(([x,y]) => {
          const hit = document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height);
          return { tag: hit?.tagName, id: hit?.id, editor: hit === editor };
        });
        const axeResult = await axe.run(editor, { runOnly: ['color-contrast'] });
        return { foreground: style.color, background: style.backgroundColor, ratio: (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),
          opacity: style.opacity, backgroundImage: style.backgroundImage, hitTargets, axe: axeResult };
      });
      assert.ok(result.ratio >= 4.5); assert.equal(result.opacity, '1'); assert.equal(result.backgroundImage, 'none');
      assert.ok(result.hitTargets.every(hit => hit.editor), `${name} ${width} overlay`);
      assert.deepEqual(result.axe.violations, []);
      evidence.push({ width, ...result });
      await page.screenshot({ path: `/tmp/veil-playground-contrast-${name}-${width}.png` });
      console.log(name, width, 'computed contrast', result.ratio.toFixed(2), 'hit targets unobscured; axe incomplete', result.axe.incomplete.map(x => x.id));
    }
    writeFileSync(`/tmp/veil-playground-contrast-${name}.json`, JSON.stringify(evidence, null, 2));
  } finally { await browser.close(); }
}
