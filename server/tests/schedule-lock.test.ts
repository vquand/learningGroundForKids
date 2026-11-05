import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { evaluateLock, normalizeSlots, slotTotals, isValidTimezone } from '../src/schedule/lock.js';
import { isLockExempt } from '../src/schedule/routes.js';
import type { ScheduleContext } from '../src/schedule/contracts.js';

const monday4to6 = [{ weekday: 1, start_minute: 960, end_minute: 1080 }];

test('locks outside a slot and reports the next opening in the child zone', () => {
  const state = evaluateLock(true, monday4to6, new Date('2026-11-02T08:30:00Z'), 'Asia/Ho_Chi_Minh');
  assert.deepEqual(state, { locked: true, next_open_at: '2026-11-02T09:00:00.000Z', ends_at: null });
});

test('is open inside a slot and reports when it ends', () => {
  const state = evaluateLock(true, monday4to6, new Date('2026-11-02T09:30:20Z'), 'Asia/Ho_Chi_Minh');
  assert.deepEqual(state, { locked: false, next_open_at: null, ends_at: '2026-11-02T11:00:00.000Z' });
});

test('the same wall-clock slot follows the child to another zone', () => {
  const paris = evaluateLock(true, monday4to6, new Date('2026-11-02T14:30:00Z'), 'Europe/Paris');
  assert.equal(paris.locked, true);
  assert.equal(paris.next_open_at, '2026-11-02T15:00:00.000Z');
});

test('slot end is exclusive and start inclusive', () => {
  assert.equal(evaluateLock(true, monday4to6, new Date('2026-11-02T11:00:00Z'), 'Asia/Ho_Chi_Minh').locked, true);
  assert.equal(evaluateLock(true, monday4to6, new Date('2026-11-02T09:00:00Z'), 'Asia/Ho_Chi_Minh').locked, false);
});

test('wraps to next week and locks all day with no slots', () => {
  const wrapped = evaluateLock(true, monday4to6, new Date('2026-11-02T12:00:00Z'), 'Asia/Ho_Chi_Minh');
  assert.equal(wrapped.next_open_at, '2026-11-09T09:00:00.000Z');
  assert.deepEqual(evaluateLock(true, [], new Date('2026-11-02T12:00:00Z'), 'UTC'), { locked: true, next_open_at: null, ends_at: null });
  assert.equal(evaluateLock(false, [], new Date(), 'UTC').locked, false);
});

test('normalizes, merges and totals slots', () => {
  const merged = normalizeSlots([
    { weekday: 2, start_minute: 600, end_minute: 660 }, { weekday: 1, start_minute: 60, end_minute: 120 }, { weekday: 1, start_minute: 120, end_minute: 180 }]);
  assert.deepEqual(merged, [{ weekday: 1, start_minute: 60, end_minute: 180 }, { weekday: 2, start_minute: 600, end_minute: 660 }]);
  assert.deepEqual(slotTotals(merged), { weekly_minutes: 180, daily_minutes: [120, 60, 0, 0, 0, 0, 0] });
  assert.equal(isValidTimezone('Europe/Paris'), true);
  assert.equal(isValidTimezone('Not/AZone'), false);
});

test('only calendar, profile read and schedule status are exempt while locked', () => {
  assert.equal(isLockExempt('GET', '/api/v1/profiles/k1'), true);
  assert.equal(isLockExempt('PUT', '/api/v1/profiles/k1'), false);
  assert.equal(isLockExempt('PUT', '/api/v1/profiles/k1/calendar/lists'), true);
  assert.equal(isLockExempt('GET', '/api/v1/profiles/k1/schedule/status'), true);
  for (const path of ['badges', 'town', 'quiz', 'avatar', 'road-racing', 'items', 'tour/complete']) assert.equal(isLockExempt('GET', `/api/v1/profiles/k1/${path}`), false, path);
});

