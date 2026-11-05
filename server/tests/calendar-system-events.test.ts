import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SYSTEM_EVENT_KEYS } from '../src/calendar/catalog.js';
import { addDays } from '../src/calendar/dates.js';
import { lunarToSolar, solarToLunar } from '../src/calendar/lunar.js';
import { SYSTEM_EVENT_WINDOW_MAX_DAYS, systemEventDate, systemEventsInWindow } from '../src/calendar/system-events.js';

const seasonalThemeUrl = new URL('../../frontend/src/lib/seasonalTheme.ts', import.meta.url);

function readTetTable(): Map<number, string> {
  const source = readFileSync(seasonalThemeUrl, 'utf8');
  const block = /const TET_DATES[^=]*=\s*\{([\s\S]*?)\};/.exec(source);
  assert.ok(block, 'TET_DATES table must exist in seasonalTheme.ts');
  const table = new Map<number, string>();
  for (const match of block[1]!.matchAll(/(\d{4}):\s*"(\d{4}-\d{2}-\d{2})"/g)) table.set(Number(match[1]), match[2]!);
  return table;
}

test('Ho Ngoc Duc algorithm reproduces every Tet date in seasonalTheme.ts for 2026 to 2046', () => {
  const table = readTetTable();
  assert.equal(table.size, 21, 'expected 21 Tet entries');
  for (let year = 2026; year <= 2046; year++) {
    const expected = table.get(year);
    assert.ok(expected, `missing Tet entry for ${year}`);
    assert.equal(systemEventDate('tet', year), expected, `Tet ${year}`);
  }
});

test('Mid-Autumn dates match the reviewed 2026, 2027 and 2028 dates', () => {
  assert.equal(systemEventDate('mid_autumn', 2026), '2026-09-25');
  assert.equal(systemEventDate('mid_autumn', 2027), '2027-09-15');
  assert.equal(systemEventDate('mid_autumn', 2028), '2028-10-03');
});

test('Mid-Autumn is always lunar 15/8 (non-leap) inside its Gregorian year and within the expected range', () => {
  for (let year = 2026; year <= 2046; year++) {
    const date = systemEventDate('mid_autumn', year);
    assert.ok(date >= '2026-09-06' && date <= '2046-10-10', `${year} Mid-Autumn ${date} out of range`);
    assert.ok(date.startsWith(`${year}-`), `${year} Mid-Autumn stays in its year`);
    assert.deepEqual(solarToLunar(...splitCivil(date)), { day: 15, month: 8, year, leap: false });
  }
});

test('Tet is always lunar 1/1 inside its Gregorian year', () => {
  for (let year = 2026; year <= 2046; year++) {
    const date = systemEventDate('tet', year);
    assert.ok(date.startsWith(`${year}-`), `${year} Tet stays in its year`);
    assert.deepEqual(solarToLunar(...splitCivil(date)), { day: 1, month: 1, year, leap: false });
  }
});

test('known Tet and Mid-Autumn dates outside the table agree with published calendars', () => {
  assert.equal(systemEventDate('tet', 2023), '2023-01-22');
  assert.equal(systemEventDate('tet', 2024), '2024-02-10');
  assert.equal(systemEventDate('tet', 2025), '2025-01-29');
  assert.equal(systemEventDate('mid_autumn', 2025), '2025-10-06');
});

test('leap lunar month 6 of 2025 runs from 2025-07-25 to 2025-08-22', () => {
  assert.deepEqual(solarToLunar(2025, 7, 25), { day: 1, month: 6, year: 2025, leap: true });
  assert.deepEqual(solarToLunar(2025, 8, 22), { day: 29, month: 6, year: 2025, leap: true });
  assert.deepEqual(solarToLunar(2025, 8, 23), { day: 1, month: 7, year: 2025, leap: false });
  assert.equal(lunarToSolar({ day: 1, month: 6, year: 2025, leap: true }), '2025-07-25');
  assert.equal(lunarToSolar({ day: 1, month: 6, year: 2025, leap: false }), '2025-06-25');
  assert.throws(() => lunarToSolar({ day: 1, month: 5, year: 2025, leap: true }), /no leap lunar month 5/);
});

