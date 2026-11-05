/** Run from frontend/: npm run test:browser:fishing */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, type Browser, type Page } from 'playwright';
import { fishingFixture } from './fishing-fixture.ts';
let browser: Browser, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const fixture = fishingFixture();
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: '/tmp/plg-fishing-vite-cache', plugins: [react(), fixture.plugin], server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });
async function fit(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const modal = document.querySelector('dialog[open]'), root = modal ?? document;
    return { overflow: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
      modalOverflow: !!modal && (modal.scrollHeight > modal.clientHeight + 1 || modal.scrollWidth > modal.clientWidth + 1),
      controls: Array.from(root.querySelectorAll('button,a,select')).filter(e => e.checkVisibility()).map(element => {
        const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { name: element.getAttribute('aria-label') ?? element.textContent, inView: box.x >= 0 && box.y >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1, hit: hit === element || !!hit && element.contains(hit), height: box.height };
      }) };
  });
  if (result.overflow || result.modalOverflow || result.controls.some(c => !c.inView || !c.hit)) await page.screenshot({ path: `/tmp/fishing-fit-${page.viewportSize()!.width}.png` });
  assert.equal(result.overflow, false, `${label} page scroll`); assert.equal(result.modalOverflow, false, `${label} modal scroll`);
  for (const control of result.controls) { assert.ok(control.inView, `${label} ${control.name} outside viewport`); assert.ok(control.hit, `${label} ${control.name} covered`); assert.ok(control.height >= 47.5, `${label} ${control.name} touch target is ${control.height}px high`); }
}
async function open(page: Page, scenario = 'fresh') { fixture.reset(scenario); await page.goto(`${origin}/tests/browser/fishing-harness.html`); await page.getByRole('button', { name: 'Let’s go fishing' }).waitFor(); await page.waitForLoadState('networkidle'); }
async function start(page: Page) { await page.getByRole('button', { name: 'Let’s go fishing' }).click(); await page.getByRole('heading', { name: 'Your bait box' }).waitFor(); }
async function pause(page: Page) {
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Fishing paused', exact: true }); await dialog.waitFor();
  await fit(page, 'pause dialog'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Continue fishing', exact: true }).waitFor();
}
async function nextMath(page:Page){await page.waitForFunction(()=>document.querySelector('.fishing-question-view .question-answer-line')?.textContent==='?');assert.ok(fixture.state().question);}
async function finishCast(page: Page) { await page.locator('.fishing-page[data-phase=waiting]').waitFor(); await page.locator('.fishing-page[data-phase=result]').waitFor({ timeout: 14000 }); }
for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) test(`fishing full flow fits ${viewport.width}×${viewport.height}`, async () => {
  const page = await browser.newPage({ viewport }); const errors: string[] = [], missingArt: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.url().includes('/minigames/') && r.status() >= 400) missingArt.push(r.url()); });
  await open(page); await fit(page, 'setup'); await page.getByRole('button', { name: 'Capybara', exact: true }).click(); await start(page); await fit(page, 'ready');
  assert.equal(await page.getByRole('button', { name: 'Cast ×1' }).count(), 0); assert.equal(fixture.state().running, true);
  await page.getByRole('button', { name: 'Earn bait', exact: true }).click(); const math = page.getByRole('region', { name: 'Earn a bait' }); await math.waitFor(); await fit(page, 'math');
  assert.equal(await page.locator('dialog[open]').count(), 0, 'math stays in the sidebar');
  assert.equal(await page.locator('.fishing-scene').evaluate(scene => {
    const box = scene.getBoundingClientRect(); return scene.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), true, 'the companion scene remains uncovered during math');
  await math.getByRole('button', { name: '9', exact: true }).click(); await math.getByRole('button', { name: 'Submit' }).click(); await math.getByText('Give it another try!').waitFor(); assert.equal(fixture.state().bait.baby, 0);
  assert.equal(await math.locator('.question-answer-line').innerText(), '?');
  await math.getByRole('button', { name: '7', exact: true }).click(); assert.equal(await math.locator('.question-answer-line').innerText(), '7');
  await math.getByRole('button', { name: 'Clear', exact: true }).click(); await page.keyboard.type(String(fixture.state().question!.question.answer)); await page.keyboard.press('Enter'); await nextMath(page); await page.keyboard.press('Escape'); assert.equal(fixture.state().bait.baby, 0); await fit(page, 'bait earned');
  await finishCast(page); await page.getByText('New discovery!', { exact: true }).waitFor(); await fit(page, 'catch'); assert.equal(fixture.state().inventory.P1, 1); assert.equal(fixture.state().points.pond, 1);
  await page.getByRole('button', { name: 'Collection', exact: true }).click(); await page.getByRole('dialog', { name: 'Your fishing collection' }).waitFor(); await fit(page, 'inventory'); await page.getByRole('button', { name: 'Next', exact: true }).click(); await fit(page, 'inventory page 2'); await page.getByRole('button', { name: 'Discovery journal', exact: true }).click(); await fit(page, 'journal'); await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Badges', exact: true }).click(); await page.getByRole('dialog', { name: 'Badges', exact: true }).getByRole('heading', { name: 'First Nibble', exact: true }).waitFor(); await fit(page, 'badges'); assert.match(await page.getByRole('dialog').innerText(), /1 of 7 earned/); await page.getByRole('button', { name: 'Close badges' }).click();
  await page.getByRole('button', { name: 'Fishing spot & friend' }).click(); await fit(page, 'trip choices'); await page.getByRole('button', { name: 'Let’s go fishing' }).click();
  const badge = await page.getByRole('button', { name: 'Badges', exact: true }).boundingBox(), language = await page.getByRole('button', { name: 'Change interface language' }).boundingBox(); assert.ok(badge && language && badge.height === 48 && Math.abs(badge.y - language.y) < 1 && Math.abs(language.x - badge.x - 56) < 1);
  await page.getByRole('button', { name: 'Back to Playground' }).click(); await page.getByRole('dialog', { name: 'Leave this fishing trip?' }).waitFor(); await fit(page, 'quit confirmation'); await page.getByRole('button', { name: 'Leave', exact: true }).click(); await page.getByRole('heading', { name: 'Playground', exact: true }).waitFor(); assert.deepEqual(errors, []); assert.deepEqual(missingArt, []); await page.close();
});
test('garbage and turtles preserve authoritative rewards, inventory and odds', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); await open(page, 'garbage'); await start(page); await finishCast(page); await fit(page, 'garbage'); assert.equal(fixture.state().bait.baby, 4); assert.equal(fixture.state().points.pond, 0); assert.equal(fixture.state().stats.garbage, 1); assert.equal(await page.locator('.fishing-emote.is-annoyed').count(), 1);
  await open(page, 'turtle'); await start(page); assert.doesNotMatch(await page.locator('.fishing-odds').innerText(), /%/); await page.getByText('No fishy', { exact: true }).waitFor(); await finishCast(page); await fit(page, 'turtle'); assert.equal(fixture.state().points.pond, 2); assert.ok(fixture.state().discovered.pond.includes('T1')); assert.equal('T1' in fixture.state().inventory, false); await page.getByText('A turtle! Points earned, journal updated, turtle released.').waitFor(); await page.close();
});
test('cast pauses for badges, visibility and reload; sync never repeats consumed bait or rewards', async () => {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } }); await open(page, 'ready'); await start(page); await page.locator('[data-phase=waiting]').waitFor(); await page.getByRole('button', { name: 'Badges', exact: true }).click(); await page.getByRole('button', { name: 'Close badges' }).click(); await page.getByRole('button', { name: 'Continue fishing' }).waitFor(); await fit(page, 'paused'); const remaining = fixture.state().cast!.remainingMs; await page.waitForTimeout(1200); assert.equal(fixture.state().cast!.remainingMs, remaining);
  await page.getByRole('button', { name: 'Continue fishing' }).click(); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.getByRole('button', { name: 'Continue fishing' }).waitFor(); await page.reload(); await page.getByRole('button', { name: 'Let’s go fishing' }).waitFor(); assert.equal(fixture.state().stats.casts, 1); await page.getByRole('button', { name: 'Let’s go fishing' }).click(); await page.locator('[data-phase=waiting]').waitFor(); await pause(page); await page.getByRole('button', { name: 'Continue fishing' }).waitFor(); assert.equal(fixture.state().stats.casts, 1); assert.equal(fixture.state().bait.baby, 4);
  await fetch(`${origin}/__fishing-fixture?fail=1`); await page.getByRole('button', { name: 'Continue fishing' }).click(); await page.getByRole('button', { name: 'Reconnect' }).waitFor(); await fit(page, 'reconnect'); await page.getByRole('button', { name: 'Reconnect' }).click(); await page.getByRole('button', { name: 'Continue fishing' }).click(); await page.locator('[data-phase=result]').waitFor({ timeout: 14000 }); assert.equal(fixture.state().inventory.P1, 1); assert.equal(fixture.state().stats.casts, 1); await page.reload(); assert.equal(fixture.state().inventory.P1, 1); await page.close();
});
test('pond graduation unlocks river and its baits', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); await open(page, 'graduate'); await start(page); await page.getByRole('dialog', { name: 'You completed this spot!' }).waitFor({ timeout: 14000 }); await fit(page, 'graduation'); await page.getByRole('dialog', { name: 'You completed this spot!' }).getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'River baits', exact: true }).click(); await page.getByRole('button', { name: /Scholar Bait/ }).click(); await fit(page, 'river baits'); await page.getByRole('button', { name: 'Fishing spot & friend' }).click(); await page.getByRole('button', { name: /Village River/ }).click(); await page.getByRole('button', { name: 'Let’s go fishing' }).click(); await fit(page, 'river'); assert.equal(fixture.state().location, 'river'); assert.equal(await page.getByRole('button', { name: /Scholar Bait/ }).count(), 1); await page.close();
});

