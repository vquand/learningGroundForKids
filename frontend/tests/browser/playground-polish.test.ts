import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
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

for(const viewport of [{width:1024,height:768},{width:1180,height:720},{width:1180,height:820},{width:1300,height:750},{width:1366,height:768}]) {
  test(`kitchen artwork stays inside card headers ${viewport.width}x${viewport.height}`,async()=>{
    const page=await browser.newPage({viewport,hasTouch:true});const errors:string[]=[];
    page.on('pageerror',(e:Error)=>errors.push(e.message));
    await page.goto(`${origin}/tests/browser/playground-polish-harness.html`);
    await page.getByRole('link',{name:'Back to kitchen',exact:true}).click();
    await page.getByRole('heading',{name:'What shall we make?',exact:true}).waitFor();
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
    const artwork=await page.locator('.cooking-meal-card__art').evaluateAll((headers:Element[])=>headers.map(header=>{
      const child=header.firstElementChild!,art=header.getBoundingClientRect(),image=child.getBoundingClientRect(),body=header.nextElementSibling!.getBoundingClientRect();
      return {name:header.className,contained:image.x>=art.x-.5&&image.y>=art.y-.5&&image.right<=art.right+.5&&image.bottom<=art.bottom+.5,
        coversText:image.bottom>body.y+.5,loaded:!(child instanceof HTMLImageElement)||child.naturalWidth>0};
    }));
    await page.screenshot({path:`/tmp/kitchen-artwork-${viewport.width}-${viewport.height}.png`});
    for(const art of artwork){assert.ok(art.loaded,art.name+' missing image');assert.ok(art.contained,art.name+' escapes header');assert.equal(art.coversText,false,art.name+' covers card text');}
    await bounds(page,'kitchen-artwork');assert.deepEqual(errors,[]);await page.close();
  });
}

