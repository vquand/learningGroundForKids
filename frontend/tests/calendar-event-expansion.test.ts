import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { CALENDAR_EVENTS_COPY } from '../src/components/Calendar/calendarEventsCopy.ts';
import {
  collapseDay, dayOverflowLabelTemplate, EXPANDED_CARD_VIEWPORT_GAP, expandDay, expandedCardHeight, expandedCardMaxHeight,
  shouldCollapseForEscape, shouldCollapseForPointer,
} from '../src/lib/calendarEventExpansion.ts';
import type { CalendarWeek, CalendarWindow } from '../src/types/calendar.ts';
import type { CalendarEventOccurrence } from '../src/types/calendarEvents.ts';

const TODAY = '2026-10-29';
const read = (name: string) => readFile(new URL(`../src/components/Calendar/${name}`, import.meta.url), 'utf8');

test('one card expanded at a time: expanding B replaces A, and collapsing leaves nothing expanded', () => {
  let expanded = expandDay('2026-10-30');
  assert.equal(expanded, '2026-10-30');
  expanded = expandDay('2026-10-31');
  assert.equal(expanded, '2026-10-31', 'expanding B collapses A');
  expanded = collapseDay();
  assert.equal(expanded, null);
});

test('Escape collapses only when a card is expanded', () => {
  assert.equal(shouldCollapseForEscape('2026-10-30'), true);
  assert.equal(shouldCollapseForEscape(null), false);
});

test('a press outside the expanded card collapses it; a press inside does not', () => {
  assert.equal(shouldCollapseForPointer('2026-10-30', false), true, 'outside tap collapses');
  assert.equal(shouldCollapseForPointer('2026-10-30', true), false, 'tap inside keeps the card open');
  assert.equal(shouldCollapseForPointer(null, false), false, 'nothing to collapse');
  assert.equal(shouldCollapseForPointer(null, true), false);
});

test('the expanded card may be as tall as the viewport bottom minus its top minus 12px', () => {
  assert.equal(EXPANDED_CARD_VIEWPORT_GAP, 12);
  assert.equal(expandedCardMaxHeight(768, 300), 456);
  assert.equal(expandedCardMaxHeight(820, 38), 770);
  assert.equal(expandedCardMaxHeight(768, 800), 0, 'a card starting below the viewport has no room');
  assert.equal(expandedCardMaxHeight(Number.NaN, 300), 0);
  assert.equal(expandedCardMaxHeight(768, 300, 0), 468, 'the gap is a parameter');
});

test('the expanded height is the content height, capped at the maximum, and never negative', () => {
  assert.equal(expandedCardHeight(320, 456), 320, 'a normal busy day is not capped');
  assert.equal(expandedCardHeight(900, 456), 456, 'fifty events scroll inside the capped card');
  assert.equal(expandedCardHeight(-4, 456), 0);
  assert.equal(expandedCardHeight(Number.NaN, 456), 0);
});

test('the "+N" accessible name uses the plural template for several events and the singular for one', () => {
  assert.equal(dayOverflowLabelTemplate(12), CALENDAR_EVENTS_COPY.showAllEvents);
  assert.equal(dayOverflowLabelTemplate(1), CALENDAR_EVENTS_COPY.showOneEvent);
  assert.equal(CALENDAR_EVENTS_COPY.showAllEvents, 'Show all {count} events on {date}');
  assert.equal(CALENDAR_EVENTS_COPY.showFewer, 'Show fewer');
});

test('EventsView no longer uses the day sheet, and the "+N" control expands the card in place', async () => {
  const view = await read('EventsView.tsx');
  assert.doesNotMatch(view, /EventDaySheet|calendarEventDaySheet|daySheet|events-sheet/);
  assert.match(view, /className="events-more"\s+aria-expanded=\{false\}/, 'the "+N" button carries aria-expanded');
  assert.match(view, /onClick=\{\(\) => onExpand\(day\.date\)\}/);
  assert.match(view, /className="events-collapse" aria-controls=\{cardId\}/, 'Show fewer controls the card it belongs to');
  assert.match(view, /const \[expandedDate, setExpandedDate\] = useState<ExpandedDay>\(null\);/);
  // The "+N" is not gated on readOnly: a parent can expand a card to read every event.
  const more = view.slice(view.indexOf('className="events-more"') - 200, view.indexOf('className="events-more"') + 200);
  assert.doesNotMatch(more, /readOnly/);
});

