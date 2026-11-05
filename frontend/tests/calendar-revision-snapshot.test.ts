import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCalendarListWriteFromRevisions, captureListRevisions, refreshListSnapshot, restoreRevisionOf, snapshotListRevisions,
} from '../src/lib/calendarHelpers.ts';
import { buildMealListWriteFromRevisions } from '../src/lib/calendarMealHelpers.ts';
import { refreshedEventRevision } from '../src/lib/calendarEventHelpers.ts';
import { CALENDAR_AREAS, type CalendarArea, type CalendarDay, type CalendarList, type CalendarTemplateList, type CalendarWindow } from '../src/types/calendar.ts';

const DATE = '2026-11-03';
const WEEKDAY = 2;
const empty: CalendarList = { id: null, items: [], revision: 0, source: 'empty' };

/** A day whose `area` is an override at `revision`, or has no override when `revision` is null. */
function dayWith(area: CalendarArea, revision: number | null): CalendarDay {
  const lists = Object.fromEntries(CALENDAR_AREAS.map((item) => [item, empty])) as Record<CalendarArea, CalendarList>;
  if (revision !== null) lists[area] = { id: `override-${revision}`, items: [{ subject: 'math' }], revision, source: 'override' };
  return { date: DATE, weekday: WEEKDAY, is_past: false, lists };
}

function templateAt(revision: number): CalendarTemplateList {
  return { id: `template-${revision}`, items: [{ subject: 'english' }], revision, source: 'template' };
}

/** A window whose weekday template for `area` is at `revision`; every other template row is empty. */
function windowWith(day: CalendarDay, area: CalendarArea, templateRevision: number): CalendarWindow {
  const emptyTemplate: CalendarTemplateList = { id: null, items: [], revision: 0, source: 'empty' };
  const emptyRow = () => Object.fromEntries(CALENDAR_AREAS.map((item) => [item, emptyTemplate])) as Record<CalendarArea, CalendarTemplateList>;
  const templates: CalendarWindow['templates'] = {
    '1': emptyRow(), '2': emptyRow(), '3': emptyRow(), '4': emptyRow(), '5': emptyRow(), '6': emptyRow(), '7': emptyRow(),
  };
  templates[String(day.weekday) as '2'][area] = templateAt(templateRevision);
  return { today: DATE, timezone: 'Asia/Ho_Chi_Minh', weeks: [{ start: DATE, days: [day] }], templates, meal_library: [], events: [], system_events: [] };
}

const items = [{ subject: 'science' as const }];

test('a date save sends the override revision captured at open, not the live revision after a background refresh', () => {
  // Editor opens at override revision 1.
  const opened = snapshotListRevisions(windowWith(dayWith('study_morning', 1), 'study_morning', 11), dayWith('study_morning', 1), 'study_morning');
  assert.equal(opened.overrideRevision, 1);
  // Another device saves revision 2 and the tab refetches. The refreshed window is not what the save uses.
  const refreshed = windowWith(dayWith('study_morning', 2), 'study_morning', 11);
  assert.equal(refreshed.weeks[0]?.days[0]?.lists.study_morning.revision, 2);
  // The original draft saves with the snapshot's revision 1, so the server rejects it with a 409.
  assert.equal(buildCalendarListWriteFromRevisions(opened, 'date', items).expected_revision, 1);
});

test('a template save sends the template revision captured at open', () => {
  const opened = snapshotListRevisions(windowWith(dayWith('study_morning', null), 'study_morning', 11), dayWith('study_morning', null), 'study_morning');
  assert.equal(buildCalendarListWriteFromRevisions(opened, 'template', items).expected_revision, 11);
  // A refresh that moved the template to 12 does not change what this editor sends.
  assert.equal(opened.templateRevision, 11);
});

test('a date save on a day that had no override at open sends 0, even if an override appeared since', () => {
  const opened = captureListRevisions(dayWith('study_morning', null), 'study_morning', templateAt(11));
  assert.equal(opened.overrideRevision, null);
  assert.equal(buildCalendarListWriteFromRevisions(opened, 'date', items).expected_revision, 0);
});

test('after a displayed 409 the snapshot advances to the refreshed revisions, and the older snapshot is unchanged', () => {
  const opened = captureListRevisions(dayWith('study_morning', 1), 'study_morning', templateAt(11));
  const refreshed = refreshListSnapshot(windowWith(dayWith('study_morning', 2), 'study_morning', 12), DATE, 'study_morning');
  assert.ok(refreshed, 'the refreshed window still contains the day');
  assert.equal(refreshed.revisions.overrideRevision, 2);
  assert.equal(refreshed.revisions.templateRevision, 12);
  // The next explicit Save uses the advanced revisions.
  assert.equal(buildCalendarListWriteFromRevisions(refreshed.revisions, 'date', items).expected_revision, 2);
  // The conflicting snapshot itself was not mutated.
  assert.equal(opened.overrideRevision, 1);
});

test('a refresh that no longer contains the date keeps the previous snapshot', () => {
  const refreshed = refreshListSnapshot(windowWith(dayWith('study_morning', 2), 'study_morning', 12), '2030-01-01', 'study_morning');
  assert.equal(refreshed, null);
  assert.equal(refreshListSnapshot(undefined, DATE, 'study_morning'), null);
});

test('restore deletes with the override revision captured at open, and has nothing to delete without one', () => {
  const opened = captureListRevisions(dayWith('study_morning', 1), 'study_morning', templateAt(11));
  assert.equal(restoreRevisionOf(opened), 1);
  const noOverride = captureListRevisions(dayWith('study_morning', null), 'study_morning', templateAt(11));
  assert.equal(restoreRevisionOf(noOverride), null);
});

test('meal and medicine saves use the captured template and override revisions', () => {
  const opened = captureListRevisions(dayWith('meal_lunch', 5), 'meal_lunch', templateAt(9));
  const dateWrite = buildMealListWriteFromRevisions(opened, 'date', [{ food: 'rice' }]);
  assert.deepEqual(dateWrite, { scope: 'date', date: DATE, area: 'meal_lunch', items: [{ food: 'rice' }], expected_revision: 5 });
  const templateWrite = buildMealListWriteFromRevisions(opened, 'template', [{ food: 'rice' }]);
  assert.deepEqual(templateWrite, { scope: 'template', weekday: WEEKDAY, area: 'meal_lunch', items: [{ food: 'rice' }], expected_revision: 9 });
  assert.equal(restoreRevisionOf(opened), 5);
});

test('the event revision adopted after a conflict comes from the refreshed list, or is absent when the event is gone', () => {
  assert.equal(refreshedEventRevision([{ event_id: 'event-a', revision: 4 }, { event_id: 'event-b', revision: 1 }], 'event-a'), 4);
  assert.equal(refreshedEventRevision([{ event_id: 'event-b', revision: 1 }], 'event-a'), null);
});
