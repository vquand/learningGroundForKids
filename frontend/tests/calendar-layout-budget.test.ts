import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CALENDAR_CHIP_GAP, CALENDAR_CHIP_HEIGHT, CALENDAR_DAY_HEADING_HEIGHT, CALENDAR_EVENING_ROW_HEIGHT, CALENDAR_WEATHER_STRIP_GAP, CALENDAR_WEATHER_STRIP_HEIGHT, visibleChipCount } from '../src/lib/calendarHelpers.ts';
import { MEAL_TILE_GAP, MEAL_TILE_SIZE, tileColumns, visibleTileCount } from '../src/lib/calendarMealHelpers.ts';
import { EVENT_ROW_GAP, EVENT_ROW_HEIGHT, visibleEventRowCount } from '../src/lib/calendarEventHelpers.ts';

const read = (name: string) => readFile(new URL(`../src/components/Calendar/${name}`, import.meta.url), 'utf8');

// Mirrors Calendar.css on the kid page. Header = 10 (top) + 52 (nav row) + 1 (border): one row. There is no toolbar row,
// so the stage is the whole main height under the header.
const HEADER = 10 + 52 + 1;
const PAGE_BOTTOM = 12;
// Left rail is 64px wide, full height; the table starts after it plus a 6px gap.
const RAIL = 64;
const RAIL_GAP = 6;
// Rail groups. Week group: two 52px buttons, 8px gap, 2px padding. View group: three 72px buttons, 8px gap, 2px padding.
const WEEK_BUTTON = 52;
const WEEK_GROUP = 2 * WEEK_BUTTON + 1 * 8 + 2 * 2;
const VIEW_BUTTON = 72;
const VIEW_GROUP = 3 * VIEW_BUTTON + 2 * 8 + 2 * 2;
// Adding action at the bottom of the rail: 60px wide, 64px tall.
const ADD_BUTTON = 64;
const ADD_BUTTON_WIDTH = 60;
// Where the table area started before the toolbar row was removed: header 63, stage pad 8 + pad 6, toolbar 44 (= 121).
const OLD_TABLE_TOP = 121;
const GRID_GAP = 6;
const LABEL_MIN = 84;
const HEADING = CALENDAR_DAY_HEADING_HEIGHT;
const EVENING = CALENDAR_EVENING_ROW_HEIGHT;
// Study cell: 2px border + 6px padding each side. Meal cell: 2px border + 5px vertical, 4px horizontal padding.
const STUDY_CELL_CHROME = 2 * 2 + 2 * 6;
const MEAL_CELL_CHROME_V = 2 * 2 + 2 * 5;
const MEAL_CELL_CHROME_H = 2 * 2 + 2 * 4;
// Weather strip above the chip stack costs its height plus its gap, at full cell width.
const WEATHER_STRIP = CALENDAR_WEATHER_STRIP_HEIGHT + CALENDAR_WEATHER_STRIP_GAP;
const CHIP_COUNT_8 = 8 * CALENDAR_CHIP_HEIGHT + 7 * CALENDAR_CHIP_GAP;
// Study chips must fit with weather, with at least this much spare height in each Study cell.
const EXTRA = 140;

const clampPx = (min: number, preferred: number, max: number) => Math.min(max, Math.max(min, preferred));

/** Grid padding from the shared clamp: 6px up to 768px and 820px tall, growing to 32px. */
function pad(viewportHeight: number): number {
  return clampPx(6, (viewportHeight - 700) * 0.04, 32);
}

/** Side inset from the shared clamp(16px, 1.6vw, 32px). */
function inset(viewportWidth: number): number {
  return clampPx(16, viewportWidth * 0.016, 32);
}

/** Free space is shared equally, and a track that reaches its cap is frozen there (the browser's maximize-tracks step). */
function fillTracks(free: number, caps: readonly number[]): number[] {
  const sizes = caps.map(() => 0);
  let open = caps.map((_, index) => index);
  let left = free;
  while (open.length > 0 && left > 0) {
    const share = left / open.length;
    const frozen = open.filter((index) => (caps[index] ?? 0) - (sizes[index] ?? 0) <= share);
    if (frozen.length === 0) {
      for (const index of open) sizes[index] = (sizes[index] ?? 0) + share;
      break;
    }
    for (const index of frozen) {
      left -= (caps[index] ?? 0) - (sizes[index] ?? 0);
      sizes[index] = caps[index] ?? 0;
    }
    open = open.filter((index) => !frozen.includes(index));
  }
  return sizes;
}

