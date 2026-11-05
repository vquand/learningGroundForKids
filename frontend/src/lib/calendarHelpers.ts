import { weatherIconEntry, type WeatherIconKey } from './calendarCatalog.ts';
import type { UiLanguage } from './uiLanguage';
import type {
  CalendarArea, CalendarDay, CalendarList, CalendarListWrite, CalendarScope, CalendarTemplateList, CalendarWeatherPeriod, CalendarWeatherResponse,
  CalendarWeekdayKey, CalendarWindow, StudyArea, StudyItem,
} from '../types/calendar';
import type { StudyKey } from './calendarCatalog';

export const STUDY_LIST_CAP = 8;

/** Replace only this draft entry; keep its icon, lineage, order and all other additions. */
export function renameStudyDraftItem(items: readonly StudyItem[], index: number, name: string): StudyItem[] {
  return items.map((item, position) => position === index ? { ...item, name } : item);
}

export interface CalendarEditorContext {
  day: CalendarDay;
  area: StudyArea;
  template: CalendarTemplateList;
}

export function addStudyKey(items: readonly StudyItem[], key: StudyKey, cap = STUDY_LIST_CAP): StudyItem[] {
  return addStudy(items, { subject: key }, cap);
}

/** Plain palette choices match customized languages; explicit entries match their language. */
export function hasStudy(items: readonly StudyItem[], entry: StudyItem): boolean {
  return items.some(item => item.subject === entry.subject && item.name === entry.name
    && (entry.teaching_language === undefined || item.teaching_language === entry.teaching_language));
}

export function addStudy(items: readonly StudyItem[], entry: StudyItem, cap = STUDY_LIST_CAP): StudyItem[] {
  return items.length >= cap || hasStudy(items, entry) ? [...items] : [...items, entry];
}

export function toggleStudy(items: readonly StudyItem[], entry: StudyItem): StudyItem[] {
  const matches = (item: StudyItem) => item.subject === entry.subject && item.name === entry.name;
  let matching = -1, exact = -1;
  items.forEach((item, index) => {
    if (!matches(item)) return;
    matching = index;
    if (item.teaching_language === entry.teaching_language) exact = index;
  });
  const index = exact >= 0 ? exact : entry.teaching_language === undefined ? matching : -1;
  return index >= 0 ? removeStudyItem(items, index) : addStudy(items, entry);
}

