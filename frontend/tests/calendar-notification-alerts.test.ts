import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { CalendarNotificationItem } from '../src/api/calendarNotifications.ts';
import type { CalendarNotificationCopy } from '../src/lib/calendarNotificationFeed.ts';
import {
  CALENDAR_ALERT_LEDGER_LIMIT,
  buildCalendarAlertCopy,
  calendarAlertKey,
  calendarAlertStorageKey,
  clearCalendarAlertLedger,
  createCalendarAlertSession,
  isCalendarAlertDay,
  planCalendarAlerts,
  readCalendarAlertLedger,
  writeCalendarAlertLedger,
  type CalendarAlertSinkDeps,
  type CalendarAlertStorage,
  type ClosableNotification,
} from '../src/lib/calendarNotificationAlerts.ts';

function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => (key in values ? String(values[key]) : token));
}

const englishCopy: CalendarNotificationCopy = { language: 'en', translate: (english, values) => interpolate(english, values) };

const kid = (occurrence: string, daysUntil: number, overrides: Partial<CalendarNotificationItem> = {}): CalendarNotificationItem => ({
  occurrence_id: occurrence,
  kind: 'kid',
  profile_id: 'kid-a',
  profile_name: 'Mun',
  title_key: null,
  title: 'Hiking with Dad',
  icon_key: 'hiking',
  date: '2026-11-01',
  days_until: daysUntil,
  ...overrides,
});

/** Halloween is always 2026-10-31; days_until says how far away it is for this poll. */
const halloween = (daysUntil: number): CalendarNotificationItem => ({
  occurrence_id: 'system:halloween:2026-10-31',
  kind: 'system',
  profile_id: null,
  profile_name: null,
  title_key: 'halloween',
  title: null,
  icon_key: 'halloween',
  date: '2026-10-31',
  days_until: daysUntil,
});

/** In-memory Storage fake. `failures` makes individual operations throw. */
function fakeStorage(failures: Partial<Record<'getItem' | 'setItem' | 'removeItem', boolean>> = {}) {
  const values = new Map<string, string>();
  const storage: CalendarAlertStorage = {
    getItem(key) {
      if (failures.getItem) throw new Error('blocked');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (failures.setItem) throw new Error('quota');
      values.set(key, value);
    },
    removeItem(key) {
      if (failures.removeItem) throw new Error('blocked');
      values.delete(key);
    },
  };
  return { storage, values };
}

/** Notification fake that records every construction and every close. */
function fakeNotifications() {
  const shown: { title: string; body: string; tag: string; closed: boolean }[] = [];
  const notify = (title: string, options: { body: string; tag: string }): ClosableNotification => {
    const entry = { title, body: options.body, tag: options.tag, closed: false };
    shown.push(entry);
    return { close: () => { entry.closed = true; } };
  };
  return { shown, notify };
}

function sinkDeps(options: {
  permission?: NotificationPermission | 'unsupported';
  notify?: CalendarAlertSinkDeps['notify'];
  storage?: CalendarAlertStorage | null;
} = {}) {
  const recorded = fakeNotifications();
  const fake = fakeStorage();
  const storage = options.storage === undefined ? fake.storage : options.storage;
  const deps: CalendarAlertSinkDeps = {
    storage,
    permission: () => options.permission ?? 'granted',
    notify: options.notify ?? recorded.notify,
    copy: () => englishCopy,
  };
  return { deps, shown: recorded.shown, values: fake.values, storage };
}

test('only the days three and zero alert; days two and one never do', () => {
  assert.equal(isCalendarAlertDay(3), true);
  assert.equal(isCalendarAlertDay(0), true);
  assert.equal(isCalendarAlertDay(2), false);
  assert.equal(isCalendarAlertDay(1), false);
});

test('an occurrence alerts once per day it is announced for, even when repeated in one list or later polls', () => {
  const items = [kid('kid:a:e:2026-11-01', 3), kid('kid:a:e:2026-11-01', 3), halloween(0)];
  const first = planCalendarAlerts(items, []);
  assert.deepEqual(first.alerts.map(calendarAlertKey), ['kid:a:e:2026-11-01|3', 'system:halloween:2026-10-31|0']);

  const second = planCalendarAlerts(items, first.ledger);
  assert.deepEqual(second.alerts, [], 'a later poll with the same items stays silent');
  assert.deepEqual(second.ledger, first.ledger);
});

test('the same occurrence at day three and again at day zero counts as two separate alerts', () => {
  const plan = planCalendarAlerts([kid('kid:a:e:2026-11-01', 3), kid('kid:a:e:2026-11-01', 0, { date: '2026-11-01' })], []);
  assert.equal(plan.alerts.length, 2);
  assert.notEqual(calendarAlertKey(plan.alerts[0]!), calendarAlertKey(plan.alerts[1]!));
});

