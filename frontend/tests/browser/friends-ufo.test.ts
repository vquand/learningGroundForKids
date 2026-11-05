import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { emptyProgress, startSession, applyAction, publicState } from '../../../server/src/ufo/game.ts';
import vietnamese from '../../../server/src/ufo/dictionary.vi.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const errors: string[] = [];
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLG_CHROMIUM_EXECUTABLE });
});
after(async () => { await browser?.close(); await server?.close(); assert.deepEqual(errors, []); });
async function open(width: number, height: number, query = '') {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.goto(`${origin}/tests/browser/friends-ufo-harness.html${query}`); return page;
}
async function answerQuiz(page: any) {
  for (const input of await page.getByRole('textbox', { name: /^Answer for/ }).all()) {
    const prompt = await input.getAttribute('aria-label'); const match = prompt.match(/(\d+) ([×÷]) (\d+)/); assert.ok(match);
    await input.fill(String(match[2] === '×' ? Number(match[1]) * Number(match[3]) : Number(match[1]) / Number(match[3])));
  }
  await page.getByRole('button', { name: 'Check answers', exact: true }).click();
}
for (const [width, height] of [[1280, 600], [1366, 768], [1024, 768], [1180, 820]]) {
  test(`friend request fits ${width}×${height} and submits after quiz`, async () => {
    const page = await open(width!, height!);
    try {
      const dialog = page.getByRole('dialog', { name: 'Add friend' });
      assert.equal(await dialog.locator('.friend-dialog-body').evaluate((el: HTMLElement) => el.scrollHeight <= el.clientHeight + 1), true);
      for (const button of await dialog.getByRole('button').all()) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height!); }
      await answerQuiz(page);
      const code = page.getByRole('textbox', { name: 'Friend’s code' });
      await code.fill('ABC-1234'); await code.focus();
      const inputBounds = await code.boundingBox(), bodyBounds = await dialog.locator('.friend-dialog-body').boundingBox();
      assert.ok(inputBounds && bodyBounds);
      assert.ok(inputBounds.x + inputBounds.width + 5 <= bodyBounds.x + bodyBounds.width && inputBounds.y + inputBounds.height + 5 <= bodyBounds.y + bodyBounds.height, 'input focus ring fits inside scrollable body');

      await page.getByRole('button', { name: 'Send request', exact: true }).click();
      assert.equal(JSON.parse(await page.getByTestId('sent').innerText()).requestingProfileId, 'kid-a');
      await page.screenshot({ path: `/tmp/plg-friends-${width}-${height}.png` });
    } finally { await page.close(); }
  });
}
test('tiny viewport keeps footer visible and body scrollable; zero kids can send as family', async () => {
  const page = await open(375, 400, '?empty&parent');
  try {
    assert.equal(await page.getByRole('button', { name: 'One kid', exact: true }).first().isEnabled(), false);
    await page.getByRole('textbox', { name: 'Friend’s code' }).fill('ABC-1234');
    const send = page.getByRole('button', { name: 'Send request', exact: true }); const bounds = await send.boundingBox(); assert.ok(bounds && bounds.y + bounds.height <= 400);
    await send.click(); assert.equal(JSON.parse(await page.getByTestId('sent').innerText()).requestingScope, 'family');
  } finally { await page.close(); }
});
for (const [width, height] of [[1366, 768], [1280, 600], [1024, 768], [1180, 820]]) {
  test(`Vietnamese UFO setup and gameplay fit ${width}×${height} and reveal tones`, async () => {
    const page = await browser.newPage({ viewport: { width, height } });
    let progress = emptyProgress();
    page.on('pageerror', (error: Error) => errors.push(error.message));
    await page.route('**/api/v1/profiles/kid-a/ufo**', async (route: any) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        assert.equal(body.revision, progress.revision);
        progress = body.settings ? startSession(progress, body.settings, vietnamese, Date.now(), () => 0) : applyAction(progress, body.action, vietnamese, Date.now(), () => 0);
        progress.revision++;
      }
      await route.fulfill({ json: publicState(progress) });
    });
    try {
      await page.goto(`${origin}/tests/browser/friends-ufo-harness.html?ufo`);
      await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
      for (const button of await page.locator('.ufo-page').getByRole('button').all()) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height!); }
      await page.screenshot({ path: `/tmp/plg-ufo-vi-setup-${width}.png` });
      await page.getByRole('button', { name: 'Let’s play!', exact: true }).click();
      await page.locator('.ufo-keyboard').waitFor();
      assert.equal(await page.locator('.ufo-keyboard button').count(), 29);
      await page.getByText('Quả giòn, thường có vỏ đỏ hoặc xanh.', { exact: true }).waitFor();
      for (const button of await page.locator('.ufo-page').getByRole('button').all()) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height!); }
      assert.equal(await page.locator('.app-shell').count(), 0);
      for (const letter of ['T', 'A', 'O']) await page.getByRole('button', { name: letter, exact: true }).click();
      await page.getByRole('heading', { name: 'TÁO', exact: true }).waitFor();
      assert.equal(progress.session!.language, 'vi'); assert.equal(progress.session!.status, 'solved');
      await page.getByText('First Word!', { exact: true }).waitFor();
      await page.screenshot({ path: `/tmp/plg-ufo-vi-solved-${width}.png` });
    } finally { await page.close(); }
  });
}

