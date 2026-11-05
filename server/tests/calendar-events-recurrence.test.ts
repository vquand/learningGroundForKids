import test from 'node:test';
import assert from 'node:assert/strict';
import { isEventActive, occurrencesInWindow, type RecurringEvent } from '../src/calendar/recurrence.js';

const event = (start_date: string, repeat: RecurringEvent['repeat'], repeat_ended_on: string | null = null): RecurringEvent => ({ start_date, repeat, repeat_ended_on });

// Independent reference: walk every civil day with UTC Date arithmetic and apply the rule literally.
function referenceOccurrences(e: RecurringEvent, windowStart: string, windowEnd: string): string[] {
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  const at = (date: string) => Date.parse(`${date}T00:00:00Z`);
  const day = 86_400_000;
  const anchor = new Date(at(e.start_date));
  const from = Math.max(at(windowStart), at(e.start_date));
  const to = Math.min(at(windowEnd), e.repeat_ended_on === null ? Infinity : at(e.repeat_ended_on));
  const out: string[] = [];
  for (let time = from; time <= to; time += day) {
    const current = new Date(time);
    const matches = e.repeat === 'none' ? time === at(e.start_date)
      : e.repeat === 'weekly' ? (time - at(e.start_date)) % (7 * day) === 0
        : e.repeat === 'monthly' ? current.getUTCDate() === anchor.getUTCDate()
          : current.getUTCMonth() === anchor.getUTCMonth() && current.getUTCDate() === anchor.getUTCDate();
    if (matches) out.push(iso(time));
  }
  return out;
}

test('weekly events repeat on the start weekday only', () => {
  // 2026-10-29 is a Thursday.
  assert.deepEqual(occurrencesInWindow(event('2026-10-29', 'weekly'), '2026-10-26', '2026-11-08'), ['2026-10-29', '2026-11-05']);
  assert.deepEqual(occurrencesInWindow(event('2026-10-29', 'weekly'), '2026-10-30', '2026-11-04'), []);
});

test('monthly events skip months without the start day-of-month', () => {
  assert.deepEqual(occurrencesInWindow(event('2026-01-31', 'monthly'), '2026-01-01', '2026-06-30'), ['2026-01-31', '2026-03-31', '2026-05-31']);
  assert.deepEqual(occurrencesInWindow(event('2026-01-30', 'monthly'), '2026-02-01', '2026-03-31'), ['2026-03-30']);
  assert.deepEqual(occurrencesInWindow(event('2026-01-29', 'monthly'), '2026-02-01', '2026-02-28'), []);
});

test('monthly events cross years without invented days', () => {
  assert.deepEqual(occurrencesInWindow(event('2026-12-31', 'monthly'), '2026-12-01', '2027-02-28'), ['2026-12-31', '2027-01-31']);
});

test('yearly events keep month and day, and Feb 29 only in leap years', () => {
  const leapStart = event('2024-02-29', 'yearly');
  assert.deepEqual(occurrencesInWindow(leapStart, '2025-01-01', '2029-12-31'), ['2028-02-29']);
  assert.deepEqual(occurrencesInWindow(leapStart, '2024-02-01', '2024-03-05'), ['2024-02-29']);
  assert.deepEqual(occurrencesInWindow(leapStart, '2025-02-01', '2025-03-05'), []);
  assert.deepEqual(occurrencesInWindow(event('2020-10-31', 'yearly'), '2026-01-01', '2026-12-31'), ['2026-10-31']);
});

test('repeat_ended_on is inclusive and nothing follows it', () => {
  assert.deepEqual(occurrencesInWindow(event('2026-10-01', 'weekly', '2026-10-15'), '2026-10-01', '2026-11-30'), ['2026-10-01', '2026-10-08', '2026-10-15']);
  assert.deepEqual(occurrencesInWindow(event('2026-10-01', 'weekly', '2026-10-14'), '2026-10-01', '2026-11-30'), ['2026-10-01', '2026-10-08']);
  assert.deepEqual(occurrencesInWindow(event('2026-10-01', 'weekly', '2026-09-30'), '2026-10-01', '2026-11-30'), []);
  assert.deepEqual(occurrencesInWindow(event('2026-10-01', 'monthly', '2026-10-31'), '2026-10-01', '2026-12-31'), ['2026-10-01']);
});

test('one-off events occur only on their start date inside the window', () => {
  const oneOff = event('2026-10-29', 'none');
  assert.deepEqual(occurrencesInWindow(oneOff, '2026-10-26', '2026-11-08'), ['2026-10-29']);
  assert.deepEqual(occurrencesInWindow(oneOff, '2026-10-30', '2026-11-08'), []);
  assert.deepEqual(occurrencesInWindow(oneOff, '2026-10-01', '2026-10-28'), []);
});

