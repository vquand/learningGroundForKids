import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { CalendarArea, CalendarDay, CalendarList, CalendarWeek, CalendarWeatherResponse, CalendarWindow } from '../src/types/calendar.ts';

const TODAY = '2026-10-29';
const EMPTY: CalendarList = { id: null, items: [], revision: 0, source: 'empty' };
const AREAS: CalendarArea[] = ['study_morning', 'study_afternoon', 'meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner', 'medicine'];

function day(date: string, weekday: number): CalendarDay {
  const lists = Object.fromEntries(AREAS.map((area) => [area, EMPTY])) as Record<CalendarArea, CalendarList>;
  lists.study_morning = { id: `m-${date}`, items: [{ subject: 'math' }, { subject: 'science' }], revision: 1, source: 'override' };
  return { date, weekday, is_past: date < TODAY, lists };
}

const WEEK: CalendarWeek = {
  start: '2026-10-26',
  days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((date, index) => day(date, index + 1)),
};

const WEATHER_OK: CalendarWeatherResponse = {
  status: 'ok',
  location_label: 'Da Nang, VN',
  updated_at: '2026-10-29T00:00:00.000Z',
  days: [{
    date: TODAY,
    morning: { icon: 'rain', temp_c: 26.6 },
    afternoon: { icon: 'hot', temp_c: 35.4 },
    evening: { icon: 'cloudy_night', temp_c: 27.2 },
  }],
};

const WINDOW = { today: TODAY, timezone: 'Asia/Ho_Chi_Minh', weeks: [WEEK], templates: {}, meal_library: [], events: [], system_events: [] } as unknown as CalendarWindow;

async function withVite<T>(run: (server: Awaited<ReturnType<typeof createServer>>) => Promise<T>): Promise<T> {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    return await run(server);
  } finally {
    await server.close();
  }
}

const read = (name: string) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('view tabs stay horizontal by default and take the vertical rail only when asked', async () => {
  await withVite(async (server) => {
    const { CalendarViewTabs } = await server.ssrLoadModule('/src/components/Calendar/CalendarViewTabs.tsx');
    const horizontal = renderToStaticMarkup(createElement(CalendarViewTabs, { active: 'study', onChange() { /* test */ } }));
    assert.match(horizontal, /<div class="calendar-view-tabs" role="tablist"/);
    assert.doesNotMatch(horizontal, /is-vertical|aria-orientation/);

    const vertical = renderToStaticMarkup(createElement(CalendarViewTabs, { active: 'meals', onChange() { /* test */ }, orientation: 'vertical' }));
    assert.match(vertical, /<div class="calendar-view-tabs is-vertical" role="tablist" aria-label="[^"]+" aria-orientation="vertical">/);
    assert.equal(vertical.match(/role="tab"/g)?.length, 3, 'three view tabs in the rail');
    assert.match(vertical, /aria-selected="true"[^>]*>/);
    assert.match(vertical, /\/calendar\/icons\/ui\/tab_study\.webp/);
    assert.match(vertical, /\/calendar\/icons\/ui\/tab_meals\.webp/);
    assert.match(vertical, /\/calendar\/icons\/ui\/tab_events\.webp/);
  });
});

