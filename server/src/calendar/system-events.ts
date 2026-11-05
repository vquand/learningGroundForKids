import { SYSTEM_EVENT_KEYS, type SystemEventKey } from './catalog.js';
import { isCivilDate } from './dates.js';
import { LUNAR_MAX_YEAR, LUNAR_MIN_YEAR, lunarToSolar } from './lunar.js';

/** Largest inclusive window, in civil days, accepted by systemEventsInWindow. */
export const SYSTEM_EVENT_WINDOW_MAX_DAYS = 400;

type FixedSystemEventKey = Exclude<SystemEventKey, 'tet' | 'mid_autumn'>;

/** Solar-date system events. Lunar events are computed from lunar.ts. */
const FIXED_EVENT_DATES: Readonly<Record<FixedSystemEventKey, { readonly month: number; readonly day: number }>> = {
  halloween: { month: 10, day: 31 },
  christmas: { month: 12, day: 25 },
  national_day: { month: 9, day: 2 },
  womens_day_oct20: { month: 10, day: 20 },
  womens_day_mar8: { month: 3, day: 8 },
  teachers_day: { month: 11, day: 20 },
  childrens_day: { month: 6, day: 1 },
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function assertCalibratedYear(year: number): void {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) {
    throw new Error(`System event year must be an integer from ${LUNAR_MIN_YEAR} to ${LUNAR_MAX_YEAR}`);
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Civil date 'YYYY-MM-DD' of a system event in the given Gregorian year. */
export function systemEventDate(key: SystemEventKey, year: number): string {
  assertCalibratedYear(year);
  if (key === 'tet' || key === 'mid_autumn') {
    // Lunar 1/1 (Tết) and lunar 8/15 (Trung Thu) always fall inside their own Gregorian year.
    const lunar = key === 'tet' ? { day: 1, month: 1 } : { day: 15, month: 8 };
    const date = lunarToSolar({ ...lunar, year, leap: false });
    if (Number(date.slice(0, 4)) !== year) throw new Error(`${key} for ${year} fell outside its Gregorian year`);
    return date;
  }
  const fixed = FIXED_EVENT_DATES[key];
  return `${pad(year, 4)}-${pad(fixed.month, 2)}-${pad(fixed.day, 2)}`;
}

/**
 * System events whose civil dates fall inside [startDate, endDate], both inclusive.
 * Sorted by date, then by key. Dates are Asia/Ho_Chi_Minh civil dates.
 */
export function systemEventsInWindow(startDate: string, endDate: string): { key: SystemEventKey; date: string }[] {
  if (!isCivilDate(startDate)) throw new Error('startDate must be a valid YYYY-MM-DD civil date');
  if (!isCivilDate(endDate)) throw new Error('endDate must be a valid YYYY-MM-DD civil date');
  if (endDate < startDate) throw new Error('endDate must not be before startDate');
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_IN_MILLISECONDS + 1;
  if (days > SYSTEM_EVENT_WINDOW_MAX_DAYS) {
    throw new Error(`Window must be at most ${SYSTEM_EVENT_WINDOW_MAX_DAYS} days`);
  }

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  assertCalibratedYear(startYear);
  assertCalibratedYear(endYear);

  const events: { key: SystemEventKey; date: string }[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (const key of SYSTEM_EVENT_KEYS) {
      const date = systemEventDate(key, year);
      if (date >= startDate && date <= endDate) events.push({ key, date });
    }
  }
  return events.sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? -1 : 1;
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
  });
}
