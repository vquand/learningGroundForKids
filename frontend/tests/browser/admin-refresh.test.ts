import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { summarizeChild, summarizeFamily } from '../../../server/src/parent-reports/summary.ts';
import { CABBAGE_ROLLS_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';

const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const profilePath = '/api/v1/admin/families/family-one/profiles/kid-one';
async function fixture(width = 1024) {
  const page = await browser.newPage({ viewport: { width, height: 768 } }); page.setDefaultTimeout(8_000);
  const state = { updated: false, fail: '', held: '', release: () => {} };
  let notifyHeld: () => void;
  const heldSeen = new Promise<void>(resolve => { notifyHeld = resolve; });
  const calls: Array<{ path: string; query: Record<string, string> }> = [], writes: string[] = [], errors: string[] = [];
  let navigations = 0;
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('request', (request: any) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
  await page.route('**/*', async (route: any) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.origin !== origin) return route.fulfill({ status: 204 });
    if (!path.startsWith('/api/')) return route.continue();
    if (request.method() !== 'GET') { writes.push(path); return route.fulfill({ status: 405 }); }
    calls.push({ path, query: Object.fromEntries(url.searchParams) });
    if (state.held === path) { state.held = ''; await new Promise<void>(resolve => { state.release = resolve; notifyHeld(); }); }
    if (state.fail === path) { state.fail = ''; return route.fulfill({ status: 503, json: { error: { message: 'Refresh fixture unavailable' } } }); }
    const child = summarizeChild({ id: 'kid-one', name: state.updated ? 'Mira updated' : 'Mira', emoji: '⭐', color: '#456', public_id: 'MIRA123456', miniku: { completed: state.updated ? 12 : 3 } });
    const profile = { ...child, family_id: 'family-one', family_name: 'Learning family', created_at: '2026-10-01T00:00:00Z', total_done: state.updated ? 9 : 2, badge_count: 0, quiz_attempt_count: 1, flashcard_session_count: 1 };
    let json: unknown = [];
    if (path.endsWith('/auth/session')) json = { authenticated: true, user: { id: 'admin', email: 'admin@example.test', name: 'Admin' } };
    else if (path.endsWith('/admin/session')) json = { is_admin: true };
    else if (path.endsWith('/admin/items')) json = [{ id: 'fox', title_en: state.updated ? 'Fox updated' : 'Fox', category: 'animal', is_published: true, created_at: profile.created_at }];
    else if (path.endsWith('/admin/families')) json = [{ id: 'family-one', display_name: state.updated ? 'Family updated' : 'Learning family', created_at: profile.created_at, profile_count: 1, accepted_request_count: 0, pending_incoming_count: 0, pending_outgoing_count: 0, rejected_request_count: 0, friend_requests: [], profiles: [{ ...profile, total_items: 20, completion_rate: 10, recent_activities: [] }] }];
    else if (path.endsWith('/family-one/reports')) json = summarizeFamily([child], new Date('2026-10-15T12:00:00Z'));
    else if (path === profilePath) json = profile;
    else if (path === `${profilePath}/activities`) json = { activities: [], total: state.updated ? 7 : 0, total_pages: 1, page: Number(url.searchParams.get('page')), page_size: 20 };
    else if (path === `${profilePath}/journey`) json = { waypoints: [], origin: { title: 'Home', latitude: 0, longitude: 0 }, total: state.updated ? 6 : 0, exploredCount: 0, total_pages: 1, page: 1, page_size: 100 };
    else if (path.endsWith('/admin/tests')) json = [{ item_id: 'fox', item_title: state.updated ? 'Fox quiz updated' : 'Fox quiz', item_category: 'animal', country_code: 'VN', assessment_type: 'quiz', active_question_count: 3, question_count: 3, attempt_count: 1, unique_profile_count: 1, pass_rate: 100, latest_attempt_at: null }];
    else if (path.endsWith('/admin/ufo/words')) json = [{ id: 'fox', word: 'FOX', language: 'en', difficulty: 'easy', clue: state.updated ? 'Updated woodland clue' : 'Woodland clue', definition: 'A woodland animal' }];
    else if (path.endsWith('/admin/miniku/puzzles')) json = [{ id: state.updated ? 'updated-puzzle' : 'original-puzzle', size: 3, givens: [1, 0, 0, 0, 2, 0, 0, 0, 3], enabled: true, revision: 0, ownerFamilyId: null }];
    else if (path.endsWith('/admin/achievements')) json = [{ ...CABBAGE_ROLLS_ACHIEVEMENT_GROUP, installed: state.updated ? 4 : 0, needsMigration: !state.updated }];
    return route.fulfill({ json });
  });
  return { page, state, calls, writes, errors, heldSeen, navigations: () => navigations };
}

