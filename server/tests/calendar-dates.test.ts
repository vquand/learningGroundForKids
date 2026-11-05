import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDates, isCivilDate } from '../src/calendar/dates.js';
test('Vietnam midnight uses a single instant and Monday weeks across years', () => {
  const before = calendarDates(new Date('2026-10-25T16:59:00Z'));
  const after = calendarDates(new Date('2026-10-25T17:00:00Z'));
  assert.equal(before.today, '2026-10-25'); assert.equal(before.start, '2026-10-19');
  assert.equal(after.today, '2026-10-26'); assert.equal(after.end, '2026-11-08');
  assert.equal(before.weeks[0]!.days[6]!.weekday, 7);
  assert.equal(before.weeks[0]!.days[0]!.is_past, true);
  assert.equal(before.editable('2026-10-24'), false);
  assert.equal(before.editable('2026-11-01'), true);
  assert.equal(before.editable('2026-11-02'), false);
  const year = calendarDates(new Date('2027-01-01T00:00:00Z'));
  assert.equal(year.start, '2026-12-28'); assert.equal(year.end, '2027-01-10');
});
test('civil dates reject rollover and accept leap dates', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-1-01', '0000-01-01', 'bad']) assert.equal(isCivilDate(date), false, date);
  assert.equal(isCivilDate('2028-02-29'), true);
});
