import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, type Browser, type Page } from 'playwright';
import { UFO_ACHIEVEMENT_GROUP, COOKING_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';

let browser: Browser, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  server = await createServer({ configFile: false, root: process.cwd(), cacheDir: '/tmp/plg-minigame-badges-cache', plugins: [react()], server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });


async function adjacentIcon(page: Page) {
  const badge = page.getByRole('button', { name: 'Badges', exact: true });
  const language = page.getByRole('button', { name: 'Change interface language' });
  const b = await badge.boundingBox(), l = await language.boundingBox();
  assert.ok(b && l && b.width === 48 && b.height === 48 && Math.abs(b.y - l.y) < 1 && Math.abs(l.x - b.x - b.width - 8) < 1);
  assert.equal(await badge.innerText(), '');
  assert.equal(await badge.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), true);
}

test('kitchen game headers and badge dialogs fit laptop and iPad landscapes', async () => {
  const page = await browser.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const game of ['cooking', 'grill', 'burger', 'cabbage-rolls', 'food-and-drink']) {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${origin}/tests/browser/minigame-badges-harness.html?fixture=1&game=${game}`);
      const badges = page.getByRole('button', { name: 'Badges', exact: true });
      await badges.waitFor();
      if (game === 'grill') assert.equal(await page.locator('.cooking-page--grill').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false, `${game} ${viewport.width} scrolls`);
      for (const control of await page.locator('.kid-nav button, .kid-nav a').all()) {
        const bounds = await control.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height, `${game} header control fits: ${await control.textContent()}`);
      }
      await adjacentIcon(page);
      await badges.click();
      await page.getByRole('dialog', { name: 'Badges', exact: true }).locator('article').first().waitFor();
      await page.getByRole('button', { name: 'Close badges' }).click();
      if (game === 'cabbage-rolls') {
        assert.equal(await page.locator('.cr-page').getAttribute('data-paused'), 'true');
        await page.getByRole('button', { name: 'Resume cooking' }).click();
        assert.equal(await page.locator('.cr-page').getAttribute('data-paused'), 'false');
      }
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('game badges show authoritative earned status, all pages, catalog limits, retry and accessible dismissal', async () => {
  const page = await browser.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let fail = false, reads = 0;
  await page.route('**/api/v1/profiles/profile-a/achievement-groups', route => {
    reads++; assert.equal(route.request().method(), 'GET');
    return route.fulfill(fail ? { status: 503, json: { error: { message: 'Unavailable' } } } : { json: [UFO_ACHIEVEMENT_GROUP, COOKING_ACHIEVEMENT_GROUP].map(group => ({
      ...group, scope: 'lifetime', recorded: true, metrics: [], achievements: group.achievements.map((badge, index) => ({ ...badge, earned: index === 0, earned_at: index === 0 ? '2026-10-19T00:00:00Z' : null })),
    })) });
  });
  await page.goto(`${origin}/tests/browser/minigame-badges-harness.html`);
  assert.equal(reads, 0);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport);
    await adjacentIcon(page);
    await page.getByRole('button', { name: 'Badges', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'First Word!', exact: true }).waitFor();
    assert.equal(await dialog.locator('article').count(), 3);
    assert.match(await dialog.innerText(), /1 of 15 earned/);
    assert.equal(await dialog.locator('.is-earned').count(), 1);
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      for (const name of await dialog.locator('article h3').allTextContents()) ids.add(name);
      assert.equal(await dialog.evaluate(element => element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth), false);
      for (const control of await dialog.locator('button').all()) {
        const bounds = await control.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
      }
      if (i < 4) await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    }
    assert.equal(ids.size, 15);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Badges', exact: true }).first().evaluate(element => element === document.activeElement), true);
  }
  await page.goto(`${origin}/tests/browser/minigame-badges-harness.html?group=cooking`);
  await page.getByRole('button', { name: 'Badges', exact: true }).click();
  await page.getByText('Not yet earnable', { exact: true }).first().waitFor();
  assert.equal(await page.getByRole('dialog').locator('.is-earned').count(), 0);
  await page.getByRole('button', { name: 'Close badges' }).click();
  await page.goto(`${origin}/tests/browser/minigame-badges-harness.html`);
  fail = true;
  await page.getByRole('button', { name: 'Badges', exact: true }).first().click();
  await page.getByRole('alert').waitFor();
  fail = false; await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('heading', { name: 'First Word!', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Vietnamese' }).click();
  await page.getByRole('button', { name: 'Huy hiệu', exact: true }).first().click();
  await page.getByRole('button', { name: 'Đóng huy hiệu' }).click();
  assert.deepEqual(errors, []);
  await page.close();
});
