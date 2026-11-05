import type { CalendarNotificationItem } from '../api/calendarNotifications.ts';
import { eventIconInfo, systemEventInfo } from './calendarEventCatalog.ts';
import type { UiLanguage } from './uiLanguage.ts';
import { SYSTEM_EVENT_KEYS, type SystemEventKey } from '../types/calendarEvents.ts';

/** Calendar items shown before "Show all". Friend requests keep their own preview length. */
export const CALENDAR_NOTIFICATION_PREVIEW = 3;

/**
 * Localization is injected so this module stays pure: the app passes uiText/uiMessage, tests pass a
 * fake or the Vietnamese catalog. `values` interpolate `{name}` placeholders in the English source.
 */
export interface CalendarNotificationCopy {
  language: UiLanguage;
  translate: (english: string, values?: Record<string, string | number>) => string;
}

function compareItems(left: CalendarNotificationItem, right: CalendarNotificationItem): number {
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  if (left.profile_name !== right.profile_name) {
    if (left.profile_name === null) return -1;
    if (right.profile_name === null) return 1;
    return left.profile_name < right.profile_name ? -1 : 1;
  }
  if (left.occurrence_id === right.occurrence_id) return 0;
  return left.occurrence_id < right.occurrence_id ? -1 : 1;
}

/** Soonest first, then kid name (system items first), then occurrence id. Same order as the server. */
export function sortCalendarNotifications(items: readonly CalendarNotificationItem[]): CalendarNotificationItem[] {
  return [...items].sort(compareItems);
}

/** Per-group preview: expanded shows everything, otherwise the first `preview` items. */
export function previewItems<T>(items: readonly T[], expanded: boolean, preview: number): T[] {
  return expanded ? [...items] : items.slice(0, preview);
}

/** Badge total for the merged panel: every listed calendar item plus every listed friend request. */
export function notificationPanelTotal(friendRequestCount: number, calendarItems: readonly CalendarNotificationItem[]): number {
  return friendRequestCount + calendarItems.length;
}

export function calendarNotificationDayLabel(daysUntil: number, copy: CalendarNotificationCopy): string {
  if (daysUntil === 0) return copy.translate('Today');
  if (daysUntil === 1) return copy.translate('Tomorrow');
  return copy.translate('In {count} days', { count: daysUntil });
}

export function isSystemEventKey(value: string): value is SystemEventKey {
  return (SYSTEM_EVENT_KEYS as readonly string[]).includes(value);
}

/** System items use the shared event label; kid items show the child's own event title as typed. */
export function calendarNotificationTitle(item: CalendarNotificationItem, copy: CalendarNotificationCopy): string {
  if (item.kind === 'system' && isSystemEventKey(item.icon_key)) return systemEventInfo(item.icon_key)[copy.language];
  if (item.kind === 'system') return item.title_key ?? item.icon_key;
  return item.title ?? eventIconInfo(item.icon_key)[copy.language];
}

export function calendarNotificationArt(item: CalendarNotificationItem): string {
  if (item.kind === 'system' && isSystemEventKey(item.icon_key)) return systemEventInfo(item.icon_key).art;
  return eventIconInfo(item.icon_key).art;
}