test('every lunar year 2026 to 2046 has at most one leap month, numbered like the month before it', () => {
  for (let year = 2026; year <= 2046; year++) {
    const leapMonths: number[] = [];
    let previous: { month: number; leap: boolean } | null = null;
    let leapAfterMonth: number | null = null;
    for (let day = new Date(Date.UTC(year - 1, 10, 1)); day.getUTCFullYear() <= year; day = new Date(day.getTime() + 86_400_000)) {
      const lunar = solarToLunar(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
      if (lunar.year !== year) continue;
      if (lunar.day === 1) {
        if (lunar.leap) {
          leapMonths.push(lunar.month);
          leapAfterMonth = previous?.month ?? null;
        }
        previous = { month: lunar.month, leap: lunar.leap };
      }
    }
    assert.ok(leapMonths.length <= 1, `${year} has ${leapMonths.length} leap months`);
    if (leapMonths.length === 1) assert.equal(leapMonths[0], leapAfterMonth, `${year} leap month repeats its predecessor`);
  }
});

test('lunar day 30 exists only when the following day stays in the same lunar month', () => {
  for (let month = 1; month <= 12; month++) {
    const day29 = lunarToSolar({ day: 29, month, year: 2026, leap: false });
    const next = solarToLunar(...splitCivil(addDays(day29, 1)));
    if (next.day === 30) {
      assert.equal(lunarToSolar({ day: 30, month, year: 2026, leap: false }), addDays(day29, 1), `month ${month}`);
    } else {
      assert.equal(next.day, 1, `month ${month} day 29 is followed by the next month`);
      assert.throws(() => lunarToSolar({ day: 30, month, year: 2026, leap: false }), /does not exist/, `month ${month}`);
    }
  }
});

test('lunar to solar and back round-trips every day of two years', () => {
  for (let date = '2025-01-01'; date <= '2026-12-31'; date = addDays(date, 1)) {
    const lunar = solarToLunar(...splitCivil(date));
    assert.equal(lunarToSolar(lunar), date, date);
  }
});

test('day-start edge cases near new moons keep the lunar day between 1 and 30', () => {
  // Regression: an index estimate near a new moon used to produce lunar day 0.
  assert.deepEqual(solarToLunar(2054, 5, 8), { day: 1, month: 4, year: 2054, leap: false });
  const may7 = solarToLunar(2054, 5, 7);
  assert.ok(may7.day === 29 || may7.day === 30, `2054-05-07 day ${may7.day}`);
  assert.equal(lunarToSolar(may7), '2054-05-07');
  assert.deepEqual(solarToLunar(2062, 4, 10), { day: 1, month: 3, year: 2062, leap: false });
  const april9 = solarToLunar(2062, 4, 9);
  assert.ok(april9.day === 29 || april9.day === 30, `2062-04-09 day ${april9.day}`);
  assert.equal(lunarToSolar(april9), '2062-04-09');
});

test('lunar conversion rejects invalid lunar input and out-of-range years', () => {
  assert.throws(() => lunarToSolar({ day: 0, month: 1, year: 2026, leap: false }), /day/);
  assert.throws(() => lunarToSolar({ day: 31, month: 1, year: 2026, leap: false }), /day/);
  assert.throws(() => lunarToSolar({ day: 1, month: 13, year: 2026, leap: false }), /month/);
  assert.throws(() => lunarToSolar({ day: 1.5, month: 1, year: 2026, leap: false }), /day/);
  assert.throws(() => lunarToSolar({ day: 1, month: 1, year: 1899, leap: false }), /year/);
  assert.throws(() => solarToLunar(2200, 1, 1), /year/);
  assert.throws(() => systemEventDate('tet', 2200), /year/);
});

test('fixed-date system events use their reviewed civil dates in every year', () => {
  const fixed: Record<string, string> = {
    halloween: '10-31',
    christmas: '12-25',
    national_day: '09-02',
    womens_day_oct20: '10-20',
    womens_day_mar8: '03-08',
    teachers_day: '11-20',
    childrens_day: '06-01',
  };
  for (const year of [2026, 2028, 2032]) {
    for (const [key, monthDay] of Object.entries(fixed)) {
      assert.equal(systemEventDate(key as (typeof SYSTEM_EVENT_KEYS)[number], year), `${year}-${monthDay}`, key);
    }
  }
});

test('a full 2026 window lists all nine system events sorted by date', () => {
  assert.deepEqual(systemEventsInWindow('2026-01-01', '2026-12-31'), [
    { key: 'tet', date: '2026-02-17' },
    { key: 'womens_day_mar8', date: '2026-03-08' },
    { key: 'childrens_day', date: '2026-06-01' },
    { key: 'national_day', date: '2026-09-02' },
    { key: 'mid_autumn', date: '2026-09-25' },
    { key: 'womens_day_oct20', date: '2026-10-20' },
    { key: 'halloween', date: '2026-10-31' },
    { key: 'teachers_day', date: '2026-11-20' },
    { key: 'christmas', date: '2026-12-25' },
  ]);
});

test('window boundaries are inclusive on both ends', () => {
  assert.deepEqual(systemEventsInWindow('2026-09-25', '2026-09-25'), [{ key: 'mid_autumn', date: '2026-09-25' }]);
  assert.deepEqual(systemEventsInWindow('2026-09-26', '2026-10-19'), []);
  assert.deepEqual(systemEventsInWindow('2026-02-17', '2026-02-17'), [{ key: 'tet', date: '2026-02-17' }]);
  assert.deepEqual(systemEventsInWindow('2026-02-18', '2026-02-18'), []);
  assert.deepEqual(systemEventsInWindow('2026-10-31', '2026-10-31'), [{ key: 'halloween', date: '2026-10-31' }]);
});

test('year-boundary windows include only events inside them', () => {
  assert.deepEqual(systemEventsInWindow('2026-12-28', '2027-01-10'), []);
  assert.deepEqual(systemEventsInWindow('2026-12-20', '2027-01-10'), [{ key: 'christmas', date: '2026-12-25' }]);
  assert.deepEqual(systemEventsInWindow('2026-12-28', '2027-02-28'), [{ key: 'tet', date: '2027-02-06' }]);
  assert.deepEqual(systemEventsInWindow('2027-02-06', '2027-02-06'), [{ key: 'tet', date: '2027-02-06' }]);
});

test('a leap-year window keeps Mid-Autumn 2025 and its sort order', () => {
  assert.deepEqual(systemEventsInWindow('2025-09-01', '2025-10-31'), [
    { key: 'national_day', date: '2025-09-02' },
    { key: 'mid_autumn', date: '2025-10-06' },
    { key: 'womens_day_oct20', date: '2025-10-20' },
    { key: 'halloween', date: '2025-10-31' },
  ]);
});

test('windows are sorted by date and then by key', () => {
  const events = systemEventsInWindow('2026-01-01', '2027-01-31');
  assert.equal(events.length, 9, 'only the nine 2026 events fall in this window');
  for (let index = 1; index < events.length; index++) {
    const previous = events[index - 1]!;
    const current = events[index]!;
    assert.ok(previous.date < current.date || (previous.date === current.date && previous.key < current.key), `${previous.key} ${previous.date} before ${current.key} ${current.date}`);
  }
});

test('window validation rejects malformed, rolled-over and reversed dates', () => {
  for (const value of ['2026-02-30', '2026-1-01', 'bad', '2026-02-29', '0000-01-01']) {
    assert.throws(() => systemEventsInWindow(value, '2026-12-31'), /startDate/, value);
    assert.throws(() => systemEventsInWindow('2026-01-01', value), /endDate/, value);
  }
  assert.throws(() => systemEventsInWindow('2026-03-02', '2026-03-01'), /before startDate/);
});

test('window length is limited to 400 inclusive days', () => {
  assert.equal(SYSTEM_EVENT_WINDOW_MAX_DAYS, 400);
  const start = '2026-01-01';
  assert.doesNotThrow(() => systemEventsInWindow(start, addDays(start, 399)));
  assert.throws(() => systemEventsInWindow(start, addDays(start, 400)), /at most 400 days/);
});

test('windows outside the calibrated years are rejected', () => {
  assert.throws(() => systemEventsInWindow('1899-12-01', '1900-01-10'), /year/);
  assert.throws(() => systemEventsInWindow('2199-12-01', '2200-01-10'), /year/);
});

function splitCivil(date: string): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

test('lunar 15th of the 7th month (Vu Lan) matches published dates, which depend on exact new-moon timing', () => {
  // Independent ground truth (Vietnamese calendar, UTC+7). In 2026 the new moon is Aug 12 17:37 UTC = Aug 13 00:37 local.
  const expected: [number, string][] = [[2023, '2023-08-30'], [2024, '2024-08-18'], [2025, '2025-09-06'], [2026, '2026-08-27']];
  for (const [year, date] of expected) assert.equal(lunarToSolar({ year, month: 7, day: 15, leap: false }), date, `Vu Lan ${year}`);
  assert.equal(lunarToSolar({ year: 2026, month: 7, day: 1, leap: false }), '2026-08-13');
});
