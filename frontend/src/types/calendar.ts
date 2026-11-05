import type { StudyKey, WeatherIconKey } from '../lib/calendarCatalog';
import type { CalendarEventOccurrence, CalendarSystemEvent } from './calendarEvents';
import type { MealLibraryEntry, MealPlanItem } from './calendarMeals';

export const CALENDAR_AREAS = [
  'study_morning', 'study_afternoon', 'study_extra', 'meal_breakfast', 'meal_lunch',
  'meal_snack', 'meal_dinner', 'medicine',
] as const;
export type CalendarArea = typeof CALENDAR_AREAS[number];
export type StudyArea = 'study_morning' | 'study_afternoon' | 'study_extra';
export type CalendarWeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type CalendarScope = 'template' | 'date';

export type StudyLanguage = 'en' | 'vi';
export interface StudyItem { subject: StudyKey; name?: string; series_id?: string; teaching_language?: StudyLanguage; }
export interface StudyLibraryEntry { id: string; subject: StudyKey; name: string; }
export type CalendarItem = StudyItem | MealPlanItem | Record<string, unknown>;

export interface CalendarList {
  id: string | null;
  items: CalendarItem[];
  revision: number;
  source: 'template' | 'override' | 'empty';
}

export interface CalendarTemplateList extends Omit<CalendarList, 'source'> {
  source: 'template' | 'empty';
}

export interface CalendarDay {
  date: string;
  weekday: number;
  is_past: boolean;
  lists: Record<CalendarArea, CalendarList>;
}

export interface CalendarWeek {
  start: string;
  days: CalendarDay[];
}

export interface CalendarWindow {
  today: string;
  timezone: 'Asia/Ho_Chi_Minh';
  weeks: CalendarWeek[];
  templates: Record<CalendarWeekdayKey, Record<CalendarArea, CalendarTemplateList>>;
  meal_library: MealLibraryEntry[];
  study_library?: StudyLibraryEntry[];
  events: CalendarEventOccurrence[];
  system_events: CalendarSystemEvent[];
}

export interface CalendarWeatherPeriod {
  icon: WeatherIconKey;
  temp_c: number;
}

export interface CalendarWeatherDay {
  date: string;
  morning: CalendarWeatherPeriod;
  afternoon: CalendarWeatherPeriod;
  evening: CalendarWeatherPeriod;
}

export interface CalendarWeatherResponse {
  status: 'ok' | 'unavailable' | 'no_location';
  location_label: string | null;
  updated_at: string | null;
  days: CalendarWeatherDay[];
}

export interface CalendarListWriteTemplate {
  scope: 'template';
  weekday: number;
  area: StudyArea;
  items: StudyItem[];
  expected_revision: number;
}

export interface CalendarListWriteDate {
  scope: 'date';
  date: string;
  area: StudyArea;
  items: StudyItem[];
  expected_revision: number;
}

export type CalendarListWrite = CalendarListWriteTemplate | CalendarListWriteDate;
