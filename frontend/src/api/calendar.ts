import { ApiError, coreRequest } from './core.ts';
import type { CalendarList, CalendarListWrite, CalendarWeatherResponse, CalendarWindow } from '../types/calendar';
import type { CalendarArea, StudyLibraryEntry } from '../types/calendar';
import type { StudyKey } from '../lib/calendarCatalog';

export interface CalendarErrorDetails {
  current?: CalendarList;
}

export class CalendarApiError extends ApiError {
  readonly details: CalendarErrorDetails | undefined;

  constructor(message: string, status: number, code: string, details?: CalendarErrorDetails) {
    super(message, status, code, details);
    this.name = 'CalendarApiError';
    this.details = details;
  }

  get current(): CalendarList | undefined { return this.details?.current; }
}

function calendarRequest<T>(request: () => Promise<T>): Promise<T> {
  return request().catch((error: unknown) => {
    if (error instanceof ApiError) {
      throw new CalendarApiError(error.message, error.status, error.code, isCalendarDetails(error.details) ? error.details : undefined);
    }
    throw error;
  });
}

function isCalendarDetails(value: unknown): value is CalendarErrorDetails {
  return Boolean(value && typeof value === 'object');
}

function profileCalendarPath(profileId: string): string {
  return `/api/v1/profiles/${encodeURIComponent(profileId)}/calendar`;
}

export function fetchCalendar(profileId: string): Promise<CalendarWindow> {
  return calendarRequest(() => coreRequest<CalendarWindow>(profileCalendarPath(profileId)));
}

export interface RenameCalendarItemInput { date: string; area: CalendarArea; index: number; name: string; expected_revision: number; expected_template_revision: number; }
export function renameCalendarItem(profileId: string, input: RenameCalendarItemInput): Promise<CalendarList> {
  return calendarRequest(() => coreRequest<CalendarList>(`${profileCalendarPath(profileId)}/rename-item`, { method: 'POST', body: JSON.stringify(input) }));
}
export function addStudyFavorite(profileId: string, subject: StudyKey, name: string): Promise<StudyLibraryEntry> {
  return calendarRequest(() => coreRequest<StudyLibraryEntry>(`${profileCalendarPath(profileId)}/subjects`, { method: 'POST', body: JSON.stringify({ subject, name }) }));
}
export function removeStudyFavorite(profileId: string, id: string): Promise<void> {
  return calendarRequest(() => coreRequest<void>(`${profileCalendarPath(profileId)}/subjects/${encodeURIComponent(id)}`, { method: 'DELETE' }));
}
export function updateStudyFavorite(profileId: string, entry: StudyLibraryEntry, subject: StudyKey, name: string): Promise<StudyLibraryEntry> {
  return calendarRequest(() => coreRequest<StudyLibraryEntry>(`${profileCalendarPath(profileId)}/subjects/${encodeURIComponent(entry.id)}`, { method: 'PUT', body: JSON.stringify({ subject, name, expected_subject: entry.subject, expected_name: entry.name }) }));
}

export function fetchCalendarWeather(profileId: string): Promise<CalendarWeatherResponse> {
  return calendarRequest(() => coreRequest<CalendarWeatherResponse>(`${profileCalendarPath(profileId)}/weather`));
}

export function saveCalendarList(profileId: string, input: CalendarListWrite): Promise<CalendarList> {
  return calendarRequest(() => coreRequest<CalendarList>(`${profileCalendarPath(profileId)}/lists`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }));
}

export function deleteCalendarOverride(profileId: string, date: string, area: CalendarListWrite['area'], expectedRevision: number): Promise<void> {
  const params = new URLSearchParams({ date, area, expected_revision: String(expectedRevision) });
  return calendarRequest(() => coreRequest<void>(`${profileCalendarPath(profileId)}/lists?${params.toString()}`, { method: 'DELETE' }));
}