for (const [path, beforeText, afterText, api] of [
  ['/admin/content', 'Fox', 'Fox updated', '/api/v1/admin/items'],
  ['/admin/families', 'Learning family', 'Family updated', '/api/v1/admin/families'],
  ['/admin/tests', 'Fox quiz', 'Fox quiz updated', '/api/v1/admin/tests'],
  ['/admin/ufo', 'Woodland clue', 'Updated woodland clue', '/api/v1/admin/ufo/words'],
  ['/admin/miniku', /original/, /updated-/, '/api/v1/admin/miniku/puzzles'],
  ['/admin/achievements', /Migration needed/, /Up to date/, '/api/v1/admin/achievements'],
] as const) test(`read-only Refresh updates ${path} without navigation or lost filters`, async () => {
  const f = await fixture(); const { page, state } = f;
  try {
    await page.goto(`${origin}${path}`);
    await page.getByText(beforeText, { exact: typeof beforeText === 'string' }).first().waitFor();
    if (path === '/admin/content') await page.locator('select').selectOption('animal');
    if (path === '/admin/tests') await page.getByPlaceholder('Search tests by item title').fill('Fox');
    if (path === '/admin/ufo') await page.getByPlaceholder('Word, clue, or meaning').fill('FOX');
    if (path === '/admin/miniku') await page.getByRole('combobox').selectOption('3');
    const before = f.calls.filter(call => call.path === api).length;
    state.updated = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText(afterText, { exact: typeof afterText === 'string' }).first().waitFor();
    assert.equal(f.calls.filter(call => call.path === api).length, before + 1);
    assert.equal(f.navigations(), 1);
    if (path === '/admin/content') assert.equal(await page.locator('select').inputValue(), 'animal');
    if (path === '/admin/tests') assert.equal(await page.getByPlaceholder('Search tests by item title').inputValue(), 'Fox');
    if (path === '/admin/ufo') assert.equal(await page.getByPlaceholder('Word, clue, or meaning').inputValue(), 'FOX');
    if (path === '/admin/miniku') assert.equal(await page.getByRole('combobox').inputValue(), '3');
    if (path === '/admin/achievements') {
      for (const badge of CABBAGE_ROLLS_ACHIEVEMENT_GROUP.achievements) await page.getByRole('heading', { name: badge.name, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Migrate achievement data' }).waitFor();
      await page.screenshot({ path: '/tmp/plg-cabbage-achievement-catalog.png', fullPage: true });
    }
    assert.deepEqual(f.writes, []); assert.deepEqual(f.errors, []);
  } finally { state.release(); await page.close(); }
});

test('profile Refresh updates summary, child achievements, journey and filtered history together', async () => {
  const f = await fixture(1366); const { page, state } = f;
  try {
    await page.goto(`${origin}/admin/families/family-one/profiles/kid-one`);
    await page.getByRole('heading', { name: '⭐ Mira', exact: true }).waitFor();
    const history = page.getByRole('region', { name: 'Activities', exact: true });
    const journey = page.getByRole('region', { name: 'Journey', exact: true });
    await history.getByRole('combobox').selectOption('quiz');
    await journey.getByRole('combobox').selectOption('all');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    const before = f.calls.length;
    state.updated = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('heading', { name: '⭐ Mira updated', exact: true }).waitFor();
    await history.getByText('7 recorded activities', { exact: true }).waitFor();
    await journey.getByText('6 completed places · Showing 0 on this page', { exact: true }).waitFor();
    assert.equal(await history.getByRole('combobox').inputValue(), 'quiz');
    assert.equal(await journey.getByRole('combobox').inputValue(), 'all');
    assert.ok(f.calls.slice(before).some(call => call.path === `${profilePath}/activities` && call.query.type === 'quiz'));
    assert.ok(f.calls.slice(before).some(call => call.path === `${profilePath}/journey` && call.query.period === 'all'));
    const learning = page.getByRole('region', { name: 'Selected child learning progress' });
    assert.equal(await learning.locator('[data-game="miniku"] dd').first().textContent(), '12');
    await learning.getByText('Achievement collection', { exact: true }).click();
    await learning.getByRole('heading', { name: 'Cabbage Roll Kitchen', exact: true, level: 4 }).waitFor();
    for (const badge of CABBAGE_ROLLS_ACHIEVEMENT_GROUP.achievements) await learning.getByText(badge.name, { exact: true }).waitFor();
    await page.screenshot({ path: '/tmp/plg-admin-profile-refresh.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(f.navigations(), 1); assert.deepEqual(f.writes, []); assert.deepEqual(f.errors, []);
  } finally { state.release(); await page.close(); }
});

test('Refresh disables while pending and recovers after a failed list request', async () => {
  const f = await fixture(); const { page, state } = f;
  try {
    await page.goto(`${origin}/admin/content`); await page.getByText('Fox', { exact: true }).waitFor();
    state.held = '/api/v1/admin/items'; state.fail = state.held;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await f.heldSeen;
    const pending = page.getByRole('button', { name: 'Refreshing…', exact: true });
    await pending.waitFor(); assert.equal(await pending.isDisabled(), true);
    state.release();
    await page.getByText('Refresh fixture unavailable', { exact: true }).waitFor();
    state.updated = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('Fox updated', { exact: true }).waitFor();
    assert.equal(await page.getByText('Refresh fixture unavailable', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Change interface language' }).click();
    await page.getByRole('button', { name: 'Tiếng Việt' }).click();
    await page.getByRole('button', { name: 'Làm mới', exact: true }).waitFor();
    assert.deepEqual(f.writes, []); assert.deepEqual(f.errors, []);
  } finally { state.release(); await page.close(); }
});