test('math answer lost after commit can sync without stranding the question or granting bait twice', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page); await start(page); await page.getByRole('button', { name: 'Earn bait', exact: true }).click(); await page.getByRole('region', { name: 'Earn a bait' }).waitFor();
  await page.keyboard.type(String(fixture.state().question!.question.answer)); await fetch(`${origin}/__fishing-fixture?failAfter=1`); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Reconnect' }).waitFor(); await fit(page, 'math reconnect'); assert.equal(fixture.state().bait.baby, 0);
  await page.route('**/api/v1/profiles/profile-a/fishing', async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
  await page.getByRole('button', { name: 'Reconnect' }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(fixture.state().bait.baby, 0); assert.equal(fixture.state().stats.questions, 1); await page.getByRole('button', { name: 'Continue fishing' }).waitFor(); assert.equal(fixture.state().stats.casts, 1); await page.close();
});

test('inline math keyboard input never grades behind an open badge dialog', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page, 'ready'); await start(page);
  await page.getByRole('button', { name: 'Earn bait', exact: true }).click();
  const math = page.getByRole('region', { name: 'Earn a bait' }); await math.waitFor();
  await page.keyboard.press('2');
  const questionId = fixture.state().question!.id;
  const expectedAnswer = String(fixture.state().question!.question.answer);
  await page.getByRole('button', { name: 'Badges', exact: true }).click();
  const badges = page.getByRole('dialog', { name: 'Badges', exact: true }); await badges.waitFor();
  await badges.getByRole('button', { name: 'Next', exact: true }).focus();
  await page.keyboard.press('9'); await page.keyboard.press('Enter');
  assert.equal(fixture.state().question!.id, questionId);
  assert.equal(fixture.state().question!.attempts, 0);
  assert.equal(fixture.state().bait.baby, 4);
  assert.equal(await math.locator('.question-answer-line').innerText(), '2');
  await page.getByRole('button', { name: 'Close badges' }).click();
  await math.focus(); await math.getByRole('button', { name: 'Clear', exact: true }).click(); await page.keyboard.type(expectedAnswer); await page.keyboard.press('Enter'); await nextMath(page);
  assert.equal(fixture.state().bait.baby, 5);
  assert.equal(await math.evaluate(e => document.activeElement === e), true);assert.equal(await math.locator('.question-answer-line').innerText(),'?');
  await page.close();
});

