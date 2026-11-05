import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()],
    root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

for (const width of [320, 768, 1024, 1145, 1440]) {
  test(`login illustration stays grounded and unobstructed at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 811 } });
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    try {
      await page.route('**/api/v1/**', (route: any) => route.fulfill({ json:
        new URL(route.request().url()).pathname.endsWith('/registration')
          ? { enabled: false } : { authenticated: false } }));
      await page.goto(`${origin}/login`);
      await page.getByRole('heading', { name: 'Welcome back, explorer!' }).waitFor();
      const path = await page.locator('main svg[viewBox="0 0 260 32"]').boundingBox();
      const rice = await page.locator('img[src*="rice-grain"]').boundingBox();
      const card = await page.locator('main section').nth(1).boundingBox();
      assert.ok(path && rice && card);
      assert.equal(await page.getByRole('button', { name: 'Switch to Admin' }).count(), 0);
      assert.ok(path.y >= rice.y + rice.height - 16, 'the dotted path stays beneath the illustration');
      if (width >= 1024) {
        assert.ok(rice.x + rice.width < card.x, 'illustration must not overlap the form');
      } else {
        assert.ok(path.y + path.height < card.y, 'mobile illustration stays above the form');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/tmp/plg-login-illustration-${width}.png`, fullPage: true });
    } finally { await page.close(); }
  });
}
