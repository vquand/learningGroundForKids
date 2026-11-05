import { coreRequest } from './core.ts';

export const CALENDAR_NOTIFICATIONS_PATH = '/api/v1/calendar/notifications';

/** One upcoming calendar occurrence for the family (server-owned; days_until is 0 to 3). */
export interface CalendarNotificationItem {
  occurrence_id: string;
  kind: 'system' | 'kid';
  profile_id: string | null;
  profile_name: string | null;
  title_key: string | null;
  title: string | null;
  icon_key: string;
  date: string;
  days_until: number;
}

/**
 * Keeps only well-formed items. The server owns the feed, but a malformed entry must not break the
 * panel or an alert, so anything unexpected is dropped rather than rendered.
 */
export function parseCalendarNotificationItems(raw: unknown): CalendarNotificationItem[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) return [];
  return ((raw as { items: unknown[] }).items).flatMap((entry): CalendarNotificationItem[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Partial<CalendarNotificationItem>;
    const valid = typeof item.occurrence_id === 'string'
      && (item.kind === 'system' || item.kind === 'kid')
      && typeof item.icon_key === 'string'
      && typeof item.date === 'string'
      && Number.isInteger(item.days_until) && item.days_until! >= 0 && item.days_until! <= 3
      && (item.profile_id === null || typeof item.profile_id === 'string')
      && (item.profile_name === null || typeof item.profile_name === 'string')
      && (item.title_key === null || typeof item.title_key === 'string')
      && (item.title === null || typeof item.title === 'string');
    return valid ? [item as CalendarNotificationItem] : [];
  });
}

export async function fetchCalendarNotifications(): Promise<CalendarNotificationItem[]> {
  return parseCalendarNotificationItems(await coreRequest<unknown>(CALENDAR_NOTIFICATIONS_PATH));
}