test('every companion float stays attached to the painted line in both poses at every required viewport', async () => {
  const page = await browser.newPage(); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const name of ['Highland Cow', 'Capybara', 'Dairy Cow']) {
    await open(page, 'ready'); await page.getByRole('button', { name, exact: true }).click(); await start(page);
    await page.locator('.fishing-float').waitFor();
    for (const pose of ['casting', 'idle']) {
      if (pose === 'idle') await page.waitForFunction(() => document.querySelector('.fishing-friend-art')?.getAttribute('viewBox')?.startsWith('0 '));
      for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
        await page.setViewportSize(viewport);
        const join = await page.locator('.fishing-companion').evaluate(async companion => {
          const art = companion.querySelector<SVGSVGElement>('.fishing-friend-art')!;
          const float = companion.querySelector<HTMLElement>('.fishing-float')!;
          const x = Number(float.dataset.lineX), y = Number(float.dataset.lineY);
          const artBox = art.getBoundingClientRect(), floatBox = float.getBoundingClientRect(), view = art.viewBox.baseVal;
          const image = new Image(); image.src = art.querySelector('image')!.getAttribute('href')!; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1254;
          const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 1254, 1254);
          return { dx: Math.abs(floatBox.x + 8 - artBox.x - (x - view.x) / view.width * artBox.width),
            dy: Math.abs(floatBox.y - artBox.y - (y - view.y) / view.height * artBox.height),
            paintedAlpha: context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] };
        });
        assert.ok(join.dx < 1 && join.dy < 1, `${name} ${pose} ${viewport.width}: float disconnected`);
        assert.ok(join.paintedAlpha! > 100, `${name} ${pose}: anchor must touch the painted line`);
        await fit(page, `${name} ${pose}`);
      }
    }
    await pause(page);
  }
  await page.close();
});
test('Vietnamese switches mounted fishing UI and every required viewport stays usable', async () => {
  const page = await browser.newPage(); await open(page, 'ready'); const revision = fixture.state().revision;
  await page.getByRole('button', { name: 'Change interface language' }).click(); await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click(); await page.getByRole('button', { name: 'Đổi ngôn ngữ giao diện' }).waitFor(); assert.equal(fixture.state().revision, revision);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport); await fit(page, 'Vietnamese setup');
  }
  await page.locator('.fishing-setup-panel>.fishing-primary').click();
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport); await fit(page, 'Vietnamese ready'); await page.locator('.fishing-collection-button').click(); await page.locator('.fishing-collection-dialog').waitFor(); await fit(page, 'Vietnamese basket'); await page.locator('.fishing-dialog>header button').click();
    await page.locator('.fishing-action-area>.fishing-secondary').click(); await page.locator('.fishing-math-panel').waitFor(); await fit(page, 'Vietnamese math'); await page.keyboard.press('Escape'); await page.locator('.fishing-math-panel').waitFor({ state: 'detached' });
  }
  assert.equal(fixture.state().bait.baby, 4); await page.close();
});
test('hidden pages stop cast heartbeats and require an explicit resume', async () => {
  const page = await browser.newPage(); await open(page, 'ready'); await start(page); await page.locator('[data-phase=waiting]').waitFor();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.getByRole('button', { name: 'Continue fishing' }).waitFor(); const remaining = fixture.state().cast!.remainingMs;
  await page.waitForTimeout(1200); assert.equal(fixture.state().cast!.remainingMs, remaining); await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(1200); assert.equal(fixture.state().cast!.remainingMs, remaining); assert.equal(fixture.state().cast!.paused, true); await page.close();
});

