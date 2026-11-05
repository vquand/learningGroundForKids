import assert from 'node:assert/strict';
import test from 'node:test';
import { viewSlideDirection, weekSlideDirection,
  addStudyKey, buildCalendarListWrite, CALENDAR_CHIP_GAP, CALENDAR_CHIP_HEIGHT, dragRowOffset, editorScopeForList, isCalendarWeekend, moveStudyItem,
  moveStudyItemTo, nextVietnamMidnightDelay, removeStudyItem, targetIndexFromPointer, visibleChipCount,
} from '../src/lib/calendarHelpers.ts';
import type { CalendarDay, CalendarTemplateList, StudyItem } from '../src/types/calendar.ts';

const day: CalendarDay = {
  date: '2026-10-29', weekday: 4, is_past: false,
  lists: {
    study_morning: { id: 'date-list', items: [{ subject: 'math' }], revision: 7, source: 'override' },
    study_afternoon: { id: null, items: [], revision: 0, source: 'empty' },
    study_extra: { id: null, items: [], revision: 0, source: 'empty' },
    meal_breakfast: { id: null, items: [], revision: 0, source: 'empty' }, meal_lunch: { id: null, items: [], revision: 0, source: 'empty' },
    meal_snack: { id: null, items: [], revision: 0, source: 'empty' }, meal_dinner: { id: null, items: [], revision: 0, source: 'empty' }, medicine: { id: null, items: [], revision: 0, source: 'empty' },
  },
};
const template: CalendarTemplateList = { id: 'template-list', items: [{ subject: 'english' }], revision: 11, source: 'template' };

test('calendar write payloads use template and override revision rules', () => {
  const context = { day, area: 'study_morning' as const, template };
  assert.deepEqual(buildCalendarListWrite(context, 'template', [{ subject: 'science' }]), { scope: 'template', weekday: 4, area: 'study_morning', items: [{ subject: 'science' }], expected_revision: 11 });
  assert.deepEqual(buildCalendarListWrite(context, 'date', [{ subject: 'science' }]), { scope: 'date', date: '2026-10-29', area: 'study_morning', items: [{ subject: 'science' }], expected_revision: 7 });
  assert.equal(editorScopeForList(day.lists.study_morning), 'date');
  assert.equal(editorScopeForList(day.lists.study_afternoon), 'template');
});

test('study editor caps, rejects duplicate palette entries, and reorders safely', () => {
  const firstEight: StudyItem[] = (['math', 'english', 'science', 'art', 'music', 'coding', 'reading', 'library'] as const).map((subject): StudyItem => ({ subject }));
  assert.equal(addStudyKey(firstEight, 'vietnamese').length, 8);
  assert.deepEqual(addStudyKey(firstEight.slice(0, 2), 'math'), firstEight.slice(0, 2));
  assert.deepEqual(moveStudyItem(firstEight.slice(0, 3), 1, -1).map((item) => item.subject), ['english', 'math', 'science']);
  assert.deepEqual(moveStudyItem(firstEight.slice(0, 3), 1, 1).map((item) => item.subject), ['math', 'science', 'english']);
  assert.deepEqual(removeStudyItem(firstEight, 2).map((item) => item.subject), ['math', 'english', 'art', 'music', 'coding', 'reading', 'library']);
});

test('next Vietnam midnight is computed from the server civil date', () => {
  // Vietnam day 2026-10-29 ends at 2026-10-29T17:00Z.
  assert.equal(nextVietnamMidnightDelay('2026-10-29', new Date('2026-10-29T10:00:00.000Z')), 7 * 60 * 60 * 1000);
  assert.equal(nextVietnamMidnightDelay('2026-10-29', new Date('2026-10-29T16:59:00.000Z')), 60 * 1000);
  // A stale server date (already past midnight) refetches immediately instead of waiting a day.
  assert.equal(nextVietnamMidnightDelay('2026-10-29', new Date('2026-10-29T17:00:00.000Z')), 0);
  assert.equal(nextVietnamMidnightDelay('2026-10-29', new Date('2026-10-29T18:00:00.000Z')), 0);
});

test('visible study chips fit the cell height and reserve room for the +N badge only when needed', () => {
  const height = CALENDAR_CHIP_HEIGHT;
  const gap = CALENDAR_CHIP_GAP;
  const fill = (count: number) => count * height + (count - 1) * gap;
  // All fit: eight chips need exactly 238 px (28px chips, 2px gaps); a taller cell shows all of them with no badge.
  assert.equal(visibleChipCount(fill(8), 8, height, gap), 8);
  assert.equal(visibleChipCount(1000, 8, height, gap), 8);
  assert.equal(visibleChipCount(fill(3), 3, height, gap), 3);
  // One pixel short: six chips plus "+2" (seven slots, six chips and the badge, need 208 px).
  assert.equal(visibleChipCount(fill(8) - 1, 8, height, gap), 6);
  assert.equal(visibleChipCount(fill(3) - 1, 3, height, gap), 1);
  // None fit: a badge alone fits in one chip height; anything shorter shows nothing.
  assert.equal(visibleChipCount(height, 8, height, gap), 0);
  assert.equal(visibleChipCount(height - 1, 8, height, gap), 0);
  assert.equal(visibleChipCount(5, 8, height, gap), 0);
  assert.equal(visibleChipCount(0, 8, height, gap), 0);
  // Zero and invalid totals or geometry never show chips.
  assert.equal(visibleChipCount(1000, 0, height, gap), 0);
  assert.equal(visibleChipCount(Number.NaN, 8, height, gap), 0);
  assert.equal(visibleChipCount(1000, 8, 0, gap), 0);
});

