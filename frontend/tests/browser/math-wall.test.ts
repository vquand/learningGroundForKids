import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { emptyProgress, startSession, applyAction, publicState, type Progress } from '../../../server/src/math-wall/game.ts';
import { WADDLE_WALL_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';

const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const artifacts = process.env.PLG_MATH_ARTIFACTS || '/tmp/plg-math-wall-browser';
function correctLane(progress: Progress): number {
  const question = progress.session!.question;
  assert.equal(question.response.mode, 'choice');
  return question.response.correct;
}
before(async () => {
  await mkdir(artifacts, { recursive: true });
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

async function fixture(viewport = { width: 1440, height: 1000 }, hasFriends = true, best = 0, tiedFriend = false, counting = false, previouslyPassed = 0) {
  const page = await browser.newPage({ viewport });
  const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message));
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(m.text()); });
  let progress: Progress = { ...emptyProgress(), best }; let leaderboardReads = 0;
  progress.stats.passed = previouslyPassed;
  await page.route('**/api/**', async (route: any) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path.endsWith('/achievement-groups')) return route.fulfill({ json: [{ ...WADDLE_WALL_ACHIEVEMENT_GROUP, achievements: WADDLE_WALL_ACHIEVEMENT_GROUP.achievements.map(badge => ({ ...badge, earned: false, earned_at: null })) }] });
    if (path.endsWith('/profiles')) return route.fulfill({ json: [{ id: 'profile-a', name: 'Test', emoji: '🐮', color: 'blue', public_id: 'TEST', total_done: 0, badge_count: 0 }] });
    if (path.endsWith('/leaderboard')) { leaderboardReads++; return route.fulfill({ json: [{ name: 'Test', score: progress.best, self: true }, ...(hasFriends ? [{ name: 'Friend', score: 7, self: false }] : []), ...(hasFriends && tiedFriend ? [{ name: 'Other friend', score: 7, self: false }] : [])].sort((a, b) => b.score - a.score) }); }
    if (request.method() === 'POST') {
      const input = request.postDataJSON();
      if (input.revision !== progress.revision) return route.fulfill({ status: 409, json: { error: { message: 'Stale session' } } });
      try {
        // The shared engine draws unit-interval rolls at 0x1000000 resolution; a zero roll selects the 20% counting branch.
        const pick = (n: number) => counting && n === 0x1000000 ? 0 : Math.floor(n / 2);
        progress = path.endsWith('/start') ? startSession(progress, input.settings, Date.now(), pick) : applyAction(progress, input.action, Date.now(), pick);
        progress.revision++;
      } catch (e) { return route.fulfill({ status: 409, json: { error: { message: (e as Error).message } } }); }
    }
    return route.fulfill({ json: publicState(progress, Date.now()) });
  });
  await page.goto(`${origin}/tests/browser/math-wall-harness.html`);
  try { await page.getByRole('heading', { name: 'Waddle Wall', exact: true }).waitFor({ timeout: 10000 }); }
  catch (e) { console.error('Browser diagnostics', errors, await page.locator('body').innerText()); throw e; }
  return { page, errors, progress: () => progress, leaderboardReads: () => leaderboardReads };
}