export function removeStudyItem(items: readonly StudyItem[], index: number): StudyItem[] {
  if (index < 0 || index >= items.length) return [...items];
  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function moveStudyItem(items: readonly StudyItem[], index: number, direction: -1 | 1): StudyItem[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (!item) return [...items];
  next.splice(target, 0, item);
  return next;
}

/**
 * Revisions that a list save or restore sends. An editor captures them when it opens and advances them only
 * after a displayed 409 (see `refreshListSnapshot`), so background refreshes never change what a save writes.
 */
export interface CalendarListRevisions<A extends CalendarArea = CalendarArea> {
  date: string;
  weekday: number;
  area: A;
  /** Weekday template row revision for this area (0 when no template row exists yet). */
  templateRevision: number;
  /** Date override revision when the list was an override at capture time, else null (date saves then send 0). */
  overrideRevision: number | null;
}

export function captureListRevisions<A extends CalendarArea>(
  day: Pick<CalendarDay, 'date' | 'weekday' | 'lists'>,
  area: A,
  template: Pick<CalendarTemplateList, 'revision'>,
): CalendarListRevisions<A> {
  const current = day.lists[area];
  return {
    date: day.date,
    weekday: day.weekday,
    area,
    templateRevision: template.revision,
    overrideRevision: current?.source === 'override' ? current.revision : null,
  };
}

/** Captures the revisions a save could need from a window, using the template for the day's weekday. */
export function snapshotListRevisions<A extends CalendarArea>(
  window: Pick<CalendarWindow, 'templates'>,
  day: Pick<CalendarDay, 'date' | 'weekday' | 'lists'>,
  area: A,
): CalendarListRevisions<A> {
  return captureListRevisions(day, area, window.templates[String(day.weekday) as CalendarWeekdayKey][area] ?? { revision: 0 });
}

/**
 * Rebuilds the day and revisions from a refreshed window after a displayed 409. Null when the date is no longer
 * in the window, in which case the editor keeps its previous snapshot.
 */
export function refreshListSnapshot<A extends CalendarArea>(
  window: Pick<CalendarWindow, 'weeks' | 'templates'> | undefined,
  date: string,
  area: A,
): { day: CalendarDay; revisions: CalendarListRevisions<A> } | null {
  if (!window) return null;
  const day = window.weeks.flatMap((week) => week.days).find((item) => item.date === date);
  if (!day) return null;
  return { day, revisions: snapshotListRevisions(window, day, area) };
}

/** The revision a restore deletes with: the captured override, or null when the day had no override at capture. */
export function restoreRevisionOf(revisions: Pick<CalendarListRevisions, 'overrideRevision'>): number | null {
  return revisions.overrideRevision;
}

/** Study list write built only from captured revisions. Date scope sends 0 when no override existed at capture. */
export function buildCalendarListWriteFromRevisions(
  revisions: CalendarListRevisions<StudyArea>,
  scope: CalendarScope,
  items: readonly StudyItem[],
): CalendarListWrite {
  if (scope === 'template') {
    return {
      scope,
      weekday: revisions.weekday,
      area: revisions.area,
      items: [...items],
      expected_revision: revisions.templateRevision,
    };
  }

  return {
    scope,
    date: revisions.date,
    area: revisions.area,
    items: [...items],
    expected_revision: revisions.overrideRevision ?? 0,
  };
}

export function buildCalendarListWrite(
  context: CalendarEditorContext,
  scope: CalendarScope,
  items: readonly StudyItem[],
): CalendarListWrite {
  return buildCalendarListWriteFromRevisions(captureListRevisions(context.day, context.area, context.template), scope, items);
}

export function editorScopeForList(list: CalendarList): CalendarScope {
  return list.source === 'override' ? 'date' : 'template';
}

export function nextVietnamMidnightDelay(serverToday: string, now = new Date()): number {
  // Vietnam civil day D ends at D 17:00 UTC (UTC+7); a stale "today" yields 0, an immediate refetch.
  const endOfServerDay = new Date(`${serverToday}T17:00:00.000Z`);
  return Math.max(0, endOfServerDay.getTime() - now.getTime());
}

/** Study chip geometry shared with the grid CSS custom properties (see StudyGrid). */
export const CALENDAR_CHIP_HEIGHT = 28;
export const CALENDAR_CHIP_GAP = 2;
export const CALENDAR_DAY_HEADING_HEIGHT = 38;
/** Weather strip above the chip stack (22px artwork row plus a 2px gap). Shown only when weather is ok. */
export const CALENDAR_WEATHER_STRIP_HEIGHT = 22;
export const CALENDAR_WEATHER_STRIP_GAP = 2;
export const CALENDAR_EVENING_ROW_HEIGHT = 36;

/**
 * How many study chips fit in a stack of `availableHeight` px. When every chip fits, all are shown and no
 * "+N" badge is needed. Pass the height BELOW the weather strip: the strip is a separate block above the stack.
 */
export function visibleChipCount(availableHeight: number, total: number, chipHeight: number, gap: number): number {
  if (!(total > 0) || !(availableHeight > 0) || !(chipHeight > 0) || !(gap >= 0)) return 0;
  if (total * chipHeight + (total - 1) * gap <= availableHeight) return total;
  const slots = Math.floor((availableHeight + gap) / (chipHeight + gap));
  return Math.max(0, Math.min(total - 1, slots - 1));
}

export type CalendarWeatherPeriodKey = 'morning' | 'afternoon' | 'evening';
export type CalendarWeatherDisplay = 'ok' | 'no_location' | 'hidden';

export function weatherDisplayState(
  weather: CalendarWeatherResponse | undefined,
  isLoading = false,
  isError = false,
): CalendarWeatherDisplay {
  if (isLoading || isError || !weather) return 'hidden';
  return weather.status === 'ok' || weather.status === 'no_location' ? weather.status : 'hidden';
}

export function weatherForDateAndPeriod(
  weather: CalendarWeatherResponse | undefined,
  date: string,
  period: CalendarWeatherPeriodKey,
): CalendarWeatherPeriod | undefined {
  return weather?.days.find((day) => day.date === date)?.[period];
}

export function formatWeatherTemperature(tempC: number): string {
  return Number.isFinite(tempC) ? `${Math.round(tempC)}°` : '';
}

export function weatherLabel(key: WeatherIconKey, language: UiLanguage): string {
  const entry = weatherIconEntry(key);
  return language === 'vi' ? entry.vi : entry.en;
}

export function buildWeatherAriaLabel(
  template: string,
  periodLabel: string,
  period: CalendarWeatherPeriod,
  language: UiLanguage,
): string {
  return template
    .replace('{period}', periodLabel)
    .replace('{label}', weatherLabel(period.icon, language))
    .replace('{temperature}', Number.isFinite(period.temp_c) ? String(Math.round(period.temp_c)) : '');
}

/** Moves the item at `from` so it ends at index `to` (clamped). Length and members never change. */
export function moveStudyItemTo(items: readonly StudyItem[], from: number, to: number): StudyItem[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= items.length) return [...items];
  const target = Math.min(items.length - 1, Math.max(0, to));
  if (target === from) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return [...items];
  next.splice(target, 0, item);
  return next;
}

