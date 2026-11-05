import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { achievements as ufoAchievements } from '../../../server/src/ufo/game.ts';
import { achievements as mathAchievements } from '../../../server/src/math-wall/game.ts';
import { CABBAGE_ROLLS_ACHIEVEMENT_GROUP, INFINIDRILL_ACHIEVEMENT_GROUP, TOWN_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';
const { chromium } = createRequire(import.meta.url)('playwright');

let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin = '';
const viewports = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 390, height: 844 },
  { width: 320, height: 667 },
];

const ufoStats = {
  solved: 100, medium: 10, hard: 3, shoo: 10,
  friends: { cow: 10, highland: 10, sheep: 10, capybara: 10 },
  captures: { cow: 5, highland: 5, sheep: 5, capybara: 5 },
};
const ufoState = {
  revision: 0,
  stats: ufoStats,
  achievements: ufoAchievements(ufoStats, 'en'),
  session: null,
};
const mathState = {
  revision: 0,
  serverNow: Date.now(),
  best: 50,
  achievements: mathAchievements({
    revision: 0, best: 50,
    stats: { passed: 50, medium: 10, hard: 5, streak: 5 },
    session: null,
  }),
  session: null,
};
const drillState = {
  revision: 0,
  game: null,
  achievements: INFINIDRILL_ACHIEVEMENT_GROUP.achievements.map((definition, index) => ({
    ...definition,
    earnedAt: index === 0 ? '2026-10-12T00:00:00.000Z' : null,
  })),
};
const townState = {
  revision: 0,
  materials: { stamina: 0, wood: 0, rock: 0, sand: 0, metal: 0, wool: 0 },
  entities: [],
  learnedIds: [],
  earned: { 'town-first-home': '2026-10-12T00:00:00.000Z' },
  badges: TOWN_ACHIEVEMENT_GROUP.achievements.map(({ id, name, description, difficulty }) => ({ id, name, description, difficulty })),
};
const cabbageGroup = {
  ...CABBAGE_ROLLS_ACHIEVEMENT_GROUP,
  scope: 'unavailable', recorded: false,
  metrics: [{ key: 'completed', label: 'Completed', value: null }],
  achievements: CABBAGE_ROLLS_ACHIEVEMENT_GROUP.achievements.map(definition => ({ ...definition, earned: false, earned_at: null })),
};
const legacyBadges = [
  { id: 'legacy-global-1', badge_key: 'global_5', badge_type: 'global', milestone: 5, earned_at: '2026-10-12T00:00:00.000Z', name: 'First World Explorer', description: 'Complete your first five places across the world.' },
  { id: 'legacy-global-2', badge_key: 'global-legend', badge_type: 'global', milestone: 50, earned_at: '2026-10-12T00:00:00.000Z', name: 'World Story Collector', description: 'Explore fifty places and remember what makes each one special.' },
  { id: 'legacy-food', badge_key: 'food-10', badge_type: 'food', milestone: 10, earned_at: '2026-10-12T00:00:00.000Z', name: 'Curious Kitchen Traveller', description: 'Discover ten food traditions and the stories shared around them.' },
  { id: 'legacy-monument', badge_key: 'monument-25', badge_type: 'monument', milestone: 25, earned_at: '2026-10-12T00:00:00.000Z', name: 'Keeper of Remarkable Places', description: 'Learn about twenty-five monuments, landmarks, and the people who made them.' },
];

