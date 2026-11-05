export const CALENDAR_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export function isCivilDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addDays(date: string, amount: number): string {
  const instant = new Date(`${date}T00:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + amount);
  return instant.toISOString().slice(0, 10);
}
export function weekday(date: string): Weekday {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() || 7) as Weekday;
}
export function todayInVietnam(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CALENDAR_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function mondayStart(date: string): string { return addDays(date, 1 - weekday(date)); }
export function calendarDates(now: Date) {
  const today = todayInVietnam(now), start = mondayStart(today), end = addDays(start, 13);
  const weeks = [0, 7].map(offset => ({ start: addDays(start, offset), days: Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, offset + index);
    return { date, weekday: weekday(date), is_past: date < today };
  }) }));
  return { today, start, end, weeks, editable: (date: string) => isCivilDate(date) && date >= today && date <= end };
}