test('days two and one are never alerted, even for new occurrences', () => {
  const plan = planCalendarAlerts([kid('kid:a:e:2026-10-31', 2), kid('kid:a:f:2026-10-30', 1)], []);
  assert.deepEqual(plan.alerts, []);
  assert.deepEqual(plan.ledger, []);
});

test('the dedupe ledger keeps at most two hundred identifiers, dropping the oldest', () => {
  const old = Array.from({ length: 250 }, (_, index) => `old-${index}|3`);
  const plan = planCalendarAlerts([kid('kid:new', 3)], old);
  assert.equal(plan.ledger.length, CALENDAR_ALERT_LEDGER_LIMIT);
  assert.equal(plan.ledger.at(-1), 'kid:new|3');
  assert.equal(plan.ledger[0], 'old-51|3');
});

test('a stored ledger round trips through storage as identifiers only, and is trimmed on write', () => {
  const { storage, values } = fakeStorage();
  assert.equal(writeCalendarAlertLedger(storage, 'family-a', ['kid:a:e:2026-11-01|3']), true);
  const stored = values.get(calendarAlertStorageKey('family-a'));
  assert.equal(stored, JSON.stringify(['kid:a:e:2026-11-01|3']));
  assert.deepEqual(readCalendarAlertLedger(storage, 'family-a'), ['kid:a:e:2026-11-01|3']);
  assert.deepEqual(readCalendarAlertLedger(storage, 'family-b'), [], 'each family has its own ledger');

  writeCalendarAlertLedger(storage, 'family-a', Array.from({ length: 205 }, (_, index) => `id-${index}|0`));
  assert.equal(readCalendarAlertLedger(storage, 'family-a').length, CALENDAR_ALERT_LEDGER_LIMIT);
});

test('storage failures and malformed values read as an empty ledger and never throw', () => {
  assert.deepEqual(readCalendarAlertLedger(null, 'family-a'), []);

  const blocked = fakeStorage({ getItem: true });
  assert.deepEqual(readCalendarAlertLedger(blocked.storage, 'family-a'), []);

  const malformed = fakeStorage();
  malformed.values.set(calendarAlertStorageKey('family-a'), '{not json');
  assert.deepEqual(readCalendarAlertLedger(malformed.storage, 'family-a'), []);

  malformed.values.set(calendarAlertStorageKey('family-a'), JSON.stringify({ id: 'object' }));
  assert.deepEqual(readCalendarAlertLedger(malformed.storage, 'family-a'), []);

  malformed.values.set(calendarAlertStorageKey('family-a'), JSON.stringify(['kept|3', 7, '', null]));
  assert.deepEqual(readCalendarAlertLedger(malformed.storage, 'family-a'), ['kept|3']);

  const full = fakeStorage({ setItem: true, removeItem: true });
  assert.equal(writeCalendarAlertLedger(full.storage, 'family-a', ['x|3']), false);
  assert.doesNotThrow(() => clearCalendarAlertLedger(full.storage, 'family-a'));
  assert.equal(writeCalendarAlertLedger(null, 'family-a', ['x|3']), false);
  assert.doesNotThrow(() => clearCalendarAlertLedger(null, 'family-a'));
});

test('alerts fire only when permission is already granted and never prompt', () => {
  for (const permission of ['default', 'denied', 'unsupported'] as const) {
    const { deps, shown, values } = sinkDeps({ permission });
    const session = createCalendarAlertSession('family-a', deps);
    assert.deepEqual(session.observe([kid('kid:a:e:2026-11-01', 3)]), []);
    assert.equal(shown.length, 0, `no alert with permission ${permission}`);
    assert.equal(values.size, 0, 'nothing is recorded while alerts are off');
  }
});

test('a granted session alerts once per occurrence and records only identifiers', () => {
  const { deps, shown, values } = sinkDeps({});
  const session = createCalendarAlertSession('family-a', deps);
  const items = [halloween(3), kid('kid:a:e:2026-11-01', 0, { date: '2026-10-29' })];

  assert.equal(session.observe(items).length, 2);
  assert.deepEqual(shown.map((entry) => [entry.title, entry.body]), [
    ['Coming up', 'Halloween is in 3 days'],
    ['Coming up', 'Mun: Hiking with Dad is today'],
  ]);
  assert.equal(session.observe(items).length, 0, 'a refetch with the same items is silent');
  assert.equal(shown.length, 2);

  const stored = values.get(calendarAlertStorageKey('family-a'))!;
  assert.doesNotMatch(stored, /Mun|Hiking|Halloween/, 'titles and names are not persisted');
  assert.deepEqual(JSON.parse(stored), ['system:halloween:2026-10-31|3', 'kid:a:e:2026-11-01|0']);
});

test('a second session on the same device sees the stored ledger and stays silent', () => {
  const { deps, shown, storage } = sinkDeps({});
  createCalendarAlertSession('family-a', deps).observe([kid('kid:a:e:2026-11-01', 3)]);
  assert.equal(shown.length, 1);

  const reopened = createCalendarAlertSession('family-a', { ...deps, storage });
  assert.deepEqual(reopened.observe([kid('kid:a:e:2026-11-01', 3)]), []);
  assert.equal(shown.length, 1, 'dedupe survives a reload of the app');
});