before(async () => {
  await mkdir('/tmp/plg-badge-collection', { recursive: true });
  server = await createServer({
    configFile: false,
    cacheDir: '/tmp/plg-badge-collection/vite-cache',
    plugins: [react(), {
      name: 'badge-collection-harness-route',
      configureServer(viteServer) {
        viteServer.middlewares.use((request, _response, next) => {
          if (request.url?.startsWith('/profile/') && request.headers.accept?.includes('text/html')) {
            request.url = '/tests/browser/badge-collection-harness.html';
          }
          next();
        });
      },
    }],
    root: fileURLToPath(new URL('../../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}),
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function fixture(viewport: { width: number; height: number }) {
  const page = await browser.newPage({ viewport });
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/api/**', async (route: any) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.fallback();
    if (path.endsWith('/badges')) return route.fulfill({ json: legacyBadges });
    if (path.endsWith('/ufo')) return route.fulfill({ json: ufoState });
    if (path.endsWith('/math-wall')) return route.fulfill({ json: mathState });
    if (path.endsWith('/infinidrill')) return route.fulfill({ json: drillState });
    if (path.endsWith('/town')) return route.fulfill({ json: townState });
    if (path.endsWith('/achievement-groups')) return route.fulfill({ json: [cabbageGroup] });
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(() => {
    try { localStorage.removeItem('plg-ui-language'); } catch { /* Browser storage is optional. */ }
  });
  return { page, errors };
}

type LayoutSnapshot = {
  cardCount: number;
  artCount: number;
  gridCount: number;
  rows: number;
  cardWidths: number[];
  cardHeights: number[];
  artWidths: number[];
  artHeights: number[];
  horizontalOverflow: boolean;
  clipped: string[];
};

async function layoutSnapshot(page: any): Promise<LayoutSnapshot> {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.badge-collection-card')];
    const arts = [...document.querySelectorAll<HTMLElement>('.badge-collection-art')];
    const rects = cards.map(card => card.getBoundingClientRect());
    const clipped = cards.flatMap(card => [...card.querySelectorAll<HTMLElement>('h3,h4,p,strong,span')]
      .filter(element => {
        if (element.closest('.badge-collection-art')) return false;
        if (!(element.textContent ?? '').trim() || element.clientWidth === 0 || element.clientHeight === 0) return false;
        return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      })
      .map(element => element.textContent?.trim() ?? ''));
    const rows = new Set(rects.map(rect => Math.round(rect.top))).size;
    return {
      cardCount: cards.length,
      artCount: arts.length,
      gridCount: document.querySelectorAll('.badge-collection-grid').length,
      rows,
      cardWidths: rects.map(rect => rect.width),
      cardHeights: rects.map(rect => rect.height),
      artWidths: arts.map(art => art.getBoundingClientRect().width),
      artHeights: arts.map(art => art.getBoundingClientRect().height),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      clipped,
    };
  });
}

function assertUniform(values: number[], expected: number, label: string) {
  assert.ok(values.length > 0, `${label} should have measurements`);
  const spread = Math.max(...values) - Math.min(...values);
  assert.ok(spread <= 1.5, `${label} spread was ${spread}: ${JSON.stringify(values)}`);
  assert.ok(Math.abs(values[0]! - expected) <= 2, `${label} expected ${expected}: ${JSON.stringify(values)}`);
}

function assertCollectionLayout(snapshot: LayoutSnapshot, viewport: { width: number; height: number }, language: string) {
  assert.ok(snapshot.cardCount >= 35, `${language} ${viewport.width}x${viewport.height} should render all game and legacy cards`);
  assert.equal(snapshot.cardCount, snapshot.artCount, `${language} art/card count`);
  assert.ok(snapshot.gridCount >= 5, `${language} should render separate collection grids`);
  assertUniform(snapshot.cardWidths, 200, `${language} card width`);
  assertUniform(snapshot.cardHeights, 380, `${language} card height`);
  assertUniform(snapshot.artWidths, 96, `${language} art width`);
  assertUniform(snapshot.artHeights, 96, `${language} art height`);
  assert.ok(snapshot.rows > 1, `${language} ${viewport.width}x${viewport.height} should wrap cards into multiple rows`);
  assert.equal(snapshot.horizontalOverflow, false, `${language} ${viewport.width}x${viewport.height} has horizontal page overflow`);
  assert.deepEqual(snapshot.clipped, [], `${language} ${viewport.width}x${viewport.height} has clipped card text`);
}

for (const viewport of viewports) {
  test(`badge collection cards stay uniform and wrap at ${viewport.width}x${viewport.height}`, async () => {
    const { page, errors } = await fixture(viewport);
    await page.goto(`${origin}/profile/profile-a/badges`);
    await page.getByRole('heading', { name: 'My Badges', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Cabbage Roll Kitchen', exact: true }).waitFor();
    for (const badge of CABBAGE_ROLLS_ACHIEVEMENT_GROUP.achievements) await page.getByRole('heading', { name: badge.name, exact: true }).waitFor();
    await page.locator('.badge-collection-card').first().waitFor();
    assertCollectionLayout(await layoutSnapshot(page), viewport, 'English');
    if (viewport.width === 1366) await page.screenshot({ path: '/tmp/plg-badge-collection/desktop-en.png', fullPage: true });

    await page.getByRole('button', { name: 'Change interface language' }).click();
    await page.getByRole('button', { name: 'Tiếng Việt' }).click();
    await page.getByRole('heading', { name: 'Huy hiệu của bé', exact: true }).waitFor();
    assertCollectionLayout(await layoutSnapshot(page), viewport, 'Vietnamese');
    if (viewport.width === 320) await page.screenshot({ path: '/tmp/plg-badge-collection/mobile-vi.png', fullPage: true });
    assert.deepEqual(errors, [], `${viewport.width}x${viewport.height} page errors`);
    await page.close();
  });
}
