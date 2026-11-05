import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: '/tmp/plg-explore-navigation-cache',
    plugins: [react(), { name: 'explore-routes', configureServer(s) { s.middlewares.use((req, _res, next) => {
      if (req.headers.accept?.includes('text/html') && !req.url?.includes('.')) req.url = '/tests/browser/explore-navigation-harness.html'; next();
    }); } }], server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLG_CHROMIUM_EXECUTABLE });
});
after(async () => { await browser?.close(); await server?.close(); });
async function fixture(width: number, height: number, done = true) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: true }); page.setDefaultTimeout(6000);
  const errors: string[] = []; page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/api/v1/**', async (route: any) => {
    const path = new URL(route.request().url()).pathname;
    let data: any = [];
    if (path.endsWith('/profiles')) data = [{ id: 'kid-a', name: 'Ada', emoji: '⭐', color: '#597653', total_done: 1 }];
    else if (path === '/api/v1/items') data = [{ id: 'polar-vortex', category: 'phenomenon', latitude: 40, longitude: -75, title: 'Polar Vortex', icon_slug: 'phenomenon', quiz_required: false }];
    else if (path === '/api/v1/items/polar-vortex') data = { id: 'polar-vortex', category: 'phenomenon', latitude: 40, longitude: -75, media: [], available_languages: ['en', 'vi'], translation: { title: 'Polar Vortex', description: 'A ring of strong winds high above Earth’s poles. '.repeat(35), lang: 'en' }, fun_facts: Array.from({ length: 12 }, (_, i) => `Weather fact ${i + 1}: The winds circle the poles.`) };
    else if (path.endsWith('/progress/polar-vortex')) data = { done: path.includes('/kid-a/') && done };
    else if (path.endsWith('/progress')) data = { done_item_ids: done ? ['polar-vortex'] : [], wip_item_ids: [] };
    else if (path.includes('/flashcards/')) data = [];
    else if (path.includes('/quiz/')) data = { status: 'not_available', has_quiz: false, passed: false, quiz_required: false };
    return route.fulfill({ json: data });
  });
  return { page, errors };
}

for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820], [768, 1024], [390, 844], [320, 667]]) {
  test(`Explore restores its camera and keeps the completed item header sticky at ${width}x${height}`, async () => {
    const { page, errors } = await fixture(width!, height!);
    try {
      await page.goto(`${origin}/map`);
      await page.locator('[data-item-id="polar-vortex"]').waitFor();
      await page.evaluate(() => (window as any).exploreMap.setView([40.25, -74.75], 6.25, { animate: false }));
      const before = await page.evaluate(() => { const map = (window as any).exploreMap; return { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() }; });
      await page.locator('[data-item-id="polar-vortex"]').tap();
      await page.locator('.item-detail-titlebar').waitFor();
      await page.getByRole('img', { name: 'Completed', exact: true }).waitFor();
      const medal = await page.locator('.item-completion-medal').boundingBox(), title = await page.locator('h1 > span:last-child').boundingBox();
      assert.ok(medal && title && medal.x + medal.width <= title.x);
      await page.locator('.app-shell > div').evaluate((node: HTMLElement) => { node.scrollTop = 700; });
      const back = await page.locator('.item-detail-backbar').boundingBox(), label = await page.locator('.item-detail-titlebar').boundingBox();
      assert.ok(back && Math.abs(back.y) < 1);
      assert.ok(label && Math.abs(label.y - 64) < 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `/tmp/plg-explore-sticky-${width}.png` });
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.locator('.illustrated-world-map').waitFor();
      const after = await page.evaluate(() => { const map = (window as any).exploreMap; return { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() }; });
      assert.equal(after.zoom, before.zoom);
      const pixelDistance = await page.evaluate(({ before, after }: any) => { const map = (window as any).exploreMap; return map.project(before.center, before.zoom).distanceTo(map.project(after.center, after.zoom)); }, { before, after });
      assert.ok(pixelDistance < 1, `restored camera differs by ${pixelDistance}px; only Leaflet pixel rounding is allowed`);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('the item medal follows confirmed completion and disappears for another child', async () => {
  const { page, errors } = await fixture(1024, 768, false);
  try {
    await page.goto(`${origin}/items/polar-vortex`);
    await page.locator('.item-detail-titlebar').waitFor();
    assert.equal(await page.locator('.item-completion-medal').count(), 0);
    await page.evaluate(() => (window as any).exploreNavigation.setDone(true));
    await page.locator('.item-completion-medal').waitFor();
    await page.evaluate(() => (window as any).exploreNavigation.switchChild());
    await page.waitForResponse((response: any) => response.url().includes('/kid-b/progress/polar-vortex'));
    assert.equal(await page.locator('.item-completion-medal').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