test('a browser that refuses an alert is recorded once and does not break later alerts', () => {
  const shown: { body: string }[] = [];
  const { deps } = sinkDeps({
    notify: (_title, options) => {
      if (options.body.startsWith('Mun')) throw new Error('not allowed on this platform');
      shown.push({ body: options.body });
      return { close() {} };
    },
  });
  const session = createCalendarAlertSession('family-a', deps);
  const alerted = session.observe([kid('kid:a:e:2026-11-01', 3), halloween(0)]);
  assert.equal(alerted.length, 2, 'both occurrences were planned');
  assert.deepEqual(shown.map((entry) => entry.body), ['Halloween is today']);
  assert.deepEqual(session.observe([kid('kid:a:e:2026-11-01', 3), halloween(0)]), [], 'the refused alert is not retried on every poll');
});

test('closing handles closes open notifications but keeps the dedupe state for the device', () => {
  const { deps, shown, values } = sinkDeps({});
  const session = createCalendarAlertSession('family-a', deps);
  session.observe([halloween(3)]);
  assert.equal(shown[0]!.closed, false);

  session.closeHandles();
  assert.equal(shown[0]!.closed, true);
  assert.ok(values.has(calendarAlertStorageKey('family-a')), 'dedupe state is kept on unmount');
  assert.deepEqual(session.observe([halloween(3)]), []);
});

test('logout or a family switch forgets the old family: handles close and its dedupe state is cleared', () => {
  const { deps, shown, values, storage } = sinkDeps({});
  const familyA = createCalendarAlertSession('family-a', deps);
  familyA.observe([halloween(3)]);

  const familyB = createCalendarAlertSession('family-b', { ...deps, storage });
  familyB.observe([halloween(3)]);
  assert.equal(shown.length, 2, 'each family alerts for its own calendar');

  familyA.forget();
  assert.equal(shown[0]!.closed, true, 'the previous family alert is closed');
  assert.equal(shown[1]!.closed, false, 'the other family alert is untouched');
  assert.equal(values.has(calendarAlertStorageKey('family-a')), false, 'the previous family dedupe state is cleared');
  assert.equal(values.has(calendarAlertStorageKey('family-b')), true);

  // A new session for the same family after logout alerts again, because its dedupe state was cleared.
  const relogged = createCalendarAlertSession('family-a', { ...deps, storage });
  assert.equal(relogged.observe([halloween(3)]).length, 1);
  assert.equal(shown.length, 3);
});

test('storage that throws never blocks alerts or cleanup', () => {
  const { storage } = fakeStorage({ getItem: true, setItem: true, removeItem: true });
  const { deps, shown } = sinkDeps({ storage });
  const session = createCalendarAlertSession('family-a', deps);
  assert.equal(session.observe([halloween(3)]).length, 1, 'the in-session ledger still prevents repeats');
  assert.equal(session.observe([halloween(3)]).length, 0);
  assert.doesNotThrow(() => session.forget());
  assert.equal(shown[0]!.closed, true);
});

test('alert copy names the event or the child and uses the day wording', async () => {
  assert.deepEqual(buildCalendarAlertCopy(halloween(3), englishCopy), { title: 'Coming up', body: 'Halloween is in 3 days' });
  assert.deepEqual(buildCalendarAlertCopy(kid('kid:a:e:2026-11-01', 0), englishCopy), { title: 'Coming up', body: 'Mun: Hiking with Dad is today' });

  const catalog = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  const vietnamese: CalendarNotificationCopy = { language: 'vi', translate: (english, values) => interpolate(catalog[english] ?? english, values) };
  assert.deepEqual(buildCalendarAlertCopy(kid('kid:a:e:2026-11-01', 0), vietnamese), { title: 'Sắp tới', body: 'Mun: Hiking with Dad là hôm nay' });
  assert.deepEqual(buildCalendarAlertCopy(halloween(3), vietnamese), { title: 'Sắp tới', body: 'Halloween còn 3 ngày nữa' });
});

test('calendar alerts fire even while the tab is visible (unlike friend alerts, which wait for a hidden tab)', async () => {
  const documentBefore = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { visibilityState: 'visible', hidden: false };
  try {
    const { deps, shown } = sinkDeps({});
    const session = createCalendarAlertSession('family-a', deps);
    assert.equal(session.observe([halloween(3)]).length, 1);
    assert.equal(shown.length, 1, 'an alert is shown with a visible tab');
  } finally {
    if (documentBefore === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = documentBefore;
  }
  const source = await readFile(new URL('../src/lib/calendarNotificationAlerts.ts', import.meta.url), 'utf8');
  assert.equal(/visibilityState|document\.hidden/.test(source), false, 'the alert module must not gate on tab visibility');
});
