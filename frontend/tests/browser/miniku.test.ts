import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { MINIKU_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';
import { applyCommand, emptyProgress, publicState } from '../../../server/src/miniku/game.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

async function bounds(page: any, state: string) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    const root = dialog ?? document.querySelector('.miniku-achievement-panel') ?? document.querySelector('.miniku-page');
    return {
      dimensions: { height: innerHeight, width: innerWidth, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, elements: ['.miniku-topbar','.miniku-layout','.miniku-board-card','.miniku-grid-wrap','.miniku-side-card'].map(selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return {selector, width:r?.width, height:r?.height, bottom:r?.bottom}; }) },
      scrolls: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
      controls: Array.from(root?.querySelectorAll('button') ?? []).filter(button => !button.disabled && button.getClientRects().length).map(button => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { name: button.textContent, visible: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1, usable: !!hit && (hit === button || button.contains(hit)) };
      }),
    };
  });
  if (result.scrolls) await page.screenshot({ path: `/tmp/miniku-overflow-${page.viewportSize().width}.png` });
  assert.equal(result.scrolls, false, `${state} scrolls: ${JSON.stringify(result.dimensions)}`);
  for (const control of result.controls) { assert.ok(control.visible, `${state}: ${control.name} outside viewport`); assert.ok(control.usable, `${state}: ${control.name} covered`); }
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
  test(`Miniku complete flows fit ${viewport.width}x${viewport.height}`, async () => {
    const page = await browser.newPage({ viewport, hasTouch: true });
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    let progress = emptyProgress();
    await page.route('**/api/v1/profiles/*/miniku**', async (route: any) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const { revision, command } = request.postDataJSON();
        assert.equal(revision, progress.revision);
        progress = applyCommand(progress, command, Date.now(), () => 0);
        progress.revision++;
      }
      await route.fulfill({ json: publicState(progress) });
    });
    await page.route('**/api/v1/profiles/*/achievement-groups', (route: any) => route.fulfill({ json: [{ ...MINIKU_ACHIEVEMENT_GROUP, achievements: publicState(progress).achievements.map(badge => ({ ...badge, earned: !!badge.earnedAt })) }] }));
    await page.goto(`${origin}/tests/browser/miniku-harness.html`);
    await page.getByRole('button', { name: 'Make my puzzle →' }).waitFor();
    await bounds(page, 'setup');
    for (const size of [3, 4, 5] as const) {
      if (progress.board) await page.getByRole('button', { name: 'Change difficulty', exact: true }).first().click();
      await page.getByRole('button', { name: new RegExp(`${size} × ${size}`) }).click();
      await page.getByRole('button', { name: 'Make my puzzle →' }).click();
      await page.locator(`.miniku-grid-${size}`).waitFor();
      await bounds(page, `${size} gameplay`);
      const solution = progress.board!.solution;
      const givens = progress.board!.givens;
      for (let index = 0; index < givens.length; index++) {
        if (givens[index]) continue;
        const cell = page.locator('.miniku-cell').nth(index);
        await cell.click();
        await page.locator('.miniku-number-pad').getByRole('button', { name: String(solution[index]), exact: true }).click();
        await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLButtonElement>('.miniku-cell')).some(button => !button.disabled));
      }
      await page.getByRole('dialog', { name: 'Congratulations! You solved it!' }).waitFor();
      await bounds(page, `${size} completion`);
      await page.getByRole('button', { name: 'Look at my grid' }).click();
      await page.getByRole('button', { name: /Badges/ }).click();
      await bounds(page, `${size} badges`);
      await page.getByRole('button', { name: 'Close badges' }).click();
    }
    assert.deepEqual(errors, []);
    await page.close();
  });
}

for (const mode of ['logout', 'relogin', 'profile', 'leave']) {
  test(`late Miniku response is discarded after ${mode}`, async () => {
    const page = await browser.newPage();
    let release!: () => void;
    let held!: () => void;
    const heldRequest = new Promise<void>(resolve => { held = resolve; });
    const responseGate = new Promise<void>(resolve => { release = resolve; });
    let reads = 0;
    await page.route('**/api/v1/profiles/*/miniku**', async (route: any) => {
      if (route.request().method() === 'POST') {
        held(); await responseGate;
        const next = applyCommand(emptyProgress(), { type: 'start', size: 3 }, Date.now(), () => 0);
        next.revision = 1;
        return route.fulfill({ json: publicState(next) });
      }
      const progress = emptyProgress();
      progress.revision = reads++ ? 99 : 0;
      return route.fulfill({ json: publicState(progress) });
    });
    await page.goto(`${origin}/tests/browser/miniku-harness.html`);
    await page.getByRole('button', { name: 'Make my puzzle →' }).click();
    await heldRequest;
    if (mode === 'leave') await page.getByRole('link', { name: 'Back to Playground', exact: true }).click();
    else await page.evaluate((change: string) => (window as any).minikuTest.changeOwner(change), mode);
    if (mode === 'relogin' || mode === 'profile') await page.getByRole('button', { name: 'Make my puzzle →' }).waitFor({ state: 'visible' });
    const response = page.waitForResponse((response: any) => response.request().method() === 'POST');
    release(); await response;
    // Wait for callbacks in the fulfilled transport and React to settle.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const cached = await page.evaluate(() => (window as any).minikuTest.revisions());
    assert.ok(cached.every((entry: any) => entry.revision !== 1), 'late mutation must not recreate or overwrite private progress');
    assert.equal(await page.locator('.miniku-grid').count(), 0, 'late result must not start the old board');
    await page.close();
  });
}

test('switching profile during number flight cancels the sprite and completion callbacks', async () => {
  const page = await browser.newPage();
  let progress = applyCommand(emptyProgress(), { type: 'start', size: 3 }, Date.now(), () => 0);
  const index = progress.board!.givens.findIndex(value => value === 0);
  const answer = progress.board!.solution[index]!;
  progress.board!.entries = [...progress.board!.solution];
  progress.board!.entries[index] = null;
  progress.board!.selectedIndex = index;
  await page.route('**/api/v1/profiles/*/miniku**', async (route: any) => {
    if (new URL(route.request().url()).pathname.includes('/profile-b/')) return route.fulfill({ json: publicState(emptyProgress()) });
    if (route.request().method() === 'POST') {
      progress = applyCommand(progress, route.request().postDataJSON().command, Date.now(), () => 0);
      progress.revision++;
    }
    return route.fulfill({ json: publicState(progress) });
  });
  await page.goto(`${origin}/tests/browser/miniku-harness.html`);
  const response = page.waitForResponse((response: any) => response.request().method() === 'POST');
  await page.locator('.miniku-number-pad').getByRole('button', { name: String(answer), exact: true }).click();
  await response;
  await page.locator('.miniku-flying-number').waitFor();
  await page.evaluate(() => (window as any).minikuTest.changeOwner('profile'));
  await page.locator('.miniku-flying-number').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Make my puzzle →' }).waitFor();
  const cached = await page.evaluate(() => (window as any).minikuTest.revisions());
  assert.ok(cached.every((entry: any) => entry.revision !== 1));
  assert.equal(await page.locator('.miniku-completion-burst, dialog[open]').count(), 0);
  await page.close();
});