// These mirror the CSS clamp(min, dvh, max) caps in Calendar.css.
const studyCap = (h: number) => clampPx(330, 0.34 * h, 470);
const mealCap = (h: number) => clampPx(160, 0.135 * h, 210);
const medicineCap = (h: number) => clampPx(96, 0.075 * h, 120);
const eventCap = (h: number) => clampPx(480, 0.56 * h, 760);

/** Table width: the main row minus both insets, the rail and its gap. */
function tableWidth(viewportWidth: number): number {
  return viewportWidth - 2 * inset(viewportWidth) - RAIL - RAIL_GAP;
}

/** Study and Meals day column: label column minimum 84px (.72fr share), then seven equal day columns. */
function studyDayWidth(viewportWidth: number): number {
  const free = tableWidth(viewportWidth) - 7 * GRID_GAP;
  const fr = free / (0.72 + 7);
  const label = Math.max(LABEL_MIN, 0.72 * fr);
  return (free - label) / 7;
}

/** Events has no label column: seven day columns across the table width. */
function eventsDayWidth(viewportWidth: number): number {
  return (tableWidth(viewportWidth) - 6 * GRID_GAP) / 7;
}

/** Main height under the header: the stage has no toolbar row above the table. */
function mainHeight(viewportHeight: number): number {
  return viewportHeight - HEADER - PAGE_BOTTOM;
}

/**
 * Height of the table content (padding removed). The grid wrap takes its natural height (padding, heading, capped
 * rows and gaps) and shrinks only when the main area is short, so the table starts directly under the header.
 */
function tableHeight(viewportHeight: number, natural: number): number {
  return Math.min(mainHeight(viewportHeight), natural) - 2 * pad(viewportHeight);
}

/** Top of the table content, measured from the top of the page. */
function tableContentTop(viewportHeight: number): number {
  return HEADER + pad(viewportHeight);
}

/**
 * Rail middle group top, measured from the top of the rail. The rail has symmetric padding (pad top and bottom) and
 * 1fr / auto / 1fr rows, so the view group sits exactly in the middle of the rail.
 */
function railViewTop(viewportHeight: number): number {
  return pad(viewportHeight) + (mainHeight(viewportHeight) - 2 * pad(viewportHeight) - VIEW_GROUP) / 2;
}

function studyRows(viewportHeight: number): number[] {
  const cap = studyCap(viewportHeight);
  const natural = 2 * pad(viewportHeight) + HEADING + 2 * cap + EXTRA + EVENING + 4 * GRID_GAP;
  return fillTracks(tableHeight(viewportHeight, natural) - HEADING - EVENING - 4 * GRID_GAP, [cap, cap, EXTRA]);
}

/** Chip stack inside one Study cell with weather present: the cell minus its chrome, minus the weather strip. */
function studyStack(viewportHeight: number): number {
  return (studyRows(viewportHeight)[0] ?? 0) - STUDY_CELL_CHROME - WEATHER_STRIP;
}

function mealRows(viewportHeight: number): number[] {
  const meal = mealCap(viewportHeight);
  const medicine = medicineCap(viewportHeight);
  const natural = 2 * pad(viewportHeight) + HEADING + 4 * meal + medicine + 5 * GRID_GAP;
  return fillTracks(tableHeight(viewportHeight, natural) - HEADING - 5 * GRID_GAP, [meal, meal, meal, meal, medicine]);
}

/** Tile stack height inside one Meals cell: four meal rows and the medicine row, five gaps. */
function mealStack(viewportHeight: number): number {
  return (mealRows(viewportHeight)[0] ?? 0) - MEAL_CELL_CHROME_V;
}

/** Inner width of a Meals cell (the tile stack width). */
function mealStackWidth(viewportWidth: number): number {
  return studyDayWidth(viewportWidth) - MEAL_CELL_CHROME_H;
}

/** Event card height: the events table area minus the heading row and gap, capped at the card maximum. */
function eventCard(viewportHeight: number): number {
  const natural = 2 * pad(viewportHeight) + HEADING + GRID_GAP + eventCap(viewportHeight);
  return tableHeight(viewportHeight, natural) - HEADING - GRID_GAP;
}