test('trip setup greets ready friends and stacks locations while previewing the chosen landscape', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await open(page, 'river');
  const choices = page.locator('.fishing-friend-choices');
  const preview = page.locator('.fishing-ready-preview');
  for (const [name, id] of [['Highland Cow', 'highland'], ['Capybara', 'capybara'], ['Dairy Cow', 'cow']]) {
    await choices.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(value => document.querySelector('.fishing-ready-preview .fishing-ready-friend')?.getAttribute('data-companion') === value, id);
    assert.ok(await preview.locator('img').getAttribute('src') === `/minigames/fishing/ready-${id}.png`);
    await preview.locator('.fishing-ready-body.is-greeting').waitFor();
    await preview.locator('.fishing-ready-heart').waitFor();
  }
  await preview.locator('.fishing-ready-heart').waitFor({ state: 'detached' });
  const revision = fixture.state().revision;
  await preview.click(); await preview.locator('.fishing-ready-heart').waitFor();
  assert.equal(fixture.state().revision, revision, 'greeting the chosen friend is cosmetic');
  const spots = page.locator('.fishing-location-choices button');
  const pond = await spots.nth(0).boundingBox(), river = await spots.nth(1).boundingBox();
  assert.ok(pond && river && river.y >= pond.y + pond.height && Math.abs(pond.x - river.x) < 1, 'locations form a vertical list');
  await page.getByRole('button', { name: /Little Pond.*Fishing points:/ }).click();
  await page.locator('.fishing-setup-scene.is-pond').waitFor();
  assert.match(await page.locator('.fishing-setup-scene').evaluate(e => getComputedStyle(e).backgroundImage), /pond\.png/);
  await page.getByRole('button', { name: /Village River.*Fishing points:/ }).click();
  await page.locator('.fishing-setup-scene.is-river').waitFor();
  assert.match(await page.locator('.fishing-setup-scene').evaluate(e => getComputedStyle(e).backgroundImage), /river-v2\.png/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preview.click();
  assert.equal(await preview.locator('.fishing-ready-body').evaluate(e => getComputedStyle(e).animationName), 'none');
  assert.equal(await preview.locator('.fishing-ready-heart').evaluate(e => getComputedStyle(e).opacity), '1');
  await fit(page, 'ready friend setup');
  await page.close();
});

