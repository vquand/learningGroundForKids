import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { FamilyOut } from '../../src/types/admin.ts';

// Run with the same shared Playwright module/browser environment as
// root-password.test.ts; this starts the actual App, without a test harness.
// Accessible UI contract: Administration nav; Journey/Activities regions;
// Journey period/Activity type selects; Previous/Next activities page buttons.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let origin: string;

before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react()],
    root: fileURLToPath(new URL('../../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

const FAMILY_ID = 'family-one';
const PROFILE_ID = 'profile-one';
const PROFILE_API = `/api/v1/admin/families/${FAMILY_ID}/profiles/${PROFILE_ID}`;
const PROFILE_ROUTE = `/admin/families/${FAMILY_ID}/profiles/${PROFILE_ID}`;
const PERIODS = ['today', 'yesterday', 'last3days', 'last7days', 'all'] as const;
type Resource = 'profile' | 'activities' | 'journey';
type ActivityType = 'completion' | 'quiz' | 'flashcard';
type Activity = {
  id: string; type: ActivityType; occurred_at: string;
  item_id: string | null; item_title: string | null; item_category: string | null;
  score: number | null; total: number | null;
  theme_type: string | null; theme_value: string | null;
  cards_shown: number | null; got_it_count: number | null; review_again_count: number | null;
};
type Call = { method: string; path: string; query: Record<string, string> };

const profile = {
  id: PROFILE_ID, name: 'Mira', emoji: '🦊', color: '#2563eb',
  public_id: 'kid-mira-fixture', created_at: '2026-09-01T00:00:00Z',
  family_id: FAMILY_ID, family_name: 'Sample family', total_done: 3, badge_count: 2,
  quiz_attempt_count: 4, flashcard_session_count: 5,
};
const sibling = { ...profile, id: 'profile-two', name: 'Noah', public_id: 'kid-noah-fixture' };
// Same profile id in a different route exercises the family part of ownership.
const otherFamilyProfile = { ...profile, family_id: 'family-two', family_name: 'Other family', name: 'Lina', public_id: 'kid-lina-fixture' };
function familyFixture(detail: typeof profile, kids: typeof profile[] = [detail]): FamilyOut {
  return {
    id: detail.family_id, display_name: detail.family_name, created_at: detail.created_at,
    profile_count: kids.length, accepted_request_count: 0, pending_incoming_count: 0,
    pending_outgoing_count: 0, rejected_request_count: 0, friend_requests: [],
    profiles: kids.map((kid) => ({
      id: kid.id, name: kid.name, emoji: kid.emoji, color: kid.color,
      public_id: kid.public_id, created_at: kid.created_at, total_done: kid.total_done,
      badge_count: kid.badge_count, total_items: 10, completion_rate: 30,
      recent_activities: [],
    })),
  };
}
const families = [familyFixture(profile, [profile, sibling]), familyFixture(otherFamilyProfile)];

function activity(id: string, type: ActivityType, fields: Partial<Activity> = {}): Activity {
  return {
    id, type, occurred_at: '2026-09-27T09:00:00Z', item_id: null,
    item_title: null, item_category: null, score: null, total: null,
    theme_type: null, theme_value: null, cards_shown: null,
    got_it_count: null, review_again_count: null, ...fields,
  };
}
const activityRows: Activity[] = [
  activity('completion-one', 'completion', { item_id: 'fort', item_title: 'Completed fort', item_category: 'history' }),
  activity('quiz-one', 'quiz', { item_id: 'observatory', item_title: 'Quiz observatory', item_category: 'science', score: 0, total: 4 }),
  activity('flashcard-one', 'flashcard', { theme_type: 'category', theme_value: 'geography', cards_shown: 12, got_it_count: 7, review_again_count: 5 }),
  ...Array.from({ length: 17 }, (_, index) => activity(`completion-${index + 2}`, 'completion', {
    item_id: `catalog-${index}`, item_title: `Catalog completion ${index + 1}`, item_category: 'history',
  })),
  activity('completion-page-two', 'completion', { item_id: 'harbour', item_title: 'Page two harbour', item_category: 'geography' }),
  // Deleted items and zero study counts must remain readable.
  activity('quiz-deleted', 'quiz', { score: 2, total: 3 }),
  activity('flashcard-zero', 'flashcard', { theme_type: 'country', theme_value: 'Vietnam', cards_shown: 0, got_it_count: 0, review_again_count: 0 }),
];
const waypoints = [
  { kind: 'item', item_id: 'fort', title: 'First fort', category: 'history', latitude: 0, longitude: 0, done_at: '2026-09-21T08:00:00Z' },
  { kind: 'item', item_id: 'museum', title: 'Second museum', category: 'culture', latitude: 10, longitude: 106, done_at: '2026-09-24T08:00:00Z' },
  { kind: 'item', item_id: 'garden', title: 'Third garden', category: 'nature', latitude: 21, longitude: 105, done_at: '2026-09-27T08:00:00Z' },
];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
type Options = {
  path?: string; width?: number; items?: 'error' | 'held'; empty?: boolean;
  failure?: Resource; failureStatus?: number;
  held?: { resource: Resource; failure?: boolean };
  holdAllActivities?: boolean;
  largeJourney?: boolean;
};

async function setup(options: Options = {}) {
  const page = await browser.newPage({ viewport: { width: options.width ?? 1024, height: 900 } });
  page.setDefaultTimeout(5_000);
  const calls: Call[] = [];
  const unexpected: Call[] = [];
  const errors: string[] = [];
  const heldSeen = deferred();
  const release = deferred();
  const delivered = deferred();
  let recovered = false;
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/*', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    // No provider, production API, remote font or map tile traffic from fixtures.
    if (url.origin !== origin) return route.fulfill({ status: 204 });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const call = { method: request.method(), path: url.pathname, query: Object.fromEntries(url.searchParams) };
    calls.push(call);
    if (call.method !== 'GET') return route.fulfill({ status: 405, json: { error: { message: 'Read-only regression fixture rejected a write.' } } });
    if (call.path === '/api/v1/auth/session') return route.fulfill({ json: {
      authenticated: true, user: { id: 'fixture-root', email: 'root@example.test', name: 'Fixture root', isRoot: true },
    } });
    if (call.path === '/api/v1/admin/session') return route.fulfill({ json: { is_admin: true } });
    if (call.path === '/api/v1/friend-requests' || call.path === '/api/v1/profiles') return route.fulfill({ json: [] });
    if (call.path === '/api/v1/auth/registration') return route.fulfill({ json: { enabled: false } });
    if (call.path === '/api/v1/admin/items') {
      if (options.items === 'held') { heldSeen.resolve(); await release.promise; }
      return route.fulfill(options.items === 'error'
        ? { status: 500, json: { error: { message: 'Items fixture unavailable.' } } }
        : { json: [] });
    }
    if (call.path === '/api/v1/admin/families') return route.fulfill({ json: families });
    if (/^\/api\/v1\/admin\/families\/(family-one|family-two)\/reports$/.test(call.path) && Object.keys(call.query).length === 0) {
      return route.fulfill({ json: { generated_at: '2026-10-14T12:00:00Z', children: [], totals: {
        children: 0, exploring_completed: 0, quiz_attempts: 0, quiz_passes: 0, earned_badges: 0, study_sessions: 0, drink_completions: 0,
      } } });
    }
    if (call.path === '/api/v1/admin/tests') return route.fulfill({ json: [] });

    const match = call.path.match(/^\/api\/v1\/admin\/families\/(family-one|family-two)\/profiles\/(profile-one|profile-two)(?:\/(activities|journey))?$/);
    if (match) {
      const [, familyId, profileId, suffix] = match;
      const resource = (suffix || 'profile') as Resource;
      const isOriginal = familyId === FAMILY_ID && profileId === PROFILE_ID;
      const current = familyId === 'family-two' ? otherFamilyProfile : profileId === 'profile-two' ? sibling : profile;
      if (resource === 'activities') {
        const valid = ['all', 'completion', 'quiz', 'flashcard'].includes(call.query.type)
          && /^[1-9]\d*$/.test(call.query.page) && call.query.page_size === '20';
        if (!valid) { unexpected.push(call); return route.fulfill({ status: 400, json: { error: { message: 'Expected activity type, page and page_size=20.' } } }); }
      }
      if (resource === 'journey') {
        const valid = PERIODS.some((period) => period === call.query.period)
          && /^[1-9]\d*$/.test(call.query.page) && call.query.page_size === '100';
        if (!valid) { unexpected.push(call); return route.fulfill({ status: 400, json: { error: { message: 'Expected journey period, page and page_size=100.' } } }); }
      }
      const held = isOriginal && (options.held?.resource === resource
        || (options.holdAllActivities && resource === 'activities' && call.query.type === 'all'));
      if (held) { heldSeen.resolve(); await release.promise; }
      const failure = (options.failure === resource && !recovered) || (held && options.held?.failure);
      let json: unknown;
      if (failure) json = { error: { message: `${resource} fixture unavailable.` } };
      else if (resource === 'profile') json = current;
      else if (resource === 'activities') {
        const all = options.empty ? [] : isOriginal ? activityRows : [activity('new-owner', 'completion', { item_id: 'new', item_title: `${current.name} completion`, item_category: 'nature' })];
        const filtered = call.query.type === 'all' ? all : all.filter((row) => row.type === call.query.type);
        const pageNumber = Number(call.query.page);
        json = { activities: filtered.slice((pageNumber - 1) * 20, pageNumber * 20), page: pageNumber, page_size: 20, total: filtered.length, total_pages: Math.ceil(filtered.length / 20) };
      } else {
        const stops = options.empty ? [] : options.largeJourney ? Array.from({ length: 125 }, (_, index) => ({
          ...waypoints[0], item_id: `stop-${index}`, title: `Journey place ${index + 1}`,
          latitude: index % 80, longitude: index % 170,
          done_at: new Date(Date.UTC(2026, 8, 1) + index * 60_000).toISOString(),
        })) : !isOriginal ? [{ ...waypoints[0], title: `${current.name} journey` }]
          : call.query.period === 'last7days' || call.query.period === 'all' ? waypoints
          : [{ ...waypoints[2], title: `${call.query.period} journey stop` }];
        const pageNumber = Number(call.query.page);
        const pageStops = stops.slice((pageNumber - 1) * 100, pageNumber * 100);
        json = { origin: { latitude: 0, longitude: 0, title: 'Home base' }, waypoints: pageStops,
          exploredCount: pageStops.length, total: stops.length, page: pageNumber, page_size: 100, total_pages: Math.max(1, Math.ceil(stops.length / 100)) };
      }
      try {
        await route.fulfill({ status: failure ? options.failureStatus ?? 500 : 200, json });
      } catch (error) {
        // Cancellation is valid stale-response suppression. Only tolerate it
        // for a deliberately held response after real SPA navigation.
        if (!held) throw error;
      } finally { if (held) delivered.resolve(); }
      return;
    }
    unexpected.push(call);
    return route.fulfill({ status: 404, json: { error: { message: 'Unexpected regression API request.' } } });
  });
  await page.goto(`${origin}${options.path ?? PROFILE_ROUTE}`);
  return { page, calls, unexpected, errors, release, heldSeen, delivered, recoverReports: () => { recovered = true; } };
}
type Fixture = Awaited<ReturnType<typeof setup>>;

async function withApp(context: TestContext, options: Options, run: (fixture: Fixture) => Promise<void>) {
  const fixture = await setup(options);
  try {
    await run(fixture);
    assert.deepEqual(fixture.calls.filter((call) => call.method !== 'GET'), [], 'admin inspection never writes');
    assert.deepEqual(fixture.unexpected, [], 'only contracted same-origin APIs are used');
    assert.deepEqual(fixture.errors, [], 'no uncaught browser exceptions');
  } catch (error) {
    context.diagnostic(`Observed browser DOM: ${(await fixture.page.locator('body').innerText()).slice(0, 1200)}`);
    context.diagnostic(`Observed API requests: ${JSON.stringify(fixture.calls)}`);
    if (context.name.includes('500') || context.name.includes('direct profile URL')) {
      const path = `/tmp/plg-admin-restoration-${context.name.includes('500') ? 'dashboard-error' : 'direct-profile'}.png`;
      await fixture.page.screenshot({ path });
      context.diagnostic(`Browser screenshot: ${path}`);
    }
    throw error;
  } finally { fixture.release.resolve(); await fixture.page.close(); }
}

async function assertRootControl(page: any) {
  const trigger = page.getByRole('button', { name: 'Update root password', exact: true });
  await trigger.waitFor();
  assert.equal(await trigger.evaluate((element: HTMLElement) => getComputedStyle(element).position), 'fixed');
}
async function assertNavigation(page: any) {
  const nav = page.getByRole('navigation', { name: 'Administration', exact: true });
  await nav.waitFor();
  for (const [name, href] of [['Dashboard', '/admin'], ['Items', '/admin/content'], ['Families', '/admin/families'], ['Assessments', '/admin/tests']]) {
    const link = nav.getByRole('link', { name, exact: true });
    await link.waitFor();
    assert.equal(await link.getAttribute('href'), href);
  }
  await assertRootControl(page);
  return nav;
}
function region(page: any, name: 'Journey' | 'Activities') {
  return page.getByRole('region', { name, exact: true });
}
async function waitForProfile(page: any, name = 'Mira') {
  await page.getByRole('heading', { name: new RegExp(name), level: 1 }).waitFor();
}
function assertRead(fixture: Fixture, path: string, query: Record<string, string> = {}) {
  assert.ok(fixture.calls.some((call) => call.method === 'GET' && call.path === path
    && Object.entries(query).every(([key, value]) => call.query[key] === value)), `expected GET ${path} ${JSON.stringify(query)}`);
}
async function openFamilyProfile(page: any, familyName: string, profileName: string, href: string) {
  const nav = page.getByRole('navigation', { name: 'Administration', exact: true });
  await nav.getByRole('link', { name: 'Families', exact: true }).click();
  await page.getByRole('row').filter({ hasText: familyName }).getByRole('button', { name: 'Detail', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(profileName) }).filter({ hasText: profileName }).click();
  const link = page.getByRole('link', { name: 'View journey and activity', exact: true });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), href);
  await link.click();
  await page.waitForURL((url: URL) => url.pathname === href);
  await waitForProfile(page, profileName);
  assert.equal(new URL(page.url()).pathname, href);
}

for (const items of ['error', 'held'] as const) {
  test(`Administration links and root control survive dashboard ${items === 'error' ? '500' : 'held loading'}`, async (context) => {
    await withApp(context, { path: '/admin', items }, async (fixture) => {
      if (items === 'held') await fixture.heldSeen.promise;
      else await fixture.page.getByText('Items fixture unavailable.', { exact: true }).waitFor();
      const nav = await assertNavigation(fixture.page);
      await nav.getByRole('link', { name: 'Families', exact: true }).click();
      await fixture.page.getByRole('button', { name: 'Detail', exact: true }).first().waitFor();
      assert.equal(new URL(fixture.page.url()).pathname, '/admin/families');
      await assertNavigation(fixture.page);
      // Navigation must succeed while the dashboard request is still held.
      fixture.release.resolve();
    });
  });
}

test('family Detail opens the existing panel and the selected profile has its journey link', async (context) => {
  await withApp(context, { path: '/admin/families' }, async ({ page }) => {
    await page.getByRole('row').filter({ hasText: 'Sample family' }).getByRole('button', { name: 'Detail', exact: true }).click();
    await page.getByRole('heading', { name: 'Sample family', exact: true }).waitFor();
    const link = page.getByRole('link', { name: 'View journey and activity', exact: true });
    await link.waitFor();
    assert.equal(await link.getAttribute('href'), PROFILE_ROUTE);
    await page.getByRole('button', { name: /Noah/ }).click();
    assert.equal(await link.getAttribute('href'), '/admin/families/family-one/profiles/profile-two');
    await link.click();
    await waitForProfile(page, 'Noah');
    await assertNavigation(page);
  });
});

test('direct profile URL loads its own summary and default read contracts without a family selection', async (context) => {
  await withApp(context, {}, async (fixture) => {
    const { page } = fixture;
    await waitForProfile(page);
    await page.getByText('Sample family', { exact: true }).waitFor();
    await page.getByText('kid-mira-fixture', { exact: true }).waitFor();
    await region(page, 'Journey').getByText('First fort', { exact: true }).waitFor();
    await region(page, 'Activities').getByText('Completed fort', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, PROFILE_ROUTE);
    assertRead(fixture, '/api/v1/auth/session');
    assertRead(fixture, '/api/v1/admin/session');
    assertRead(fixture, PROFILE_API);
    assertRead(fixture, `${PROFILE_API}/activities`, { page: '1', page_size: '20', type: 'all' });
    assertRead(fixture, `${PROFILE_API}/journey`, { period: 'last7days', page: '1', page_size: '100' });
    await assertNavigation(page);
  });
});

test('journey shows origin and all completed stops in chronological order, including zero coordinates', async (context) => {
  await withApp(context, {}, async ({ page }) => {
    const journey = region(page, 'Journey');
    await journey.getByText('Home base', { exact: true }).waitFor();
    for (const stop of waypoints) await journey.getByText(stop.title, { exact: true }).waitFor();
    const positions = await journey.evaluate((element: HTMLElement, titles: string[]) => {
      const text = element.innerText;
      return titles.map((title) => text.indexOf(title));
    }, waypoints.map((stop) => stop.title));
    assert.ok(positions[0] >= 0 && positions[0] < positions[1] && positions[1] < positions[2], 'oldest completion precedes newer completions');
    assert.match(await journey.innerText(), /history/i);
    assert.match(await journey.innerText(), /culture/i);
    assert.match(await journey.innerText(), /nature/i);
  });
});

test('journey period selects today, yesterday, last three days, last seven days and all', async (context) => {
  await withApp(context, {}, async (fixture) => {
    const { page } = fixture;
    const select = page.getByRole('combobox', { name: 'Journey period', exact: true });
    await select.waitFor();
    assert.equal(await select.inputValue(), 'last7days');
    assert.deepEqual(await select.locator('option').evaluateAll((options: HTMLOptionElement[]) => options.map((option) => option.value).sort()), [...PERIODS].sort());
    for (const period of PERIODS) {
      await select.selectOption(period);
      const title = period === 'all' || period === 'last7days' ? 'First fort' : `${period} journey stop`;
      await region(page, 'Journey').getByText(title, { exact: true }).waitFor();
      assertRead(fixture, `${PROFILE_API}/journey`, { period, page: '1', page_size: '100' });
    }
  });
});

test('activity feed shows completion, zero quiz score, flashcard theme and study counts', async (context) => {
  await withApp(context, {}, async ({ page }) => {
    const activities = region(page, 'Activities');
    await activities.getByText('Completed fort', { exact: true }).waitFor();
    await activities.getByText('Quiz observatory', { exact: true }).waitFor();
    await activities.getByText(/geography/i).first().waitFor();
    const text = await activities.innerText();
    assert.match(text, /completion|completed/i);
    assert.match(text, /quiz/i);
    assert.match(text, /flashcard/i);
    assert.match(text, /0\s*\/\s*4/, 'zero score is data, not an empty value');
    assert.match(text, /12\s+cards|cards(?: shown)?\s*:?\s*12/i);
    assert.match(text, /7\s+got it|got it\s*:?\s*7/i);
    assert.match(text, /5\s+review again|review again\s*:?\s*5/i);
    assert.doesNotMatch(text, /NaN|\[object Object\]/);
  });
});

test('activities paginate, handle deleted item metadata and reset to page one on every type filter', async (context) => {
  await withApp(context, {}, async (fixture) => {
    const { page } = fixture;
    const activities = region(page, 'Activities');
    const previous = page.getByRole('button', { name: 'Previous activities page', exact: true });
    const next = page.getByRole('button', { name: 'Next activities page', exact: true });
    const select = page.getByRole('combobox', { name: 'Activity type', exact: true });
    await activities.getByText('Completed fort', { exact: true }).waitFor();
    assert.equal(await previous.isDisabled(), true);
    assert.equal(await next.isEnabled(), true);
    assert.equal(await activities.getByText('Page two harbour', { exact: true }).count(), 0);
    await next.click();
    await activities.getByText('Page two harbour', { exact: true }).waitFor();
    assertRead(fixture, `${PROFILE_API}/activities`, { page: '2', page_size: '20', type: 'all' });
    assert.equal(await activities.getByText('Completed fort', { exact: true }).count(), 0);
    assert.match(await activities.innerText(), /2\s*\/\s*3/);
    assert.match(await activities.innerText(), /Vietnam/i);
    assert.match(await activities.innerText(), /0\s+cards|cards(?: shown)?\s*:?\s*0/i);
    assert.equal(await next.isDisabled(), true);
    await previous.click();
    await activities.getByText('Completed fort', { exact: true }).waitFor();
    await next.click();
    await activities.getByText('Page two harbour', { exact: true }).waitFor();
    for (const type of ['quiz', 'flashcard', 'completion', 'all']) {
      await select.selectOption(type);
      const marker = type === 'quiz' ? 'Quiz observatory' : type === 'flashcard' ? 'Vietnam' : 'Completed fort';
      await activities.getByText(marker, { exact: false }).first().waitFor();
      assertRead(fixture, `${PROFILE_API}/activities`, { type, page: '1', page_size: '20' });
      assert.equal(await previous.isDisabled(), true);
      if (type !== 'all' && type !== 'completion') assert.equal(await activities.getByText('Completed fort', { exact: true }).count(), 0);
      if (type === 'completion' || type === 'flashcard') assert.equal(await activities.getByText('Quiz observatory', { exact: true }).count(), 0);
      if (type === 'quiz' || type === 'completion') assert.equal(await activities.getByText(/Vietnam/).count(), 0);
    }
  });
});

test('empty activities and journey show separate readable empty states with disabled activity pagination', async (context) => {
  await withApp(context, { empty: true }, async ({ page }) => {
    await waitForProfile(page);
    await region(page, 'Activities').getByText(/no .*activit|no activit/i).waitFor();
    await region(page, 'Journey').getByText(/no .*complet|no .*journey|no .*stop|no .*explor/i).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Previous activities page', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Next activities page', exact: true }).isDisabled(), true);
    await assertNavigation(page);
  });
});

for (const resource of ['profile', 'activities', 'journey'] as const) {
  test(`${resource} error stays visible without losing Administration or root controls`, async (context) => {
    await withApp(context, { failure: resource }, async ({ page }) => {
      await page.getByRole('alert').filter({ hasText: `${resource} fixture unavailable.` }).waitFor();
      await assertNavigation(page);
      if (resource !== 'profile') {
        await waitForProfile(page);
        const unaffected = resource === 'activities' ? region(page, 'Journey') : region(page, 'Activities');
        await unaffected.getByText(resource === 'activities' ? 'First fort' : 'Completed fort', { exact: true }).waitFor();
      }
      await page.getByRole('navigation', { name: 'Administration', exact: true }).getByRole('link', { name: 'Families', exact: true }).click();
      await page.getByRole('button', { name: 'Detail', exact: true }).first().waitFor();
    });
  });
}

test('missing profile responds with a readable error and leaves family navigation usable', async (context) => {
  await withApp(context, { failure: 'profile', failureStatus: 404 }, async ({ page }) => {
    await page.getByRole('alert').filter({ hasText: /profile fixture unavailable/ }).waitFor();
    await assertNavigation(page);
    assert.equal(await page.getByRole('heading', { name: /Mira/ }).count(), 0);
  });
});

for (const resource of ['profile', 'activities', 'journey'] as const) {
  for (const failure of [false, true]) {
    test(`late ${resource} ${failure ? 'error' : 'success'} cannot overwrite a different profile route`, async (context) => {
      await withApp(context, { held: { resource, failure } }, async (fixture) => {
        const { page } = fixture;
        await assertNavigation(page);
        await fixture.heldSeen.promise;
        await openFamilyProfile(page, 'Sample family', 'Noah', '/admin/families/family-one/profiles/profile-two');
        await region(page, 'Activities').getByText('Noah completion', { exact: true }).waitFor();
        await region(page, 'Journey').getByText('Noah journey', { exact: true }).waitFor();
        fixture.release.resolve();
        await fixture.delivered.promise;
        await page.waitForLoadState('networkidle');
        await waitForProfile(page, 'Noah');
        assert.equal(await page.getByRole('heading', { name: /Mira/ }).count(), 0);
        assert.equal(await region(page, 'Activities').getByText('Completed fort', { exact: true }).count(), 0);
        assert.equal(await region(page, 'Journey').getByText('First fort', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('alert').filter({ hasText: /fixture unavailable/ }).count(), 0);
        await assertNavigation(page);
      });
    });
  }
}

test('late profile response cannot cross families even when the profile id is unchanged', async (context) => {
  await withApp(context, { held: { resource: 'profile' } }, async (fixture) => {
    const { page } = fixture;
    await assertNavigation(page);
    await fixture.heldSeen.promise;
    await openFamilyProfile(page, 'Other family', 'Lina', '/admin/families/family-two/profiles/profile-one');
    fixture.release.resolve();
    await fixture.delivered.promise;
    await page.waitForLoadState('networkidle');
    await waitForProfile(page, 'Lina');
    assert.equal(await page.getByRole('heading', { name: /Mira/ }).count(), 0);
    await page.getByText('kid-lina-fixture', { exact: true }).waitFor();
  });
});

test('late activity response cannot replace a newer type filter', async (context) => {
  await withApp(context, { holdAllActivities: true }, async (fixture) => {
    const { page } = fixture;
    await waitForProfile(page);
    await fixture.heldSeen.promise;
    await page.getByRole('combobox', { name: 'Activity type', exact: true }).selectOption('quiz');
    await region(page, 'Activities').getByText('Quiz observatory', { exact: true }).waitFor();
    fixture.release.resolve();
    await fixture.delivered.promise;
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByRole('combobox', { name: 'Activity type', exact: true }).inputValue(), 'quiz');
    assert.equal(await region(page, 'Activities').getByText('Completed fort', { exact: true }).count(), 0);
    assert.match(await region(page, 'Activities').innerText(), /2\s*\/\s*3/);
  });
});

test('leaving the profile route discards a pending error and preserves root control', async (context) => {
  await withApp(context, { held: { resource: 'journey', failure: true } }, async (fixture) => {
    const { page } = fixture;
    const nav = await assertNavigation(page);
    await fixture.heldSeen.promise;
    await nav.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
    fixture.release.resolve();
    await fixture.delivered.promise;
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname, '/admin');
    assert.equal(await region(page, 'Journey').count(), 0);
    assert.equal(await page.getByRole('alert').filter({ hasText: /journey fixture unavailable/ }).count(), 0);
    await assertNavigation(page);
  });
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`Administration links remain usable at ${width}px through every destination`, async (context) => {
    await withApp(context, { path: '/admin', width }, async ({ page }) => {
      for (const [name, path] of [['Items', '/admin/content'], ['Families', '/admin/families'], ['Assessments', '/admin/tests'], ['Dashboard', '/admin']]) {
        const nav = await assertNavigation(page);
        // Wrapping or scrolling inside the nav is allowed. Page-wide overflow
        // and off-screen/unreachable navigation controls are regressions.
        const link = nav.getByRole('link', { name, exact: true });
        await link.scrollIntoViewIfNeeded();
        const box = await link.boundingBox();
        assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `${name} fits ${width}px`);
        await link.click();
        await page.waitForURL(`${origin}${path}`);
        await assertNavigation(page);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no page-wide horizontal overflow');
      }
      const trigger = page.getByRole('button', { name: 'Update root password', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Update root password', exact: true });
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate((element: HTMLElement) => element === document.activeElement), true);
    });
  });
}

test('journey pagination renders later stops and resets when the period changes', async (context) => {
  await withApp(context, { largeJourney: true }, async (fixture) => {
    const journey = region(fixture.page, 'Journey');
    await journey.getByText('Journey place 1', { exact: true }).waitFor();
    assert.equal(await journey.getByRole('list', { name: 'Journey stops' }).getByRole('listitem').count(), 100);
    await journey.getByRole('button', { name: 'Next journey page' }).click();
    await journey.getByText('Journey place 101', { exact: true }).waitFor();
    assert.equal(await journey.getByRole('list', { name: 'Journey stops' }).getAttribute('start'), '101');
    assert.equal(await journey.getByRole('list', { name: 'Journey stops' }).getByRole('listitem').count(), 25);
    assert.equal(await journey.getByRole('button', { name: 'Next journey page' }).isDisabled(), true);
    assertRead(fixture, `${PROFILE_API}/journey`, { period: 'last7days', page: '2', page_size: '100' });
    await fixture.page.getByLabel('Journey period', { exact: true }).selectOption('all');
    await journey.getByText('Journey place 1', { exact: true }).waitFor();
    assertRead(fixture, `${PROFILE_API}/journey`, { period: 'all', page: '1' });
  });
});

test('family detail URL survives refresh and profile drill-down works with the keyboard', async (context) => {
  await withApp(context, { path: `/admin/families/${FAMILY_ID}` }, async ({ page }) => {
    await page.getByRole('heading', { name: 'Sample family', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Sample family', exact: true }).waitFor();
    const siblingButton = page.getByRole('button', { name: /Noah/ });
    await siblingButton.focus();
    await page.keyboard.press('Enter');
    const link = page.getByRole('link', { name: 'View journey and activity', exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    await waitForProfile(page, 'Noah');
    const activities = page.getByLabel('Activity type', { exact: true });
    await activities.focus();
    assert.equal(await activities.evaluate((element: HTMLElement) => element === document.activeElement), true);
    await assertNavigation(page);
  });
});

for (const resource of ['profile', 'activities', 'journey'] as const) {
  test(`${resource} Retry recovers without losing the active route`, async (context) => {
    await withApp(context, { failure: resource }, async ({ page, recoverReports }) => {
      const error = page.getByRole('alert').filter({ hasText: `${resource} fixture unavailable.` });
      await error.waitFor();
      recoverReports();
      await error.getByRole('button', { name: 'Retry', exact: true }).click();
      if (resource === 'profile') await waitForProfile(page);
      else await region(page, resource === 'journey' ? 'Journey' : 'Activities').getByText(resource === 'journey' ? 'First fort' : 'Completed fort', { exact: true }).waitFor();
      assert.equal(await error.count(), 0);
      assert.equal(new URL(page.url()).pathname, PROFILE_ROUTE);
    });
  });
}

for (const width of [320, 768, 1024, 1440]) {
  test(`learner report layout fits ${width}px and has accessible map and filters`, async (context) => {
    await withApp(context, { width }, async ({ page }) => {
      await waitForProfile(page);
      const journey = region(page, 'Journey');
      await journey.getByText('Third garden', { exact: true }).waitFor();
      await region(page, 'Activities').getByText('Completed fort', { exact: true }).waitFor();
      await journey.getByRole('img', { name: 'Completed item locations in journey order' }).waitFor();
      assert.equal(await page.getByLabel('Journey period', { exact: true }).inputValue(), 'last7days');
      assert.equal(await page.getByLabel('Activity type', { exact: true }).inputValue(), 'all');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
      await page.screenshot({ path: `/tmp/plg-admin-profile-${width}.png`, fullPage: true });
    });
  });
}