test('the header is one row of 63px, and the toolbar row is gone so the table gains 58px', async () => {
  const calendar = await read('Calendar.css');
  assert.equal(HEADER, 63);
  // The table area used to start at 121px (63 header + 8 stage pad + 44 toolbar + the grid's own pad); it now starts at 63px.
  // Measured from the grid's content, the table's top moves from 127px to 69px, so both gain the same 58px.
  assert.equal(OLD_TABLE_TOP, 121);
  assert.equal(OLD_TABLE_TOP - HEADER, 58, 'the table area gains the old toolbar row and its 14px stage padding');
  assert.equal(tableContentTop(768), HEADER + 6);
  assert.match(calendar, /--calendar-header-top: 10px;/);
  assert.match(calendar, /--calendar-nav-height: 52px;/);
  assert.match(calendar, /--calendar-header-height: calc\(var\(--calendar-header-top\) \+ var\(--calendar-nav-height\) \+ 1px\);/);
  assert.doesNotMatch(calendar, /--calendar-toolbar-height/);
  assert.doesNotMatch(calendar, /--calendar-row-gap/);
  assert.doesNotMatch(calendar, /\.calendar-toolbar \{/, 'no toolbar row');
  assert.doesNotMatch(calendar, /\.calendar-toolbar \.calendar-week-toggle/, 'the week toggle is not in a toolbar');
  assert.doesNotMatch(calendar, /calendar-stage[^}]*padding-top/, 'the stage has no top padding of its own');
});

