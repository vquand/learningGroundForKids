import { coreRequest } from './core';
import type { CalendarPeopleSettings, ParticipantCandidates, RelativeRole } from '../types/calendarPeople';
export function fetchCalendarParticipants(profileId: string, search: string, signal?: AbortSignal): Promise<ParticipantCandidates> {
  return coreRequest(`/api/v1/profiles/${encodeURIComponent(profileId)}/calendar/participants?q=${encodeURIComponent(search)}`, { signal });
}
export const fetchCalendarPeopleSettings = (): Promise<CalendarPeopleSettings> => coreRequest('/api/v1/parent/calendar-settings');
export const saveCalendarPeopleSettings = (disabled_roles: RelativeRole[], expected_revision: number): Promise<CalendarPeopleSettings> => coreRequest('/api/v1/parent/calendar-settings', { method: 'PUT', body: JSON.stringify({ disabled_roles, expected_revision }) });
