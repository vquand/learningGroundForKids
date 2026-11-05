import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { INFINIDRILL_ACHIEVEMENT_GROUP, TOWN_ACHIEVEMENT_GROUP, achievementGroupStatus } from '../../../server/src/achievement-catalog.ts';
import { emptyProgress, applyCommand, publicState } from '../../../server/src/infinidrill/progress.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const artifacts = '/tmp/plg-achievement-catalog-browser';
before(async () => {
  await mkdir(artifacts, { recursive: true });
  server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
test('admin catalog previews ten badges and migration succeeds repeatedly, fails safely, and retries', async () => {
  const page = await browser.newPage();
  const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message));
  let installed: Array<any> = [], fail = false, writes = 0;
  await page.route('**/api/v1/admin/achievements**', async (route: any) => {
    const request = route.request();
    if (request.method() === 'POST') {
      writes++;
      assert.ok(request.url().endsWith('/achievements/migrate'));
      assert.equal(request.postData(), null);
      if (fail) return route.fulfill({ status: 503, json: { error: { message: 'Temporary catalog outage' } } });
      const needsMigration = installed.length === 0;
      installed = INFINIDRILL_ACHIEVEMENT_GROUP.achievements.map(a => ({ ...a, groupId: INFINIDRILL_ACHIEVEMENT_GROUP.id }));
      return route.fulfill({ json: { groups: [achievementGroupStatus(INFINIDRILL_ACHIEVEMENT_GROUP, installed)], migratedGroups: needsMigration ? 1 : 0, installed: needsMigration ? 10 : 0 } });
    }
    return route.fulfill({ json: [achievementGroupStatus(INFINIDRILL_ACHIEVEMENT_GROUP, installed)] });
  });
  await page.goto(`${origin}/tests/browser/achievement-catalog-harness.html`);
  await page.getByRole('heading', { name: 'Infinidrill · Earth Expedition' }).waitFor();
  assert.equal(await page.locator('article').count(), 10);
  assert.equal(await page.getByRole('button', { name: 'Migrate achievement data' }).count(), 1);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport);
    const button = page.getByRole('button', { name: 'Migrate achievement data' });
    const bounds = await button.boundingBox(); assert.ok(bounds && bounds.y + bounds.height <= viewport.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${artifacts}/admin-${viewport.width}.png`, fullPage: true });
  }
  const migrate = page.getByRole('button', { name: 'Migrate achievement data' });
  await migrate.click();
  await page.getByRole('status').filter({ hasText: '10 achievement definitions synced across 1 group' }).waitFor();
  assert.match(await page.locator('body').innerText(), /10\/10 definitions current/);
  await page.waitForFunction(() => !document.querySelector('button:disabled'));
  await migrate.click();
  await page.getByRole('status').filter({ hasText: 'already up to date' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button:disabled'));
  fail = true; await migrate.click();
  await page.getByRole('alert').filter({ hasText: 'Temporary catalog outage' }).waitFor();
  fail = false; await migrate.click();
  await page.getByRole('status').filter({ hasText: 'already up to date' }).waitFor();
  assert.equal(writes, 4); assert.deepEqual(errors, []);
  await page.close();
});
test('admin catalog renders all Town badges from their measured atlas crops', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message));
  await page.route('**/api/v1/admin/achievements**', (route: any) => route.fulfill({
    json: [achievementGroupStatus(TOWN_ACHIEVEMENT_GROUP, [])],
  }));
  await page.goto(`${origin}/tests/browser/achievement-catalog-harness.html`);
  const group = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Town Building · Little Town' }) });
  await group.getByRole('heading', { name: 'Town Building · Little Town' }).waitFor();
  assert.equal(await group.locator('article').count(), 10);
  assert.equal(await group.locator('image[href="/minigames/town-building/badges.png"]').count(), 5);
  assert.equal(await group.locator('image[href="/minigames/town-building/garden-badges.png"]').count(), 2);
  assert.equal(await group.locator('.achievement-badge-art').count(), 3);
  assert.equal(await group.locator('.achievement-badge-art').evaluateAll((badges: HTMLElement[]) => badges.every(badge =>
    getComputedStyle(badge).backgroundImage.includes('/minigames/town-building/civ-badges-v1.png'),
  )), true);
  assert.deepEqual(await group.locator('svg.town-sprite').evaluateAll((sprites: SVGSVGElement[]) => sprites.map(sprite => sprite.getAttribute('viewBox'))), [
    '10 120 424 436', '434 120 435 436', '869 120 434 436', '1303 120 435 435', '1738 119 423 436',
    '314 12 685 680', '1172 12 685 680',
  ]);
  assert.deepEqual(errors, []);
  await page.close();
});
test('the player group shows server-earned and locked badges with difficulty and artwork', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, { random: () => 0 });
  p = applyCommand(p, { type: 'submit-answer', questionId: p.game!.currentQuestion!.id, answer: p.game!.currentQuestion!.answer }, 1000, { random: () => 0 });
  await page.route('**/api/v1/profiles/profile-a/infinidrill', (route: any) => route.fulfill({ json: publicState(p) }));
  await page.goto(`${origin}/tests/browser/achievement-catalog-harness.html#badges`);
  await page.getByRole('heading', { name: 'First Dig' }).waitFor();
  assert.equal(await page.locator('article').count(), 10);
  assert.match(await page.locator('article').first().innerText(), /Earned/);
  assert.equal(await page.getByText('Locked', { exact: true }).count(), 9);
  const artwork = page.locator('.achievement-badge-art');
  assert.equal(await artwork.count(), 10);
  assert.equal(await artwork.evaluateAll((badges: HTMLElement[]) => badges.every(badge => {
    const style = getComputedStyle(badge);
    return style.backgroundImage.includes('/minigames/infinidrill/achievement-badges.png') && style.backgroundSize === '500% 200%';
  })), true);
  await page.screenshot({ path: `${artifacts}/player-badges.png`, fullPage: true });
  await page.close();
});
