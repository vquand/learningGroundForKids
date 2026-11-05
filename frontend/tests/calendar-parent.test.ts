import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { parentCalendarPath, parentChildCalendarRoute } from '../src/api/calendarParent.ts';
import type { CalendarArea, CalendarDay, CalendarList, CalendarWeek, CalendarWindow } from '../src/types/calendar.ts';

const MEDICINE_NOTE = 'Medicine reminders are set by your child and are not medical advice.';
const NEW_KEYS = ['View calendar', 'Back to child report', 'View only', 'Could not load this calendar. Please try again.', MEDICINE_NOTE];
const TODAY = '2026-10-29';
const EMPTY: CalendarList = { id: null, items: [], revision: 0, source: 'empty' };
const AREAS: CalendarArea[] = ['study_morning', 'study_afternoon', 'study_extra', 'meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner', 'medicine'];

function day(date: string, weekday: number): CalendarDay {
  const lists = Object.fromEntries(AREAS.map((area) => [area, EMPTY])) as Record<CalendarArea, CalendarList>;
  lists.study_morning = { id: `m-${date}`, items: [{ subject: 'math', teaching_language: 'en' }], revision: 1, source: 'override' };
  lists.study_extra = { id: `extra-${date}`, items: [{ subject: 'reading', teaching_language: 'vi' }], revision: 1, source: 'template' };
  return { date, weekday, is_past: date < TODAY, lists };
}

function week(start: string, dates: string[]): CalendarWeek {
  return { start, days: dates.map((date, index) => day(date, index + 1)) };
}

