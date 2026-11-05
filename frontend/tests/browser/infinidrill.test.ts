import { applyCommand, emptyProgress, publicState } from '../../../server/src/infinidrill/progress.ts';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { generateInfinidrillCard } from '../../../server/src/infinidrill/questions-config.ts';
import { createInfinidrillGame } from '../../../server/src/infinidrill/game.ts';
import { makeQuestion, questionKey } from '../../../server/src/questions/identity.ts';
import { equationCard, withBlank } from '../../../server/src/questions/equation.ts';
import { vennCard } from '../../../server/src/questions/venn.ts';
import type { InfinidrillGameState, InfinidrillLevel, InfinidrillQuestion } from '../../../server/src/infinidrill/types.ts';
import type { VennTarget } from '../../../server/src/questions/types.ts';
import type { Cost } from '../../../server/src/town-building/game.ts';

const { chromium } = createRequire(import.meta.url)('playwright');
const artifacts = '/tmp/plg-infinidrill-browser';
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const viewports = [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }];

function stageForCard(question: InfinidrillQuestion): InfinidrillLevel {
  if (question.card.kind === 'venn') return question.card.level === 'venn-small' ? 1 : 3;
  const stages: Record<string, InfinidrillLevel> = {
    'add-1d': 1, 'sub-1d': 2, 'add-chain-1d': 3, 'sub-chain-1d': 4, 'mixed-chain-1d': 5,
    'addsub-2d1d': 6, 'addsub-2d1d-regroup': 7, 'add-2d': 8, 'sub-2d': 9, 'chain-2d-3': 10,
    'chain-2d-4': 11, 'mul-1d': 12, 'mul-teens-small': 13, 'mul-teens-large': 14, 'div-1d': 14,
    'addsub-3d1d': 15, 'addsub-3d2d': 16, 'chain-3d-3': 17, 'chain-3d-4': 18,
  };
  return stages[question.card.level]!;
}

function generateBaseInfinidrillQuestion(level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18, random: () => number): InfinidrillQuestion {
  const card = generateInfinidrillCard(level, random);
  assert.ok(card);
  return makeQuestion(card, `saved-${level}`) as InfinidrillQuestion;
}

before(async () => {
  await mkdir(artifacts, { recursive: true });
  server = await createServer({ configFile: false, cacheDir: '/tmp/plg-sand-infinidrill-vite-cache', plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

async function fixture(viewport = viewports[0]!, options: { randomValue?: number; loseResponse?: boolean; failReplay?: boolean; worldSeed?: number; savedGame?: InfinidrillGameState; holdEquip?: boolean; touch?: boolean; serverTownReward?: Cost } = {}) {
  const page = await browser.newPage({ viewport, hasTouch: options.touch ?? false });
  let verified = emptyProgress(), lostResponse = false, failReplay = !!options.failReplay;
  if (options.savedGame) verified = { ...verified, game: options.savedGame };
  let releaseEquip: (() => void) | undefined;
  const errors: string[] = [], writes: string[] = [];
  const assetFailures: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request: any) => { if (request.url().includes('/minigames/infinidrill/')) assetFailures.push(`${request.url()} (${request.failure()?.errorText ?? 'failed'})`); });
  page.on('response', (response: any) => { if (response.url().includes('/minigames/infinidrill/') && response.status() >= 400) assetFailures.push(`${response.url()} (${response.status()})`); });
  if (options.randomValue !== undefined) {
    await page.addInitScript((value: number) => { Math.random = () => value; }, options.randomValue);
  }
  await page.route('**/api/**', async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    // The source tree also contains /src/api/*.ts modules. Only intercept
    // same-origin runtime API paths; letting Vite serve source modules keeps
    // the harness mounted while checking only scoped game actions are written.
    if (!path.startsWith('/api/')) return route.fallback();
    if (request.method() !== 'GET') writes.push(request.url());
    if (path.endsWith('/infinidrill')) return route.fulfill({ json: publicState(verified) });
    if (path.endsWith('/infinidrill/action')) {
      const body = request.postDataJSON();
      assert.equal(body.revision, verified.revision);
      if (body.command.type === 'replay' && failReplay) {
        failReplay = false;
        return route.fulfill({ status: 503, json: { error: { message: 'Unable to start a new session' } } });
      }
      if (body.command.type === 'equip-upgrade' && options.holdEquip) {
        await new Promise<void>(resolve => { releaseEquip = resolve; });
        return route.fulfill({ status: 503, json: { error: { message: 'Equipment request rejected' } } });
      }
      const beforeMain = verified.game?.mainQuestionsCompleted ?? 0;
      verified = applyCommand(verified, body.command, await page.evaluate(() => Date.now()), { random: () => options.randomValue ?? 0 });
      if (body.command.type === 'replay' && options.worldSeed !== undefined) verified = { ...verified, game: { ...verified.game!, worldSeed: options.worldSeed } };
      if (options.loseResponse && body.command.type === 'submit-answer' && !lostResponse) {
        lostResponse = true;
        return route.fulfill({ status: 503, json: { error: { message: 'Reply lost after saving' } } });
      }
      return route.fulfill({ json: { ...publicState(verified), ...(options.serverTownReward && (verified.game?.mainQuestionsCompleted ?? 0) > beforeMain ? { townReward: options.serverTownReward } : {}) } });
    }
    if (path.endsWith('/profiles')) return route.fulfill({ json: [{ id: 'profile-a', name: 'Mun', emoji: '🐹', color: '#3B82F6', avatar_type: 'default', avatar_url: 'capybara-calm', avatar_frame: 'space', public_id: 'TEST', total_done: 0, badge_count: 0 }] });
    return route.fulfill({ json: [] });
  });
  await page.goto(`${origin}/tests/browser/infinidrill-harness.html`);
  await page.getByRole('button', { name: /Start|Resume|Let.s drill|Begin/i }).waitFor();
  return { page, errors, writes, assetFailures, getVerified: () => verified, releaseEquip: () => releaseEquip?.() };
}

async function checkViewport(page: any, name: string) {
  const state = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden' && !button.closest('[inert]'));
    return {
      overflow: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
      controls: controls.map(button => {
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { name: button.getAttribute('aria-label') || button.textContent, inBounds: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, reachable: !!hit && (button === hit || button.contains(hit)), width: r.width, height: r.height };
      }),
    };
  });
  assert.equal(state.overflow, false, `${name}: document scrolls`);
  assert.ok(state.controls.length > 0, `${name}: no controls`);
  for (const button of state.controls) {
    assert.equal(button.inBounds, true, `${name}: ${button.name} outside viewport`);
    assert.equal(button.reachable, true, `${name}: ${button.name} covered`);
    assert.ok(button.width >= 40 && button.height >= 40, `${name}: ${button.name} touch target too small (${button.width}×${button.height})`);
  }
  await page.screenshot({ path: `${artifacts}/${name}.png` });
}

