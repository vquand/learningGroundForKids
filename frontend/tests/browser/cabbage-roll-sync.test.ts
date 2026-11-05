import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { CabbageRollSession } from '../../../server/src/town-building/cabbage-rolls';

const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

function savedRecipe(patch: Partial<CabbageRollSession> = {}): CabbageRollSession {
  return { revision: 20, sessionId: 'saved-recipe', phase: 'add', ingredient: 3, cuts: 3,
    onionPeeled: true, added: [0, 1, 2], seasoning: [], covered: false, restStartedAt: null,
    cabbagePlaced: false, steamCovered: false, steamHeat: null, steamStartedAt: null,
    rolls: 0, portion: null, folds: [], torn: false, arranged: 0, sauce: false,
    potCovered: false, heat: null, cookingStartedAt: null, outcome: null, ...patch };
}

async function setup(width: number, height: number, initial = savedRecipe(), loseResponse = false, failRead = false) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(8_000);
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  // Disposable browser fixture: no production identities, cookies or writes.
  let saved = structuredClone(initial);
  let failNext = true;
  let stamina = 0;
  let requests = 0;
  let syncReadFailed = false;
  await page.route('**/api/v1/**', async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/health/ready') return route.fulfill({ json: { status: 'ready' } });
    if (path === '/api/v1/auth/session') return route.fulfill({ json: { authenticated: true, user: { id: 'test-family', name: 'Test family', email: 'test@example.com' } } });
    if (path === '/api/v1/profiles') return route.fulfill({ json: [{ id: 'test-kid', name: 'Test kid', familyId: 'test-family' }] });
    if (path.endsWith('/cabbage-rolls')) {
      if (failRead && requests > 0 && !syncReadFailed) { syncReadFailed = true; return route.abort('failed'); }
      return route.fulfill({ json: saved });
    }
    if (path.endsWith('/cabbage-rolls/action')) {
      requests++;
      if (failNext && !loseResponse) { failNext = false; return route.abort('failed'); }
      const { revision, command } = request.postDataJSON();
      assert.equal(revision, saved.revision, 'recovery sends the saved revision');
      let reward = 0;
      if (command.type === 'add' && saved.phase === 'add') saved.added = [...new Set([...saved.added, command.index])];
      if (command.type === 'next' && saved.phase === 'add' && saved.added.length === 4) saved.phase = 'season';
      if (command.type === 'serve' && saved.phase === 'result') { saved.phase = 'served'; stamina += 8; reward = 8; }
      saved.revision++;
      if (failNext) { failNext = false; return route.abort('failed'); }
      return route.fulfill({ json: { ...saved, townReward: { stamina: reward } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(origin);
  await page.getByRole('button', { name: /Test kid.*explored/ }).click();
  await page.evaluate(() => { history.pushState({}, '', '/cooking/cabbage-rolls'); dispatchEvent(new PopStateEvent('popstate')); });
  try { await page.locator(`.cr-page[data-phase="${initial.phase}"]`).waitFor(); }
  catch (error) { console.error({ url: page.url(), body: await page.locator('body').innerText(), errors }); await page.close(); throw error; }
  return { page, errors, get saved() { return saved; }, get stamina() { return stamina; }, get requests() { return requests; } };
}

async function fits(page: any) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false, 'recovery needs no scrolling');
  const viewport = page.viewportSize();
  for (const control of await page.locator('.cr-page button:visible, .cr-page a:visible').all()) {
    const bounds = await control.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, `control fits: ${await control.textContent()}`);
  }
}

for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820]]) {
  test(`lost ingredient request can be synchronized and completed at ${width}x${height}`, async () => {
    const t = await setup(width, height, savedRecipe(), false, width === 1366);
    try {
      await t.page.getByRole('button', { name: 'Onion', exact: true }).click();
      await t.page.getByRole('alert').waitFor();
      assert.equal(await t.page.locator('.cr-workspace').getAttribute('inert'), '');
      await fits(t.page);
      await t.page.screenshot({ path: `/tmp/cabbage-sync-error-${width}.png` });
      const failedRead = width === 1366 ? t.page.waitForEvent('requestfailed', (request: any) => request.url().endsWith('/cabbage-rolls') && request.method() === 'GET') : null;
      await t.page.getByRole('button', { name: 'Sync recipe', exact: true }).click();
      if (width === 1366) {
        await failedRead;
        await t.page.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('.cr-sync-error button'); return button && !button.disabled; });
        assert.equal(await t.page.locator('.cr-workspace').getAttribute('inert'), '', 'a failed resync keeps gameplay frozen');
        assert.equal(t.requests, 1, 'no further actions are sent while the recipe is unavailable');
        await t.page.getByRole('button', { name: 'Sync recipe', exact: true }).click();
      }
      await t.page.getByRole('alert').waitFor({ state: 'hidden' });
      assert.equal(await t.page.getByRole('button', { name: 'Choose seasonings', exact: true }).isDisabled(), true);
      assert.equal(await t.page.locator('.cr-ingredient-added').count(), 3);
      assert.equal(t.saved.added.length, 3, 'the dropped action was not assumed to have saved');
      await t.page.getByRole('button', { name: 'Onion', exact: true }).click();
      const saved = t.page.waitForResponse((response: any) => response.url().endsWith('/cabbage-rolls/action') && response.ok() && response.request().postDataJSON().command.type === 'next');
      await t.page.getByRole('button', { name: 'Choose seasonings', exact: true }).click();
      await saved;
      assert.equal(t.saved.phase, 'season');
      assert.equal(await t.page.locator('.cr-page').getAttribute('data-phase'), 'season');
      await fits(t.page);
      await t.page.screenshot({ path: `/tmp/cabbage-sync-${width}.png` });
      assert.deepEqual(t.errors, []);
    } finally { await t.page.close(); }
  });
}

for (const loseResponse of [false, true]) test(`serve recovery ${loseResponse ? 'recognizes a saved response' : 'restores the unsaved result'} without duplicating stamina`, async () => {
  const t = await setup(1024, 768, savedRecipe({ phase: 'result', rolls: 3, outcome: 'perfect' }), loseResponse);
  try {
    await t.page.getByRole('button', { name: 'Serve my rolls', exact: true }).click();
    await t.page.getByRole('alert').waitFor();
    await fits(t.page);
    await t.page.getByRole('button', { name: 'Sync recipe', exact: true }).click();
    await t.page.getByRole('alert').waitFor({ state: 'hidden' });
    if (loseResponse) {
      assert.equal(await t.page.locator('.cr-page').getAttribute('data-phase'), 'served');
      assert.equal(await t.page.getByRole('button', { name: 'Serve my rolls', exact: true }).count(), 0);
      assert.equal(t.requests, 1, 'a committed serve is not resent');
    } else {
      assert.equal(await t.page.locator('.cr-page').getAttribute('data-phase'), 'result');
      assert.equal(t.stamina, 0);
      const saved = t.page.waitForResponse((response: any) => response.url().endsWith('/cabbage-rolls/action') && response.ok());
      await t.page.getByRole('button', { name: 'Serve my rolls', exact: true }).click();
      await saved;
    }
    assert.equal(t.stamina, 8);
    await fits(t.page);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});
