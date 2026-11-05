import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import {
  NOTIFICATION_ITEM_CAP,
  buildCalendarNotifications,
  type CalendarNotificationKidEvent,
  type CalendarNotificationsResponse,
} from '../src/calendar/notifications.js';

const TODAY = '2026-10-29';
const family = { id: 'family-a', email: 'parent@example.test', displayName: 'Family A', passwordHash: 'stored', role: 'family', isActive: true };

function kid(overrides: Partial<CalendarNotificationKidEvent> & Pick<CalendarNotificationKidEvent, 'id' | 'start_date'>): CalendarNotificationKidEvent {
  return {
    profile_id: 'kid-a',
    profile_name: 'Mun',
    title: 'Hiking with Dad',
    icon_key: 'hiking',
    repeat: 'none',
    repeat_ended_on: null,
    ...overrides,
  };
}

test('system events are one item per family inside today through today plus three, inclusive', () => {
  const result = buildCalendarNotifications({
    today: '2026-10-28',
    systemEvents: [{ key: 'halloween', date: '2026-10-31' }],
    kidEvents: [],
  });
  assert.deepEqual(result.items, [{
    occurrence_id: 'system:halloween:2026-10-31',
    kind: 'system',
    profile_id: null,
    profile_name: null,
    title_key: 'halloween',
    title: null,
    icon_key: 'halloween',
    date: '2026-10-31',
    days_until: 3,
  }]);

  // today + 4 is outside the window and is dropped even when a caller passes it in.
  assert.deepEqual(buildCalendarNotifications({
    today: '2026-10-27',
    systemEvents: [{ key: 'halloween', date: '2026-10-31' }],
    kidEvents: [],
  }).items, []);
});

test('kid occurrences use profile, event and date identity and carry the event title', () => {
  const result = buildCalendarNotifications({
    today: TODAY,
    systemEvents: [],
    kidEvents: [kid({ id: 'event-1', start_date: '2026-10-30', repeat: 'weekly' })],
  });
  assert.deepEqual(result.items, [{
    occurrence_id: 'kid:kid-a:event-1:2026-10-30',
    kind: 'kid',
    profile_id: 'kid-a',
    profile_name: 'Mun',
    title_key: null,
    title: 'Hiking with Dad',
    icon_key: 'hiking',
    date: '2026-10-30',
    days_until: 1,
  }]);
});

test('weekly, monthly and yearly series contribute only the occurrences inside the window', () => {
  // Thursdays from 2026-10-01: 10-29 is inside, 11-05 is outside.
  const weekly = kid({ id: 'weekly', start_date: '2026-10-01', repeat: 'weekly' });
  // Day 31 monthly: 10-31 is inside; November has no day 31 and is skipped.
  const monthly = kid({ id: 'monthly', start_date: '2026-03-31', repeat: 'monthly' });
  // Same month and day as the anchor: 2026-10-30 is inside.
  const yearly = kid({ id: 'yearly', start_date: '2024-10-30', repeat: 'yearly' });
  const result = buildCalendarNotifications({ today: TODAY, systemEvents: [], kidEvents: [weekly, monthly, yearly] });
  assert.deepEqual(result.items.map(item => item.occurrence_id), [
    'kid:kid-a:weekly:2026-10-29',
    'kid:kid-a:yearly:2026-10-30',
    'kid:kid-a:monthly:2026-10-31',
  ]);
});

test('a stopped series has no occurrence after its stop date and a series ended before today has none', () => {
  const stopped = kid({ id: 'stopped', start_date: '2026-10-01', repeat: 'weekly', repeat_ended_on: '2026-10-29' });
  const ended = kid({ id: 'ended', start_date: '2026-10-01', repeat: 'weekly', repeat_ended_on: '2026-10-28' });
  const result = buildCalendarNotifications({ today: TODAY, systemEvents: [], kidEvents: [stopped, ended] });
  assert.deepEqual(result.items.map(item => item.occurrence_id), ['kid:kid-a:stopped:2026-10-29']);
});

test('a one-off starting after the window or before today is not listed', () => {
  const result = buildCalendarNotifications({
    today: TODAY,
    systemEvents: [],
    kidEvents: [
      kid({ id: 'today-plus-three', start_date: '2026-11-01' }),
      kid({ id: 'today-plus-four', start_date: '2026-11-02' }),
      kid({ id: 'yesterday', start_date: '2026-10-28' }),
    ],
  });
  assert.deepEqual(result.items.map(item => item.occurrence_id), ['kid:kid-a:today-plus-three:2026-11-01']);
  assert.equal(result.items[0]!.days_until, 3);
});