const family = { id: 'family-a', email: 'p@example.test', displayName: 'A', passwordHash: 'stored', role: 'family', isActive: true };
function fixture(context: ScheduleContext | null) {
  const seen: (string | null)[] = [];
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? family : null; }, async parentAccess() { return null; } },
    profiles: { async get(_family: string, id: string) { return { id, name: 'Mia' }; } },
    schedules: { async resolve(_f: string, _p: string, tz: string | null) { seen.push(tz); return context; } },
  } as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com' });
  const app = createApp({ db, config, logger: { info() {}, warn() {}, error() {} } });
  const send = (path: string, tz?: string) => app.request(`https://app.example.com${path}`, { headers: { cookie: 'plg_session=token', ...(tz ? { 'x-device-timezone': tz } : {}) } });
  return { send, seen };
}

test('a locked child gets 423 on a game route but still reads status', async () => {
  const { send, seen } = fixture({ enabled: true, slots: [], timezone: 'UTC' });
  const blocked = await send('/api/v1/profiles/kid-a/badges', 'Europe/Paris');
  assert.equal(blocked.status, 423);
  assert.equal((await blocked.json()).error.code, 'ADVENTURE_LOCKED');
  assert.deepEqual(seen, ['Europe/Paris']);
  const status = await (await send('/api/v1/profiles/kid-a/schedule/status')).json();
  assert.equal(status.locked, true);
  assert.equal(status.enabled, true);
});

test('children without the feature, and unknown profiles, are not locked by it', async () => {
  const off = fixture({ enabled: false, slots: [], timezone: 'UTC' });
  assert.equal((await off.send('/api/v1/profiles/kid-a/schedule/status')).status, 200);
  const unknown = fixture(null);
  assert.equal((await unknown.send('/api/v1/profiles/other/schedule/status')).status, 200);
});

test('slots touching across midnight and the week wrap are one continuous window', () => {
  const slots = [{ weekday: 1, start_minute: 1410, end_minute: 1440 }, { weekday: 2, start_minute: 0, end_minute: 30 }];
  const state = evaluateLock(true, slots, new Date('2026-11-02T16:35:00Z'), 'Asia/Ho_Chi_Minh'); // Mon 23:35 local
  assert.equal(state.locked, false);
  assert.equal(state.ends_at, '2026-11-02T17:30:00.000Z'); // Tue 00:30 local
  const wrap = evaluateLock(true, [{ weekday: 7, start_minute: 1410, end_minute: 1440 }, { weekday: 1, start_minute: 0, end_minute: 60 }], new Date('2026-11-08T16:40:00Z'), 'Asia/Ho_Chi_Minh');
  assert.equal(wrap.ends_at, '2026-11-08T18:00:00.000Z');
});

test('spring-forward gap still yields a future boundary', () => {
  // US clocks jump 02:00 -> 03:00 on 2026-03-08; a Sunday 01:00-02:00 slot ends at the jump.
  const state = evaluateLock(true, [{ weekday: 7, start_minute: 60, end_minute: 120 }], new Date('2026-03-08T06:45:00Z'), 'America/New_York');
  assert.equal(state.locked, false);
  assert.ok(Date.parse(state.ends_at!) > Date.parse('2026-03-08T06:45:00Z'));
  assert.ok(Date.parse(state.ends_at!) - Date.parse('2026-03-08T06:45:00Z') <= 3600_000);
});

test('child content reads that name the child by profile_id are locked; parent reads without it are not', async () => {
  const { send } = fixture({ enabled: true, slots: [], timezone: 'UTC' });
  const blocked = await send('/api/v1/items?profile_id=kid-a');
  assert.equal(blocked.status, 423);
  assert.equal((await send('/api/v1/items/abc/quiz?profile_id=kid-a')).status, 423);
  assert.notEqual((await send('/api/v1/items')).status, 423, 'Parent Space reads carry no profile_id');
});

test('a slot covering the whole week and a Monday 00:00 boundary behave', () => {
  const all = [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, start_minute: 0, end_minute: 1440 }));
  const open = evaluateLock(true, all, new Date('2026-11-04T05:00:00Z'), 'UTC');
  assert.equal(open.locked, false);
  assert.ok(Date.parse(open.ends_at!) - Date.parse('2026-11-04T05:00:00Z') <= 7 * 86400_000);
  const monday = evaluateLock(true, [{ weekday: 1, start_minute: 0, end_minute: 60 }], new Date('2026-11-04T05:00:00Z'), 'America/New_York');
  assert.equal(monday.locked, true);
  assert.ok(Date.parse(monday.next_open_at!) > Date.parse('2026-11-04T05:00:00Z'));
});