test('long Vietnamese words and saved legacy English sessions keep all controls visible', async () => {
  for (const language of ['vi', 'en'] as const) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
    const pool = language === 'vi' ? [vietnamese.find(word => word.id === 'master-vi-vertebrate')!] : [{ id: 'legacy', word: 'CAT', difficulty: 'medium' as const, clue: 'A purring pet.', definition: 'A small pet.' }];
    let progress = startSession(emptyProgress(), { language, difficulty: 'medium', animal: 'cow', background: 'farm' }, pool, Date.now(), () => 0);
    if (language === 'en') delete progress.session!.language;
    await page.route('**/api/v1/profiles/kid-a/ufo**', async (route: any) => {
      if (route.request().method() === 'POST') { const body = route.request().postDataJSON(); progress = applyAction(progress, body.action, pool, Date.now(), () => 0); progress.revision++; }
      await route.fulfill({ json: publicState(progress) });
    });
    try {
      await page.goto(`${origin}/tests/browser/friends-ufo-harness.html?ufo`);
      if (language === 'en') {
        await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
        await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
        await page.getByRole('button', { name: 'Keep my saved game', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      const panel = await page.locator('.ufo-word-panel').boundingBox(); assert.ok(panel && panel.y + panel.height <= 600);
      for (const button of await page.locator('.ufo-page').getByRole('button').all()) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 600); }
      assert.equal(await page.locator('.ufo-page').evaluate((el: HTMLElement) => el.scrollHeight <= el.clientHeight + 1), true);
      await page.screenshot({ path: `/tmp/plg-ufo-long-${language}.png` });
    } finally { await page.close(); }
  }
});

test('accept dialog actions fit a short laptop and still require correct answers', async () => {
  const page = await open(1280, 600, '?accept');
  try {
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    assert.equal(await page.getByTestId('sent').innerText(), '');
    for (const input of await page.getByRole('textbox', { name: /^Answer for/ }).all()) {
      const match = (await input.getAttribute('aria-label')).match(/(\d+) ([×÷]) (\d+)/); assert.ok(match);
      await input.fill(String(match[2] === '×' ? Number(match[1]) * Number(match[3]) : Number(match[1]) / Number(match[3])));
    }
    for (const button of await page.getByRole('dialog').getByRole('button').all()) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 600); }
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    assert.equal(await page.getByTestId('sent').innerText(), 'accepted');
  } finally { await page.close(); }
});

for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
  test(`UFO scales to the full ${width}×${height} viewport with countryball choices`, async () => {
    const page = await browser.newPage({ viewport: { width, height } });
    let progress = emptyProgress();
    await page.route('**/api/v1/profiles/kid-a/ufo**', async (route: any) => {
      if (route.request().method() === 'POST') { const body = route.request().postDataJSON(); progress = startSession(progress, body.settings, vietnamese, Date.now(), () => 0); progress.revision++; }
      await route.fulfill({ json: publicState(progress) });
    });
    async function fits() {
      const bounds = await page.locator('.ufo-page').boundingBox(); assert.ok(bounds && bounds.width >= width! - 1 && bounds.height >= height! - 1);
      assert.equal(await page.locator('.ufo-page').evaluate((el: HTMLElement) => el.scrollHeight <= el.clientHeight + 1), true);
      for (const button of await page.locator('.ufo-page').getByRole('button').all()) { const box = await button.boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= height!); }
    }
    try {
      await page.goto(`${origin}/tests/browser/friends-ufo-harness.html?ufo`);
      const vi = page.getByRole('button', { name: 'Tiếng Việt', exact: true }); await vi.waitFor();
      assert.equal(await vi.innerText(), '');
      assert.ok((await vi.locator('.ufo-country-ball').evaluate((el: HTMLElement) => getComputedStyle(el).backgroundImage)).includes('country-balls-v2.png'));
      const setup = await page.locator('.ufo-setup').boundingBox(); assert.ok(setup && setup.width > width! * .9 && setup.height > height! * .8);
      await vi.click(); await fits();
      await page.screenshot({ path: `/tmp/plg-ufo-large-setup-${width}.png` });
      await page.getByRole('button', { name: 'Let’s play!', exact: true }).click();
      await page.locator('.ufo-keyboard').waitFor(); await fits();
      const arena = await page.locator('.ufo-scene').boundingBox(); assert.ok(arena && arena.width > width! * .4);
      await page.screenshot({ path: `/tmp/plg-ufo-large-play-${width}.png` });
    } finally { await page.close(); }
  });
}