test('items sort by date, then profile name with system items first, then occurrence id', () => {
  const result = buildCalendarNotifications({
    today: TODAY,
    systemEvents: [{ key: 'halloween', date: '2026-10-31' }, { key: 'tet', date: '2026-10-29' }],
    kidEvents: [
      kid({ id: 'b', start_date: '2026-10-31', profile_id: 'kid-z', profile_name: 'Zed' }),
      kid({ id: 'a', start_date: '2026-10-31', profile_id: 'kid-a', profile_name: 'Ann' }),
      kid({ id: 'c', start_date: '2026-10-31', profile_id: 'kid-b', profile_name: 'Ann' }),
    ],
  });
  assert.deepEqual(result.items.map(item => item.occurrence_id), [
    'system:tet:2026-10-29',
    'system:halloween:2026-10-31',
    'kid:kid-a:a:2026-10-31',
    'kid:kid-b:c:2026-10-31',
    'kid:kid-z:b:2026-10-31',
  ]);
});

test('the response is capped at one hundred items after sorting', () => {
  const kidEvents = Array.from({ length: 130 }, (_, index) => kid({
    id: `event-${String(index).padStart(3, '0')}`,
    start_date: index % 2 === 0 ? TODAY : '2026-10-30',
    profile_id: `kid-${index % 5}`,
    profile_name: `Kid ${index % 5}`,
  }));
  const result = buildCalendarNotifications({ today: TODAY, systemEvents: [], kidEvents });
  assert.equal(NOTIFICATION_ITEM_CAP, 100);
  assert.equal(result.items.length, 100);
  // Every item on the earlier date sorts first, so the cap never drops a soonest item in favour of a later one.
  assert.ok(result.items.slice(0, 65).every(item => item.date === TODAY));
  assert.ok(result.items.slice(65).every(item => item.date === '2026-10-30'));
});

test('system items on Tet and Halloween dates keep their keys and are listed for their own day', () => {
  const tet = buildCalendarNotifications({ today: '2027-02-03', systemEvents: [{ key: 'tet', date: '2027-02-06' }], kidEvents: [] });
  assert.deepEqual(tet.items.map(item => [item.occurrence_id, item.days_until]), [['system:tet:2027-02-06', 3]]);
  const halloween = buildCalendarNotifications({ today: '2026-10-31', systemEvents: [{ key: 'halloween', date: '2026-10-31' }], kidEvents: [] });
  assert.deepEqual(halloween.items.map(item => [item.title_key, item.icon_key, item.days_until]), [['halloween', 'halloween', 0]]);
});

test('an empty family returns an empty items list', () => {
  const result: CalendarNotificationsResponse = buildCalendarNotifications({ today: TODAY, systemEvents: [], kidEvents: [] });
  assert.deepEqual(result, { items: [] });
});

function fixture(options: { repository?: boolean } = {}) {
  const calls: { familyId: string; now: Date }[] = [];
  const repository = {
    async list(familyId: string, now: Date): Promise<CalendarNotificationsResponse> {
      calls.push({ familyId, now });
      return { items: [{ occurrence_id: 'system:halloween:2026-10-31', kind: 'system', profile_id: null, profile_name: null, title_key: 'halloween', title: null, icon_key: 'halloween', date: '2026-10-31', days_until: 2 }] };
    },
  };
  const db = {
    auth: {
      async findFamilyBySessionHash(hash: string) { return hash === hashSessionToken('token') ? family : null; },
    },
    ...(options.repository === false ? {} : { calendarNotifications: repository }),
  } as unknown as AppDatabase;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com', MAX_BODY_BYTES: '1024' });
  const app = createApp({ db, config, logger: { info() {}, warn() {}, error() {} } });
  const send = (method: string, path = '/api/v1/calendar/notifications', init: { cookie?: string | null; body?: string } = {}) => app.request(`https://app.example.com${path}`, {
    method,
    headers: init.cookie === null ? { 'content-type': 'application/json' } : { cookie: `plg_session=${init.cookie ?? 'token'}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  return { send, calls };
}

test('the notifications route requires a session and never trusts a family from the client', async () => {
  const { send, calls } = fixture();

  assert.equal((await send('GET', undefined, { cookie: null })).status, 401, 'anonymous requests are rejected');
  assert.equal(calls.length, 0);

  const response = await send('GET', '/api/v1/calendar/notifications?family_id=family-b&profile_id=kid-x');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{ occurrence_id: 'system:halloween:2026-10-31', kind: 'system', profile_id: null, profile_name: null, title_key: 'halloween', title: null, icon_key: 'halloween', date: '2026-10-31', days_until: 2 }],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.familyId, 'family-a', 'the session family is the only scope');
  assert.ok(calls[0]!.now instanceof Date);
});

test('the notifications route is GET only, private and no-store', async () => {
  const { send, calls } = fixture();

  const response = await send('GET');
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const rejected = await send(method, undefined, method === 'POST' ? { body: '{}' } : {});
    assert.equal(rejected.status, 405, `${method} is not allowed`);
    assert.equal(rejected.headers.get('allow'), 'GET');
    assert.match(rejected.headers.get('cache-control') ?? '', /no-store/);
    assert.equal((await rejected.json()).error.code, 'METHOD_NOT_ALLOWED');
  }
  assert.equal(calls.length, 1, 'rejected methods never reach the repository');
});

test('the notifications route reports unavailable when the repository is not configured', async () => {
  const { send } = fixture({ repository: false });
  const response = await send('GET');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'CALENDAR_UNAVAILABLE');
});
