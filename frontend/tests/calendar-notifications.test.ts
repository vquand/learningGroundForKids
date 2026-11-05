import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CALENDAR_NOTIFICATIONS_PATH,
  fetchCalendarNotifications,
  parseCalendarNotificationItems,
  type CalendarNotificationItem,
} from '../src/api/calendarNotifications.ts';
import { FRIEND_NOTIFICATION_PREVIEW } from '../src/lib/friendNotificationFeed.ts';
import {
  CALENDAR_NOTIFICATION_PREVIEW,
  calendarNotificationArt,
  calendarNotificationDayLabel,
  calendarNotificationTitle,
  notificationPanelTotal,
  previewItems,
  sortCalendarNotifications,
  type CalendarNotificationCopy,
} from '../src/lib/calendarNotificationFeed.ts';

type Catalog = Record<string, string>;

async function loadVietnamese(): Promise<Catalog> {
  return JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Catalog;
}

function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => (key in values ? String(values[key]) : token));
}

/** English copy: the source text with values interpolated. */
const englishCopy: CalendarNotificationCopy = {
  language: 'en',
  translate: (english, values) => interpolate(english, values),
};

async function vietnameseCopy(): Promise<CalendarNotificationCopy> {
  const catalog = await loadVietnamese();
  return {
    language: 'vi',
    translate: (english, values) => interpolate(catalog[english] ?? english, values),
  };
}

const kid = (overrides: Partial<CalendarNotificationItem> & Pick<CalendarNotificationItem, 'occurrence_id' | 'date' | 'days_until'>): CalendarNotificationItem => ({
  kind: 'kid',
  profile_id: 'kid-a',
  profile_name: 'Mun',
  title_key: null,
  title: 'Hiking with Dad',
  icon_key: 'hiking',
  ...overrides,
});

const system = (key: string, date: string, daysUntil: number): CalendarNotificationItem => ({
  occurrence_id: `system:${key}:${date}`,
  kind: 'system',
  profile_id: null,
  profile_name: null,
  title_key: key,
  title: null,
  icon_key: key,
  date,
  days_until: daysUntil,
});

test('the feed parser keeps well-formed items and drops anything unexpected', () => {
  const valid = system('halloween', '2026-10-31', 2);
  const raw = {
    items: [
      valid,
      { ...valid, occurrence_id: 'bad-days', days_until: 4 },
      { ...valid, occurrence_id: 'bad-kind', kind: 'other' },
      { ...valid, occurrence_id: 'bad-profile', profile_id: 7 },
      { ...valid, occurrence_id: 'no-icon', icon_key: undefined },
      null,
      'text',
    ],
  };
  assert.deepEqual(parseCalendarNotificationItems(raw), [valid]);
  assert.deepEqual(parseCalendarNotificationItems({ items: 'nope' }), []);
  assert.deepEqual(parseCalendarNotificationItems(null), []);
});

test('fetching the feed uses the same-origin route and returns only the items', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  const item = system('tet', '2027-02-06', 3);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(typeof input === 'string' ? input : input.toString());
    return Response.json({ items: [item] });
  }) as typeof fetch;
  try {
    assert.equal(CALENDAR_NOTIFICATIONS_PATH, '/api/v1/calendar/notifications');
    assert.deepEqual(await fetchCalendarNotifications(), [item]);
    assert.deepEqual(requests, ['/api/v1/calendar/notifications']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the feed sorts soonest first, then kid name with system items first, then occurrence id', () => {
  const input = [
    kid({ occurrence_id: 'kid:z', date: '2026-10-31', days_until: 2, profile_name: 'Zed' }),
    kid({ occurrence_id: 'kid:b', date: '2026-10-31', days_until: 2, profile_name: 'Ann', profile_id: 'b' }),
    system('halloween', '2026-10-31', 2),
    kid({ occurrence_id: 'kid:a', date: '2026-10-30', days_until: 1, profile_name: 'Zed' }),
  ];
  const original = input.map((item) => item.occurrence_id);
  assert.deepEqual(sortCalendarNotifications(input).map((item) => item.occurrence_id), [
    'kid:a',
    'system:halloween:2026-10-31',
    'kid:b',
    'kid:z',
  ]);
  assert.deepEqual(input.map((item) => item.occurrence_id), original, 'the source list is not reordered');
});