test('the week group is a tablist in both orientations, and the kid rail renders it vertically', async () => {
  await withVite(async (server) => {
    const { CalendarWeekToggle } = await server.ssrLoadModule('/src/components/Calendar/CalendarWeekToggle.tsx');
    const weeks = [{ start: '2026-10-26' }, { start: '2026-11-02' }, { start: '2026-11-09' }];
    const horizontal = renderToStaticMarkup(createElement(CalendarWeekToggle, { weeks, active: 0, onChange() { /* test */ } }));
    assert.match(horizontal, /^<div class="calendar-week-toggle" role="tablist" aria-label="[^"]+">/);
    assert.doesNotMatch(horizontal, /is-vertical|aria-orientation/, 'Parent Space keeps the horizontal toggle');
    assert.equal(horizontal.match(/role="tab"/g)?.length, 2, 'only this week and next week get a tab');
    assert.match(horizontal, /<button[^>]*role="tab" aria-selected="true"[^>]*class="is-active"[^>]*>This week<\/button>/);
    assert.match(horizontal, /<button[^>]*role="tab" aria-selected="false"[^>]*>Next week<\/button>/);

    const vertical = renderToStaticMarkup(createElement(CalendarWeekToggle, { weeks, active: 1, onChange() { /* test */ }, orientation: 'vertical' }));
    assert.match(vertical, /^<div class="calendar-week-toggle is-vertical" role="tablist" aria-label="[^"]+" aria-orientation="vertical">/);
    assert.equal(vertical.match(/role="tab"/g)?.length, 2);
    assert.match(vertical, /<button[^>]*role="tab" aria-selected="false"[^>]*>This week<\/button>/);
    assert.match(vertical, /<button[^>]*role="tab" aria-selected="true"[^>]*class="is-active"[^>]*>Next week<\/button>/);
    assert.equal(vertical.includes('<img'), false, 'the week group has no icons');
  });

  const page = await read('pages/CalendarPage.tsx');
  const rail = page.slice(page.indexOf('<div className="calendar-rail">'), page.indexOf('<div className="calendar-stage">'));
  const week = rail.indexOf('<CalendarWeekToggle');
  const views = rail.indexOf('<CalendarViewTabs');
  const action = rail.indexOf('<div className="calendar-toolbar-action" ref={setToolbarSlot} />');
  assert.ok(week > 0 && views > week && action > views, 'rail order: week group, views, then the bottom action slot');
  assert.match(rail, /<CalendarWeekToggle weeks=\{weeks\} active=\{weekIndex\} onChange=\{changeWeek\} orientation="vertical" \/>/);
  assert.match(rail, /<CalendarViewTabs active=\{view\} onChange=\{changeView\} orientation="vertical" \/>/);
  assert.equal(page.includes('calendar-toolbar">'), false, 'the toolbar row is gone');
  assert.equal(page.includes('className="calendar-week-toggle"'), false, 'the page no longer renders its own week markup');
  // Parent Space keeps its horizontal toggle and horizontal tabs.
  const parent = await read('pages/ParentCalendarPage.tsx');
  assert.match(parent, /<CalendarWeekToggle weeks=\{weeks\} active=\{weekIndex\} onChange=\{onWeekChange\} \/>/);
  assert.match(parent, /<CalendarViewTabs active=\{view\} onChange=\{onViewChange\} \/>/);
});

test('a weather strip sits above the chips at full width, and only when weather is ok', async () => {
  await withVite(async (server) => {
    const { StudyGrid } = await server.ssrLoadModule('/src/components/Calendar/StudyGrid.tsx');
    const render = (weather?: CalendarWeatherResponse, weatherLoading = false, weatherError = false) => renderToStaticMarkup(createElement(StudyGrid, {
      week: WEEK, today: TODAY, onEdit() { /* test */ }, cellRefs: { current: {} }, weather, weatherLoading, weatherError,
    }));

    const ok = render(WEATHER_OK);
    assert.equal(ok.match(/class="calendar-weather-strip"/g)?.length, 2, 'morning and afternoon strips for the forecast day');
    assert.equal(ok.includes('calendar-weather-badge'), false, 'the absolute badge is gone');
    assert.equal(ok.includes('has-weather'), false, 'the first chip no longer reserves a badge width');
    const cellStart = ok.indexOf('calendar-weather-strip');
    assert.ok(cellStart > 0 && cellStart < ok.indexOf('calendar-study-stack', cellStart), 'the strip is a block above the stack');
    assert.match(ok, /<span class="calendar-weather-strip" title="[^"]+" aria-hidden="true"><img /);
    assert.match(ok, /27°/);
    assert.match(ok, /\/calendar\/icons\/weather\/rain\.webp/);

    assert.equal(render().includes('class="calendar-weather-strip"'), false, 'no weather response: no strip');
    assert.equal(render(WEATHER_OK, true).includes('class="calendar-weather-strip"'), false, 'loading: no strip');
    assert.equal(render(WEATHER_OK, false, true).includes('class="calendar-weather-strip"'), false, 'error: no strip');
    const noLocation = render({ ...WEATHER_OK, status: 'no_location', days: [] });
    assert.equal(noLocation.includes('class="calendar-weather-strip"'), false, 'no location: no strip');
    assert.match(noLocation, /calendar-evening-message/, 'no location keeps its one-line hint');
  });
});

