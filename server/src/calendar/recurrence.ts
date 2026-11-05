import { isCivilDate } from './dates.js';

/** Kid event repeat kinds. `none` is a one-off on start_date. */
export const EVENT_REPEATS = ['none', 'weekly', 'monthly', 'yearly'] as const;
export type EventRepeat = typeof EVENT_REPEATS[number];

/** Recurrence inputs. Dates are Asia/Ho_Chi_Minh civil dates (YYYY-MM-DD); no timezone math happens here. */
export interface RecurringEvent {
  start_date: string;
  repeat: EventRepeat;
  repeat_ended_on: string | null;
}

// Proleptic Gregorian civil arithmetic on integer day numbers (days since 1970-01-01).
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function civilFromDays(days: number): { year: number; month: number; day: number } {
  const shifted = days + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

function parseCivil(date: string): number {
  if (!isCivilDate(date)) throw new TypeError('Expected a valid YYYY-MM-DD civil date');
  return daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
}

function formatCivil(days: number): string {
  const { year, month, day } = civilFromDays(days);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Occurrence dates of one event inside the inclusive civil window [windowStart, windowEnd], ascending.
 * - Anchored to start_date: nothing before start_date.
 * - repeat_ended_on is inclusive: nothing after it.
 * - weekly: same weekday. monthly: same day of month; months without that day are skipped
 *   (Jan 31 -> Mar 31). yearly: same month and day; Feb 29 only in leap years.
 * Occurrences are computed directly for the window (never iterated from start_date).
 */
export function occurrencesInWindow(event: RecurringEvent, windowStart: string, windowEnd: string): string[] {
  const start = parseCivil(event.start_date);
  const ws = parseCivil(windowStart);
  const from = Math.max(ws, start);
  const to = event.repeat_ended_on === null ? parseCivil(windowEnd) : Math.min(parseCivil(windowEnd), parseCivil(event.repeat_ended_on));
  if (from > to) return [];
  const anchor = civilFromDays(start);
  const out: string[] = [];
  switch (event.repeat) {
    case 'none':
      if (start >= ws && start <= to) out.push(formatCivil(start));
      return out;
    case 'weekly':
      for (let day = start + 7 * Math.ceil((from - start) / 7); day <= to; day += 7) out.push(formatCivil(day));
      return out;
    case 'monthly': {
      const first = civilFromDays(from), last = civilFromDays(to);
      let year = first.year, month = first.month;
      while (year < last.year || (year === last.year && month <= last.month)) {
        if (anchor.day <= daysInMonth(year, month)) {
          const day = daysFromCivil(year, month, anchor.day);
          if (day >= from && day <= to) out.push(formatCivil(day));
        }
        month += 1;
        if (month > 12) { month = 1; year += 1; }
      }
      return out;
    }
    case 'yearly': {
      const first = civilFromDays(from), last = civilFromDays(to);
      for (let year = first.year; year <= last.year; year += 1) {
        if (anchor.month === 2 && anchor.day === 29 && !isLeapYear(year)) continue;
        const day = daysFromCivil(year, anchor.month, anchor.day);
        if (day >= from && day <= to) out.push(formatCivil(day));
      }
      return out;
    }
    default: {
      const unreachable: never = event.repeat;
      throw new TypeError(`Unknown repeat ${String(unreachable)}`);
    }
  }
}

/**
 * Active events count toward the per-profile cap. A one-off is active while start_date >= today.
 * A repeating event is active while it has no end date or its end date (inclusive) is today or later.
 */
export function isEventActive(event: RecurringEvent, today: string): boolean {
  if (event.repeat === 'none') return parseCivil(event.start_date) >= parseCivil(today);
  return event.repeat_ended_on === null || parseCivil(event.repeat_ended_on) >= parseCivil(today);
}
