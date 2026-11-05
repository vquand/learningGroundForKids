import type { CalendarArea, CalendarWindow, CalendarWeatherResponse, StudyArea, StudyItem } from '../types/calendar.ts';
import type { UiLanguage } from './uiLanguage.ts';
import { uiText } from '../i18n/uiText.ts';
import { isStudyKey, studyEntry, studyLabel, weatherIconEntry } from './calendarCatalog.ts';
import { isClubItem } from './calendarStudyPlan.ts';
import { parseMealPlanItems } from './calendarMealHelpers.ts';
import { mealFoodArt, mealFoodLabel, medicineColorLabel, medicineMethodArt, medicineMethodLabel } from './calendarMealCatalog.ts';
import { eventIconInfo, systemEventInfo, systemEventLabel } from './calendarEventCatalog.ts';
import { participantLabel } from './calendarPeople.ts';
import type { MealsArea } from '../types/calendarMeals.ts';

export interface CalendarExportEntry { art: string; label: string; club?: boolean }
export interface CalendarExportRow { label: string; cells: CalendarExportEntry[][]; clubs: boolean }
export interface CalendarExportPage { title: string; start: string; end: string; days: { date: string; weekday: number; today: boolean }[]; rows: CalendarExportRow[] }
const STUDY_ROWS: readonly [StudyArea, string][] = [['study_morning', 'Morning'], ['study_afternoon', 'Afternoon'], ['study_extra', 'Extra']];
const MEAL_ROWS: readonly [MealsArea, string][] = [['meal_breakfast', 'Breakfast'], ['meal_lunch', 'Lunch'], ['meal_snack', 'Afternoon snack'], ['meal_dinner', 'Dinner'], ['medicine', 'Medicine']];
function studyEntries(items: readonly unknown[], language: UiLanguage): CalendarExportEntry[] {
  return items.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || !('subject' in raw) || !isStudyKey(raw.subject)) return [];
    const item = raw as StudyItem;
    return [{ art: studyEntry(item.subject).art, label: `${item.name ?? studyLabel(item.subject, language)}${item.teaching_language ? ` (${item.teaching_language.toUpperCase()})` : ''}`, club: isClubItem(item) }];
  });
}
function mealEntries(items: readonly unknown[], area: MealsArea, language: UiLanguage): CalendarExportEntry[] {
  return parseMealPlanItems(items, area).map(item => {
    if ('medicine' in item) {
      const m = item.medicine;
      return { art: medicineMethodArt(m.method), label: `${medicineMethodLabel(m.method, language)} · ${medicineColorLabel(m.color, language)} ×${m.qty}${m.dose ? ` · ${m.dose}` : ''}` };
    }
    return { art: mealFoodArt(item.food === 'custom' ? item.icon : item.food), label: item.food === 'custom' ? item.name : mealFoodLabel(item.food, language) };
  });
}

/** Explicit print content: every saved item has artwork and a full name, independent of screen capacity. */
export function buildCalendarExportPages(data: CalendarWindow, language: UiLanguage, weather?: CalendarWeatherResponse): CalendarExportPage[] {
  if (data.weeks.length !== 2 || data.weeks.some(week => week.days.length !== 7)) throw new Error('A complete two-week calendar is required.');
  return data.weeks.flatMap(week => {
    const base = { start: week.start, end: week.days[6]!.date, days: week.days.map(day => ({ date: day.date, weekday: day.weekday, today: day.date === data.today })) };
    const rows = (spec: readonly [CalendarArea, string][], study: boolean): CalendarExportRow[] => spec.map(([area, label]) => ({ label: uiText(label, language), clubs: study && area !== 'study_extra', cells: week.days.map(day => study ? studyEntries(day.lists[area].items, language) : mealEntries(day.lists[area].items, area as MealsArea, language)) }));
    const studyRows = rows(STUDY_ROWS, true);
    if (weather?.status === 'ok') {
      const weatherEntries = (date: string, period: 'morning' | 'afternoon' | 'evening'): CalendarExportEntry[] => {
        const forecast = weather.days.find(day => day.date === date)?.[period];
        if (!forecast) return [];
        const icon = weatherIconEntry(forecast.icon);
        return [{ art: icon.art, label: `${language === 'vi' ? icon.vi : icon.en} · ${Math.round(forecast.temp_c)}°C` }];
      };
      for (const [index, period] of (['morning', 'afternoon'] as const).entries()) studyRows[index]!.cells.forEach((cell, i) => cell.unshift(...weatherEntries(week.days[i]!.date, period)));
      studyRows.push({ label: uiText('Evening', language), clubs: false, cells: week.days.map(day => weatherEntries(day.date, 'evening')) });
    }
    const eventRow: CalendarExportRow = {
      label: uiText('Events', language), clubs: false, cells: week.days.map(day => [
        ...data.system_events.filter(e => e.date === day.date).map(e => ({ art: systemEventInfo(e.key).art, label: systemEventLabel(e.key, language) })),
        ...data.events.filter(e => e.date === day.date).map(e => ({ art: eventIconInfo(e.icon_key).art, label: [e.title, e.participants?.map(p => participantLabel(p, language)).join(', ')].filter(Boolean).join('\n') })),
      ]),
    };
    return [{ ...base, title: uiText('Study', language), rows: studyRows }, { ...base, title: uiText('Meals', language), rows: rows(MEAL_ROWS, false) }, { ...base, title: uiText('Events', language), rows: [eventRow] }];
  });
}