// The server window's weekday templates are not used by the read-only views, so the fixture omits them.
const WINDOW = {
  today: TODAY,
  timezone: 'Asia/Ho_Chi_Minh',
  weeks: [
    week('2026-10-26', ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']),
    week('2026-11-02', ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']),
  ],
  templates: {},
  meal_library: [],
  events: [],
  system_events: [],
} as unknown as CalendarWindow;

/**
 * Every rendered button must be a view or week tab, the Events "+N" control, or the parent-only family-button settings action.
 * The calendar entries themselves remain read-only.
 */
function assertNoEditControls(html: string) {
  for (const [tag] of html.matchAll(/<button\b[^>]*>/g)) assert.match(tag, /role="tab"|class="events-more"|data-calendar-family-settings="true"/, `Unexpected button in read-only calendar: ${tag}`);
  assert.doesNotMatch(html, /events-collapse|events-sheet|role="dialog"/, 'the expanded-card control only appears once a card is expanded');
  assert.doesNotMatch(html, /<(input|select|textarea|form)\b/i);
  assert.doesNotMatch(html, /contenteditable/i);
  assert.doesNotMatch(html, /aria-label="Edit |Save this plan|Restore weekly plan|Every |Only /);
}

test('parent calendar routes and endpoints stay on the same-origin parent surface', () => {
  assert.equal(parentCalendarPath('kid-a'), '/api/v1/parent/calendar/kid-a');
  assert.equal(parentCalendarPath('a/b c'), '/api/v1/parent/calendar/a%2Fb%20c');
  assert.equal(parentChildCalendarRoute('kid-a'), '/parent/children/kid-a/calendar');
  assert.equal(parentChildCalendarRoute('a/b c'), '/parent/children/a%2Fb%20c/calendar');
});

test('parent calendar strings are translated with the English source keys intact', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const key of NEW_KEYS) assert.ok(catalog[key], `Missing Vietnamese translation for: ${key}`);
  assert.equal(catalog[MEDICINE_NOTE], 'Nhắc nhở uống thuốc do con đặt và không phải lời khuyên y tế.');
  assert.equal(catalog['View calendar'], 'Xem lịch');
});

test('parent calendar is wired into the child report and the parent route tree', async () => {
  const routes = await readFile(new URL('../src/features/parent/ParentRoutes.tsx', import.meta.url), 'utf8');
  assert.match(routes, /path="children\/:profileId\/calendar" element=\{<ParentCalendarPage \/>\}/);
  const report = await readFile(new URL('../src/features/parent/ParentReportViews.tsx', import.meta.url), 'utf8');
  assert.match(report, /to=\{parentChildCalendarRoute\(child\.id\)\}>\{uiText\('View calendar'\)\}/);
});

test('read-only study grid renders inert cells that keep chips, weekend tint and past dimming', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const { StudyGrid } = await server.ssrLoadModule('/src/components/Calendar/StudyGrid.tsx');
    const readOnly = renderToStaticMarkup(createElement(StudyGrid, {
      week: WINDOW.weeks[0]!, today: TODAY, onEdit() { /* read-only: never called */ }, cellRefs: { current: {} }, readOnly: true,
    }));
    assertNoEditControls(readOnly);
    assert.equal(readOnly.match(/class="calendar-study-cell[^"]*"/g)?.length, 21, 'three study rows across seven days');
    assert.equal(readOnly.match(/class="calendar-study-cell[^"]*is-readonly[^"]*"/g)?.length, 21, 'every study cell is read-only');
    assert.equal(readOnly.match(/role="group"/g)?.length, 21, 'read-only cells are inert groups');
    assert.ok(readOnly.includes('calendar-study-chip'), 'planned chips remain visible');
    assert.match(readOnly, /Math \(English\)/, 'teaching language is in the accessible plan summary');
    assert.match(readOnly, /Reading \(Vietnamese\)/, 'Extra study includes its teaching language');
    assert.match(readOnly, /calendar-language-medal/, 'parent shares the flag medallions');
    assert.ok(readOnly.includes('Extra'), 'parent sees the additional study row');
    assert.ok(readOnly.includes('is-weekend'), 'weekend tint remains visible');
    assert.ok(readOnly.includes('is-past'), 'past dimming remains visible');

    // Regression: the kid calendar keeps interactive study cells when readOnly is not set.
    const editable = renderToStaticMarkup(createElement(StudyGrid, {
      week: WINDOW.weeks[0]!, today: TODAY, onEdit() { /* kid editor */ }, cellRefs: { current: {} },
    }));
    assert.equal(editable.match(/<button[^>]*class="calendar-study-cell/g)?.length, 21);
    assert.equal(editable.includes('is-readonly'), false);
  } finally {
    await server.close();
  }
});

test('parent calendar views render without edit controls and keep the study chips', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const { ParentCalendarView } = await server.ssrLoadModule('/src/pages/ParentCalendarPage.tsx');
    const render = (overrides: Partial<{ view: 'study' | 'meals' | 'events'; weekIndex: number }> = {}) => renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ParentCalendarView, {
        profileId: 'kid-a', childName: 'Ada', data: WINDOW, weekIndex: overrides.weekIndex ?? 0, view: overrides.view ?? 'study',
        onWeekChange() { /* read-only test harness */ }, onViewChange() { /* read-only test harness */ },
      })));

    const study = render();
    assertNoEditControls(study);
    assert.match(study, /data-calendar-family-settings="true"[^>]*>Family members in events<\/button>/);
    assert.equal(study.match(/class="calendar-study-cell[^"]*is-readonly[^"]*"/g)?.length, 21, 'every study cell is read-only');
    // Parent Space keeps the horizontal week toggle and view tabs; the kid rail and weather strip are not used here.
    assert.match(study, /<div class="calendar-week-toggle" role="tablist" aria-label="[^"]+">/);
    assert.match(study, /<div class="calendar-view-tabs" role="tablist"/);
    assert.equal(study.includes('is-vertical'), false, 'parent tabs are not the kid rail');
    assert.equal(study.includes('aria-orientation'), false, 'parent tablists stay horizontal');
    assert.equal(study.match(/role="tab"/g)?.length, 5, 'two week tabs and three view tabs');
    assert.equal(study.includes('class="calendar-weather-strip"'), false, 'no weather strip without weather data');
    assert.equal(study.includes('calendar-toolbar'), false, 'the parent page has no kid toolbar');
    assert.ok(study.includes('Ada'), 'child name is shown as plain text');
    assert.ok(study.includes('href="/parent/children/kid-a"'), 'back link returns to the child report');
    assert.equal(study.includes(MEDICINE_NOTE), false, 'the medicine note belongs to the Meals view only');

    const meals = render({ view: 'meals' });
    assertNoEditControls(meals);
    assert.ok(meals.includes(MEDICINE_NOTE), 'Meals shows the medicine disclaimer');

    const events = render({ view: 'events' });
    assertNoEditControls(events);
    assert.equal(events.includes(MEDICINE_NOTE), false);
    // Events: seven date containers (Study/Meals classes) sit above seven cards. The date lives in each heading, not inside the card.
    assert.equal(events.match(/class="calendar-day-heading/g)?.length, 7, 'seven heading containers');
    assert.equal(events.includes('events-day-heading'), false, 'no date inside the card');
    // Every day is empty in this fixture: each card shows the calendar icon with a screen-reader label and keeps the date in its accessible name.
    assert.equal(events.match(/class="events-empty-label">Empty day</g)?.length, 7, 'every empty read-only day keeps the Empty day label');
    assert.match(events, /aria-label="Monday 26 Oct, Empty day"/);

    const nextWeek = render({ view: 'events', weekIndex: 1 });
    assertNoEditControls(nextWeek);
    assert.equal(nextWeek.match(/class="events-empty-label">Empty day</g)?.length, 7, 'Next week empty days are labelled too');
    assert.match(nextWeek, /aria-label="Monday 2 Nov, Empty day"/);
    assertNoEditControls(render({ weekIndex: 1 }));
  } finally {
    await server.close();
  }
});