test('dragging reorders study rows without changing length, members, or the cap', () => {
  const items = (['math', 'english', 'science'] as const).map((subject): StudyItem => ({ subject }));
  const subjects = (list: readonly StudyItem[]) => list.map((item) => item.subject);
  assert.deepEqual(subjects(moveStudyItemTo(items, 0, 2)), ['english', 'science', 'math']);
  assert.deepEqual(subjects(moveStudyItemTo(items, 2, 0)), ['science', 'math', 'english']);
  assert.deepEqual(subjects(moveStudyItemTo(items, 1, 1)), ['math', 'english', 'science']);
  // Out-of-range targets clamp to the list ends; invalid sources leave the list unchanged.
  assert.deepEqual(subjects(moveStudyItemTo(items, 0, 9)), ['english', 'science', 'math']);
  assert.deepEqual(subjects(moveStudyItemTo(items, 2, -4)), ['science', 'math', 'english']);
  assert.deepEqual(subjects(moveStudyItemTo(items, 5, 0)), ['math', 'english', 'science']);
  assert.deepEqual(subjects(moveStudyItemTo(items, 1.5, 0)), ['math', 'english', 'science']);
  const eight: StudyItem[] = (['math', 'english', 'science', 'art', 'music', 'coding', 'reading', 'library'] as const).map((subject): StudyItem => ({ subject }));
  const moved = moveStudyItemTo(eight, 6, 1);
  assert.equal(moved.length, 8);
  assert.equal(new Set(moved.map((item) => item.subject)).size, 8);
  assert.deepEqual(moveStudyItemTo([], 0, 0), []);
  // The input is never mutated.
  assert.deepEqual(subjects(items), ['math', 'english', 'science']);
});

test('drop index comes from the dragged row centre against the other rows midpoints', () => {
  const others = [10, 60, 110];
  assert.equal(targetIndexFromPointer(others, 5), 0);
  assert.equal(targetIndexFromPointer(others, 35), 1);
  assert.equal(targetIndexFromPointer(others, 90), 2);
  assert.equal(targetIndexFromPointer(others, 200), 3);
  assert.equal(targetIndexFromPointer([], 50), 0);
  assert.equal(targetIndexFromPointer(others, Number.NaN), 0);
});

test('rows between the dragged row and its drop slot shift by one step', () => {
  // Drag row 0 down to slot 2: rows 1 and 2 move up, the dragged row follows the pointer.
  assert.equal(dragRowOffset(0, 0, 2, 70, 46), 70);
  assert.equal(dragRowOffset(1, 0, 2, 70, 46), -46);
  assert.equal(dragRowOffset(2, 0, 2, 70, 46), -46);
  assert.equal(dragRowOffset(3, 0, 2, 70, 46), 0);
  // Drag row 3 up to slot 1: rows 1 and 2 move down.
  assert.equal(dragRowOffset(1, 3, 1, -20, 46), 46);
  assert.equal(dragRowOffset(2, 3, 1, -20, 46), 46);
  assert.equal(dragRowOffset(0, 3, 1, -20, 46), 0);
  assert.equal(dragRowOffset(3, 3, 1, -20, 46), -20);
  // Dropping in place shifts nothing.
  assert.equal(dragRowOffset(1, 1, 1, 0, 46), 0);
});

test('weekend styling keys off the calendar weekday number', () => {
  assert.equal(isCalendarWeekend(6), true);
  assert.equal(isCalendarWeekend(7), true);
  for (const weekday of [1, 2, 3, 4, 5]) assert.equal(isCalendarWeekend(weekday), false);
});

test('the table slides in from the side the week change moves towards', () => {
  assert.equal(weekSlideDirection(0, 1), 'next');
  assert.equal(weekSlideDirection(1, 0), 'prev');
  assert.equal(weekSlideDirection(1, 1), null);
});

test('switching views slides vertically: down the rail from below, up the rail from above', () => {
  assert.equal(viewSlideDirection('study', 'meals'), 'down');
  assert.equal(viewSlideDirection('meals', 'events'), 'down');
  assert.equal(viewSlideDirection('study', 'events'), 'down');
  assert.equal(viewSlideDirection('events', 'meals'), 'up');
  assert.equal(viewSlideDirection('meals', 'study'), 'up');
  assert.equal(viewSlideDirection('meals', 'meals'), null);
  assert.equal(viewSlideDirection('meals', 'unknown'), null);
});
