import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });
async function fits(page: any) {
  const viewport = page.viewportSize(); const state = await page.locator('.cr-page').getAttribute('data-phase');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1), false, `no scrolling in ${state}`);
  const scene = await page.locator('.cr-scene').boundingBox();
  for (const art of await page.locator('.cr-scene [data-sprite]').all()) {
    const b = await art.boundingBox();
    assert.ok(b && b.x >= scene.x - 1 && b.y >= scene.y - 1 && b.x + b.width <= scene.x + scene.width + 1 && b.y + b.height <= scene.y + scene.height + 1, `art fits in ${state}: ${await art.getAttribute('data-sprite')}`);
  }
  for (const control of await page.locator('.cr-page button:visible, .cr-page a:visible').all()) {
    const b = await control.boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `control fits in ${state}: ${await control.textContent()}`);
    assert.ok(b.height >= 44, `touch target in ${state}`);
  }
}
for (const [width, height] of [[1366,768], [1024,768], [1180,820], [390,844], [320,667], [844,390]]) test(`cabbage full recipe and all results at ${width}x${height}`, async () => {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, reducedMotion: width === 1180 ? 'reduce' : 'no-preference' });
  const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message));
  page.on('response', (r: any) => { if (r.url().includes('/minigames/cooking/cabbage-rolls/') && !r.ok()) errors.push(r.url()); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  async function tap(name: string) { await button(name).tap(); await fits(page); }
  async function snap(name: string) { await page.screenshot({ path: `/tmp/cabbage-${width}-${name}.png` }); }
  try {
    await page.goto(`${origin}/uat/cooking`); await button('Cook Cabbage rolls with meat').tap();
    await button('Start cooking').waitFor(); await page.clock.install(); await page.clock.pauseAt(new Date()); await fits(page); await snap('setup');
    await tap('Start cooking'); await tap('Chop now'); assert.match(await page.locator('.cr-feedback').innerText(), /Missed a stripe/);
    await tap('Try three chops again');
    assert.equal(await page.locator('.cr-chop-band--target').count(), 3);
    assert.equal(await page.getByRole('note').innerText(), 'Knives are dangerous. Only use one while an adult is watching.');
    assert.equal(await page.locator('.cr-board').getAttribute('data-sprite'), 'board-0');
    const choppingBoard = await page.locator('.cr-board').boundingBox(); const choppingFood = await page.locator('.cr-chop-food').boundingBox();
    const choppingOffset = { x: choppingFood.x + choppingFood.width / 2 - choppingBoard.x - choppingBoard.width / 2, y: choppingFood.y + choppingFood.height / 2 - choppingBoard.y - choppingBoard.height / 2 };
    assert.ok(Math.abs(choppingOffset.x) < 2 && Math.abs(choppingOffset.y) < 2, `chopping food is centered on the top-down board: ${JSON.stringify(choppingOffset)}`);
    const firstLayout = await page.locator('.cr-chop-band--target').evaluateAll((nodes: Element[]) => nodes.map((node: Element) => (node as HTMLElement).style.cssText));
    // Missing the first stripe without pressing must also offer a fresh attempt.
    await page.clock.runFor(2500); await tap('Try three chops again');
    const retryLayout = await page.locator('.cr-chop-band--target').evaluateAll((nodes: Element[]) => nodes.map((node: Element) => (node as HTMLElement).style.cssText));
    assert.notDeepEqual(retryLayout, firstLayout, 'retry varies stripe positions and widths');
    assert.equal(await page.locator('.cr-chop-track button').count(), 0, 'stripes are not click steps');
    const track = await page.locator('.cr-chop-track').boundingBox(); const knife = await button('Chop now').boundingBox();
    const tool = await page.locator('.cr-knife-tool').boundingBox();
    assert.ok(knife.x >= tool.x && knife.y < track.y, 'chopping targets the illustrated knife handle above the bar');
    assert.equal(await page.locator('.cr-chop-timing button').count(), 0, 'no separate chop button at the bar');
    for (let i = 0; i < 4; i++) {
      if (i === 3) {
        assert.equal(await button('Chop now').isDisabled(), true);
        await snap('onion-unpeeled'); await tap('Peel the onion'); await page.clock.runFor(700);
      }
      let elapsed = i === 3 ? 50 : 0; // Remaining time after the peel animation.
      await snap(`whole-${i}`);
      for (let cut = 0; cut < 3; cut++) {
        const band = page.locator('.cr-chop-band--target').nth(cut);
        const left = Number.parseFloat(await band.evaluate((node: HTMLElement) => node.style.left));
        const width = Number.parseFloat(await band.evaluate((node: HTMLElement) => node.style.width));
        const centerMs = (left + width / 2) / 100 * 7200;
        await page.clock.runFor(centerMs - elapsed);
        const meter = page.getByRole('meter', { name: 'Chopping pointer' });
        const pointer = Number(await meter.getAttribute('aria-valuenow'));
        const expectedPointer = left + width / 2;
        assert.ok(Math.abs(pointer - expectedPointer) <= 2, `pointer reached sequential target: ${pointer}`);
        await button('Chop now').tap();
        assert.equal(await meter.getAttribute('aria-valuenow'), String(pointer), 'successful chop does not reset pointer');
        assert.equal(await page.locator('.cr-chop-food').count(), 1, 'one discrete art stage, no crossfade layers');
        assert.equal(await page.locator('.cr-chop-food').getAttribute('data-sprite'), `chopping-${i * 4 + cut + 1}`);
        await page.clock.runFor(400);
        const after = Number(await meter.getAttribute('aria-valuenow'));
        assert.ok(cut === 2 ? after === pointer : after > pointer, 'pointer keeps moving during chopping until the third hit');
        assert.equal(await page.locator('.cr-cut-count').innerText(), `${cut + 1}/3 chops in a row`);
        assert.equal(await page.locator('.cr-chop-band--hit').count(), cut + 1);
        await snap(`chop-${i}-stage-${cut + 1}`);
        elapsed = centerMs + 400;
      }
      await snap(`chop-${i}`); await fits(page);
      const board = await page.locator('.cr-board').boundingBox();
      const food = await page.locator('.cr-chop-food').last().boundingBox();
      assert.ok(food.x >= board.x && food.y >= board.y && food.x + food.width <= board.x + board.width && food.y + food.height <= board.y + board.height, 'food stays on cutting board');
      await tap(i < 3 ? 'Next ingredient' : 'Bring the bowl');
    }
    const ingredient = await button('Beef').boundingBox(); const bowl = await page.locator('[data-bowl-drop]').boundingBox();
    if (width === 1024) {
      const cdp = await page.context().newCDPSession(page);
      const x = ingredient.x + ingredient.width / 2, y = ingredient.y + ingredient.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (bowl.x + bowl.width / 2 - x) * i / 12, y: y + (bowl.y + bowl.height / 2 - y) * i / 12 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    } else { await page.mouse.move(ingredient.x + ingredient.width / 2, ingredient.y + ingredient.height / 2); await page.mouse.down(); await page.mouse.move(bowl.x + bowl.width / 2, bowl.y + bowl.height / 2, { steps: 12 }); await page.mouse.up(); }
    await page.clock.runFor(400); await snap('ingredient-falling'); await fits(page); await page.clock.runFor(500);
    assert.equal(await button('Beef').count(), 0, 'drag adds beef');
    await button('Carrot').click(); // Mouse click adds an ingredient.
    await page.clock.runFor(900);
    assert.equal(await button('Carrot').count(), 0, 'click adds carrot');
    await button('Mushroom').tap(); // Touch tap also works without dragging.
    await page.clock.runFor(900);
    assert.equal(await button('Mushroom').count(), 0, 'tap adds mushroom');
    await button('Onion').focus(); await page.keyboard.press('Enter'); await page.clock.runFor(900);
    assert.equal(await button('Choose seasonings').isEnabled(), true);
    await tap('Choose seasonings'); await snap('seasonings'); await tap('Sugar'); assert.match(await page.locator('.cr-feedback').innerText(), /salt/);
    for (const name of ['Salt','Pepper','Soy sauce']) { await tap(name); await page.clock.runFor(500); await snap(`seasoning-${name}`); await fits(page); await page.clock.runFor(650); } await tap('Mix the filling');
    const wheel = await page.locator('.cr-wheel').boundingBox(); const cx = wheel.x + wheel.width * .5, cy = wheel.y + wheel.height * .43, rx = wheel.width * .27, ry = wheel.height * .09;
    await page.mouse.move(cx + rx, cy); await page.mouse.down();
    for (let i = 1; i <= 32; i++) await page.mouse.move(cx + Math.cos(i * Math.PI / 16) * rx, cy + Math.sin(i * Math.PI / 16) * ry);
    await page.mouse.up(); await page.getByRole('button', { name: 'Stir with drag or arrow keys' }).focus();
    for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowLeft');
    if (width === 1024) {
      const progress = await page.getByRole('progressbar').getAttribute('value');
      await button('Change interface language').click(); await button('Tiếng Việt').click();
      await page.getByRole('heading', { name: 'Xoay tròn, xoay tròn', exact: true }).waitFor();
      assert.equal(await page.getByRole('progressbar').getAttribute('value'), progress); await fits(page);
      await page.locator('.ui-language__trigger').click(); await button('English').click();
    }
    await snap('mix'); await tap('Let it rest'); await tap('Cover with plastic wrap'); await page.clock.runFor(450);
    assert.equal(await page.locator('.cr-plastic-wrap').count(), 1, 'plastic wrap covers the filling bowl');
    assert.equal(await page.locator('.cr-plastic-wrap + .cr-bowl-front').count(), 1, 'the bowl front seats over the wrap edge');
    assert.equal(await page.locator('.cr-bowl-lid').count(), 0, 'the mismatched rigid bowl lid is not rendered');
    await snap('plastic-wrap-closing'); await fits(page); await page.clock.runFor(500); await snap('plastic-wrap-covered'); await tap('Put in the fridge'); await page.clock.runFor(1100); await snap('bowl-entering-fridge'); await fits(page); await page.clock.runFor(600);
    await tap('Put the cabbage in the pot'); await page.clock.runFor(1100); await snap('whole-cabbage');
    await tap('Cover the pot'); await page.clock.runFor(1000); await tap('Medium heat'); await tap('Start steaming'); await page.clock.runFor(8100); await snap('steam'); await tap('Lift the cabbage');
    await page.getByRole('heading', { name: 'Bring back the rested filling' }).waitFor();
    assert.match(await page.locator('.cr-hint').innerText(), /rested in the fridge/);
    await tap('Take out the rested filling'); await page.clock.runFor(800); await snap('filling-leaving-fridge'); await fits(page); await page.clock.runFor(850);
    await tap('Large'); assert.match(await page.locator('.cr-feedback').innerText(), /Too much/); await snap('tear'); await tap('Try a fresh leaf');
    for (let roll = 0; roll < 3; roll++) {
      await tap('Medium');
      assert.equal(await page.locator('.cr-fold-handle').count(), 0, 'no four arrow buttons');
      if (roll === 0) {
        assert.equal(await page.locator('.cr-fold-board').getAttribute('data-sprite'), 'board-0');
        const rollingBoard = await page.locator('.cr-fold-board').boundingBox(); const rollingFood = await page.locator('.cr-leaf-touch').boundingBox();
        assert.ok(Math.abs(rollingFood.x + rollingFood.width / 2 - rollingBoard.x - rollingBoard.width / 2) < 2 && Math.abs(rollingFood.y + rollingFood.height / 2 - rollingBoard.y - rollingBoard.height / 2) < 2, 'rolling food is centered on the top-down board');
      }
      const leaf = button('Fold cabbage leaf');
      const order = roll === 1 ? ['bottom','right','left','close'] : ['bottom','left','right','close'];
      for (const edge of order) {
        if (roll === 0) {
          const b = await leaf.boundingBox(); const x = b.x + b.width * (edge === 'left' ? .2 : edge === 'right' ? .8 : .5), y = b.y + b.height * (edge === 'left' || edge === 'right' ? .45 : .8);
          await page.mouse.move(x,y); await page.mouse.down();
          await page.mouse.move(x + (edge === 'left' ? b.width * .25 : edge === 'right' ? -b.width * .25 : 0), y - (edge === 'bottom' ? b.height * .25 : edge === 'close' ? b.height * .2 : 0), { steps: 8 });
          if (edge === 'close') {
            assert.match(await page.locator('.cr-leaf').getAttribute('data-sprite'), /rollProgress-[34]/);
            await snap('roll-mid-drag');
            await page.mouse.move(x, y - b.height * .4, { steps: 8 });
            assert.equal(await page.locator('.cr-leaf').getAttribute('data-sprite'), 'rollProgress-7');
          }
          await page.mouse.up();
        } else { await leaf.focus(); await page.keyboard.press(edge === 'left' ? 'ArrowLeft' : edge === 'right' ? 'ArrowRight' : 'ArrowUp'); }
        await fits(page);
      }
      if (roll === 0) await snap('fold');
    }
    await tap('Bring the pot'); for (let i = 0; i < 3; i++) { await tap(`Place a roll in the pot · ${i}/3`); await page.clock.runFor(500); await snap(`tongs-${i}`); await fits(page); await page.clock.runFor(750); }
    await tap('Ladle tomato sauce'); await page.clock.runFor(1300); await tap('Cover the pot'); await page.clock.runFor(450); await snap('pot-lid-closing'); await fits(page); await page.clock.runFor(550); await tap('Low heat'); assert.equal(await page.locator('.cr-zone-labels').count(), 0); await snap('simmer-preview');
    for (const [duration, outcome, cell] of [[2000,'Undercooked',0],[6500,'Okay-ish',1],[8200,'Perfect',2],[11400,'Burnt',3]] as const) {
      await tap('Start simmering');
      if (outcome === 'Perfect') { await page.clock.runFor(2000); await tap('Pause'); const before = await page.getByRole('meter').getAttribute('aria-valuenow'); await page.clock.runFor(60000); assert.equal(await page.getByRole('meter').getAttribute('aria-valuenow'), before); await tap('Resume cooking'); await page.clock.runFor(duration - 2000); }
      else await page.clock.runFor(duration);
      await snap(`cooking-${outcome}`); await tap('Stop cooking'); await page.clock.runFor(600); await snap(`lid-opening-${outcome}`); await fits(page); await page.clock.runFor(1700); await snap(`plating-tongs-${outcome}`); await fits(page); await page.clock.runFor(4400); await snap(`plating-sauce-${outcome}`); await fits(page); await page.clock.runFor(1000); assert.equal(await page.locator('.cr-outcome').innerText(), outcome); assert.equal(await page.locator(`[data-sprite="meals-${cell}"]`).count(), 1);
      if (outcome !== 'Burnt') await tap('Try simmering again');
    }
    await tap('Serve my rolls'); await snap('served'); assert.equal(await page.locator('.cr-page').getAttribute('data-phase'),'served');
    await tap('Make another batch'); assert.equal(await page.locator('.cr-page').getAttribute('data-phase'),'setup'); assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