async function clickCommand(page: any, locator: any) {
  await Promise.all([page.waitForResponse((response: any) => response.url().endsWith('/infinidrill/action')), locator.click()]);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function enterAnswer(page: any, value: number) {
  for (const digit of String(value)) await page.getByRole('button', { name: `Number ${digit}`, exact: true }).click();
  await clickCommand(page, page.getByRole('button', { name: 'Check answer', exact: true }));
}

test('setup stacks machine above the introduction on narrow screens', async () => {
  for (const viewport of [{ width: 320, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 820, height: 1180 }, ...viewports]) {
    const { page, errors } = await fixture(viewport);
    try {
      const art = await page.locator('.infinidrill-setup-art').boundingBox();
      const card = await page.locator('.infinidrill-setup-card').boundingBox();
      const machine = await page.locator('.infinidrill-setup-art .infinidrill-machine').boundingBox();
      assert.ok(art && card && machine);
      if (viewport.width <= 900) {
        assert.ok(art.y + art.height <= card.y, 'machine artwork should be above the copy');
        assert.ok(machine.y + machine.height <= card.y, 'machine should not cover the introduction');
      } else assert.ok(art.x + art.width <= card.x, 'wide setup keeps its two columns');
      await checkViewport(page, `setup-responsive-${viewport.width}`);
      await page.getByRole('button', { name: 'How does it work?', exact: true }).click();
      await page.locator('.infinidrill-help-copy').waitFor();
      await page.getByRole('button', { name: 'Start drilling', exact: true }).click();
      await page.locator('.infinidrill-game').waitFor();
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test('server-confirmed bonus sand and its help stay readable with all controls at laptop and iPad sizes', async () => {
  for (const viewport of viewports) {
    const initial = createInfinidrillGame({ random: () => 0.5 });
    const savedGame: InfinidrillGameState = { ...initial, level: 7, depthBlocks: 120, depthMetres: 720,
      mainQuestionsCompleted: 9, questionsSinceChallenge: 0, fastStreak: 0,
      currentQuestion: generateBaseInfinidrillQuestion(7, () => 0.5),
      excavations: [{ from: 0, to: 120, left: -1, right: 1 }] };
    const { page, errors, getVerified } = await fixture(viewport, { savedGame, serverTownReward: { rock: 10, sand: 1, metal: 1 } });
    try {
      await page.getByRole('button', { name: 'How does it work?', exact: true }).click();
      await assertElementText(page.locator('.infinidrill-help-copy'), /Every 10 rocks.*1 bonus sand/);
      await checkViewport(page, `bonus-sand-help-en-${viewport.width}`);
      await page.evaluate(async () => { const path = '/src/i18n/uiText.ts'; const uiText = await import(path); await uiText.loadUiLanguage('vi'); const languagePath = '/src/lib/uiLanguage.ts'; (await import(languagePath)).setUiLanguage('vi'); });
      await assertElementText(page.locator('.infinidrill-help-copy'), /10 đá.*1 cát/);
      await checkViewport(page, `bonus-sand-help-vi-${viewport.width}`);
      await page.evaluate(async () => { const path = '/src/lib/uiLanguage.ts'; (await import(path)).setUiLanguage('en'); });
      await page.getByRole('button', { name: /Resume drilling/ }).click();
      await page.getByRole('button', { name: 'Check answer', exact: true }).waitFor();
      await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
      const notice = page.locator('.town-reward-bar [role="status"]');
      await assertElementText(notice, /\+10 rock, \+1 sand, \+1 metal/);
      await page.locator('.infinidrill-game[data-phase="playing"]').waitFor();
      await checkViewport(page, `bonus-sand-reward-${viewport.width}`);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

async function assertElementText(locator: any, expected: RegExp) {
  assert.match((await locator.innerText()) as string, expected);
}

async function assertFlightPath(page: any, kind: string, source: { x: number; y: number; width: number; height: number }, sourceTolerance = 2) {
  const target = await page.getByRole('button', { name: 'Open inventory', exact: true }).boundingBox();
  const points = await page.locator(`[data-reward-kind="${kind}"]`).first().evaluate((element: HTMLElement) => {
    const animation = element.getAnimations()[0]!;
    animation.pause();
    return [114, 400, 684].map(time => {
      animation.currentTime = time + Number(animation.effect!.getTiming().delay);
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
  });
  assert.ok(Math.abs(points[0].x - (source.x + source.width / 2)) < sourceTolerance && Math.abs(points[0].y - (source.y + source.height / 2)) < sourceTolerance, `${kind} starts at its source`);
  assert.ok(Math.abs(points[2].x - (target.x + target.width / 2)) < 2 && Math.abs(points[2].y - (target.y + target.height / 2)) < 2, `${kind} reaches Inventory`);
  assert.ok(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) > 20, `${kind} actually moves`);
}

test('mined diamonds and nuggets fly from their actual tiles to Inventory at all landscape sizes', async () => {
  for (const viewport of viewports) {
    const { page, getVerified } = await fixture(viewport, { worldSeed: 10, randomValue: 0 });
    await page.clock.install();
    await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
    const diamond = await page.locator('[data-world-row="1"][data-world-column="-1"]').boundingBox();
    const nugget = await page.locator('[data-world-row="1"][data-world-column="0"]').boundingBox();
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await assertFlightPath(page, 'crystals', diamond);
    await assertFlightPath(page, 'nuggets', nugget);
    assert.deepEqual(getVerified().game!.resources, { crystals: 1, nuggets: 1 });
    await checkViewport(page, `mineral-flight-${viewport.width}x${viewport.height}`);
    await page.clock.runFor(1400);
    assert.equal(await page.locator('.infinidrill-reward-flight').count(), 0);
    await clickCommand(page, page.getByRole('button', { name: 'Open inventory', exact: true }));
    assert.equal(await page.locator('.infinidrill-reward-flight').count(), 0, 'Opening Inventory cannot replay old rewards');
    await page.close();
  }
});

test('untouched wall diamonds stay visible after passing their depth and are not awarded', async () => {
  const { page, getVerified } = await fixture(viewports[1]!, { worldSeed: 6, randomValue: 0 });
  await page.clock.install();
  await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
  const diamond = page.locator('.infinidrill-world-block[data-world-row="1"][data-world-column="3"] [data-deposit-kind="crystals"]');
  assert.equal(await diamond.count(), 1, 'A diamond is visible outside the basic head reach');
  await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
  await page.clock.runFor(1800);
  assert.equal(getVerified().game!.depthBlocks, 2);
  assert.equal(getVerified().game!.resources.crystals, 0, 'Passing a row cannot collect its untouched diamond');
  assert.equal(await diamond.count(), 1, 'The intact wall keeps its diamond after the drill passes');
  await checkViewport(page, 'untouched-wall-diamond-1024x768');
  await page.close();
});

test('equipment remains unchanged while the server is pending and after an equip rejection', async () => {
  const savedGame = { ...createInfinidrillGame({ random: () => 0 }), ownedUpgradeIds: ['head-1'] };
  const { page, getVerified, releaseEquip } = await fixture(viewports[1]!, { savedGame, holdEquip: true });
  await page.getByRole('button', { name: /Start drilling/i }).click();
  await clickCommand(page, page.getByRole('button', { name: 'Open inventory', exact: true }));
  await page.getByRole('button', { name: 'Copper cone, owned', exact: true }).click();
  await Promise.all([page.waitForRequest((request: any) => request.postData()?.includes('equip-upgrade')), page.getByRole('button', { name: 'Equip part', exact: true }).click()]);
  await page.clock.install();
  await page.clock.runFor(1800);
  assert.equal(await page.locator('.infinidrill-machine.is-glowing').count(), 0);
  assert.equal(await page.locator('.infinidrill-workshop-preview [data-slot="head"]').getAttribute('data-tier'), '0');
  releaseEquip();
  await page.getByRole('alert').filter({ hasText: 'Equipment request rejected' }).waitFor();
  assert.equal(getVerified().game!.equippedUpgradeIds.head, 'starter-head');
  await page.getByRole('button', { name: 'Sync game', exact: true }).click();
  await page.getByRole('heading', { name: 'Workshop tree', exact: true }).waitFor();
  assert.equal(await page.locator('.infinidrill-world-motion [data-slot="head"]').getAttribute('data-tier'), '0');
  await page.close();
});

test('all equipped head tiers cut the required visible widths and retain them after resize', async () => {
  for (let tier = 0; tier <= 4; tier++) for (const side of tier % 2 ? [0, .99] : [0]) {
    const savedGame = createInfinidrillGame({ random: () => 0 });
    const game = { ...savedGame, equippedUpgradeIds: { ...savedGame.equippedUpgradeIds, head: tier ? `head-${tier}` : 'starter-head' } };
    const { page, getVerified } = await fixture(viewports[0]!, { savedGame: game, randomValue: side });
    await page.clock.install();
    await page.getByRole('button', { name: /Start drilling/i }).click();
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await page.clock.runFor(1800);
    const cut = getVerified().game!.excavations![0]!;
    assert.equal(cut.right - cut.left + 1, tier + 3);
    if (tier % 2) assert.equal(side < .5 ? cut.left : cut.right, side < .5 ? -Math.floor(tier / 2) - 2 : Math.floor(tier / 2) + 2);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const opening = page.locator('[data-cleared-row="0"]');
      const width = await opening.evaluate((element: HTMLElement) => {
        const tile = document.querySelector('.infinidrill-world-block')!.getBoundingClientRect().width;
        return element.getBoundingClientRect().width / tile;
      });
      assert.ok(Math.abs(width - (tier + 3)) < .01, `Tier ${tier} cuts ${tier + 3} visible tiles at ${viewport.width}`);
      await checkViewport(page, `head-${tier}-side-${side}-${viewport.width}`);
    }
    await page.close();
  }
});

test('Return to basic restores only one slot, keeps its tiers owned and narrows future digs', async () => {
  const initial = createInfinidrillGame({ random: () => 0 });
  const savedGame = { ...initial, depthBlocks: 10, depthMetres: 60, ownedUpgradeIds: ['head-1', 'head-2', 'head-3', 'engine-1'], equippedUpgradeIds: { ...initial.equippedUpgradeIds, head: 'head-3', engine: 'engine-1' }, excavations: [{ from: 0, to: 10, left: -3, right: 2 }] };
  const { page, getVerified } = await fixture(viewports[0]!, { savedGame, randomValue: 0 });
  await page.clock.install();
  await page.getByRole('button', { name: /Start drilling/i }).click();
  await clickCommand(page, page.getByRole('button', { name: 'Open inventory', exact: true }));
  await page.getByRole('button', { name: 'Crystal crown, equipped', exact: true }).click();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await checkViewport(page, `return-to-basic-${viewport.width}`);
  }
  await clickCommand(page, page.getByRole('button', { name: 'Return to basic', exact: true }));
  await page.clock.runFor(1700);
  assert.equal(getVerified().game!.equippedUpgradeIds.head, 'starter-head');
  assert.equal(getVerified().game!.equippedUpgradeIds.engine, 'engine-1');
  assert.deepEqual(getVerified().game!.ownedUpgradeIds, savedGame.ownedUpgradeIds);
  assert.equal(await page.locator('.infinidrill-workshop-preview [data-slot="head"]').getAttribute('data-tier'), '0');
  await clickCommand(page, page.getByRole('button', { name: 'Close workshop', exact: true }));
  await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
  await page.clock.runFor(1800);
  const cuts = getVerified().game!.excavations!;
  assert.deepEqual(cuts[0], savedGame.excavations[0]);
  assert.equal(cuts[1]!.right - cuts[1]!.left + 1, 3);
  await page.close();
});

test('game header uses the drill icon and the achievement collection pauses play and fits all landscape sizes', async () => {
  const { page, getVerified, errors, assetFailures } = await fixture(viewports[0]!, { randomValue: 0 });
  await page.clock.install();
  await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
  assert.equal(await page.locator('.infinidrill-brand-icon [data-slot="head"]').count(), 1);
  await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
  await page.clock.runFor(1800);
  const equation = await page.locator('.infinidrill-equation').textContent();
  await clickCommand(page, page.getByRole('button', { name: 'Badges', exact: true }));
  assert.equal(getVerified().game!.mode, 'paused');
  assert.equal(await page.locator('.infinidrill-achievement').count(), 10);
  assert.ok(await page.locator('.infinidrill-achievement[data-earned="true"]').count() > 0);
  assert.ok(await page.locator('.infinidrill-achievement[data-earned="false"]').count() > 0);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await checkViewport(page, `in-game-achievements-${viewport.width}x${viewport.height}`);
  }
  await page.clock.runFor(30000);
  await clickCommand(page, page.getByRole('button', { name: 'Back to drilling', exact: true }));
  assert.equal(await page.locator('.infinidrill-equation').textContent(), equation);
  assert.equal(getVerified().game!.mode, 'playing');
  assert.deepEqual(errors, []); assert.deepEqual(assetFailures, []);
  await page.close();
});

test('two header rows and pause prompt resume or restart at ground level', async () => {
  for (const viewport of [...viewports, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 667 }]) {
    const savedGame: InfinidrillGameState = { ...createInfinidrillGame({ random: () => .5 }), level: 12, depthBlocks: 160, depthMetres: 960,
      mainQuestionsCompleted: 90, currentQuestion: generateBaseInfinidrillQuestion(12, () => .5),
      excavations: [{ from: 0, to: 160, left: -1, right: 1 }] };
    const { page, getVerified, errors } = await fixture(viewport, { savedGame });
    page.setDefaultTimeout(6000);
    try {
      await page.getByRole('button', { name: 'Resume drilling', exact: true }).click();
      const nav = page.locator('.infinidrill-topbar'), materials = page.locator('.infinidrill-materialbar');
      const pause = page.getByRole('button', { name: 'Pause game', exact: true });
      assert.equal(await pause.locator('svg').count(), 1);
      assert.equal(await pause.locator('span').textContent(), 'Pause game');
      assert.equal(await nav.locator('.infinidrill-resource').count(), 0);
      assert.equal(await materials.locator('.infinidrill-resource').count(), 2);
      assert.equal(await materials.getByRole('button', { name: 'Open inventory', exact: true }).count(), 1);
      const first = await nav.boundingBox(), second = await materials.boundingBox();
      assert.ok(first && second && second.y >= first.y + first.height);
      for (const control of [nav.locator('.kid-back'), pause, page.getByRole('button', { name: 'Badges', exact: true }), page.getByRole('button', { name: 'Change interface language' }), materials.getByRole('button', { name: 'Open inventory' })]) {
        const box = await control.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= 128 && box.height >= 48);
        assert.ok(await control.evaluate((node: HTMLElement) => { const box = node.getBoundingClientRect(); const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return hit === node || node.contains(hit); }));
      }
      if (viewport.width >= 768) await checkViewport(page, `two-rows-${viewport.width}`);
      const questionId = getVerified().game!.currentQuestion!.id;
      await clickCommand(page, pause);
      const dialog = page.getByRole('dialog', { name: 'Drill paused', exact: true });
      assert.equal(await dialog.getByRole('button').count(), 2);
      const earned = { ...getVerified().earned };
      await checkViewport(page, `new-pause-${viewport.width}`);
      await clickCommand(page, dialog.getByRole('button', { name: 'Resume', exact: true }));
      assert.equal(getVerified().game!.currentQuestion!.id, questionId);
      assert.equal(getVerified().game!.depthMetres, 960);
      await clickCommand(page, pause);
      await clickCommand(page, dialog.getByRole('button', { name: 'Start new session', exact: true }));
      await page.locator('[data-phase="playing"]').waitFor();
      assert.equal(getVerified().game!.depthMetres, 0);
      assert.equal(getVerified().game!.level, 1);
      assert.equal(getVerified().game!.mainQuestionsCompleted, 0);
      assert.deepEqual(getVerified().earned, earned);
      assert.equal(await page.getByRole('dialog').count(), 0);
      if (viewport.width >= 768) await checkViewport(page, `new-session-${viewport.width}`);
      await page.getByRole('button', { name: 'Change interface language' }).click();
      await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
      await page.getByRole('button', { name: 'Tạm dừng trò chơi', exact: true }).click();
      await page.getByRole('button', { name: 'Bắt đầu lượt mới', exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test('a rejected new session keeps the saved tunnel until syncing and a verified restart succeed', async () => {
  const savedGame = { ...createInfinidrillGame(), depthBlocks: 20, depthMetres: 120, mainQuestionsCompleted: 3 };
  const { page, getVerified, errors } = await fixture(viewports[1]!, { savedGame, failReplay: true });
  try {
    await page.getByRole('button', { name: 'Resume drilling', exact: true }).click();
    await clickCommand(page, page.getByRole('button', { name: 'Pause game', exact: true }));
    await page.getByRole('button', { name: 'Start new session', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Unable to start a new session' }).waitFor();
    assert.equal(getVerified().game!.depthMetres, 120);
    await page.getByRole('button', { name: 'Sync game', exact: true }).click();
    await page.getByRole('heading', { name: 'Drill paused', exact: true }).waitFor();
    await clickCommand(page, page.getByRole('button', { name: 'Start new session', exact: true }));
    assert.equal(getVerified().game!.depthMetres, 0);
    await page.locator('[data-phase="playing"]').waitFor();
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /503 \(Service Unavailable\)/, 'only the deliberately rejected request is reported');
  } finally { await page.close(); }
});

test('engine vibration continues while answering and drilling, stops for pause, and respects reduced motion', async () => {
  const { page, getVerified } = await fixture(viewports[1]!, { randomValue: 0 });
  await page.clock.install();
  await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
  const machine = page.locator('.infinidrill-engine-shake');
  assert.equal(await machine.evaluate((element: HTMLElement) => getComputedStyle(element).animationName), 'infinidrill-engine-vibrate');
  const positions = await machine.evaluate((element: HTMLElement) => {
    const animation = element.getAnimations()[0]!;
    animation.pause();
    return [0, 36].map(time => { animation.currentTime = time; return getComputedStyle(element).translate; });
  });
  assert.notEqual(positions[0], positions[1], 'The entire machine visibly moves');
  await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
  assert.ok((await machine.evaluate((element: HTMLElement) => getComputedStyle(element).animationName)).includes('infinidrill-engine-vibrate'));
  await page.clock.runFor(1800);
  await clickCommand(page, page.getByRole('button', { name: 'Pause game', exact: true }));
  assert.equal(await machine.evaluate((element: HTMLElement) => getComputedStyle(element).animationName), 'none');
  await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
  assert.equal(await machine.evaluate((element: HTMLElement) => getComputedStyle(element).animationName), 'infinidrill-engine-vibrate');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await machine.evaluate((element: HTMLElement) => getComputedStyle(element).animationName), 'none');
  await page.close();
});

test('clicking or tapping the idle machine releases one to five chubby hearts in an arch without changing progress', async () => {
  for (const touch of [false, true]) {
    const { page, writes, getVerified } = await fixture(viewports[1]!, { randomValue: touch ? .99 : 0, touch });
    await page.clock.install();
    await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
    const before = structuredClone(getVerified());
    const requests = writes.length;
    const machine = page.getByRole('button', { name: 'Send hearts from the cabin', exact: true });
    if (touch) await machine.tap(); else await machine.click();
    const hearts = page.locator('.infinidrill-chubby-heart');
    assert.equal(await hearts.count(), touch ? 5 : 1);
    if (touch) {
      const arch = await hearts.evaluateAll((elements: HTMLElement[]) => elements.map(element => ({ x: parseFloat(element.style.getPropertyValue('--heart-x')), y: parseFloat(element.style.getPropertyValue('--heart-y')) })));
      assert.ok(arch[0].x < arch[2].x && arch[2].x < arch[4].x);
      assert.ok(arch[2].y < arch[0].y && arch[2].y < arch[4].y, 'Centre hearts sit highest in the arch');
    }
    assert.equal(writes.length, requests);
    assert.deepEqual(getVerified(), before, 'Hearts are cosmetic');
    await hearts.evaluateAll((elements: HTMLElement[]) => elements.forEach(element => {
      const animation = element.getAnimations()[0]!; animation.pause();
      animation.currentTime = 780 + Number(animation.effect!.getTiming().delay);
    }));
    await checkViewport(page, `pet-machine-${touch ? 'touch' : 'mouse'}-1024x768`);
    await page.clock.runFor(1600);
    assert.equal(await hearts.count(), 0);
    await page.close();
  }
});

test('all five head tiers cycle side-view frames during drilling and restore still art when paused or idle', async () => {
  for (let tier = 0; tier <= 4; tier++) {
    const initial = createInfinidrillGame({ random: () => 0 });
    const savedGame = { ...initial, equippedUpgradeIds: { ...initial.equippedUpgradeIds, head: tier ? `head-${tier}` : 'starter-head' } };
    const { page, assetFailures, getVerified } = await fixture(viewports[1]!, { savedGame, randomValue: 0 });
    await page.clock.install();
    await page.getByRole('button', { name: /Start drilling/i }).click();
    assert.equal(await page.locator('.infinidrill-spin-head').count(), 0);
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    const head = page.locator('.infinidrill-spin-head');
    await head.waitFor();
    assert.equal(await head.getAttribute('data-tier'), String(tier));
    assert.equal(await head.locator('svg image[href$="/drill-head-spin.png"]').count(), 4);
    const visible = await head.evaluate((element: HTMLElement) => {
      const frames = [...element.querySelectorAll<SVGElement>('.infinidrill-spin-frame')];
      return [0, 100].map(time => {
        frames.forEach(frame => { const animation = frame.getAnimations()[0]!; animation.pause(); animation.currentTime = time; });
        return frames.flatMap((frame, index) => Number(getComputedStyle(frame).opacity) > .9 ? [index] : []);
      });
    });
    assert.deepEqual(visible[0], [0]);
    assert.deepEqual(visible[1], [1]);
    await checkViewport(page, `spinning-head-${tier}-1024x768`);
    await page.clock.runFor(1800);
    assert.equal(await page.locator('.infinidrill-spin-head').count(), 0);
    await clickCommand(page, page.getByRole('button', { name: 'Pause game', exact: true }));
    assert.equal(await page.locator('.infinidrill-spin-head').count(), 0);
    assert.deepEqual(assetFailures, []);
    await page.close();
  }
});

test('equipped upgrades dig deeper, automatically laser either side, and rough tunnel art follows actual boundaries', async () => {
  for (const side of [0, .99]) {
    const initial = createInfinidrillGame({ random: () => 0 });
    const savedGame = { ...initial, equippedUpgradeIds: { ...initial.equippedUpgradeIds, accessory: 'accessory-4', cabin: 'cabin-1', engine: 'engine-1', treads: 'treads-1' } };
    const { page, getVerified, errors, assetFailures } = await fixture(viewports[1]!, { savedGame, randomValue: side });
    await page.clock.install();
    await page.getByRole('button', { name: /Start drilling/i }).click();
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await page.clock.runFor(1050);
    await page.locator('.infinidrill-laser').waitFor();
    assert.equal(await page.locator('.infinidrill-laser').getAttribute('data-laser-side'), side < .5 ? 'left' : 'right');
    assert.equal(await page.locator('.infinidrill-world-motion [data-slot="accessory"] image[href$="/laser-accessories.png"]').count(), 1, 'The upgrade mounts an actual laser cannon');
    const steps = await page.locator('[data-laser-step]').evaluateAll((elements: HTMLElement[]) => elements.map(element => ({ column: Number(element.dataset.laserColumn), left: parseFloat(element.style.left), top: parseFloat(element.style.top) })));
    assert.equal(steps.length, 6);
    for (let index = 1; index < steps.length; index++) {
      assert.ok(steps[index]!.top > steps[index - 1]!.top, 'Each pulse travels down to the next row');
      assert.equal(steps[index]!.column - steps[index - 1]!.column, side < .5 ? -1 : 1);
    }
    assert.equal(await page.locator('.infinidrill-laser-beam').count(), 3, 'Wide upgrades fire three diagonal beams');
    const pulse = await page.locator('.infinidrill-laser-beam').first().evaluate((element: SVGPathElement) => {
      const length = element.getTotalLength();
      const points = [0, .25, .5, .75, 1].map(fraction => {
        const point = element.getPointAtLength(length * fraction);
        return { x: point.x, y: point.y };
      });
      const animation = element.getAnimations()[0]!; animation.pause(); animation.currentTime = 50;
      const early = Number(getComputedStyle(element).strokeDashoffset.replace('px', ''));
      animation.currentTime = 180;
      const later = Number(getComputedStyle(element).strokeDashoffset.replace('px', ''));
      return { points, early, later };
    });
    for (let index = 1; index < pulse.points.length; index++) {
      assert.ok(pulse.points[index]!.y > pulse.points[index - 1]!.y, 'The beam travels down');
      assert.ok((pulse.points[index]!.x - pulse.points[index - 1]!.x) * (side < .5 ? -1 : 1) > 0, 'The beam travels outward diagonally');
    }
    assert.ok(pulse.later < pulse.early, 'The animation reveals the beam along its diagonal path');
    assert.equal(getVerified().game!.depthMetres, side < .5 ? 21 : 27);
    assert.ok(await page.locator('.infinidrill-tunnel-edge[data-edge-side="left"]').count());
    assert.ok(await page.locator('svg image[href$="/tunnel-edges.png"]').count());
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await checkViewport(page, `laser-${side}-${viewport.width}x${viewport.height}`);
    }
    await page.clock.runFor(1800);
    assert.equal(await page.locator('.infinidrill-laser').count(), 0);
    assert.ok(await page.locator('.infinidrill-tunnel-edge[data-edge-side="bottom"]').count(), 'The revealed laser tip has rough boundary art');
    await checkViewport(page, `rough-tunnel-${side}`);
    assert.deepEqual(errors, []); assert.deepEqual(assetFailures, []);
    await page.close();
  }
});

test('setup, retry, keypad, pause and full workshop tree fit laptop and iPad viewports', async () => {
  for (const viewport of viewports) {
    const { page, errors, writes, assetFailures, getVerified } = await fixture(viewport);
    const suffix = `${viewport.width}x${viewport.height}`;
    await checkViewport(page, `setup-${suffix}`);
    assert.equal(await page.locator('.infinidrill-setup-pills').count(), 0, 'Removed setup tags stay absent');
    assert.ok(await page.locator('svg image[href$="/drill-parts-atlas-v2.png"]').count(), 'The regenerated avatar-style drill art is active');
    const mountedTread = page.locator('.infinidrill-machine > .infinidrill-part-treads').first();
    assert.equal(await mountedTread.evaluate((part: HTMLElement) => getComputedStyle(part).transform), 'matrix(0, -1, 1, 0, 0, 0)', 'Left-facing tracks are rotated downward');
    const treadBounds = await mountedTread.boundingBox();
    const cabinBounds = await page.locator('.infinidrill-machine > .infinidrill-cabin').first().boundingBox();
    assert.ok(treadBounds && cabinBounds && treadBounds.height > treadBounds.width && treadBounds.x + treadBounds.width / 2 > cabinBounds.x + cabinBounds.width / 2, 'Tracks are vertical and mounted on the right');
    await clickCommand(page, page.getByRole('button', { name: /Start|Let.s drill|Begin/i }));
    await page.locator('.infinidrill-equation').waitFor();
    await checkViewport(page, `play-${suffix}`);
    const equation = await page.locator('.infinidrill-equation').textContent();
    const result = getVerified().game!.currentQuestion!.answer;
    await enterAnswer(page, result + 1);
    assert.equal(await page.locator('.infinidrill-equation').textContent(), equation, 'Wrong answer must keep the equation');
    await checkViewport(page, `retry-${suffix}`);
    await page.getByRole('button', { name: /Inventory/i }).click();
    await page.getByRole('heading', { name: 'Workshop tree', exact: true }).waitFor();
    await checkViewport(page, `workshop-${suffix}`);
    await clickCommand(page, page.getByRole('button', { name: /Close workshop|Back to drill|Keep drilling/i }).first());
    await clickCommand(page, page.getByRole('button', { name: /Pause/i }));
    await checkViewport(page, `pause-${suffix}`);
    await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
    const imageFailures = await page.locator('img').evaluateAll((images: HTMLImageElement[]) => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src));
    assert.deepEqual(imageFailures, [], 'All cabin and drill assets load');
    assert.deepEqual(assetFailures, [], 'No Infinidrill asset requests fail');
    assert.ok(await page.locator('img[src="/avatar-frames/space.webp"]').count(), 'Uses the selected avatar frame');
    assert.ok(writes.length > 0 && writes.every(url => url.endsWith('/infinidrill/action')), 'Only verified game commands are written');
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('top bar shows gathered resources and an immediately usable quest reward can be received and equipped', async () => {
  const { page, errors, assetFailures, getVerified } = await fixture(viewports[1]!, { randomValue: 0.999 });
  await page.clock.install();
  await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
  assert.equal(await page.locator('[data-resource="diamonds"] small').textContent(), 'diamonds');
  assert.equal(await page.locator('[data-resource="materials"] small').textContent(), 'nuggets');

  for (let index = 0; index < 7; index += 1) {
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await page.clock.runFor(1_800);
  }
  await page.getByRole('heading', { name: 'What should we do?', exact: true }).waitFor();
  await clickCommand(page, page.getByRole('button', { name: /Try a bonus/i }));
  await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
  await page.getByRole('heading', { name: /Pick one for your stash/i }).waitFor();
  const receiveAndEquip = page.getByRole('button', { name: /Receive and equip/i }).first();
  await receiveAndEquip.waitFor();
  const machine = await page.locator('.infinidrill-world-motion > .infinidrill-machine').boundingBox();
  await clickCommand(page, receiveAndEquip);
  await page.locator('[data-reward-kind="upgrade"]').waitFor();
  // The engine can move five pixels between measuring the machine and the reply.
  await assertFlightPath(page, 'upgrade', machine, 6);
  assert.ok(Object.values(getVerified().game!.equippedUpgradeIds).some((id) => id === 'head-1'), 'Usable quest equipment is equipped by the verified game state');
  assert.equal(await page.locator('[data-resource="diamonds"] strong').textContent(), String(getVerified().game!.resources.crystals));
  assert.equal(await page.locator('[data-resource="materials"] strong').textContent(), String(getVerified().game!.resources.nuggets));
  await page.clock.runFor(1_200);
  assert.equal(await page.locator('[data-reward-kind="upgrade"]').count(), 0, 'Equipment flight completes at the inventory target');
  assert.deepEqual(assetFailures, []);
  assert.deepEqual(errors, []);
  await page.close();
});

test('idle thoughts repeat, pause freezes the timer, and workshop handles stash prerequisites and glow-up', async () => {
  const { page, errors, writes, assetFailures, getVerified } = await fixture(viewports[1]!, { randomValue: 0, worldSeed: 3 });
  await page.clock.install();
  await clickCommand(page, page.getByRole('button', { name: /Start|Let.s drill|Begin/i }));
  await page.locator('[data-phase="playing"]').waitFor();

  await page.clock.runFor(10_250);
  const thought = page.locator('.infinidrill-thought[role="status"]');
  await thought.waitFor();
  const firstThought = await thought.textContent();
  assert.ok(firstThought, 'Idle thought appears after ten seconds');
  await page.clock.runFor(3_100);
  assert.equal(await thought.count(), 0, 'The first idle thought expires');
  await page.clock.runFor(25_250);
  await thought.waitFor();
  const secondThought = await thought.textContent();
  assert.ok(secondThought, 'A later idle thought appears again');
  await page.clock.runFor(3_100);

  await clickCommand(page, page.getByRole('button', { name: 'Pause game', exact: true }));
  await page.getByRole('heading', { name: 'Drill paused', exact: true }).waitFor();
  const pausedQuestion = await page.locator('.infinidrill-equation').textContent();
  await page.clock.runFor(30_000);
  assert.equal(await page.locator('.infinidrill-equation').textContent(), pausedQuestion, 'Pause keeps the current question');
  assert.equal(await thought.count(), 0, 'Pause hides idle thoughts');
  await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
  await page.locator('[data-phase="playing"]').waitFor();
  await page.clock.runFor(9_500);
  assert.equal(await thought.count(), 0, 'Paused time does not count toward idle thoughts');
  await page.clock.runFor(750);
  await thought.waitFor();

  await clickCommand(page, page.getByRole('button', { name: 'Open inventory', exact: true }));
  await page.getByRole('heading', { name: 'Workshop tree', exact: true }).waitFor();
  assert.equal(await page.locator('.infinidrill-node').count(), 20, 'Workshop shows all five four-tier branches');
  const lockedNode = page.getByRole('button', { name: /Steel spiral, locked/i });
  await lockedNode.click();
  const detail = page.locator('.infinidrill-detail-card');
  await assertElementText(detail, /Requires: Copper cone/);
  await assertElementText(detail, /Unlock previous tier/);
  await assertElementText(detail, /💎 5 diamonds · 🪙 8 nuggets/);

  await clickCommand(page, page.getByRole('button', { name: /Close workshop/i }));
  for (let index = 0; index < 7; index += 1) {
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await page.clock.runFor(1_800);
    if (await page.getByRole('heading', { name: 'What should we do?', exact: true }).count()) break;
  }
  await page.getByRole('heading', { name: 'What should we do?', exact: true }).waitFor();
  await clickCommand(page, page.getByRole('button', { name: /Try a bonus/i }));
  await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
  await page.getByRole('heading', { name: /Pick one for your stash/i }).waitFor();
  const reward = page.locator('.infinidrill-reward-choice').first();
  const rewardName = (await reward.locator('strong').textContent())?.trim();
  const rewardTier = (await reward.locator('small').textContent())?.trim();
  assert.ok(rewardName && rewardTier?.includes('tier 2'), `Deterministic free reward is a tier-two part: ${rewardName} (${rewardTier})`);
  await clickCommand(page, reward);

  // Build enough currency through normal questions to make the first tier buyable.
  for (let index = 0; index < 4; index += 1) {
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await page.clock.runFor(1_800);
  }
  await clickCommand(page, page.getByRole('button', { name: 'Open inventory', exact: true }));
  await page.getByRole('heading', { name: 'Workshop tree', exact: true }).waitFor();
  const stashNode = page.getByRole('button', { name: `${rewardName}, in stash`, exact: true });
  await stashNode.click();
  await assertElementText(detail, /In stash/);
  await assertElementText(detail, /Unlock previous tier/);

  const firstTier = page.getByRole('button', { name: /Copper cone, available/i });
  await firstTier.click();
  const buy = detail.getByRole('button', { name: 'Buy part', exact: true });
  assert.equal(await buy.isDisabled(), false, 'Enough earned crystals unlock a first-tier purchase');
  await clickCommand(page, buy);
  const equip = detail.getByRole('button', { name: 'Equip part', exact: true });
  await clickCommand(page, equip);
  await page.locator('.infinidrill-workshop-preview .infinidrill-machine.is-glowing').waitFor();
  await page.clock.runFor(1_700);
  await page.getByRole('button', { name: /Copper cone, equipped/i }).waitFor();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await checkViewport(page, `workshop-selected-equip-${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize(viewports[1]!);
  await clickCommand(page, page.getByRole('button', { name: /Close workshop/i }));
  assert.deepEqual(assetFailures, [], 'No Infinidrill asset requests fail');
  assert.ok(writes.every(url => url.endsWith('/infinidrill/action')));
  assert.deepEqual(errors, []);
  await page.close();
});

test('physical keyboard works after keypad focus and exit cancellation restores play', async () => {
  const { page, errors, writes, getVerified } = await fixture(viewports[0]!, { randomValue: 0 });
  await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
  await page.getByRole('button', { name: 'Number 1', exact: true }).click();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('0');
  assert.equal(await page.locator('.question-answer-line').textContent(), '0');
  await page.keyboard.press('Backspace');
  for(const digit of String(getVerified().game!.currentQuestion!.answer)) await page.keyboard.press(digit);
  await Promise.all([page.waitForResponse((response: any) => response.url().endsWith('/infinidrill/action')), page.keyboard.press('Enter')]);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('[data-phase="playing"]').waitFor();
  assert.ok(Number(await page.locator('[data-depth-blocks]').getAttribute('data-depth-blocks')) >= 2);
  await clickCommand(page, page.getByRole('button', { name: 'Pause game', exact: true }));
  const resume = page.getByRole('button', { name: 'Resume', exact: true });
  await resume.waitFor();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await resume.evaluate((button: HTMLElement) => document.activeElement === button), true, 'Modal traps tab focus');
  await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
  await clickCommand(page, page.getByRole('button', { name: 'Back to Playground', exact: true }));
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await checkViewport(page, `exit-confirmation-${viewport.width}x${viewport.height}`);
  }
  await clickCommand(page, resume);
  await page.locator('[data-phase="playing"]').waitFor();
  await clickCommand(page, page.getByRole('button', { name: 'Pause game', exact: true }));
  await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
  await clickCommand(page, page.getByRole('button', { name: 'Back to Playground', exact: true }));
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('heading', { name: 'What do you feel like doing?', exact: true }).waitFor();
  await page.getByRole('button').filter({ has: page.getByText('InfiniDrill', { exact: true }) }).click();
  await page.getByRole('button', { name: /Start drilling|Resume drilling/i }).waitFor();
  assert.deepEqual(errors, []);
  assert.ok(writes.every(url => url.endsWith('/infinidrill/action')));
  await page.close();
});

test('the camera goes underground, soil breaks away, the drill bounces and offscreen rows are unmounted', async () => {
  for (const viewport of [...viewports, { width: 1024, height: 1366 }]) {
    const { page, errors, assetFailures, getVerified } = await fixture(viewport, { randomValue: 0 });
    await page.clock.install();
    await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
    const scene = page.locator('.infinidrill-world-scene');
    await page.locator('.infinidrill-world-sky').waitFor();
    assert.ok(await page.locator('svg image[href$="/terrain-atlas-v2.png"]').count(), 'Pastel terrain art is active');
    assert.match(await page.locator('.infinidrill-world-wall > span').first().evaluate((element: HTMLElement) => getComputedStyle(element).filter), /blur\(2px\)/, 'Underground texture is softly blurred');
    const startCamera = Number(await scene.getAttribute('data-camera-row'));
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    await page.locator('.infinidrill-world-motion.is-bouncing').waitFor();
    await page.locator('.infinidrill-debris').first().waitFor();
    await page.clock.runFor(250);
    assert.ok(Number(await scene.getAttribute('data-camera-row')) > startCamera, 'Camera moves down with the drill');
    await checkViewport(page, `drilling-bounce-${viewport.width}x${viewport.height}`);
    await page.clock.runFor(1800);
    for (let index = 1; index < 10; index++) {
      await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
      await page.clock.runFor(1800);
      if (await page.getByRole('heading', { name: 'What should we do?', exact: true }).count()) await clickCommand(page, page.locator('.infinidrill-choice-card').first());
      if (index === 3) {
        const depth = Number(await scene.getAttribute('data-world-depth'));
        const tip = await page.locator(`[data-cleared-row="${depth - .5}"]`).boundingBox();
        const middle = await page.locator(`[data-cleared-row="${depth - 1}"]`).boundingBox();
        const upper = await page.locator(`[data-cleared-row="${depth - 1.5}"]`).boundingBox();
        assert.ok(tip && middle && upper && tip.width < middle.width && middle.width < upper.width, 'Excavation visibly narrows to a V at the tip');
        await checkViewport(page, `pastel-v-shaft-${viewport.width}x${viewport.height}`);
      }
    }
    assert.equal(await page.locator('.infinidrill-world-sky').count(), 0, 'Surface sky is removed at depth');
    assert.equal(await page.locator('.infinidrill-world-sun').count(), 0, 'Offscreen sun is removed');
    assert.equal(await page.locator('.infinidrill-world-wall[data-world-row="0"]').count(), 0, 'Old surface row is unmounted');
    assert.equal(await page.locator('.infinidrill-debris').count(), 0, 'Spent debris is unmounted');
    assert.ok(await page.locator('[data-cleared-row]').count(), 'Drilled shaft reveals background walls');
    assert.ok(Number(await scene.getAttribute('data-retained-caves')) <= 1, 'Passed cave metadata is pruned');
    const camera = Number(await scene.getAttribute('data-camera-row'));
    const rowCount = Number(await scene.getAttribute('data-visible-rows'));
    const columns = Number(await scene.getAttribute('data-visible-columns'));
    assert.ok(await page.locator('.infinidrill-world-block, .infinidrill-world-open').count() <= rowCount * columns);
    const renderedRows = await page.locator('[data-world-row]').evaluateAll((elements: HTMLElement[]) => elements.map(element => Number(element.dataset.worldRow)));
    const firstRow = Math.floor(camera * 2) / 2;
    assert.ok(renderedRows.every((row: number) => row >= firstRow && row < firstRow + rowCount / 2), 'No old or distant rows remain');
    assert.equal(await page.locator('.infinidrill-world-block').evaluateAll((blocks: HTMLElement[]) => {
      const bounds = blocks[0]?.closest('.infinidrill-world-scene')?.getBoundingClientRect();
      return !!bounds && blocks.every(block => {
        const rect = block.getBoundingClientRect();
        return rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top;
      });
    }), true, 'Every foreground block intersects the scene viewport');
    await checkViewport(page, `underground-trail-${viewport.width}x${viewport.height}`);
    assert.deepEqual(assetFailures, []);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('a complete Earth expedition reaches the core and replay resets session state', async () => {
  const { page, errors, writes, assetFailures, getVerified } = await fixture(viewports[1]!);
  await page.clock.install();
  await clickCommand(page, page.getByRole('button', { name: /Start|Let.s drill|Begin/i }));
  let sawChoice = false, sawReward = false, sawFailedBonus = false, sawCave = false;
  const seenQuestions = new Set<string>();
  function checkUniqueQuestion() {
    const key = questionKey(getVerified().game!.currentQuestion!);
    assert.equal(seenQuestions.has(key), false, `Repeated question during browser expedition: ${key}`);
    seenQuestions.add(key);
  }
  for (let step = 0; step < 160; step++) {
    await page.clock.runFor(2500);
    if (await page.getByRole('button', { name: /Play again|Replay/i }).count()) break;
    const choices = page.getByRole('button', { name: /Try a bonus/i });
    if (await choices.count()) {
      sawChoice = true;
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await checkViewport(page, `optional-choice-${viewport.width}x${viewport.height}`);
      }
      await page.setViewportSize(viewports[1]!);
      await clickCommand(page, choices);
      checkUniqueQuestion();
      const answer = getVerified().game!.currentQuestion!.answer;
      await enterAnswer(page, sawFailedBonus ? answer : answer + 1);
      if (!sawFailedBonus) { sawFailedBonus = true; await page.clock.runFor(2500); }
      else {
        await page.getByRole('heading', { name: /Pick one/i }).waitFor();
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await checkViewport(page, `reward-${viewport.width}x${viewport.height}`);
        }
        await page.setViewportSize(viewports[1]!);
        await clickCommand(page, page.locator('.infinidrill-reward-choice').first());
        sawReward = true;
      }
      continue;
    }
    checkUniqueQuestion();
    await enterAnswer(page, getVerified().game!.currentQuestion!.answer);
    if (!sawCave && await page.locator('.infinidrill-scene.has-cave-fall').count()) {
      await checkViewport(page, 'cave-fall-1024x768');
      sawCave = true;
    }
  }
  assert.ok(sawChoice && sawReward && sawFailedBonus, 'Exercise optional success and failure');
  assert.ok(sawCave, 'Fast correct answers visibly open a cave shortcut');
  await page.getByRole('button', { name: /Play again|Replay/i }).waitFor();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await checkViewport(page, `core-${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize(viewports[1]!);
  assert.ok((await page.locator('body').innerText()).includes('2,160') || (await page.locator('body').innerText()).includes('2160'));
  await clickCommand(page, page.getByRole('button', { name: /Play again|Replay/i }));
  await page.getByRole('button', { name: /Start|Let.s drill|Begin/i }).waitFor();
  await checkViewport(page, 'replay-1024x768');
  assert.ok(writes.every(url => url.endsWith('/infinidrill/action')));
  assert.deepEqual(assetFailures, [], 'No Infinidrill asset requests fail');
  assert.deepEqual(errors, []);
  await page.close();
});

test('an exhausted question pool offers replay and exit without scrolling at every landscape size', async () => {
  const savedGame = { ...createInfinidrillGame({ random: () => 0 }), mode: 'question-exhausted' as const, currentQuestion: null };
  const { page, errors, getVerified } = await fixture(viewports[0]!, { savedGame });
  await page.getByRole('button', { name: /Start drilling/i }).click();
  await page.getByRole('heading', { name: 'You tried every puzzle in this layer!' }).waitFor();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await checkViewport(page, `exhausted-${viewport.width}x${viewport.height}`);
  }
  await clickCommand(page, page.getByRole('button', { name: 'Play again', exact: true }));
  await page.getByRole('button', { name: 'Start drilling', exact: false }).waitFor();
  assert.equal(getVerified().game!.mode, 'playing');
  assert.equal(getVerified().game!.seenQuestions!.length, 1);
  assert.deepEqual(errors, []);
  await page.close();
});


test('saved badge survives a lost reply, syncing, leaving, and returning to the expedition', async () => {
  const { page, getVerified } = await fixture(viewports[0]!, { randomValue: 0, loseResponse: true });
  await clickCommand(page, page.getByRole('button', { name: /Start drilling/i }));
  const answer = getVerified().game!.currentQuestion!.answer;
  for (const digit of String(answer)) await page.getByRole('button', { name: `Number ${digit}`, exact: true }).click();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Reply lost after saving' }).waitFor();
  const earnedAt = getVerified().earned['infinidrill-first-drill']; assert.ok(earnedAt);
  await checkViewport(page, 'network-recovery-1366x768');
  await page.getByRole('button', { name: 'Sync game' }).click();
  await page.locator('[data-phase="playing"]').waitFor();
  assert.equal(getVerified().game!.mainQuestionsCompleted, 1);
  await clickCommand(page, page.getByRole('button', { name: 'Pause game' }));
  await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
  await clickCommand(page, page.getByRole('button', { name: 'Back to Playground', exact: true }));
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('heading', { name: 'What do you feel like doing?' }).waitFor();
  await page.getByRole('button').filter({ has: page.getByText('InfiniDrill', { exact: true }) }).click();
  await page.getByRole('button', { name: 'Resume drilling' }).click();
  await page.getByRole('heading', { name: 'Drill paused' }).waitFor();
  await clickCommand(page, page.getByRole('button', { name: 'Resume', exact: true }));
  assert.equal(getVerified().earned['infinidrill-first-drill'], earnedAt);
  assert.equal(getVerified().game!.mainQuestionsCompleted, 1);
  await page.close();
});

for(const viewport of viewports)test(`stacked math and Venn questions fit ${viewport.width}x${viewport.height}`,async()=>{
  const base = makeQuestion(equationCard('chain-2d-3', [18, 3, 12], ['+', '+'], 'result'), 'column-example') as InfinidrillQuestion;
  if (base.card.kind !== 'equation') throw new Error('Expected an equation fixture');
  const missing = makeQuestion(withBlank(base.card, 1)!, 'missing') as InfinidrillQuestion;
  const questions: InfinidrillQuestion[] = [base, missing,
    makeQuestion(generateInfinidrillCard(12,()=>.7)!, 'mul-12') as InfinidrillQuestion,
    makeQuestion(generateInfinidrillCard(13,()=>.7)!, 'mul-13') as InfinidrillQuestion,
    makeQuestion(generateInfinidrillCard(14,()=>.1)!, 'mul-14') as InfinidrillQuestion,
    makeQuestion(generateInfinidrillCard(14,()=>.9)!, 'div-14') as InfinidrillQuestion];
  const picture = makeQuestion(vennCard(6,()=>.99, 'venn-large'), 'venn') as InfinidrillQuestion;
  for(const target of ['leftOnly','shared','rightOnly','left','right','union'] as VennTarget[]) {
    if (picture.card.kind !== 'venn') continue;
    questions.push(makeQuestion({...picture.card, target}, `venn-${target}`) as InfinidrillQuestion);
  }
  for(const question of questions){
    const level = stageForCard(question);
    const savedGame={...createInfinidrillGame({random:()=>.9}),level,currentQuestion:question};
    const {page,getVerified,errors,assetFailures}=await fixture(viewport,{savedGame});
    await page.getByRole('button',{name:/Start drilling/i}).click();
    await page.locator('.infinidrill-equation').waitFor();
    if(question.card.kind === 'venn'){await page.waitForFunction(()=>Array.from(document.querySelectorAll('.infinidrill-venn image')).every(image=>image.getAttribute('href')?.startsWith('data:image/png')));assert.equal(await page.locator('.infinidrill-venn [data-region] circle').count(),0);const transparent=await page.locator('.infinidrill-venn image').evaluateAll(async(images:Element[])=>Promise.all(images.map(element=>new Promise<boolean>(resolve=>{const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);resolve(ctx.getImageData(0,0,1,1).data[3]===0);};image.src=element.getAttribute('href')!;}))));assert.ok(transparent.every(Boolean));}
    await checkViewport(page,`visual-${question.card.kind === 'venn' ? question.card.target : question.card.blank}-${viewport.width}`);
    if(question.card.kind === 'venn'){assert.equal(await page.locator('.infinidrill-venn [data-region]').count(),picture.card.kind === 'venn' ? picture.card.items.length : 0);}
    else{
      const rights=await page.locator('.infinidrill-math-number').evaluateAll((nodes:Element[])=>nodes.map(n=>n.getBoundingClientRect().right));
      assert.ok(rights.every((right:number)=>Math.abs(right-rights[0])<.5));
      assert.equal(await page.locator('.infinidrill-math-row').count(),question.card.kind === 'equation' ? question.card.operands.length+1 : 0);
      if(question.card.kind === 'equation' && question.card.blank === 1){assert.equal(await page.locator('.infinidrill-math-row').nth(1).locator('.question-answer-line').textContent(),'?');assert.equal(await page.locator('.is-result .infinidrill-math-number').textContent(),'33');}
    }
    await enterAnswer(page,getVerified().game!.currentQuestion!.answer);
    assert.equal(getVerified().game!.mainQuestionsCompleted,1);
    assert.deepEqual(errors,[]);assert.deepEqual(assetFailures,[]);await page.close();
  }
});
