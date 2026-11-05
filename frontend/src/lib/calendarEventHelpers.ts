import { CALENDAR_EVENTS_COPY } from '../components/Calendar/calendarEventsCopy.ts';
import { isEventIconKey } from './calendarEventCatalog.ts';
import { EVENT_REPEAT_VALUES, type CalendarEventInput, type CalendarEventRepeat } from '../types/calendarEvents.ts';

export const EVENT_TITLE_MAX_LENGTH = 40;
/** Start dates for new events run from today through this many days ahead (server rule). */
export const EVENT_DAY_WINDOW_DAYS = 365;
/** Event rows are 44px touch targets. The Events view and its CSS variables share these numbers. */
export const EVENT_ROW_HEIGHT = 44;
export const EVENT_ROW_GAP = 4;

export interface EventRepeatOption {
  value: CalendarEventRepeat;
  /** English source for the segmented control. */
  label: string;
  /** English source for the repeat badge, or null when the event does not repeat. */
  badge: string | null;
}

export const EVENT_REPEAT_OPTIONS: readonly EventRepeatOption[] = [
  { value: 'none', label: CALENDAR_EVENTS_COPY.repeatNone, badge: null },
  { value: 'weekly', label: CALENDAR_EVENTS_COPY.repeatWeekly, badge: CALENDAR_EVENTS_COPY.repeatsWeekly },
  { value: 'monthly', label: CALENDAR_EVENTS_COPY.repeatMonthly, badge: CALENDAR_EVENTS_COPY.repeatsMonthly },
  { value: 'yearly', label: CALENDAR_EVENTS_COPY.repeatYearly, badge: CALENDAR_EVENTS_COPY.repeatsYearly },
];

export function repeatOption(repeat: CalendarEventRepeat): EventRepeatOption {
  return EVENT_REPEAT_OPTIONS.find((option) => option.value === repeat) ?? EVENT_REPEAT_OPTIONS[0]!;
}

export function isEventRepeat(value: unknown): value is CalendarEventRepeat {
  return typeof value === 'string' && (EVENT_REPEAT_VALUES as readonly string[]).includes(value);
}

/** Removes control characters, normalises to NFC (what the server counts) and trims. */
export function normalizeEventTitle(value: string): string {
  return value.replace(/\p{Cc}/gu, '').normalize('NFC').trim();
}

export type EventTitleProblem = 'required' | 'too_long';

export function eventTitleProblem(value: string): EventTitleProblem | null {
  const title = normalizeEventTitle(value);
  if (!title) return 'required';
  // UTF-16 length matches the server's string max check, so the browser never sends a name the server rejects.
  if (title.length > EVENT_TITLE_MAX_LENGTH) return 'too_long';
  return null;
}

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in YYYY-MM-DD form (no timezone involved). */
export function isCivilDate(value: string): boolean {
  const match = CIVIL_DATE.exec(value);
  if (!match) return false;
  return addCivilDays(value, 0) === value;
}

/** Adds whole days to a civil date using UTC arithmetic, so no local timezone can shift the result. */
export function addCivilDays(date: string, days: number): string {
  const match = CIVIL_DATE.exec(date);
  if (!match) return date;
  const [, year = '0', month = '1', day = '1'] = match;
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day) + days);
  const next = new Date(time);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function eventDayWindowEnd(today: string): string {
  return addCivilDays(today, EVENT_DAY_WINDOW_DAYS);
}

/** The first editable day of the selected week (today or later), or its last day when every day has passed. */
export function defaultEventDate(weekDates: readonly string[], today: string): string {
  const upcoming = weekDates.find((date) => date >= today);
  return upcoming ?? weekDates[weekDates.length - 1] ?? today;
}

/** A started event (start before today) keeps its date; only its title and icon may change. */
export function isLockedStart(startDate: string | undefined, today: string): boolean {
  return startDate !== undefined && startDate < today;
}

export interface EventDraft {
  title: string;
  icon_key: string;
  start_date: string;
  repeat: CalendarEventRepeat;
}

export type EventDraftProblem =
  | 'title_required'
  | 'title_too_long'
  | 'icon_unknown'
  | 'repeat_unknown'
  | 'day_invalid'
  | 'day_out_of_range';

export type EventDraftResult =
  | { ok: true; value: CalendarEventInput }
  | { ok: false; problem: EventDraftProblem };

export interface EventDraftContext {
  today: string;
  /** Existing event being edited. New events have no start date yet. */
  editing: boolean;
  /** Existing event that started before today: the start date must stay as stored. */
  lockedStart: boolean;
}

/** Client-side mirror of the server rules, used before sending. The server still validates every write. */
export function buildEventPayload(draft: EventDraft, context: EventDraftContext): EventDraftResult {
  const titleProblem = eventTitleProblem(draft.title);
  if (titleProblem === 'required') return { ok: false, problem: 'title_required' };
  if (titleProblem === 'too_long') return { ok: false, problem: 'title_too_long' };
  if (!isEventIconKey(draft.icon_key)) return { ok: false, problem: 'icon_unknown' };
  if (!isEventRepeat(draft.repeat)) return { ok: false, problem: 'repeat_unknown' };
  if (!isCivilDate(draft.start_date)) return { ok: false, problem: 'day_invalid' };
  if (!context.lockedStart) {
    const weekday = new Date(`${context.today}T12:00:00Z`).getUTCDay() || 7;
    const firstDay = addCivilDays(context.today, 1 - weekday);
    if (draft.start_date < firstDay || draft.start_date > eventDayWindowEnd(context.today) || (draft.start_date < context.today && draft.repeat !== 'none')) {
      return { ok: false, problem: 'day_out_of_range' };
    }
  }
  return {
    ok: true,
    value: {
      title: normalizeEventTitle(draft.title),
      icon_key: draft.icon_key,
      start_date: draft.start_date,
      repeat: draft.repeat,
    },
  };
}

/**
 * How many event rows fit in `availableHeight`. When every row fits, all show. Otherwise the last visible slot
 * is given to the "+N" row, so the count is one less than the slots that fit.
 */
export function visibleEventRowCount(availableHeight: number, total: number, rowHeight = EVENT_ROW_HEIGHT, gap = EVENT_ROW_GAP): number {
  if (!(total > 0) || !(availableHeight > 0) || !(rowHeight > 0) || !(gap >= 0)) return 0;
  if (total * rowHeight + (total - 1) * gap <= availableHeight) return total;
  const slots = Math.floor((availableHeight + gap) / (rowHeight + gap));
  return Math.max(0, Math.min(total - 1, slots - 1));
}

/** The revision a refreshed event list reports for one event, or null when the event is no longer listed. */
export function refreshedEventRevision(events: readonly { event_id: string; revision: number }[], eventId: string): number | null {
  return events.find((event) => event.event_id === eventId)?.revision ?? null;
}
