import assert from 'node:assert/strict';
import test from 'node:test';
import { STUDY_CATALOG } from '../src/lib/calendarCatalog.ts';
import { MEAL_FOOD_CATALOG } from '../src/lib/calendarMealCatalog.ts';
import {
  EVENT_ICON_ENTRIES, EVENT_ICON_TABS, GENERIC_EVENT_CATALOG, GENERIC_EVENT_GROUPS, SYSTEM_EVENT_CATALOG,
  eventIconInfo, isEventIconKey, systemEventInfo,
} from '../src/lib/calendarEventCatalog.ts';

test('system event catalog has the nine fixed keys with labels and artwork', () => {
  assert.deepEqual(
    SYSTEM_EVENT_CATALOG.map((entry) => entry.key).sort(),
    ['childrens_day', 'christmas', 'halloween', 'mid_autumn', 'national_day', 'teachers_day', 'tet', 'womens_day_mar8', 'womens_day_oct20'],
  );
  for (const entry of SYSTEM_EVENT_CATALOG) {
    assert.ok(entry.en.trim(), `${entry.key} English label`);
    assert.ok(entry.vi.trim(), `${entry.key} Vietnamese label`);
    assert.equal(entry.art, `/calendar/icons/events/system/${entry.key}.webp`);
    assert.equal(systemEventInfo(entry.key).vi, entry.vi);
  }
});

test('generic event catalog has 86 unique keys in six groups with the expected sizes', () => {
  assert.equal(GENERIC_EVENT_CATALOG.length, 86);
  assert.equal(new Set(GENERIC_EVENT_CATALOG.map((entry) => entry.key)).size, 86);
  assert.deepEqual([...GENERIC_EVENT_GROUPS], ['outdoors', 'school', 'family', 'health', 'home', 'celebrations']);
  const sizes = GENERIC_EVENT_CATALOG.reduce<Record<string, number>>((counts, entry) => ({ ...counts, [entry.group]: (counts[entry.group] ?? 0) + 1 }), {});
  assert.deepEqual(sizes, { outdoors: 24, school: 12, family: 12, health: 6, home: 20, celebrations: 12 });
  for (const entry of GENERIC_EVENT_CATALOG) {
    assert.ok(entry.en.trim() && entry.vi.trim(), entry.key);
    assert.equal(entry.art, `/calendar/icons/events/${entry.group}/${entry.key}.webp`);
  }
});

test('study, meal and generic icon keys are unique across the picker', () => {
  assert.equal(EVENT_ICON_ENTRIES.length, STUDY_CATALOG.length + MEAL_FOOD_CATALOG.length + GENERIC_EVENT_CATALOG.length);
  assert.equal(new Set(EVENT_ICON_ENTRIES.map((entry) => entry.key)).size, EVENT_ICON_ENTRIES.length);
});

test('picker tabs combine study, meals and the six generic groups in order', () => {
  assert.deepEqual(EVENT_ICON_TABS.map((tab) => tab.id), ['study', 'meals', 'outdoors', 'school', 'family', 'health', 'home', 'celebrations']);
  assert.equal(EVENT_ICON_TABS[0]!.entries.length, STUDY_CATALOG.length);
  assert.equal(EVENT_ICON_TABS[1]!.entries.length, MEAL_FOOD_CATALOG.length);
  for (const tab of EVENT_ICON_TABS) assert.ok(tab.entries.length > 0, tab.id);
});

test('event icon lookup returns labels and artwork, with a safe fallback for unknown keys', () => {
  assert.deepEqual(eventIconInfo('math'), { key: 'math', en: 'Math', vi: 'Toán', art: '/calendar/icons/study/math.webp' });
  assert.equal(eventIconInfo('hiking').art, '/calendar/icons/events/outdoors/hiking.webp');
  assert.equal(eventIconInfo('rice').vi, 'Cơm');
  const unknown = eventIconInfo('not_a_key');
  assert.equal(unknown.en, 'not_a_key');
  assert.ok(unknown.art.startsWith('/calendar/icons/'));
  assert.equal(isEventIconKey('birthday'), true);
  assert.equal(isEventIconKey('tet'), false, 'system artwork is not a kid-event icon');
  assert.equal(isEventIconKey('medicine_time'), true, 'medicine_time is a generic health icon');
});
