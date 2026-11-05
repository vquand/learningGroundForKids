import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendarNotifications, type CalendarNotificationItem } from '../api/calendarNotifications';
import { uiMessage, uiText } from '../i18n/uiText';
import {
  createCalendarAlertSession,
  type CalendarAlertSession,
  type CalendarAlertSinkDeps,
  type CalendarAlertStorage,
} from '../lib/calendarNotificationAlerts';
import type { CalendarNotificationCopy } from '../lib/calendarNotificationFeed';
import { familyQueryKey, familyScopedQuery } from '../lib/familyQueries';
import { getUiLanguage, type UiLanguage } from '../lib/uiLanguage';
import { useFamilyStore } from '../stores/familyStore';

export const CALENDAR_NOTIFICATION_STALE_MS = 5 * 60 * 1000;
export const CALENDAR_NOTIFICATION_REFETCH_MS = 15 * 60 * 1000;
export const EMPTY_CALENDAR_NOTIFICATIONS: readonly CalendarNotificationItem[] = [];

export function calendarNotificationsQueryKey(familyId: string | null) {
  return familyQueryKey('calendar-notifications', familyId);
}

/** Localized copy for the panel and alerts. Keys are English source text; Vietnamese lives in vi.json. */
export function calendarNotificationCopy(language: UiLanguage): CalendarNotificationCopy {
  return {
    language,
    translate: (english, values) => (values ? uiMessage(english, values) : uiText(english, language)),
  };
}

/** Upcoming calendar items for the session family. Failures are silent: the panel just omits them. */
export function useCalendarNotifications() {
  const familyId = useFamilyStore((state) => state.familyId);
  return useQuery({
    queryKey: calendarNotificationsQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchCalendarNotifications),
    enabled: Boolean(familyId),
    staleTime: CALENDAR_NOTIFICATION_STALE_MS,
    refetchInterval: familyId ? CALENDAR_NOTIFICATION_REFETCH_MS : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

function browserNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function safeLocalStorage(): CalendarAlertStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function browserAlertDeps(): CalendarAlertSinkDeps {
  return {
    storage: safeLocalStorage(),
    permission: () => (browserNotificationsSupported() ? Notification.permission : 'unsupported'),
    notify: (title, options) => {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return notification;
    },
    copy: () => calendarNotificationCopy(getUiLanguage()),
  };
}

interface AlertSessionSlot {
  familyId: string;
  generation: number;
  session: CalendarAlertSession;
}

/**
 * Browser alerts for due calendar items. Mounted globally next to the friend-request notifications.
 * Only runs while the app is open and permission is already granted; it never prompts.
 */
export function useCalendarNotificationAlerts(): void {
  const familyId = useFamilyStore((state) => state.familyId);
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const { data, isSuccess } = useCalendarNotifications();
  const slotRef = useRef<AlertSessionSlot | null>(null);

  // A logout or a different family ends the previous session: close its alerts and clear its dedupe state.
  useEffect(() => {
    const current = slotRef.current;
    if (current && current.familyId === familyId && current.generation === sessionGeneration) return;
    current?.session.forget();
    slotRef.current = familyId
      ? { familyId, generation: sessionGeneration, session: createCalendarAlertSession(familyId, browserAlertDeps()) }
      : null;
  }, [familyId, sessionGeneration]);

  useEffect(() => {
    const current = slotRef.current;
    if (!current || !isSuccess || current.familyId !== familyId) return;
    current.session.observe(data ?? EMPTY_CALENDAR_NOTIFICATIONS);
  }, [data, familyId, isSuccess]);

  // Unmount closes open browser alerts but keeps the device's dedupe state.
  useEffect(() => () => {
    slotRef.current?.session.closeHandles();
  }, []);
}