test('one start keeps fishing alongside math, repeats casts, waits for bait and resumes without another click', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page, 'single'); await start(page);
  const firstCast = fixture.state().cast!.id;
  await page.getByRole('button', { name: 'Earn bait', exact: true }).click();
  const math = page.getByRole('region', { name: 'Earn a bait' }); await math.waitFor();
  const remaining = fixture.state().cast!.remainingMs;
  await page.waitForResponse(response => response.url().endsWith('/fishing/action') && response.request().postDataJSON()?.command.type === 'tick');
  assert.ok(fixture.state().cast!.remainingMs < remaining);
  assert.equal(fixture.state().cast?.paused, false); await fit(page, 'parallel math');
  await page.keyboard.type(String(fixture.state().question!.question.answer)); await page.keyboard.press('Enter'); await nextMath(page);
  assert.equal(fixture.state().bait.baby, 1); assert.equal(fixture.state().cast?.id, firstCast);
  assert.equal(fixture.state().question!.baitId,'baby');
  // The second question can stay open across the first catch and the next cast.
  await page.waitForFunction(id => document.querySelector('.fishing-reveal')?.getAttribute('data-cast-id') === id, firstCast);
  await fit(page, 'catch while math stays open');
  await page.locator('.fishing-float').waitFor();
  assert.notEqual(fixture.state().cast?.id, firstCast);
  assert.equal(fixture.state().stats.casts, 2); assert.equal(fixture.state().bait.baby, 0);
  await page.getByText('More bait, please!', { exact: true }).waitFor({ timeout: 14000 });
  await fit(page, 'out of bait with math'); assert.equal(fixture.state().running, true);
  assert.equal(await page.locator('.fishing-emote.is-annoyed').count(), 1);
  await math.focus(); await page.keyboard.type(String(fixture.state().question!.question.answer)); await page.keyboard.press('Enter'); await nextMath(page);
  assert.equal(fixture.state().stats.casts, 3); assert.equal(fixture.state().cast?.phase, 'waiting');
  assert.equal(fixture.state().inventory.P1, 2); assert.equal(fixture.state().points.pond, 2);
  await pause(page); await page.close();
});

