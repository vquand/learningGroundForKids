import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  server = await createServer({ configFile: false, cacheDir: '/tmp/plg-kitchen-counts-cache', root: fileURLToPath(new URL('../../', import.meta.url)),
    plugins: [react(), { name: 'kitchen-count-routes', configureServer(s) { s.middlewares.use((req, _res, next) => {
      if (req.headers.accept?.includes('text/html') && !req.url?.includes('.')) req.url = '/tests/browser/uiux-harness.html'; next();
    }); } }], server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLG_CHROMIUM_EXECUTABLE });
});
after(async () => { await browser?.close(); await server?.close(); });

async function fixture(width = 1024, height = 768, failFirst = false) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: true }); page.setDefaultTimeout(6000);
  const errors: string[] = []; page.on('pageerror', (error: Error) => errors.push(error.message));
  let failure = failFirst;
  const counts = { burger: 100, 'pan-seared-steak': 1, 'potato-carrot-beef-soup': 2, 'grilled-steak': 3, 'cabbage-rolls': 9, lemonade: 7, 'mint-tea': 4, 'iced-coffee': 0 };
  await page.route('**/api/**', async (route: any) => {
    const path = new URL(route.request().url()).pathname; if (!path.startsWith('/api/')) return route.fallback();
    let data: any = [];
    if (path.endsWith('/auth/session')) data = { authenticated: true, user: { id: 'family-a', name: 'Family', email: 'a@test.local' } };
    else if (path.endsWith('/profiles')) data = ['kid-a', 'kid-b'].map((id, i) => ({ id, name: i ? 'Ben' : 'Ada', emoji: '⭐', color: '#597653', public_id: `TEST${i}`, total_done: 0, badge_count: 0 }));
    else if (path.endsWith('/town/name')) data = { townName: { adjective: 'Sunny', noun: 'Meadow' } };
    else if (path.endsWith('/kitchen-completions')) {
      if (failure) { failure = false; return route.fulfill({ status: 503, json: { error: { message: 'Counts temporarily unavailable' } } }); }
      data = { counts: path.includes('/kid-a/') ? counts : {} };
    }
    return route.fulfill({ json: data });
  });
  return { page, errors, counts };
}

for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820], [768, 1024], [390, 844], [320, 667]]) {
  test(`recipe medals show saved counts in the top-right corner at ${width}x${height}`, async () => {
    const { page, errors } = await fixture(width, height);
    try {
      await page.goto(`${origin}/kitchen`);
      await page.locator('#kitchen-finished-burger').waitFor();
      assert.equal(await page.locator('.cooking-completion-medal').count(), 7);
      assert.match(await page.locator('#kitchen-finished-burger').textContent(), /× 100/);
      assert.match(await page.locator('#kitchen-finished-cabbage-rolls').textContent(), /9.*OK-ish \+ Perfect/);
      assert.equal(await page.locator('#kitchen-finished-iced-coffee').count(), 0);
      for (const medal of await page.locator('.cooking-completion-medal').all()) {
        await medal.scrollIntoViewIfNeeded();
        const box = await medal.boundingBox(), card = await medal.locator('..').boundingBox();
        assert.ok(box && card && box.x > card.x + card.width / 2 && box.y >= card.y && box.y < card.y + 16);
        assert.ok(box.x + box.width <= card.x + card.width);
        assert.ok(box.y + box.height < (await medal.locator('..').locator('h3').boundingBox()).y, 'medal stays above the recipe copy');
      }
      await page.locator('.app-shell').evaluate((node: HTMLElement) => { node.scrollTop = 0; });
      await page.screenshot({ path: `/tmp/plg-kitchen-medals-${width}.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', { name: 'Change interface language' }).click();
      await page.getByRole('button', { name: 'Tiếng Việt' }).click();
      assert.match(await page.locator('#kitchen-finished-cabbage-rolls').textContent(), /Tạm ổn \+ Hoàn hảo/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('counts retry, refresh on return, and remain scoped to the selected child', async () => {
  const { page, errors, counts } = await fixture(1024, 768, true);
  try {
    await page.goto(`${origin}/kitchen`);
    await page.getByText('Meal counts couldn’t load.', { exact: false }).waitFor();
    assert.equal(await page.locator('.cooking-completion-medal').count(), 0);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.locator('#kitchen-finished-burger').waitFor();
    await page.getByRole('link', { name: 'Back to Playground', exact: true }).click();
    counts.burger = 101;
    await page.getByRole('button', { name: /^Kitchen/ }).click();
    await page.waitForFunction(() => document.querySelector('#kitchen-finished-burger')?.textContent?.includes('× 101'));
    await page.getByRole('link', { name: 'Back to Playground', exact: true }).click();
    await page.getByRole('button', { name: 'Back to profiles', exact: true }).click();
    await page.getByRole('button', { name: /Ben/ }).first().click();
    await Promise.all([page.waitForResponse((response: any) => response.url().includes('/kid-b/kitchen-completions')), page.getByRole('button', { name: /^Kitchen/ }).click()]);
    assert.equal(await page.locator('.cooking-completion-medal').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
