import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { summarizeChild, summarizeFamily } from '../../../server/src/parent-reports/summary.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const rows = [
  { id: 'kid-one', name: 'Mira', emoji: '⭐', color: '#6a8a65', public_id: 'MIRA123456', exploring_completed: 1, latest_items: [{ item_id: 'lesson-one', title: 'Our learning garden', category: 'animal', completed_at: '2026-10-14T12:00:00Z' }], miniku: { completed: 7, completedBySize: { '3': 7 }, earned: { 'miniku-first-solve': '2026-10-14T12:00:00Z' } }, ufo: { stats: { solved: 12 } }, quiz_attempts: 2, quiz_passes: 1, last_activity_at: '2026-10-14T12:00:00Z' },
  { id: 'kid-two', name: 'Noah', emoji: '🐮', color: '#d8a65e', public_id: 'NOAH123456', miniku: { completed: 3 }, exploring_completed: 4 },
];
const report = summarizeFamily(rows.map(summarizeChild), new Date('2026-10-14T12:30:00Z'));
const emptyReport = summarizeFamily([summarizeChild({ id: 'kid-empty', name: 'Lina', emoji: '🌼', color: '#987', town: { entities: [{ blueprintId: 'house' }] } })], new Date('2026-10-14T12:30:00Z'));
const family = (id: string, name: string, children = report.children) => ({
  id, display_name: name, email: `${id}@example.test`, role: 'family', is_active: true, created_at: '2026-10-01T00:00:00Z',
  profile_count: children.length, accepted_request_count: 0, pending_incoming_count: 0, pending_outgoing_count: 0, rejected_request_count: 0, friend_requests: [],
  profiles: children.map(child => ({ ...child, created_at: '2026-10-01T00:00:00Z', total_done: 0, badge_count: 0, total_items: 4614, completion_rate: 0, recent_activities: [] })),
});
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function setup(viewport: { width: number; height: number }, fail = false) {
  const page = await browser.newPage({ viewport }); const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/api/**', (route: any) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.fallback();
    if (request.method() !== 'GET') { writes.push(path); return route.abort(); }
    let json: unknown = [];
    if (path.endsWith('/auth/session')) json = { authenticated: true, user: { id: 'admin', name: 'Admin', email: 'admin@example.test' } };
    else if (path.endsWith('/admin/session')) json = { is_admin: true };
    else if (path.endsWith('/health/ready')) json = { status: 'ready' };
    else if (path.endsWith('/admin/families')) json = [family('family-one', 'Learning family'), family('family-empty', 'New family', emptyReport.children)];
    else if (path.endsWith('/family-one/reports')) {
      if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: { message: 'Report temporarily unavailable' } } }); }
      json = report;
    } else if (path.endsWith('/family-empty/reports')) json = emptyReport;
    return route.fulfill({ json });
  });
  return { page, errors, writes };
}
for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }, { width: 390, height: 844 }]) test(`admin family learning and selected child reports at ${viewport.width}`, async () => {
  const { page, errors, writes } = await setup(viewport);
  try {
    await page.goto(`${origin}/admin/families/family-one`);
    const overview = page.getByRole('region', { name: 'Family learning overview', exact: true });
    await overview.getByText('Children with recorded learning').waitFor();
    assert.equal(await overview.locator('dl > div').first().locator('dd').textContent(), '2');
    await overview.getByText('Across their activities', { exact: true }).click();
    assert.equal(await overview.locator('[data-game="miniku"] dd').first().textContent(), '10');
    const selected = page.getByRole('region', { name: 'Selected child learning progress' });
    assert.equal(await selected.locator('[data-game="miniku"] dd').first().textContent(), '7');
    assert.equal(await selected.locator('[data-game="shoo-shoo-ufo"] dd').first().textContent(), '12');
    assert.equal(await selected.locator('[data-game="cooking"] dd').textContent(), '—');
    await page.getByText('Our learning garden', { exact: true }).waitFor();
    await selected.getByText('Achievement collection', { exact: true }).click();
    assert.ok(await selected.getByText('Catalog only — not earnable yet', { exact: true }).count());
    const townBadges = page.locator('.admin-learning-badge-group').filter({ hasText: 'Town Building · Little Town' });
    assert.equal(await townBadges.locator('article').count(), 7);
    assert.equal(await townBadges.locator('image[href="/minigames/town-building/badges.png"]').count(), 5);
    assert.equal(await townBadges.locator('image[href="/minigames/town-building/garden-badges.png"]').count(), 2);
    await page.getByRole('button', { name: /Noah/ }).click();
    assert.equal(await selected.locator('[data-game="miniku"] dd').first().textContent(), '3');
    assert.equal(await selected.locator('dl').first().locator('dd').first().textContent(), '4');
    assert.equal(await page.getByText('Our learning garden', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Change interface language' }).click(); await page.getByRole('button', { name: 'Tiếng Việt' }).click();
    await page.getByRole('region', { name: 'Tổng quan học tập của gia đình' }).waitFor();
    assert.ok(await page.getByRole('button', { name: /Noah/ }).count());
    await page.screenshot({ path: `/tmp/plg-admin-learning-${viewport.width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  } finally { await page.close(); }
});
test('report failure is distinct from no progress, retry works, and a starter home is not learning', async () => {
  const { page, errors, writes } = await setup({ width: 1024, height: 768 }, true);
  try {
    await page.goto(`${origin}/admin/families/family-one`);
    const failure = page.getByRole('alert').filter({ hasText: 'Learning report unavailable' }); await failure.waitFor();
    assert.equal(await page.getByText('No saved learning progress yet.', { exact: true }).count(), 0);
    await failure.getByRole('button', { name: 'Retry' }).click();
    await page.getByRole('region', { name: 'Family learning overview' }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'New family' }).getByRole('button', { name: 'Detail' }).click();
    await page.getByText('No saved learning progress yet.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Family learning overview' }).locator('dd').first().textContent(), '0');
    await page.reload(); await page.getByText('No saved learning progress yet.', { exact: true }).waitFor();
    assert.equal(await page.getByText('Mira', { exact: true }).count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  } finally { await page.close(); }
});