test('a saved cast never disables friend selection or consumes another bait when a friend changes', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page, 'saved'); const before = fixture.state().cast!;
  await page.getByRole('button', { name: 'Dairy Cow', exact: true }).click();
  await page.getByRole('button', { name: 'Say hello to Dairy Cow', exact: true }).waitFor();
  assert.equal(fixture.state().cast?.id, before.id); assert.equal(fixture.state().cast?.outcome, before.outcome);
  assert.equal(fixture.state().cast?.remainingMs, before.remainingMs); assert.equal(fixture.state().bait.baby, 0);
  await fit(page, 'saved cast friend selection'); await start(page);
  await page.getByRole('button', { name: 'Fishing spot & friend' }).click();
  await page.getByRole('button', { name: 'Capybara', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s go fishing' }).click();
  assert.equal(fixture.state().companion, 'capybara'); assert.equal(fixture.state().cast?.id, before.id);
  await fit(page, 'changed friend mid session'); await page.close();
});

test('answer input waits for a slow heartbeat without losing keystrokes or replaying an answer', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page, 'single'); await start(page);
  await page.getByRole('button', { name: 'Earn bait', exact: true }).click();
  const math = page.getByRole('region', { name: 'Earn a bait' }); await math.waitFor();
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let delayed = false;
  await page.route('**/fishing/action', async route => {
    if (!delayed && route.request().postDataJSON().command.type === 'tick') { delayed = true; entered(); await gate; }
    await route.continue();
  });
  await blocked;
  await math.focus(); await page.keyboard.type(String(fixture.state().question!.question.answer));
  assert.equal(await math.locator('.question-answer-line').innerText(), String(fixture.state().question!.question.answer));
  await page.keyboard.press('Enter'); release();
  await nextMath(page);
  assert.equal(fixture.state().stats.questions, 1); assert.equal(fixture.state().bait.baby, 1);
  assert.equal(fixture.state().stats.casts, 1); assert.equal(await page.getByRole('button', { name: 'Reconnect' }).count(), 0);
  await pause(page); await page.close();
});

test('a blur during start or continue wins over a late server reply', async () => {
  const page = await browser.newPage(); await open(page, 'single');
  for (const type of ['cast', 'resume']) {
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const handler = async (route: import('playwright').Route) => {
      if (route.request().postDataJSON().command.type === type) { entered(); await gate; }
      await route.continue();
    };
    await page.route('**/fishing/action', handler);
    await page.getByRole('button', { name: type === 'cast' ? 'Let’s go fishing' : 'Continue fishing', exact: true }).click();
    await blocked; await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const paused = page.waitForResponse(response => response.url().endsWith('/fishing/action') && response.request().postDataJSON()?.command.type === 'pause');
    release(); await paused;
    await page.getByRole('button', { name: 'Continue fishing', exact: true }).waitFor();
    assert.equal(fixture.state().running, false); assert.equal(fixture.state().cast?.paused, true);
    assert.equal(fixture.state().stats.casts, 1); assert.equal(fixture.state().bait.baby, 0);
    await page.unroute('**/fishing/action', handler);
  }
  await page.close();
});

