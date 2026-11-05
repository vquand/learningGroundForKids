/** Pure weekly-whitelist evaluation. The server clock and the child's reported zone decide; nothing here reads the browser. */
export const SLOT_STEP_MINUTES = 30;
export const WEEK_MINUTES = 7 * 1440;
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface ScheduleSlot { weekday: number; start_minute: number; end_minute: number }
export interface LockState { locked: boolean; next_open_at: string | null; ends_at: string | null }

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Minute of the local week (Monday 00:00 = 0) for an instant in a zone. */
export function localWeekMinute(at: Date, timezone: string): number {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(at);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return (WEEKDAYS[get('weekday')] ?? 0) * 1440 + Number(get('hour')) * 60 + Number(get('minute'));
}

/**
 * The first instant strictly after `now` whose local week minute is `target` (or the first minute after it when a
 * spring-forward gap skips that wall-clock time). `target` may exceed one week to mean "next week".
 */
function instantAt(now: Date, current: number, target: number, timezone: string): Date {
  const wanted = target % WEEK_MINUTES;
  const base = now.getTime() - (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds());
  const guess = base + (target - current) * 60000;
  // Search a window around the naive guess (DST shifts are at most a couple of hours).
  let best: number | null = null;
  for (let offset = -180; offset <= 180; offset += 1) {
    const at = guess + offset * 60000;
    if (at <= now.getTime()) continue;
    const minute = localWeekMinute(new Date(at), timezone);
    if (minute === wanted) { best = at; break; }
    const after = (minute - wanted + WEEK_MINUTES) % WEEK_MINUTES;
    if (best === null && after > 0 && after < 180) {
      // Nonexistent wall-clock time: the first local minute after the gap (cyclic, so Monday 00:00 works).
      const before = (localWeekMinute(new Date(at - 60000), timezone) - wanted + WEEK_MINUTES) % WEEK_MINUTES;
      if (before >= 180) { best = at; break; }
    }
  }
  return new Date(best ?? guess);
}

export function evaluateLock(enabled: boolean, slots: readonly ScheduleSlot[], now: Date, timezone: string): LockState {
  if (!enabled) return { locked: false, next_open_at: null, ends_at: null };
  const current = localWeekMinute(now, timezone);
  const ranges = normalizeSlots(slots).map(slot => ({ start: (slot.weekday - 1) * 1440 + slot.start_minute, end: (slot.weekday - 1) * 1440 + slot.end_minute }));
  const open = ranges.find(range => range.start <= current && current < range.end);
  if (open) {
    // Slots that touch across midnight (or the Sunday-to-Monday wrap) are one continuous window.
    let end = open.end;
    for (let guard = 0; guard < ranges.length && end - open.start < WEEK_MINUTES; guard++) {
      const next = ranges.find(range => range.start === end % WEEK_MINUTES && range.start !== open.start);
      if (!next) break;
      end += next.end - next.start;
    }
    return { locked: false, next_open_at: null, ends_at: instantAt(now, current, end, timezone).toISOString() };
  }
  const starts = ranges.map(range => range.start > current ? range.start : range.start + WEEK_MINUTES);
  if (starts.length === 0) return { locked: true, next_open_at: null, ends_at: null };
  const next = Math.min(...starts);
  return { locked: true, next_open_at: instantAt(now, current, next, timezone).toISOString(), ends_at: null };
}

/** Sort and merge overlapping or touching slots per weekday. */
export function normalizeSlots(slots: readonly ScheduleSlot[]): ScheduleSlot[] {
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute);
  const merged: ScheduleSlot[] = [];
  for (const slot of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.weekday === slot.weekday && slot.start_minute <= last.end_minute) last.end_minute = Math.max(last.end_minute, slot.end_minute);
    else merged.push({ ...slot });
  }
  return merged;
}

/** Weekly and per-day (Mon..Sun) allowed minutes: the ceiling, not usage. */
export function slotTotals(slots: readonly ScheduleSlot[]): { weekly_minutes: number; daily_minutes: number[] } {
  const daily = [0, 0, 0, 0, 0, 0, 0];
  for (const slot of normalizeSlots(slots)) daily[slot.weekday - 1]! += slot.end_minute - slot.start_minute;
  return { weekly_minutes: daily.reduce((sum, value) => sum + value, 0), daily_minutes: daily };
}