test('each group truncates on its own preview length and the badge counts every listed item', () => {
  const calendar = Array.from({ length: 5 }, (_, index) => kid({ occurrence_id: `kid:${index}`, date: '2026-10-29', days_until: 0, profile_name: `Kid ${index}` }));
  const friends = Array.from({ length: 4 }, (_, index) => `friend-${index}`);

  assert.equal(CALENDAR_NOTIFICATION_PREVIEW, 3);
  assert.equal(FRIEND_NOTIFICATION_PREVIEW, 2, 'friend requests keep their own preview length');
  assert.equal(previewItems(calendar, false, CALENDAR_NOTIFICATION_PREVIEW).length, 3);
  assert.equal(previewItems(calendar, true, CALENDAR_NOTIFICATION_PREVIEW).length, 5);
  assert.equal(previewItems(friends, false, FRIEND_NOTIFICATION_PREVIEW).length, 2);
  // Calendar items never reduce the friend preview, and friend requests never reduce the calendar one.
  assert.equal(previewItems(friends, false, FRIEND_NOTIFICATION_PREVIEW).length, FRIEND_NOTIFICATION_PREVIEW);

  assert.equal(notificationPanelTotal(4, calendar), 9);
  assert.equal(notificationPanelTotal(0, []), 0);
});

test('day labels read Today, Tomorrow or the count of days, in English and Vietnamese', async () => {
  const vi = await vietnameseCopy();
  assert.equal(calendarNotificationDayLabel(0, englishCopy), 'Today');
  assert.equal(calendarNotificationDayLabel(1, englishCopy), 'Tomorrow');
  assert.equal(calendarNotificationDayLabel(3, englishCopy), 'In 3 days');
  assert.equal(calendarNotificationDayLabel(0, vi), 'Hôm nay');
  assert.equal(calendarNotificationDayLabel(1, vi), 'Ngày mai');
  assert.equal(calendarNotificationDayLabel(3, vi), 'Còn 3 ngày nữa');
});

test('titles use the shared event labels for system items and the typed title for kid items', async () => {
  const vi = await vietnameseCopy();
  const halloween = system('halloween', '2026-10-31', 2);
  const tet = system('tet', '2027-02-06', 3);
  assert.equal(calendarNotificationTitle(halloween, englishCopy), 'Halloween');
  assert.equal(calendarNotificationTitle(tet, englishCopy), 'Tết (Lunar New Year)');
  assert.equal(calendarNotificationTitle(tet, vi), 'Tết Nguyên đán');
  assert.equal(calendarNotificationTitle(kid({ occurrence_id: 'k', date: '2026-10-29', days_until: 0 }), englishCopy), 'Hiking with Dad');
  // A kid item without a title falls back to its icon label rather than an empty string.
  assert.equal(calendarNotificationTitle(kid({ occurrence_id: 'k', date: '2026-10-29', days_until: 0, title: null }), englishCopy), 'Hiking');
});

test('artwork comes from the shared catalogs and unknown keys fall back safely', () => {
  assert.equal(calendarNotificationArt(system('halloween', '2026-10-31', 2)), '/calendar/icons/events/system/halloween.webp');
  assert.equal(calendarNotificationArt(kid({ occurrence_id: 'k', date: '2026-10-29', days_until: 0 })), '/calendar/icons/events/outdoors/hiking.webp');
  assert.match(calendarNotificationArt(kid({ occurrence_id: 'k', date: '2026-10-29', days_until: 0, icon_key: 'not-a-key' })), /\.webp$/);
});

test('every authored notification string has a Vietnamese translation with placeholders intact', async () => {
  const catalog = await loadVietnamese();
  const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  const keys = [
    'Coming up',
    'Today',
    'Tomorrow',
    'In {count} days',
    '{subject} is today',
    '{subject} is in {count} days',
    'Show all ({count})',
    'Show less',
    'Notifications',
    'No notifications yet.',
  ];
  for (const key of keys) {
    assert.ok(catalog[key], `Missing Vietnamese notification label: ${key}`);
    assert.deepEqual(placeholders(catalog[key]!), placeholders(key), `Preserve values in ${key}`);
  }
  assert.equal(catalog['Coming up'], 'Sắp tới');
});