test('outside presses use the capture phase, Escape is handled, and the editor pauses both', async () => {
  const view = await read('EventsView.tsx');
  assert.match(view, /document\.addEventListener\('pointerdown', onPointerDown, true\);/);
  assert.match(view, /document\.removeEventListener\('pointerdown', onPointerDown, true\);/);
  assert.match(view, /if \(event\.key !== 'Escape' \|\| !shouldCollapseForEscape\(expandedDate\)\) return;/);
  assert.match(view, /\}, \[expandedDate, editor, arrangedDay\]\);/);
  // The press is never cancelled, so another control still receives it.
  assert.doesNotMatch(view, /preventDefault|stopPropagation/);
  // Escape returns focus to the day's "+N" button; "Show fewer" returns it too.
  assert.match(view, /focusRequest\.current = \{ date: expandedDate, target: 'more' \};/);
  assert.match(view, /focus\(\{ preventScroll: true \}\)/);
});

test('the expansion overlay keeps the slot and animates height and shadow only without reduced motion', async () => {
  const events = await read('Events.css');
  assert.match(events, /\.events-day-slot \{ position: relative;/);
  assert.match(events, /\.events-day\.is-expanded \{ position: absolute; z-index: 20;[^}]*max-height: var\(--events-expanded-max, 100dvh\);[^}]*overflow-y: auto;/);
  assert.match(events, /transition: height 180ms ease-out, box-shadow 180ms ease-out;/);
  assert.match(events, /@media \(prefers-reduced-motion: reduce\) \{\s*\.events-day, \.events-day\.is-expanded \{ transition: none; \}/);
  assert.doesNotMatch(events, /events-sheet/);
});

test('the Events day sheet copy keys are gone from the Events copy', async () => {
  const copy = await read('calendarEventsCopy.ts');
  assert.doesNotMatch(copy, /dayEvents|dayEventsList|dayEventPages|closeDayEvents|closeDay:/);
});

test('read-only Events renders each day card without any expanded control or dialog', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const { EventsView } = await server.ssrLoadModule('/src/components/Calendar/EventsView.tsx');
    const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    const week = { start: dates[0], days: dates.map((date, index) => ({ date, weekday: index + 1, is_past: date < TODAY, lists: {} })) } as unknown as CalendarWeek;
    const occurrence: CalendarEventOccurrence = {
      event_id: 'event-1', date: '2026-10-30', title: 'Hike', icon_key: 'hiking', repeat: 'none', repeat_ended_on: null, start_date: '2026-10-30', revision: 1,
    };
    const data = { today: TODAY, timezone: 'Asia/Ho_Chi_Minh', weeks: [week], templates: {}, meal_library: [], events: [occurrence], system_events: [] } as unknown as CalendarWindow;
    const html = renderToStaticMarkup(createElement(EventsView, { profileId: 'kid-a', week, data, today: TODAY, onChanged: async () => undefined, readOnly: true, toolbarSlot: null }));
    assert.equal(html.match(/class="events-day-slot"/g)?.length, 7, 'every day sits in a positioned slot');
    assert.equal(html.includes('is-expanded'), false, 'nothing starts expanded');
    assert.equal(html.includes('events-collapse'), false, 'Show fewer only exists on an expanded card');
    assert.equal(html.includes('role="dialog"'), false, 'there is no day sheet dialog');
    assert.match(html, /aria-label="Hike on 30 Oct"/, 'parent rows keep their read-only names');
    assert.equal(html.match(/<button[^>]*class="events-row/g), null, 'parent rows are not buttons');
  } finally {
    await server.close();
  }
});

test('focus returns to the "+N" button after a collapse even though it mounts a frame later', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/components/Calendar/EventsView.tsx', import.meta.url), 'utf8');
  // The collapsed card re-measures before it shows "+N", so the focus request retries for a few animation frames.
  assert.match(source, /requestAnimationFrame\(attempt\)/);
  assert.match(source, /cancelAnimationFrame\(handle\)/);
});