test('nothing occurs before start_date, including future starts', () => {
  assert.deepEqual(occurrencesInWindow(event('2026-12-03', 'weekly'), '2026-10-26', '2026-12-06'), ['2026-12-03']);
  assert.deepEqual(occurrencesInWindow(event('2026-12-03', 'monthly'), '2026-10-26', '2026-12-06'), ['2026-12-03']);
  assert.deepEqual(occurrencesInWindow(event('2027-03-08', 'yearly'), '2026-10-26', '2026-12-06'), []);
});

test('window boundaries are inclusive', () => {
  const weekly = event('2026-10-01', 'weekly');
  assert.deepEqual(occurrencesInWindow(weekly, '2026-10-08', '2026-10-15'), ['2026-10-08', '2026-10-15']);
  assert.deepEqual(occurrencesInWindow(weekly, '2026-10-09', '2026-10-14'), []);
  assert.deepEqual(occurrencesInWindow(weekly, '2026-10-15', '2026-10-08'), []);
});

test('weekly events cross the year boundary', () => {
  assert.deepEqual(occurrencesInWindow(event('2026-12-28', 'weekly'), '2026-12-28', '2027-01-10'), ['2026-12-28', '2027-01-04']);
});

test('windows far from start_date are computed directly, including 30 years back', () => {
  const started = performance.now();
  for (let index = 0; index < 2_000; index += 1) {
    const window = occurrencesInWindow(event('1996-01-15', 'weekly'), '2026-10-26', '2026-11-08');
    assert.equal(window.length, 2);
    occurrencesInWindow(event('1996-10-29', 'monthly'), '2026-10-26', '2026-11-08');
    occurrencesInWindow(event('1996-02-29', 'yearly'), '2026-10-26', '2026-11-08');
  }
  assert.ok(performance.now() - started < 2_000, 'recurrence expansion must stay fast for distant start dates');
  assert.deepEqual(occurrencesInWindow(event('1996-10-29', 'monthly'), '2026-10-26', '2026-11-08'), ['2026-10-29']);
  assert.deepEqual(occurrencesInWindow(event('1996-03-10', 'yearly'), '2026-01-01', '2026-12-31'), ['2026-03-10']);
  assert.deepEqual(occurrencesInWindow(event('1996-02-29', 'yearly'), '1996-01-01', '2000-12-31'), ['1996-02-29', '2000-02-29']);
});

test('matches a day-by-day reference over seeded random events and windows', () => {
  let seed = 20261029;
  const next = (limit: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % limit; };
  const day = 86_400_000;
  const base = Date.parse('2024-01-01T00:00:00Z');
  const dateAt = (offset: number) => new Date(base + offset * day).toISOString().slice(0, 10);
  const shift = (date: string, offset: number) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * day).toISOString().slice(0, 10);
  const repeats = ['none', 'weekly', 'monthly', 'yearly'] as const;
  let nonEmpty = 0;
  for (let index = 0; index < 600; index += 1) {
    const start = dateAt(next(1200));
    const repeat = repeats[next(repeats.length)]!;
    const ended = next(3) === 0 ? null : shift(start, next(900));
    const e = event(start, repeat, ended);
    // Windows straddle the start, the end and month/leap boundaries; some windows are inverted on purpose.
    const windowStart = shift(start, next(900) - 400);
    const windowEnd = shift(windowStart, next(400) - 20);
    const expected = referenceOccurrences(e, windowStart, windowEnd);
    if (expected.length > 0) nonEmpty += 1;
    assert.deepEqual(occurrencesInWindow(e, windowStart, windowEnd), expected, JSON.stringify({ e, windowStart, windowEnd }));
  }
  assert.ok(nonEmpty > 100, `the random cases must exercise real occurrences (got ${nonEmpty})`);
});

test('invalid civil dates are rejected instead of guessed', () => {
  assert.throws(() => occurrencesInWindow(event('2026-02-30', 'weekly'), '2026-02-01', '2026-03-01'), TypeError);
  assert.throws(() => occurrencesInWindow(event('2026-10-01', 'weekly'), '2026-10-1', '2026-10-31'), TypeError);
});

test('active events: one-offs until their date, repeating series until the inclusive end date', () => {
  const today = '2026-10-29';
  assert.equal(isEventActive(event('2026-10-29', 'none'), today), true);
  assert.equal(isEventActive(event('2026-10-28', 'none'), today), false);
  assert.equal(isEventActive(event('2026-11-30', 'none'), today), true);
  assert.equal(isEventActive(event('2026-01-05', 'weekly'), today), true);
  assert.equal(isEventActive(event('2026-01-05', 'weekly', '2026-10-29'), today), true);
  assert.equal(isEventActive(event('2026-01-05', 'weekly', '2026-10-28'), today), false);
  assert.equal(isEventActive(event('2026-12-05', 'monthly'), today), true);
});