test('bait and fish tallies stay visible above column math in both languages at every required viewport', async () => {
  const page = await browser.newPage(); await open(page, 'learning-river'); await start(page);
  await pause(page);
  await page.getByRole('button', { name: 'Earn bait', exact: true }).click();
  await page.locator('.fishing-math-panel').waitFor();
  assert.equal(await page.locator('.fishing-bait-tally li').count(), 7);
  assert.equal(await page.locator('.fishing-fish-tally li').count(), 6);
  assert.match(await page.locator('.fishing-fish-tally li').filter({ hasText: 'Silver Dace' }).innerText(), /×2/);
  assert.match(await page.locator('.fishing-fish-tally li').filter({ hasText: 'Whisker Catfish' }).innerText(), /×0/);
  assert.equal(await page.getByRole('button', { name: 'Check answer', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Submit', exact: true }).count(), 1);
  const rows = page.locator('.fishing-question-view .question-math-row');
  assert.equal(await rows.count(), 3);
  const top = await rows.nth(0).boundingBox(), lower = await rows.nth(1).boundingBox(), result = await rows.nth(2).boundingBox();
  assert.ok(top && lower && result && top.y < lower.y && lower.y < result.y);
  const supplies = await page.locator('.fishing-supplies').boundingBox(), math = await page.locator('.fishing-math-panel').boundingBox();
  assert.ok(supplies && math && supplies.y + supplies.height + 12 <= math.y, 'space separates supplies from the question');
  const equation = await page.locator('.fishing-question-view .question-equation-column').boundingBox(), numpad = await page.locator('.fishing-keypad').boundingBox();
  assert.ok(equation && numpad && equation.y + equation.height <= numpad.y, 'numpad is below the question');
  assert.equal(await page.locator('.fishing-control-panel .fishing-pause-button').count(), 0);
  assert.equal(await page.locator('.fishing-nav .fishing-pause-button').count(), 1);
  for (const language of ['en','vi']) {
    if (language === 'vi') { await page.getByRole('button', { name: 'Change interface language' }).click(); await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click(); }
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
      await page.setViewportSize(viewport); await fit(page, `${language} math with seven bait counts and six fish`);
    }
  }
  await page.close();
});

test('missing operands and three-digit results use the correct editable row and server grading', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  for (const [scenario, editableRow] of [['missing-left',0], ['missing-right',1], ['large-question',2]] as const) {
    await open(page, scenario); await start(page); await pause(page);
    await page.getByRole('button', { name: 'Earn bait', exact: true }).click(); await page.locator('.fishing-math-panel').waitFor();
    const question = fixture.state().question!;
    assert.equal(await page.locator('.question-math-row').nth(editableRow).locator('.question-answer-line').count(), 1);
    await fit(page, scenario); await page.keyboard.type(String(question.question.answer));
    await page.getByRole('button', { name: 'Submit', exact: true }).click(); await nextMath(page);
    assert.equal(fixture.state().stats.questions, 1); assert.equal(fixture.state().question!.baitId,question.baitId);assert.notEqual(fixture.state().question!.id,question.id);
  }
  await page.close();
});

test('bait names, result-only starter math and bounded river multiplication render with server grading', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page, 'single');await start(page);
  const choices = await page.locator('.fishing-bait-grid').innerText();
  assert.match(choices,/Corn Bait/);assert.match(choices,/Worm Bait/);
  assert.doesNotMatch(choices,/Beginner Bait|Chewy Bait/);
  await page.getByRole('button',{name:'Earn bait',exact:true}).click();
  await page.locator('.fishing-math-panel').waitFor();
  assert.equal(await page.locator('.question-math-row').nth(2).locator('.question-answer-line').count(),1);
  const starterCard = fixture.state().question!.question.card;
  assert.equal(starterCard.kind, 'equation');
  if (starterCard.kind === 'equation') { assert.deepEqual(starterCard.operands,[10,0]); assert.equal(starterCard.blank,'result'); }
  await page.getByRole('button',{name:'Change interface language'}).click();await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  assert.equal(await page.locator('.fishing-bait-tally li[title="Mồi bắp"]').count(),1);
  assert.equal(await page.locator('.fishing-bait-tally li[title="Mồi giun"]').count(),1);
  await fit(page,'Vietnamese starter bait names');
  await page.evaluate(()=>localStorage.removeItem('plg-ui-language'));
  await open(page,'multiplication');await start(page);await page.getByRole('button',{name:'Earn bait',exact:true}).click();
  await page.locator('.fishing-math-panel').waitFor();
  const question=fixture.state().question!; assert.equal(question.question.card.kind,'equation');
  const [a,b]=question.question.card.kind === 'equation' ? question.question.card.operands as [number,number] : [0,0];
  assert.ok(a<10&&b<10);assert.equal(question.question.card.kind === 'equation' ? question.question.card.operators[0] : null,'×');
  for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}]){await page.setViewportSize(viewport);await fit(page,'single-digit fishing multiplication');}
  await page.keyboard.type(String(question.question.answer));await page.getByRole('button',{name:'Submit',exact:true}).click();
  await nextMath(page);const nextQuestion=fixture.state().question!;assert.equal(fixture.state().bait.crunchy,1);assert.equal(nextQuestion.baitId,'crunchy');
  assert.equal(nextQuestion.question.card.kind,'equation');
  assert.notDeepEqual([...(nextQuestion.question.card.kind === 'equation' ? nextQuestion.question.card.operands : [])].sort(),[...(question.question.card.kind === 'equation' ? question.question.card.operands : [])].sort());
  await page.close();
});

