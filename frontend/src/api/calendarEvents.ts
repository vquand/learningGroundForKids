import { ApiError, coreRequest } from './core.ts';
import type { CalendarEventInput, CalendarEventUpdateInput, CalendarKidEvent } from '../types/calendarEvents';

/**
 * Typed outcomes for kid-event writes:
 * - conflict: 409 CALENDAR_REVISION_CONFLICT; `currentRevision` comes from details.current when the server sends it.
 * - events_full: 422 CALENDAR_EVENTS_FULL (the 50-active-event cap).
 * - not_found: 404 (unknown or another family's event).
 * - validation: other 400/422 responses.
 */
export type CalendarEventErrorKind = 'conflict' | 'events_full' | 'not_found' | 'validation' | 'unknown';

export class CalendarEventApiError extends ApiError {
  readonly kind: CalendarEventErrorKind;
  readonly currentRevision: number | undefined;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message, status, code, details);
    this.name = 'CalendarEventApiError';
    this.kind = classifyEventError(status, code);
    this.currentRevision = readCurrentRevision(details);
  }
}

function classifyEventError(status: number, code: string): CalendarEventErrorKind {
  if (status === 409 || code === 'CALENDAR_REVISION_CONFLICT') return 'conflict';
  if (code === 'CALENDAR_EVENTS_FULL') return 'events_full';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 422) return 'validation';
  return 'unknown';
}

function readCurrentRevision(details: unknown): number | undefined {
  if (!details || typeof details !== 'object' || !('current' in details)) return undefined;
  const current = details.current;
  if (!current || typeof current !== 'object' || !('revision' in current)) return undefined;
  const revision = current.revision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
}

async function eventRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error: unknown) {
    if (error instanceof ApiError) throw new CalendarEventApiError(error.message, error.status, error.code, error.details);
    throw error;
  }
}

function eventsPath(profileId: string): string {
  return `/api/v1/profiles/${encodeURIComponent(profileId)}/calendar/events`;
}

/** Sends exactly the frozen fields; the browser never supplies today, ownership or revisions it did not read. */
function eventBody(input: CalendarEventInput): CalendarEventInput {
  return { title: input.title, icon_key: input.icon_key, start_date: input.start_date, repeat: input.repeat, ...(input.participants !== undefined ? {participants:input.participants.map(p => p.kind === 'role' ? {kind:p.kind,key:p.key} : {kind:p.kind,profile_id:p.profile_id})} : {}) };
}

export function createCalendarEvent(profileId: string, input: CalendarEventInput): Promise<CalendarKidEvent> {
  return eventRequest(() => coreRequest<CalendarKidEvent>(eventsPath(profileId), {
    method: 'POST',
    body: JSON.stringify(eventBody(input)),
  }));
}

export function updateCalendarEvent(profileId: string, eventId: string, input: CalendarEventUpdateInput): Promise<CalendarKidEvent> {
  return eventRequest(() => coreRequest<CalendarKidEvent>(`${eventsPath(profileId)}/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...eventBody(input), expected_revision: input.expected_revision, ...(input.from_date ? {from_date:input.from_date} : {}) }),
  }));
}

export function deleteCalendarEvent(profileId: string, eventId: string, expectedRevision: number): Promise<void> {
  const params = new URLSearchParams({ expected_revision: String(expectedRevision) });
  return eventRequest(() => coreRequest<void>(`${eventsPath(profileId)}/${encodeURIComponent(eventId)}?${params.toString()}`, {
    method: 'DELETE',
  }));
}

export function stopCalendarEventRepeat(profileId: string, eventId: string, expectedRevision: number): Promise<CalendarKidEvent> {
  return eventRequest(() => coreRequest<CalendarKidEvent>(`${eventsPath(profileId)}/${encodeURIComponent(eventId)}/stop-repeat`, {
    method: 'POST',
    body: JSON.stringify({ expected_revision: expectedRevision }),
  }));
}
