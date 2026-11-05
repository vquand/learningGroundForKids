import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { emptyTown, BLUEPRINTS, TOWN_BADGES } from '../../../server/src/town-building/game.ts';
import { emptyProgress, publicState } from '../../../server/src/infinidrill/progress.ts';
const { chromium } = createRequire(import.meta.url)('playwright');

// Opt in: this tests the actual packaged UAT stack, not a checkout Vite harness.
test('local UAT loads shared modules through the actual frontend container', { skip: process.env.PLG_LOCAL_UAT !== '1' }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
  const profile = { id: 'smoke-profile', name: 'Smoke test', emoji: '⭐', color: '#3B82F6', total_done: 0, badge_count: 0 };
  try {
    for (const [path, selector] of [
      ['/playground', '#activity-hub-title'],
      ['/town-building', 'canvas'],
      ['/infinidrill', '.infinidrill-start-button'],
      ['/uat/cooking', '.cooking-menu-grid'],
      ['/uat/food-and-drink/lemonade', '.food-drink-step-card'],
    ]) {
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
      const errors: string[] = [];
      page.on('pageerror', (error: Error) => errors.push(error.message));
      page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', (response: any) => { if (response.url().startsWith('http://localhost:5173/') && !response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.addInitScript(() => {
        localStorage.setItem('plg-ui-language', 'en');
      });
      // No user credentials or writes: mock identity/progress only in this
      // disposable browser while real Docker Vite serves every code/art module.
      await page.route('**/api/**', (route: any) => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        if (!pathname.startsWith('/api/')) return route.fallback();
        if (request.method() !== 'GET') return route.abort();
        if (pathname.endsWith('/health/ready')) return route.fallback();
        let json: unknown = [];
        if (pathname.endsWith('/auth/session')) json = { authenticated: true, user: { id: 'smoke-family', name: 'Smoke test', email: 'smoke@example.test' } };
        else if (pathname.endsWith('/profiles')) json = [profile];
        else if (pathname.endsWith('/town')) json = { ...emptyTown(), blueprints: BLUEPRINTS, badges: TOWN_BADGES };
        else if (pathname.endsWith('/town/name')) json = { townName: emptyTown().townName };
        else if (pathname.endsWith('/environment')) json = { season: 'autumn', localDate: '2026-10-14', timeZone: 'UTC', precipitation: 'none', snowCover: false, weatherSource: 'unavailable', observedAt: null, expiresAt: '', canPreviewEnvironment: false, locationLabel: 'Smoke test' };
        else if (pathname.endsWith('/infinidrill')) json = publicState(emptyProgress());
        return route.fulfill({ json });
      });
      await page.goto('http://localhost:5173');
      await page.getByRole('button', { name: /Smoke test.*explored/ }).click();
      await page.evaluate((path: string) => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
      try { await page.locator(selector!).first().waitFor({ timeout: 10000 }); }
      catch (error) { console.error(path, errors, await page.locator('body').innerText()); throw error; }
      assert.equal(await page.locator('vite-error-overlay').count(), 0, path);
      assert.deepEqual(errors, [], path);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('local UAT sign-in and family landing serve the new pastel artwork', { skip: process.env.PLG_LOCAL_UAT !== '1' }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
  try {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
      for (const authenticated of [false, true]) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on('pageerror', (error: Error) => errors.push(error.message));
        page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
        await page.addInitScript(() => { localStorage.setItem('plg-ui-language', 'en'); });
        await page.route('**/api/**', (route: any) => {
          const request = route.request(), path = new URL(request.url()).pathname;
          if (!path.startsWith('/api/')) return route.fallback();
          if (request.method() !== 'GET') return route.abort();
          if (path.endsWith('/health/ready')) return route.fallback();
          let json: unknown = [];
          if (path.endsWith('/auth/session')) json = authenticated ? { authenticated: true, user: { id: 'art-family', name: 'Art preview', email: 'art@example.test' } } : { authenticated: false };
          else if (path.endsWith('/auth/registration')) json = { enabled: false };
          else if (path.endsWith('/google/config')) json = { enabled: false };
          else if (path.endsWith('/profiles')) json = [{ id: 'art-profile', name: 'Explorer', emoji: '⭐', color: '#3B82F6', total_done: 0, badge_count: 0 }];
          return route.fulfill({ json });
        });
        await page.goto(authenticated ? 'http://localhost:5173/' : 'http://localhost:5173/login');
        await page.getByRole('heading', { name: authenticated ? "Who's joining today?" : 'Welcome back, explorer!', exact: true }).waitFor();
        const mascot = page.locator('img[src="/illustrations/rice-grain-explorer-pastel.png"]');
        await mascot.waitFor();
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
        assert.equal(await mascot.evaluate((image: HTMLImageElement) => image.naturalWidth), 1254);
        assert.match(await page.locator('.seasonal-screen').evaluate((node: Element) => getComputedStyle(node).backgroundImage), /-pastel-chubby\.png/);
        // Decode every seasonal asset from the actual container, including event art.
        if (viewport.width === 1366 && !authenticated) await page.evaluate(async () => {
          for (const theme of ['spring', 'summer', 'fall', 'winter', 'halloween', 'christmas', 'vietnam-national-day', 'tet']) {
            const image = new Image(); image.src = `/illustrations/seasonal/${theme}-pastel-chubby.png`; await image.decode();
            if (image.naturalWidth < 1600 || image.naturalHeight !== 941) throw new Error(`Invalid artwork: ${theme}`);
          }
        });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `/tmp/plg-pastel-${authenticated ? 'family' : 'signin'}-${viewport.width}.png`, fullPage: true });
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally { await browser.close(); }
});