test('Badges pauses a live wall and isolates collection keys until explicit resume', async () => {
  const { page, errors, progress } = await fixture({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('button', { name: 'Badges', exact: true }).click();
  const badges = page.getByRole('dialog', { name: 'Badges', exact: true });
  await badges.getByRole('heading', { name: 'First Waddle', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.math-results-title') || document.querySelector('#math-results-title'));
  assert.equal(progress().session?.phase, 'paused');
  const revision = progress().revision;
  await page.keyboard.press('1');
  await page.keyboard.press('Tab');
  assert.equal(await badges.evaluate((element: HTMLElement) => element.contains(document.activeElement)), true);
  assert.equal(progress().revision, revision);
  await page.getByRole('button', { name: 'Close badges' }).click();
  assert.equal(progress().session?.phase, 'paused');
  await page.getByRole('button', { name: 'Badges', exact: true }).last().click();
  await badges.getByRole('heading', { name: 'First Waddle', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keep waddling →' }).click();
  assert.equal(progress().session?.phase, 'playing');
  assert.deepEqual(errors, []);
  await page.close();
});

test('Math Scientist is the seventh collectible with its own complete badge artwork at all landscape sizes', async () => {
  const { page, errors } = await fixture({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('button', { name: 'Badges', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Badges', exact: true });
  await dialog.getByRole('heading', { name: 'First Waddle', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByRole('heading', { name: 'Math Scientist', exact: true }).waitFor();
  assert.match(await dialog.textContent(), /Pass 10 hard walls/);
  const art = dialog.locator('.achievement-badge-art');
  assert.match(await art.evaluate((el: HTMLElement) => el.style.backgroundImage), /math-scientist\.png/);
  assert.equal(await art.evaluate((el: HTMLElement) => el.style.backgroundSize), '100% 100%');
  for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await dialog.evaluate((el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && el.scrollHeight <= el.clientHeight + 1;
    }), true);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('all animal friends use six real walking frames, level bodies and a frozen gait during pause', async () => {
  for (const animal of ['Capybara', 'Dairy cow', 'Highland cow']) {
    const { page, errors } = await fixture({ width: 1024, height: 768 });
    try {
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('button', { name: animal, exact: true }).click();
      await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
      const sprite = page.locator('.math-flat-actor .math-animal-sprite');
      await sprite.locator('img').evaluate(async (image: HTMLImageElement) => { await image.decode(); });
      assert.equal(await sprite.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth), 1536);
      for (const [key, pose] of [['1', 'left'], ['3', 'right']]) {
        await page.keyboard.press(key!);
        await page.locator(`.math-flat-actor [data-pose="${pose}"][data-walking="true"]`).waitFor();
        const samples = await sprite.locator('img').evaluate((image: HTMLElement) => {
          const wasRunning = image.getAnimations()[0]!.playState === 'running';
          // Sample a hidden clone so the test does not override the live CSS
          // animation's pause/resume behavior through the Web Animations API.
          const clone = image.cloneNode(true) as HTMLElement;
          clone.style.visibility = 'hidden'; image.parentElement!.append(clone);
          const animation = clone.getAnimations()[0]!;
          animation.pause();
          const offsets = [0, 70, 140, 210, 280, 350].map(time => { animation.currentTime = time + 1; return getComputedStyle(clone).transform; });
          clone.remove();
          return { wasRunning, offsets, easing: getComputedStyle(image).animationTimingFunction };
        });
        assert.equal(samples.wasRunning, true);
        assert.equal(new Set(samples.offsets).size, 6, 'six distinct atlas frames form the gait');
        assert.match(samples.easing ?? '', /steps\(6/);
        const rotation = await page.locator('.math-flat-actor-body').evaluate((node: HTMLElement) => new DOMMatrixReadOnly(getComputedStyle(node).transform).b);
        assert.equal(rotation, 0, 'walking does not rotate the whole animal');
        await page.screenshot({ path: `${artifacts}/animated-${animal.replaceAll(' ', '-')}-${pose}.png` });
      }
      await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      assert.equal(await sprite.getAttribute('data-paused'), 'true');
      assert.equal(await sprite.locator('img').evaluate((image: HTMLElement) => getComputedStyle(image).animationPlayState), 'paused');
      const first = await sprite.locator('img').evaluate((image: HTMLElement) => getComputedStyle(image).transform);
      await page.waitForTimeout(120);
      assert.equal(await sprite.locator('img').evaluate((image: HTMLElement) => getComputedStyle(image).transform), first);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test('reduced motion uses a still rear pose while lane selection remains usable', async () => {
  const { page, errors, progress } = await fixture({ width: 1180, height: 820 });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
    await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
    const laneSaved = page.waitForResponse((response: any) => response.request().method() === 'POST' && response.url().includes('/api/') && response.url().endsWith('/action'));
    await page.keyboard.press('1');
    await laneSaved;
    assert.equal(progress().session!.lane, 0);
    await page.locator('.math-flat-actor .math-animal-sprite[data-pose="rear"]').waitFor();
    assert.equal(await page.locator('.math-flat-actor .math-animal-sprite').getAttribute('data-pose'), 'rear');
    assert.equal(await page.locator('.math-flat-actor img').evaluate((image: HTMLElement) => getComputedStyle(image).animationName), 'none');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('the shrinking timer changes from green to yellow to red across screen sizes', async () => {
  for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820], [390, 844]]) {
    const { page, errors } = await fixture({ width, height });
    try {
      const initialTime = Date.now();
      await page.clock.setFixedTime(new Date(initialTime));
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
      await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
      const samples: { color: string; width: number }[] = [];
      for (const [elapsed, urgency] of [[0, 'green'], [5500, 'yellow'], [8000, 'red']] as const) {
        await page.clock.setFixedTime(new Date(initialTime + elapsed));
        await page.locator(`.math-wall-clock[data-urgency="${urgency}"]`).waitFor();
        samples.push(await page.locator('.math-wall-clock span').evaluate((bar: HTMLElement) => ({
          color: getComputedStyle(bar).backgroundColor,
          width: new DOMMatrixReadOnly(getComputedStyle(bar).transform).a,
        })));
      }
      assert.deepEqual(samples.map(sample => sample.color), ['rgb(140, 164, 120)', 'rgb(221, 179, 67)', 'rgb(207, 101, 89)']);
      assert.ok(samples[0]!.width > samples[1]!.width && samples[1]!.width > samples[2]!.width);
      await page.screenshot({ path: `${artifacts}/red-timer-chubby-${width}x${height}.png` });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test('setup requires a flag, exposes all buddies and styles, and its playground card opens the game', async () => {
  const { page, errors } = await fixture();
  assert.equal(await page.getByRole('button', { name: 'Let’s waddle! →' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await page.getByRole('heading', { name: 'Waddle Wall', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Highland cow', exact: true }).click();
  await page.getByRole('button', { name: 'Block wall', exact: true }).click();
  await page.screenshot({ path: `${artifacts}/setup-highland-blocks.png`, fullPage: true });
  await page.getByRole('button', { name: 'Dairy cow', exact: true }).click();
  await page.getByRole('button', { name: 'Vietnamese garden fence', exact: true }).click();
  assert.equal(await page.locator('.math-moving-wall .math-wall-art').count(), 1);
  assert.equal(await page.locator('.math-wall-answer-zone').count(), 3);
  assert.equal(await page.locator('.math-wall-answer-zone').evaluateAll((zones: HTMLElement[]) => zones.every(zone => getComputedStyle(zone).borderLeftWidth === '0px' && getComputedStyle(zone).borderRightWidth === '0px')), true);
  await page.screenshot({ path: `${artifacts}/setup-vi.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to Playground', exact: true }).click();
  const activities = page.locator('section[aria-labelledby="activity-hub-title"] > div.grid > button');
  await activities.getByText('Waddle Wall', { exact: true }).waitFor();
  const waddleWall = activities.filter({ hasText: 'Waddle Wall' });
  assert.equal(await waddleWall.count(), 1);
  await waddleWall.click();
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('counting waves display a prominent question and stars in both languages across screen sizes', async () => {
  for (const vi of [false, true]) {
    const { page, errors, progress } = await fixture({ width: 390, height: 844 }, true, 0, false, true);
    await page.getByRole('button', { name: vi ? 'Tiếng Việt' : 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
    await page.getByRole('heading', { name: vi ? 'Có bao nhiêu ngôi sao?' : 'How many stars?', exact: true }).waitFor();
    const card = progress().session!.question.card;
    assert.equal(await page.locator('.math-counting > span').count(), card.kind === 'counting' ? card.count : 0);
    for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height });
      const heading = await page.locator('.math-counting-title').boundingBox();
      assert.ok(heading && heading.y >= 0 && heading.y + heading.height <= height);
      assert.ok(await page.locator('.math-counting').isVisible());
      assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.math-counting-title')!).fontSize) >= 20));
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${artifacts}/counting-${vi ? 'vi' : 'en'}-${width}x${height}.png` });
    }
    assert.equal(errors.length, 0, errors.join('\n')); await page.close();
  }
});

test('Vietnamese math content keeps the Waddle status controls in English', async () => {
  const { page, errors, progress } = await fixture({ width: 1180, height: 820 }, true, 0, false, false);
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  await page.getByRole('group', { name: 'Choose a lane' }).getByRole('button').nth(correctLane(progress())).click();
  await page.getByRole('status').filter({ hasText: 'You got it!' }).waitFor({ timeout: 15000 });
  assert.equal(await page.getByText('Đúng rồi! ♥', { exact: true }).count(), 0);
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('Minecraft walls stack square blocks responsively and keep answers at independent lane positions', async () => {
  const { page, errors } = await fixture();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Block wall', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  const layouts: { rows: number; columns: number }[] = [];
  for (const [width, height] of [[1440, 1000], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100);
    const grid = page.locator('.math-minecraft-grid');
    const rows = Number(await grid.getAttribute('data-rows')), columns = Number(await grid.getAttribute('data-columns'));
    layouts.push({ rows, columns });
    assert.equal(await page.locator('.math-minecraft-block').count(), rows * columns);
    const tile = await page.locator('.math-minecraft-block').first().boundingBox();
    assert.ok(tile && Math.abs(tile.width - tile.height) < .1);
    const wall = await page.locator('.math-moving-wall').boundingBox(); assert.ok(wall);
    const labels = await page.locator('.math-wall-answer').all(); assert.equal(labels.length, 3);
    for (let i = 0; i < labels.length; i++) {
      const b = await labels[i].boundingBox(); assert.ok(b);
      const fraction = (b.x + b.width / 2 - wall.x) / wall.width;
      assert.ok(Math.abs(fraction - (i + .5) / 3) < .01);
    }
    await page.screenshot({ path: artifacts + '/minecraft-' + width + 'x' + height + '.png' });
  }
  assert.ok(layouts[0]!.rows > layouts[1]!.rows && layouts[0]!.columns > layouts[1]!.columns);
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('near-arrival walls have no highlighted frame and leave the whole cow visible with clear answers', async () => {
  const { page, errors } = await fixture({ width: 960, height: 800 });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Dairy cow', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  await page.keyboard.press('3');
  await page.waitForFunction(() => {
    const wall = document.querySelector('.math-moving-wall')!.getBoundingClientRect();
    const actor = document.querySelector('.math-flat-actor')!.getBoundingClientRect();
    return wall.bottom > actor.top + actor.height * .65;
  }, undefined, { timeout: 10000 });
  await page.getByRole('img', { name: 'Dairy cow, rear view', exact: true }).waitFor();
  const actor = await page.locator('.math-flat-actor').boundingBox(); assert.ok(actor);
  const wall = page.locator('.math-moving-wall');
  assert.equal(await wall.evaluate((el: HTMLElement) => getComputedStyle(el).borderTopWidth), '0px');
  assert.equal(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.math-flat-actor')!).zIndex) > Number(getComputedStyle(document.querySelector('.math-moving-wall')!).zIndex)), true);
  for (const label of await page.locator('.math-wall-answer').all()) {
    const b = await label.boundingBox(); assert.ok(b && b.y + b.height <= actor.y + 3);
  }
  await page.screenshot({ path: artifacts + '/wall-arrival-cow-visible.png' });
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('live game keeps arena and controls visible across phone, tablet, desktop and landscape', async () => {
  const { page, errors, leaderboardReads } = await fixture();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  assert.equal(await page.locator('.math-arena canvas').count(), 0, 'The arena uses 2D artwork rather than a WebGL canvas');
  assert.equal(await page.locator('.math-moving-wall').evaluate((el: HTMLElement) => getComputedStyle(el).borderTopWidth), '0px');
  assert.equal(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.math-flat-actor')!).zIndex) > Number(getComputedStyle(document.querySelector('.math-moving-wall')!).zIndex)), true);
  for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820], [1440, 1000], [390, 844], [360, 640], [768, 1024], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const bounds = await page.locator('.math-stage').boundingBox();
    assert.ok(bounds && bounds.width > 100 && bounds.height > 140);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height);
    for (const button of await page.locator('.math-lane-buttons button').all()) {
      const b = await button.boundingBox(); assert.ok(b && b.y >= 0 && b.y + b.height <= height);
      assert.ok(b.x >= bounds.x && b.x + b.width <= bounds.x + bounds.width);
      assert.ok(b.y >= bounds.y && b.y + b.height <= bounds.y + bounds.height);
      assert.ok(Math.abs(b.width - b.height) < 1, 'Lane labels retain square, unstretched proportions');
    }
    assert.equal(await page.locator('.math-play-layout > .math-lane-buttons').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${artifacts}/playing-${width}x${height}.png` });
  }
  assert.equal(leaderboardReads(), 0);
  assert.equal(await page.locator('.math-score-cards').count(), 0);
  assert.equal(await page.locator('[role="alert"]').count(), 0);
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('number keys choose lanes; pass earns server points, pause freezes timer and finish shows best and badges', async () => {
  const { page, errors, progress } = await fixture({ width: 960, height: 800 });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  await page.getByRole('img', { name: 'Capybara, rear view', exact: true }).waitFor();
  for (const key of ['1', '3', '2']) {
    await page.keyboard.press(key); await page.waitForTimeout(80); assert.equal(progress().session!.lane, Number(key) - 1);
    if (key === '1') {
      await page.getByRole('img', { name: 'Capybara, moving left', exact: true }).waitFor();
      await page.screenshot({ path: `${artifacts}/sprite-waddle-left.png` });
    }
    if (key === '3') {
      await page.getByRole('img', { name: 'Capybara, moving right', exact: true }).waitFor();
      await page.waitForTimeout(80); await page.screenshot({ path: `${artifacts}/sprite-waddle-right.png` });
    }
  }
  await page.getByRole('img', { name: 'Capybara, rear view', exact: true }).waitFor();
  await page.keyboard.press(String(correctLane(progress()) + 1));
  await page.getByRole('status').filter({ hasText: 'You got it!' }).waitFor({ timeout: 15000 });
  assert.equal(progress().best, 1);
  await page.waitForTimeout(1350);
  await page.screenshot({ path: `${artifacts}/success-heart.png` });
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(progress().session!.phase, 'paused');
  const remaining = progress().session!.remaining;
  await page.waitForTimeout(500); assert.equal(progress().session!.remaining, remaining);
  assert.equal(await page.locator('.math-score-cards strong').last().textContent(), '1');
  await page.getByRole('heading', { name: 'Badges you earned this game', exact: true }).waitFor();
  assert.deepEqual(await page.locator('.math-badge h3').allTextContents(), ['First Waddle']);
  assert.equal(await page.locator('.math-badge.locked').count(), 0);
  await page.getByText('You and your friends', { exact: true }).waitFor();
  assert.equal(await page.getByRole('img', { name: 'Gold medal for the highest score' }).count(), 1);
  assert.match(await page.locator('.math-leaders li.highest').textContent(), /Friend/);
  assert.equal(await page.locator('.math-leaders li.self .math-gold-medal').count(), 0);
  assert.equal(await page.getByText('Only your accepted kid friends.', { exact: true }).count(), 0);
  await page.keyboard.press('Shift+Tab');
  assert.match(await page.locator(':focus').textContent(), /Back to Playground/);
  await page.keyboard.press('Tab');
  assert.match(await page.locator(':focus').textContent(), /Keep waddling/);
  await page.screenshot({ path: `${artifacts}/paused-badges.png`, fullPage: true });
  await page.getByRole('button', { name: 'Keep waddling →' }).click();
  await page.getByRole('button', { name: 'Ⅱ Pause' }).waitFor();
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('heading', { name: 'Lovely waddling!' }).waitFor();
  assert.equal(progress().session!.phase, 'finished');
  await page.getByRole('button', { name: 'Play again →' }).click();
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  assert.equal(progress().best, 1);
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('a kid without connected friends sees personal scores and badges, with no global ranking', async () => {
  const { page, errors } = await fixture({ width: 960, height: 800 }, false, 4);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  const boardResponse = page.waitForResponse((r: any) => r.url().endsWith('/math-wall/leaderboard'));
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await (await boardResponse).finished();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('heading', { name: /Global high scores/ }).count(), 0);
  assert.equal(await page.getByText('You and your friends', { exact: true }).count(), 0);
  assert.equal(await page.locator('.math-leaders').count(), 0);
  assert.equal(await page.locator('.math-score-cards').count(), 1);
  await page.getByText('Your high score so far: 4', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Badges you earned this game', exact: true }).count(), 0);
  assert.equal(await page.locator('.math-badge-grid').count(), 0);
  await page.screenshot({ path: `${artifacts}/paused-no-friends.png`, fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('results show this session milestone only, excluding badges earned in earlier games', async () => {
  const { page, errors, progress } = await fixture({ width: 960, height: 800 }, false, 4, false, false, 9);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  await page.keyboard.press(String(correctLane(progress()) + 1));
  await page.getByRole('status').filter({ hasText: 'You got it!' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await page.getByRole('heading', { name: 'Badges you earned this game', exact: true }).waitFor();
  assert.deepEqual(await page.locator('.math-badge h3').allTextContents(), ['Wall Wanderer']);
  await page.screenshot({ path: `${artifacts}/paused-session-badges.png`, fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('all tied highest scores receive gold medals, including the kid', async () => {
  const { page, errors } = await fixture({ width: 960, height: 800 }, true, 7, true);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await page.getByText('You and your friends', { exact: true }).waitFor();
  assert.equal(await page.getByRole('img', { name: 'Gold medal for the highest score' }).count(), 3);
  assert.equal(await page.locator('.math-leaders li.self .math-gold-medal').count(), 1);
  assert.equal(await page.locator('.math-personal-high-score').count(), 0);
  await page.screenshot({ path: `${artifacts}/paused-gold-medals.png`, fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});

test('wrong answers show the splash, finish at that wall, and require Play again to restart', async () => {
  const { page, errors, progress } = await fixture({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Dairy cow', exact: true }).click();
  await page.getByRole('button', { name: 'European stone', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  const wrong = (correctLane(progress()) + 1) % 3;
  await page.locator('.math-lane-buttons button').nth(wrong).click();
  await page.getByRole('status').filter({ hasText: 'Splash!' }).waitFor({ timeout: 15000 });
  await page.getByRole('img', { name: 'Dairy cow, surprised', exact: true }).waitFor();
  assert.equal(await page.locator('.math-lane-buttons').isVisible(), false, 'Lane controls clear the view of the animal falling');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${artifacts}/surprised-splash-phone.png` });
  assert.equal(progress().session!.result, 'splash');
  assert.equal(progress().best, 0);
  await page.getByRole('heading', { name: 'Nice try!', exact: true }).waitFor();
  await page.getByText('You stopped at wall 1 and scored 0 points.', { exact: true }).waitFor();
  assert.equal(progress().session!.wave, 1);
  assert.equal(progress().session!.phase, 'finished');
  assert.equal(await page.getByRole('button', { name: 'Keep waddling →' }).count(), 0);
  await page.screenshot({ path: `${artifacts}/finished-after-splash.png`, fullPage: true });
  await page.waitForTimeout(300);
  assert.equal(progress().session!.wave, 1);
  await page.getByRole('button', { name: 'Play again →' }).click();
  await page.getByRole('button', { name: 'Let’s waddle! →' }).click();
  await page.getByRole('group', { name: 'Choose a lane' }).waitFor();
  assert.equal(progress().session!.wave, 1);
  assert.equal(progress().session!.score, 0);
  assert.equal(errors.length, 0, errors.join('\n')); await page.close();
});