test('topbar pause and quit match the shared game flow without losing the current question', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await open(page, 'single'); await start(page);
  await page.getByRole('button', { name: 'Earn bait', exact: true }).click();
  const math = page.locator('.fishing-math-panel'); await math.waitFor(); await page.keyboard.press('2');
  const questionId = fixture.state().question!.id, castId = fixture.state().cast!.id;
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Fishing paused', exact: true }); await dialog.waitFor(); await fit(page, 'pause over math');
  await page.keyboard.press('9'); assert.equal(await math.locator('.question-answer-line').innerText(), '2');
  assert.equal(fixture.state().question?.id, questionId);
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
  assert.equal(fixture.state().cast?.id, castId); assert.equal(fixture.state().question?.id, questionId);
  assert.equal(await math.locator('.question-answer-line').innerText(), '2');
  await page.getByRole('button', { name: 'Change interface language' }).click(); await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await page.locator('.fishing-pause-button').click(); await page.locator('.fishing-pause-dialog').waitFor();
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) { await page.setViewportSize(viewport); await fit(page, 'Vietnamese pause dialog'); }
  await page.locator('.fishing-pause-dialog>.fishing-primary').click();
  await page.locator('.fishing-nav .kid-back').click(); await page.locator('.fishing-pause-dialog').waitFor(); await fit(page, 'Vietnamese quit dialog');
  await page.locator('.fishing-pause-dialog>.fishing-secondary').click(); await page.getByRole('heading', { name: 'Playground', exact: true }).waitFor();
  assert.equal(fixture.state().question?.id, questionId); assert.equal(fixture.state().stats.casts, 1);
  await page.close();
});

test('sleep hides the last catch bubble and its labels until the friend wakes',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}});
 await open(page,'garbage');await start(page);await finishCast(page);
 await page.locator('.fishing-reveal').waitFor();await pause(page);
 for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}]){
  await page.setViewportSize(viewport);assert.equal(await page.locator('.fishing-sleeping-friend').count(),1);
  assert.equal(await page.locator('.fishing-reveal,.fishing-catch-reward,.fishing-discovery-tag').count(),0);await fit(page,'sleep without last catch');
 }
 await page.getByRole('button',{name:'Continue fishing',exact:true}).click();await page.locator('.fishing-reveal').waitFor();await page.close();
});