async function bounds(page: any, state: string) {
  const result = await page.evaluate(() => ({
    scrolls: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
    controls: Array.from(document.querySelectorAll('button,a,select')).filter(e => e.checkVisibility() && !e.closest('[inert]')).map(e => {
      const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { name: e.getAttribute('aria-label') || e.textContent, visible: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, usable: !!hit && (hit === e || e.contains(hit)) };
    }),
  }));
  if (result.scrolls || result.controls.some((c: any) => !c.visible || !c.usable)) await page.screenshot({ path: `/tmp/polish-${page.viewportSize().width}-${state}.png` });
  assert.equal(result.scrolls, false, `${state} scrolls`);
  for (const c of result.controls) { assert.ok(c.visible, `${state}: ${c.name} outside viewport`); assert.ok(c.usable, `${state}: ${c.name} covered`); }
  const back = await page.locator('.kid-back').boundingBox();
  assert.ok(Math.abs(back.x - 16) <= 1 && Math.abs(back.y - 8) <= 1 && back.height === 48, `${state}: inconsistent back position ${JSON.stringify(back)}`);
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
  test(`pig roasting, sauce, serving, failure and replay fit ${viewport.width}x${viewport.height}`, async () => {
    const page = await browser.newPage({ viewport, hasTouch: true });
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message));
    page.on('response', (r: any) => { if (r.url().includes('/minigames/') && r.status() >= 400) errors.push(`Asset ${r.status()}: ${r.url()}`); });
    await page.goto(`${origin}/tests/browser/playground-polish-harness.html`);
    await page.getByRole('button', { name: 'Heat OK', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sound on', exact: true }).click();
    await bounds(page, 'heat');
    await page.getByRole('button', { name: /^Medium/ }).click();
    await page.getByRole('button', { name: 'Heat OK', exact: true }).click();
    await bounds(page, 'raw');
    const handle = page.getByRole('button', { name: 'Turn handle with drag or arrow keys' });
    await handle.focus();
    let sawWarming = false;
    for (let step = 0; step < 320; step++) {
      if (await page.getByRole('button', { name: 'Done grilling', exact: true }).isEnabled()) break;
      await handle.press('ArrowRight');
      if (await page.locator('[data-roast-stage="Lightly toasted"]').count()) sawWarming = true;
    }
    assert.ok(sawWarming, 'the intermediate roast is visible before golden readiness');
    await page.locator('[data-roast-stage="Golden roasted"]').waitFor();
    await bounds(page, 'golden');
    await page.screenshot({ path: `/tmp/polish-roast-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Done grilling', exact: true }).click();
    await bounds(page, 'glaze-choice');
    const started = Date.now();
    await page.getByRole('button', { name: /Honey.*Brush on/ }).click();
    const done = page.getByRole('button', { name: 'Done seasoning', exact: true });
    assert.ok(await done.isDisabled(), 'continue waits for the sauce stroke');
    await bounds(page, 'brushing');
    const brush = await page.locator('.cooking-seasoning-animation__brush').boundingBox();
    assert.ok(brush.width >= 64 && brush.height >= 30, 'brush is large enough to see');
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Done seasoning')?.disabled);
    assert.ok(Date.now() - started >= 3900, 'the Z stroke remains visible for about four seconds');
    await done.click();
    await bounds(page, 'serve');
    await page.getByRole('button', { name: 'Serve pork', exact: true }).click();
    await bounds(page, 'serving');
    await page.getByRole('button', { name: 'Replay', exact: true }).waitFor();
    await bounds(page, 'success');
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await page.getByRole('button', { name: /^Medium/ }).click();
    await page.getByRole('button', { name: 'Heat OK', exact: true }).click();
    const burnHandle = page.getByRole('button', { name: 'Turn handle with drag or arrow keys' });
    for (let step = 0; step < 320 && await burnHandle.count(); step++) await burnHandle.press('ArrowRight');
    await page.getByRole('button', { name: 'Replay', exact: true }).waitFor();
    await bounds(page, 'failure');
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await bounds(page, 'replay');
    await page.getByRole('link', { name: 'Back to kitchen', exact: true }).click();
    await page.getByRole('heading', { name: 'What shall we make?', exact: true }).waitFor();
    await bounds(page, 'kitchen');
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('activity age badges sit beside each game name and navigation style is shared', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message));
  await page.route('**/api/**', (route: any) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.fallback();
    return route.fulfill({ json: path.endsWith('/profiles') ? [{ id: 'profile-a', name: 'Tester', emoji: 'star', color: 'green' }] : {} });
  });
  await page.goto(`${origin}/tests/browser/playground-polish-harness.html?hub`);
  await page.getByRole('heading', { name: 'Hi, Tester!' }).waitFor();
  for (const [title, age] of [['Explore', 6], ['Miniku', 4], ['Shoo Shoo UFO', 7], ['Waddle Wall', 5], ['Infinidrill', 6], ['Kitchen', 6]]) {
    const card = page.getByRole('button', { name: new RegExp(String(title), 'i') });
    assert.equal(await card.locator('[data-min-age]').textContent(), `${age}+`);
    assert.equal(await card.locator('[data-min-age]').getAttribute('aria-label'), `Suggested age: ${age} and up`);
  }
  assert.equal(await page.locator('[data-min-age]').count(), 11);
  const firstActivities = await page.locator('.activity-hub-card').evaluateAll((cards: Element[]) => cards.slice(0, 5).map((card: Element) => card.querySelector('[data-activity-icon]')?.getAttribute('data-activity-icon')));
  assert.deepEqual(firstActivities, ['avatar', 'badges', 'town', 'calendar', 'daily-quiz']);
  const style = await page.locator('.kid-back').evaluate((e: Element) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { height: r.height, x: r.x, y: r.y, font: s.font, background: s.backgroundColor, color: s.color }; });
  await page.goto(`${origin}/tests/browser/playground-polish-harness.html`);
  await page.locator('.kid-back').waitFor();
  const gameStyle = await page.locator('.kid-back').evaluate((e: Element) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { height: r.height, x: r.x, y: r.y, font: s.font, background: s.backgroundColor, color: s.color }; });
  assert.deepEqual(gameStyle, style);
  assert.deepEqual(errors, []);
  await page.close();
});

test('glazing recovers canceled animations and honors reduced motion', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(`${origin}/tests/browser/playground-polish-harness.html`);
  await page.getByRole('button', { name: /^Medium/ }).click();
  await page.getByRole('button', { name: 'Heat OK', exact: true }).click();
  const handle = page.getByRole('button', { name: 'Turn handle with drag or arrow keys' });
  for (let i = 0; i < 88; i++) await handle.press('ArrowRight');
  await page.getByRole('button', { name: 'Done grilling', exact: true }).click();
  await page.clock.install();
  await page.getByRole('button', { name: /Honey.*Brush on/ }).click();
  const done = page.getByRole('button', { name: 'Done seasoning', exact: true });
  await page.locator('.cooking-seasoning-animation__brush').evaluate((e: Element) => e.getAnimations().forEach(a => a.cancel()));
  assert.ok(await done.isDisabled());
  await page.clock.fastForward(4600);
  assert.ok(await done.isEnabled(), 'lost animation events cannot trap the child');
  await page.clock.resume();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /Butter.*Brush on/ }).click();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Done seasoning')?.disabled);
  assert.ok(await done.isEnabled(), 'reduced motion finishes without waiting through the full stroke');
  await page.close();
});

for(const [width,height] of [[1366,768],[1024,768],[1180,820],[768,1024],[768,600],[390,844],[320,667]])test(`kitchen navigation shares one sticky row at ${width}x${height}`,async()=>{
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});page.setDefaultTimeout(6000);const errors:string[]=[];page.on('pageerror',(error:Error)=>errors.push(error.message));
  try{
    await page.goto(`${origin}/tests/browser/playground-polish-harness.html?menu`);
    const header=page.locator('.cooking-menu-header'),back=header.locator('.kid-back'),title=header.locator('h1'),language=page.locator('.ui-language__trigger');await back.waitFor();
    async function aligned(){
      const [h,b,t,l]=await Promise.all([header.boundingBox(),back.boundingBox(),title.boundingBox(),language.boundingBox()]);assert.ok(h&&b&&t&&l);
      assert.ok(Math.abs(b.y+b.height/2-(l.y+l.height/2))<2,'return and language controls share a row');
      assert.ok(Math.abs(t.y+t.height/2-(b.y+b.height/2))<2,'title is in the same row');
      assert.ok(b.x+b.width<=t.x&&t.x+t.width<=l.x,'navigation never overlaps');
      assert.ok(h.y>=0&&h.y+h.height<=height&&b.height>=48&&l.height>=48,'sticky controls stay in view');
      assert.equal(await back.evaluate((element:HTMLElement)=>{const box=element.getBoundingClientRect();return element.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}),true,'return action remains uncovered');
    }
    await aligned();await page.locator('.app-shell').evaluate((element:HTMLElement)=>{element.scrollTop=element.scrollHeight;});await aligned();
    await language.tap();await page.getByRole('button',{name:'Tiếng Việt',exact:true}).tap();await aligned();
    assert.equal(await page.locator('.app-shell').evaluate((element:HTMLElement)=>element.scrollWidth>element.clientWidth),false);
    await page.screenshot({path:`/tmp/plg-kitchen-sticky-nav-${width}-${height}.png`});assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