/**
 * Drop index for a dragged row. Pass the vertical midpoints of every row the dragged row can pass
 * (all rows except the dragged one, in list order) and the dragged row's centre Y. The result is the
 * index the row should occupy in the final list.
 */
export function targetIndexFromPointer(rowMidpoints: readonly number[], pointerY: number): number {
  if (!Number.isFinite(pointerY)) return 0;
  return rowMidpoints.filter((midpoint) => midpoint < pointerY).length;
}

/** Vertical translation (px) for a row while another row is being dragged from `from` to `target`. */
export function dragRowOffset(index: number, from: number, target: number, dragDistance: number, step: number): number {
  if (index === from) return dragDistance;
  if (from < target && index > from && index <= target) return -step;
  if (from > target && index >= target && index < from) return step;
  return 0;
}

/** Saturday (6) and Sunday (7) from the calendar weekday number, never from column position. */
export function isCalendarWeekend(weekday: number): boolean {
  return weekday === 6 || weekday === 7;
}

export type WeekSlide = 'next' | 'prev' | null;

/** Which way the table slides in when the week changes: forward (next week) from the right, back from the left. */
export function weekSlideDirection(previousIndex: number, nextIndex: number): WeekSlide {
  if (nextIndex > previousIndex) return 'next';
  if (nextIndex < previousIndex) return 'prev';
  return null;
}

export const CALENDAR_VIEW_ORDER = ['study', 'meals', 'events'] as const;
export type ViewSlide = 'down' | 'up' | null;
/** Slide direction of the table: any week or view transition. */
export type PaneSlide = WeekSlide | ViewSlide;

/** Moving down the rail (Study, Meals, Events) slides the new view up from below; moving up slides it in from above. */
export function viewSlideDirection(previous: string, next: string): ViewSlide {
  const from = CALENDAR_VIEW_ORDER.indexOf(previous as (typeof CALENDAR_VIEW_ORDER)[number]);
  const to = CALENDAR_VIEW_ORDER.indexOf(next as (typeof CALENDAR_VIEW_ORDER)[number]);
  if (from < 0 || to < 0 || from === to) return null;
  return to > from ? 'down' : 'up';
}
