import { coreRequest } from './core.ts';
import type { CalendarWindow } from '../types/calendar';

/** Read-only Parent Space calendar. The server enforces the parent capability and family ownership. */
export function parentCalendarPath(profileId: string): string {
  return `/api/v1/parent/calendar/${encodeURIComponent(profileId)}`;
}

/** Client route for a child's read-only calendar inside Parent Space. */
export function parentChildCalendarRoute(profileId: string): string {
  return `/parent/children/${encodeURIComponent(profileId)}/calendar`;
}

export function fetchParentCalendar(profileId: string): Promise<CalendarWindow> {
  return coreRequest<CalendarWindow>(parentCalendarPath(profileId));
}