test('the Add event and My meals buttons are portaled into the toolbar slot, never rendered in the view', async () => {
  const events = await read('components/Calendar/EventsView.tsx');
  const meals = await read('components/Calendar/MealsView.tsx');
  const page = await read('pages/CalendarPage.tsx');

  // The view keeps no in-view toolbar row; the button goes to the slot CalendarPage owns.
  assert.doesNotMatch(events, /events-toolbar/);
  assert.match(events, /import \{ createPortal \} from 'react-dom';/);
  assert.match(events, /toolbarSlot\?: HTMLElement \| null;/);
  assert.match(events, /\{!readOnly && toolbarSlot && createPortal\(\s*<button ref=\{addRef\} type="button" className="calendar-toolbar-button" onClick=\{openCreate\}>/);
  // The "+" glyph is decorative, so the accessible name stays "Add event".
  assert.match(events, /<span className="calendar-toolbar-plus" aria-hidden="true">\+<\/span>\s*<span className="calendar-toolbar-label">\{uiText\(CALENDAR_EVENTS_COPY\.addEvent\)\}<\/span>/);

  assert.match(meals, /import \{ createPortal \} from 'react-dom';/);
  assert.match(meals, /toolbarSlot\?: HTMLElement \| null;/);
  assert.match(meals, /\{!readOnly && toolbarSlot && createPortal\(\s*<button type="button" className="calendar-toolbar-button" onClick=\{\(\) => setLibraryOpen\(true\)\}>/);
  // The Meals button shows a decorative settings gear above the label (named "My favorites").
  assert.match(meals, /<svg className="calendar-toolbar-gear" viewBox="0 0 24 24" aria-hidden="true" focusable="false">[\s\S]*?<\/svg>\s*<span className="calendar-toolbar-label">\{uiText\(CALENDAR_MEALS_COPY\.myMeals\)\}<\/span>/);
  assert.match(meals, /\{!readOnly && libraryOpen && \(\s*createPortal\(<MealLibraryDialog profileId=\{profileId\} library=\{data\.meal_library \?\? \[\]\} onChanged=\{onChanged\} onClose=\{\(\) => setLibraryOpen\(false\)\} \/>/);

  // CalendarPage owns the slot element (bottom of the rail) and passes it to both views; Study has no action.
  assert.match(page, /const \[toolbarSlot, setToolbarSlot\] = useState<HTMLElement \| null>\(null\);/);
  assert.match(page, /<div className="calendar-toolbar-action" ref=\{setToolbarSlot\} \/>/);
  assert.match(page, /toolbarSlot=\{toolbarSlot\} \/>\}/);
  assert.match(page, /orientation="vertical"/);
  const studyLine = page.split('\n').find((line) => line.includes('<StudyGrid')) ?? '';
  assert.ok(studyLine.length > 0, 'the Study view is rendered');
  assert.equal(studyLine.includes('toolbarSlot'), false, 'Study gets no action slot');
});

test('the adding buttons are 60 x 64px in CSS and their accessible names come from the label only', async () => {
  const calendar = await read('components/Calendar/Calendar.css');
  assert.match(calendar, /\.calendar-toolbar-button \{ display: flex; width: 60px; height: 64px;/);
  assert.match(calendar, /\.calendar-toolbar-button:focus-visible \{ outline: 3px solid #397367;/);
  const events = await read('components/Calendar/EventsView.tsx');
  const meals = await read('components/Calendar/MealsView.tsx');
  assert.match(events, /aria-hidden="true">\+</);
  assert.match(meals, /className="calendar-toolbar-gear" viewBox="0 0 24 24" aria-hidden="true"/);
  assert.doesNotMatch(meals, /calendar-toolbar-plus/);
});

test('read-only views render no toolbar action even when a slot is available', async () => {
  await withVite(async (server) => {
    const { EventsView } = await server.ssrLoadModule('/src/components/Calendar/EventsView.tsx');
    const { MealsView } = await server.ssrLoadModule('/src/components/Calendar/MealsView.tsx');
    const eventsMarkup = renderToStaticMarkup(createElement(EventsView, { profileId: 'kid-a', week: WEEK, data: WINDOW, today: TODAY, onChanged: async () => undefined, readOnly: true, toolbarSlot: null }));
    assert.equal(eventsMarkup.includes('calendar-toolbar-button'), false);
    assert.equal(eventsMarkup.includes('Add event'), false);
    const mealsMarkup = renderToStaticMarkup(createElement(MealsView, { profileId: 'kid-a', week: WEEK, data: WINDOW, today: TODAY, onChanged: async () => undefined, readOnly: true, toolbarSlot: null }));
    assert.equal(mealsMarkup.includes('calendar-toolbar-button'), false);
    assert.equal(mealsMarkup.includes('My favorites'), false);
  });
});
