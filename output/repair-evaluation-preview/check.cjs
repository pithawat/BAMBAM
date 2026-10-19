const { chromium } = require('../../frontend/node_modules/@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
    await page.evaluate(() => document.fonts.ready);
    for(const width of [375, 1280]) {
      await page.setViewportSize({ width, height:1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path:path.join(__dirname, `preview-${width}.png`), fullPage:true });
      await page.locator('.action-review').screenshot({ path:path.join(__dirname, `card-${width}.png`) });
    }
    await page.locator('[data-action="rate"]').click();
    assert(await page.locator('#dialog').isVisible());
    assert.equal(await page.locator('[data-score][aria-checked="true"]').count(), 0);
    assert(await page.locator('#demo-submit').isDisabled());
    await page.keyboard.press('Escape');
    await page.locator('[data-quick-score="4"]').click();
    assert.equal(await page.locator('[data-score="4"]').getAttribute('aria-checked'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('#viewer').selectOption('subscriber');
    assert.equal(await page.locator('.action-review').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: 375/1280 layouts, evaluation entry, draft score, follower visibility, no JS errors.');
  } finally { await browser.close(); }
})();