test('the shared CSS carries the padding clamp, row caps, rail, inset and table tracks', async () => {
  const calendar = await read('Calendar.css');
  const meals = await read('Meals.css');
  const events = await read('Events.css');
  const clamp = 'clamp(6px, calc((100dvh - 700px) * 0.04), 32px)';
  assert.match(calendar, new RegExp(`\\.calendar-page, \\.parent-calendar \\{[^}]*--calendar-grid-pad-top: ${escape(clamp)}`));
  assert.match(calendar, new RegExp(`--calendar-grid-pad-bottom: ${escape(clamp)}`));
  assert.match(calendar, /--calendar-study-row-max: clamp\(330px, 34dvh, 470px\)/);
  assert.match(calendar, /--calendar-meal-row-max: clamp\(160px, 13\.5dvh, 210px\)/);
  assert.match(calendar, /--calendar-meal-medicine-row-max: clamp\(96px, 7\.5dvh, 120px\)/);
  assert.match(calendar, /--calendar-event-card-max: clamp\(480px, 56dvh, 760px\)/);
  assert.match(calendar, /--calendar-inset: clamp\(16px, 1\.6vw, 32px\);/);
  assert.match(calendar, /--calendar-rail-width: 64px;/);
  assert.match(calendar, /--calendar-rail-gap: 6px;/);
  assert.match(calendar, /--calendar-grid-gap: 6px;/);
  assert.match(calendar, /--calendar-grid-columns: minmax\(84px, \.72fr\) repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(calendar, /--calendar-grid-columns-events: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(calendar, /\.parent-calendar \{ --calendar-grid-columns: minmax\(100px, \.72fr\) repeat\(7, minmax\(0, 1fr\)\); \}/);
  assert.match(calendar, /\.calendar-study-grid \{[^}]*align-content: center;/);
  assert.match(calendar, /\.calendar-study-grid \{[^}]*grid-template-columns: var\(--calendar-grid-columns\);/);
  assert.match(calendar, /\.calendar-study-grid \{[^}]*minmax\(0, var\(--calendar-study-row-max, 330px\)\)/);
  assert.match(meals, /\.meal-grid \{[^}]*align-content: center;/);
  assert.match(meals, /\.meal-grid \{[^}]*grid-template-columns: var\(--calendar-grid-columns\);/);
  assert.match(meals, /repeat\(4, minmax\(0, var\(--calendar-meal-row-max, 160px\)\)\) minmax\(0, var\(--calendar-meal-medicine-row-max, 96px\)\)/);
  assert.match(meals, /\.meal-cell \{[^}]*padding: 5px 4px;/);
  assert.match(events, /\.events-week \{[^}]*grid-template-columns: var\(--calendar-grid-columns-events\);[^}]*minmax\(0, var\(--calendar-event-card-max, 480px\)\)/);
});

test('the left rail is full height with three groups: week at the top, views centred, adding action at the bottom', async () => {
  const calendar = await read('Calendar.css');
  // One grid: 1fr, auto, 1fr rows (minmax(0, 1fr) so the top group can never push the middle off centre), symmetric padding.
  assert.match(calendar, /\.calendar-rail \{ display: grid;[^}]*grid-template-rows: minmax\(0, 1fr\) auto minmax\(0, 1fr\);[^}]*padding: var\(--calendar-grid-pad-top\) 0 var\(--calendar-grid-pad-bottom\);/);
  assert.match(calendar, /\.calendar-rail \{[^}]*width: var\(--calendar-rail-width\);/);
  // Top group: the week toggle, pinned to the top of the rail.
  assert.match(calendar, /\.calendar-week-toggle\.is-vertical \{ grid-row: 1; align-self: start;/);
  // Middle group: the view tabs, centred by the auto track.
  assert.match(calendar, /\.calendar-view-tabs\.is-vertical \{ grid-row: 2; align-self: center;/);
  // Bottom group: the adding action slot, pinned to the bottom.
  assert.match(calendar, /\.calendar-toolbar-action \{ display: flex; min-width: 0; grid-row: 3; align-self: end;/);
  // The old toolbar column placement is gone.
  assert.doesNotMatch(calendar, /grid-column: 5 \/ 9|grid-column: 2 \/ 6|--calendar-grid-columns-events\); \}/);
});

test('the rail groups are sized for 44px+ targets and the week group mirrors the view tabs', async () => {
  const calendar = await read('Calendar.css');
  assert.match(calendar, /\.calendar-week-toggle\.is-vertical button \{ display: flex; width: 100%; height: 52px; min-height: 52px;/);
  assert.match(calendar, /\.calendar-week-toggle\.is-vertical button\.is-active \{ background: var\(--calendar-accent, #17324d\); \}/);
  assert.match(calendar, /\.calendar-week-toggle\.is-vertical \{[^}]*gap: 8px;[^}]*border-radius: 16px;[^}]*box-shadow: inset 0 0 0 1px #d6dfd4;/);
  assert.match(calendar, /\.calendar-view-tabs\.is-vertical \{[^}]*gap: 8px;[^}]*border-radius: 16px;/);
  assert.match(calendar, /\.calendar-view-tabs\.is-vertical button \{ display: flex; width: 100%; height: 72px; min-height: 72px;/);
  assert.match(calendar, /\.calendar-toolbar-button \{ display: flex; width: 60px; height: 64px; min-height: 64px; flex-direction: column;/);
  assert.match(calendar, /\.calendar-toolbar-button \{[^}]*background: #397367;/, 'primary green fill');
  assert.match(calendar, /\.calendar-toolbar-plus \{ font-size: 20px;/);
  assert.match(calendar, /\.calendar-toolbar-label \{[^}]*-webkit-line-clamp: 2;/);
  // Two-line labels at 12-13px bold, and the rail is 64px wide, so 60px buttons leave a 2px inset each side.
  assert.equal(ADD_BUTTON_WIDTH + 2 * 2, RAIL, 'add button sits inside the 64px rail');
  assert.equal(WEEK_GROUP, 116, 'week group: two 52px buttons, an 8px gap and 2px padding each side');
  assert.equal(VIEW_GROUP, 236, 'view group: three 72px buttons, two 8px gaps and 2px padding each side');
});

test('the rail groups stack inside the rail, with the views exactly centred and nothing overlapping', () => {
  for (const height of [768, 820, 1288]) {
    const main = mainHeight(height);
    const top = pad(height);
    const viewTop = railViewTop(height);
    const viewBottom = viewTop + VIEW_GROUP;
    const addTop = main - pad(height) - ADD_BUTTON;
    // The view group centre is the rail centre (the rail is main height with symmetric padding).
    assert.ok(Math.abs(viewTop + VIEW_GROUP / 2 - main / 2) < 1e-9, `${height} tall: views exactly centred`);
    assert.ok(top + WEEK_GROUP <= viewTop, `${height} tall: week group sits above the views`);
    assert.ok(viewBottom <= addTop, `${height} tall: the adding action sits below the views`);
    assert.equal(addTop + ADD_BUTTON, main - pad(height), `${height} tall: the action ends at the table's bottom padding`);
  }
  // The middle group is centred at 768 and 820 tall too, which is the shared 6px padding case.
  assert.equal(railViewTop(768), 228.5);
  assert.equal(railViewTop(820), 6 + (745 - 12 - VIEW_GROUP) / 2);
});

test('the rail is a 64px vertical group and the table starts after it at every tested width', () => {
  for (const width of [1024, 1180, 1366, 1495]) {
    const table = tableWidth(width);
    assert.ok(table > 0);
    assert.equal(table, width - 2 * inset(width) - 64 - 6, `${width}px table width`);
  }
  // 1024 wide: insets 16.38px each, rail 64px, gap 6px, so the table is 921.2px. The label column sits at its
  // 84px minimum, and each Study day column is 113.6px (Events: 126.5px with seven columns and no label).
  assert.ok(Math.abs(tableWidth(1024) - 921.23) < 0.1);
  assert.ok(Math.abs(studyDayWidth(1024) - 113.6) < 0.1, `study day ${studyDayWidth(1024)}`);
  assert.ok(Math.abs(eventsDayWidth(1024) - 126.5) < 0.1, `events day ${eventsDayWidth(1024)}`);
});

test('at 1024 and 1180 wide a Meals cell has three tile columns, so eight tiles fit the 768 and 820 tall stacks', () => {
  for (const width of [1024, 1180]) {
    for (const height of [768, 820]) {
      const inner = mealStackWidth(width);
      const stack = mealStack(height);
      assert.ok(tileColumns(inner) >= 3, `${width}px wide: inner ${inner}px must hold three 32px tiles`);
      assert.equal(visibleTileCount(inner, stack, 8, MEAL_TILE_SIZE, MEAL_TILE_GAP), 8, `${width}x${height}: stack ${stack}px`);
    }
  }
  assert.ok(mealStack(768) >= 100, 'the 768px stack reaches the 3-row threshold');
});

test('at 1366 wide a Meals cell has four tile columns', () => {
  assert.ok(tileColumns(mealStackWidth(1366)) >= 4);
});

test('compact Study rows reserve Extra and weather while truthfully showing overflow', () => {
  assert.equal(CALENDAR_CHIP_HEIGHT, 28);
  assert.equal(CHIP_COUNT_8, 238);
  assert.equal(WEATHER_STRIP, 24);
  for (const height of [768, 820]) {
    const stack = studyStack(height);
    const visible = visibleChipCount(stack, 8, CALENDAR_CHIP_HEIGHT, CALENDAR_CHIP_GAP);
    assert.ok(visible >= 4 && visible < 8, `${height}px: subjects plus an overflow chip fit above Extra`);
    assert.ok((visible + 1) * (CALENDAR_CHIP_HEIGHT + CALENDAR_CHIP_GAP) - CALENDAR_CHIP_GAP <= stack);
    assert.equal(studyRows(height)[2], EXTRA);
  }
});

test('Study budgets include the compact Extra row at 768 and 820 tall', () => {
  assert.equal(studyRows(768)[0], 221.5);
  assert.equal(studyRows(768)[1], 221.5);
  assert.equal(studyStack(768), 181.5);
  assert.equal(studyRows(820)[0], 247.5);
  assert.equal(studyStack(820), 207.5);
});

test('at 1288 tall, study rows grow to the responsive cap (about 438px) and the group stays centred', () => {
  assert.equal(studyRows(1288)[0], studyCap(1288));
  assert.ok(studyCap(1288) > 330 && studyCap(1288) <= 470);
  // Short screens keep the old fixed cap as their minimum.
  assert.equal(studyCap(768), 330);
  assert.equal(studyCap(820), 330);
});

test('an Events day card stays at its cap and still shows nine rows at 768 tall', () => {
  assert.equal(eventCard(768), eventCap(768));
  assert.equal(eventCard(1288), eventCap(1288));
  const inner = eventCard(768) - 2 - 12;
  assert.equal(visibleEventRowCount(inner, 9, EVENT_ROW_HEIGHT, EVENT_ROW_GAP), 9);
});

test('the day heading and evening row are 38px and 36px, and the header is 63px', () => {
  assert.equal(CALENDAR_DAY_HEADING_HEIGHT, 38);
  assert.equal(CALENDAR_EVENING_ROW_HEIGHT, 36);
  assert.equal(HEADER, 63);
});

test('Events renders seven heading containers and no date inside the cards', async () => {
  const view = await read('EventsView.tsx');
  assert.match(view, /<div className=\{`calendar-day-heading/);
  assert.doesNotMatch(view, /events-day-heading/);
  const events = await read('Events.css');
  assert.doesNotMatch(events, /\.events-day-heading/);
});

test('an empty Events day shows a calendar icon with a screen-reader "Empty day" label and keeps the date in the card name', async () => {
  const view = await read('EventsView.tsx');
  assert.match(view, /empty && \(\s*<p className="events-empty">[\s\S]*events-empty-calendar[\s\S]*<span className="events-empty-label">\{uiText\(CALENDAR_EVENTS_COPY\.emptyDay\)\}<\/span>/);
  assert.match(view, /\$\{empty \? `, \$\{uiText\(CALENDAR_EVENTS_COPY\.emptyDay\)\}` : ''\}/);
  const copy = await read('calendarEventsCopy.ts');
  assert.match(copy, /emptyDay: 'Empty day'/);
  const vi = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  assert.equal(vi['Empty day'], 'Ngày trống');
});

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
