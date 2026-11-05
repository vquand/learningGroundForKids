import type { CalendarNotificationItem } from '../api/calendarNotifications.ts';
import { calendarNotificationTitle, type CalendarNotificationCopy } from './calendarNotificationFeed.ts';

/** Browser alerts fire three days ahead and on the day only. */
export const CALENDAR_ALERT_LEAD_DAYS = 3;
export const CALENDAR_ALERT_DAY_OF = 0;
/** Identifiers kept per family on this device. Oldest entries are dropped first. */
export const CALENDAR_ALERT_LEDGER_LIMIT = 200;

export function isCalendarAlertDay(daysUntil: number): boolean {
  return daysUntil === CALENDAR_ALERT_LEAD_DAYS || daysUntil === CALENDAR_ALERT_DAY_OF;
}

/** Identity of one alert: the occurrence plus the day it was announced for. Holds no titles or names. */
export function calendarAlertKey(item: CalendarNotificationItem): string {
  return `${item.occurrence_id}|${item.days_until}`;
}

export function calendarAlertStorageKey(familyId: string): string {
  return `plg.calendar-alerts.${familyId}`;
}

export interface CalendarAlertStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function trimCalendarAlertLedger(ledger: readonly string[]): string[] {
  return ledger.slice(-CALENDAR_ALERT_LEDGER_LIMIT);
}

/** Storage failures (private mode, blocked site data, quota) read as an empty ledger. */
export function readCalendarAlertLedger(storage: CalendarAlertStorage | null, familyId: string): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(calendarAlertStorageKey(familyId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return trimCalendarAlertLedger(parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0 && entry.length <= 300));
  } catch {
    return [];
  }
}

/** Returns false when storage refused the write; the session keeps its in-memory ledger either way. */
export function writeCalendarAlertLedger(storage: CalendarAlertStorage | null, familyId: string, ledger: readonly string[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(calendarAlertStorageKey(familyId), JSON.stringify(trimCalendarAlertLedger(ledger)));
    return true;
  } catch {
    return false;
  }
}

export function clearCalendarAlertLedger(storage: CalendarAlertStorage | null, familyId: string): void {
  if (!storage) return;
  try {
    storage.removeItem(calendarAlertStorageKey(familyId));
  } catch {
    // Nothing else to clear; the in-memory ledger is dropped by the session.
  }
}

export interface CalendarAlertPlan {
  alerts: CalendarNotificationItem[];
  ledger: string[];
}

/**
 * Pure decision: which items should alert now. An identity is announced at most once, even when
 * the same occurrence appears in several polls or twice in one list.
 */
export function planCalendarAlerts(items: readonly CalendarNotificationItem[], ledger: readonly string[]): CalendarAlertPlan {
  const seen = new Set(ledger);
  const next = [...ledger];
  const alerts: CalendarNotificationItem[] = [];
  for (const item of items) {
    if (!isCalendarAlertDay(item.days_until)) continue;
    const key = calendarAlertKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(key);
    alerts.push(item);
  }
  return { alerts, ledger: trimCalendarAlertLedger(next) };
}

export interface CalendarAlertCopy {
  title: string;
  body: string;
}

/** "Halloween is in 3 days" or "Mun: Hiking with Dad is today", localized through the injected copy. */
export function buildCalendarAlertCopy(item: CalendarNotificationItem, copy: CalendarNotificationCopy): CalendarAlertCopy {
  const label = calendarNotificationTitle(item, copy);
  const subject = item.kind === 'kid' && item.profile_name ? `${item.profile_name}: ${label}` : label;
  return {
    title: copy.translate('Coming up'),
    body: item.days_until === CALENDAR_ALERT_DAY_OF
      ? copy.translate('{subject} is today', { subject })
      : copy.translate('{subject} is in {count} days', { subject, count: item.days_until }),
  };
}

export interface ClosableNotification {
  close(): void;
}

export interface CalendarAlertSinkDeps {
  storage: CalendarAlertStorage | null;
  /** 'unsupported' when the browser has no Notification API. Alerts never prompt for permission. */
  permission: () => NotificationPermission | 'unsupported';
  notify: (title: string, options: { body: string; tag: string }) => ClosableNotification;
  copy: () => CalendarNotificationCopy;
}

export interface CalendarAlertSession {
  readonly familyId: string;
  /** Alerts for newly due items when permission is already granted. Returns the items that alerted. */
  observe(items: readonly CalendarNotificationItem[]): CalendarNotificationItem[];
  /** Closes open browser notifications; keeps the dedupe state for this device. */
  closeHandles(): void;
  /** Logout or family/account switch: close handles and clear the dedupe state for this family. */
  forget(): void;
}

export function createCalendarAlertSession(familyId: string, deps: CalendarAlertSinkDeps): CalendarAlertSession {
  let ledger: string[] | null = null;
  let handles: ClosableNotification[] = [];

  function loadLedger(): string[] {
    ledger ??= readCalendarAlertLedger(deps.storage, familyId);
    return ledger;
  }

  function closeOpenHandles() {
    const open = handles;
    handles = [];
    for (const handle of open) {
      try {
        handle.close();
      } catch {
        // A notification that is already closed or gone cannot be closed again.
      }
    }
  }

  return {
    familyId,
    observe(items) {
      if (deps.permission() !== 'granted') return [];
      const plan = planCalendarAlerts(items, loadLedger());
      ledger = plan.ledger;
      if (!plan.alerts.length) return [];
      // Record before showing, so a browser that refuses the alert is not retried on every poll.
      writeCalendarAlertLedger(deps.storage, familyId, plan.ledger);
      const copy = deps.copy();
      for (const item of plan.alerts) {
        try {
          const { title, body } = buildCalendarAlertCopy(item, copy);
          handles.push(deps.notify(title, { body, tag: `calendar-${calendarAlertKey(item)}` }));
        } catch {
          // Notification constructors can throw in some browsers; the page stays usable.
        }
      }
      return plan.alerts;
    },
    closeHandles: closeOpenHandles,
    forget() {
      closeOpenHandles();
      ledger = null;
      clearCalendarAlertLedger(deps.storage, familyId);
    },
  };
}
