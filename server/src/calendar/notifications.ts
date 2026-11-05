import type { Pool } from 'pg';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import type { SystemEventKey } from './catalog.js';
import { addDays, todayInVietnam } from './dates.js';
import { occurrencesInWindow, type EventRepeat } from './recurrence.js';
import { systemEventsInWindow } from './system-events.js';
import { eventNameAt, type EventNameVersion } from './names.js';

/** Items are listed for today through today + 3 days, inclusive. */
export const NOTIFICATION_WINDOW_DAYS = 3;
/** Hard cap on the response, applied after sorting. */
export const NOTIFICATION_ITEM_CAP = 100;
/** Database bound: at most this many kid event rows are read per profile before expansion. */
export const NOTIFICATION_EVENT_ROWS_PER_PROFILE = 50;

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

export interface CalendarNotificationsResponse {
  items: CalendarNotificationItem[];
}

/** A kid event row joined to its profile name, already limited to the family. */
export interface CalendarNotificationKidEvent {
  id: string;
  profile_id: string;
  profile_name: string;
  title: string;
  icon_key: string;
  start_date: string;
  repeat: EventRepeat;
  repeat_ended_on: string | null;
  name_history?: EventNameVersion[];
}

export interface CalendarNotificationInput {
  today: string;
  systemEvents: readonly { key: SystemEventKey; date: string }[];
  kidEvents: readonly CalendarNotificationKidEvent[];
}

export interface CalendarNotificationsRepository {
  /** `familyId` must come from the authenticated session, never from the request. */
  list(familyId: string, now: Date): Promise<CalendarNotificationsResponse>;
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function dayDifference(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_IN_MILLISECONDS);
}

/** Orders by date, then profile name (system items, with no name, first), then occurrence id. */
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

/**
 * Pure assembly of the notification feed. Inputs are trusted server data; the window is
 * [today, today + 3] inclusive, so anything outside it is dropped here as well.
 */
export function buildCalendarNotifications(input: CalendarNotificationInput): CalendarNotificationsResponse {
  const end = addDays(input.today, NOTIFICATION_WINDOW_DAYS);
  const system: CalendarNotificationItem[] = input.systemEvents
    .filter(event => event.date >= input.today && event.date <= end)
    .map(event => ({
      occurrence_id: `system:${event.key}:${event.date}`,
      kind: 'system',
      profile_id: null,
      profile_name: null,
      title_key: event.key,
      title: null,
      icon_key: event.key,
      date: event.date,
      days_until: dayDifference(input.today, event.date),
    }));
  const kid: CalendarNotificationItem[] = input.kidEvents.flatMap(event => occurrencesInWindow({
    start_date: event.start_date,
    repeat: event.repeat,
    repeat_ended_on: event.repeat_ended_on,
  }, input.today, end).map(date => ({
    occurrence_id: `kid:${event.profile_id}:${event.id}:${date}`,
    kind: 'kid' as const,
    profile_id: event.profile_id,
    profile_name: event.profile_name,
    title_key: null,
    ...eventNameAt(event, date),
    date,
    days_until: dayDifference(input.today, date),
  })));
  return { items: [...system, ...kid].sort(compareItems).slice(0, NOTIFICATION_ITEM_CAP) };
}

/**
 * Only rows that can have an occurrence in the window are read: one-offs starting inside it, and
 * series that started by the window end and have not stopped before its start. Rows are bounded
 * per profile by a window function, so the database never returns more than the cap per profile.
 */
const KID_EVENT_ROWS_SQL = `SELECT id,profile_id,profile_name,title,icon_key,start_date,"repeat",repeat_ended_on,name_history FROM (
    SELECT e.id,e.profile_id,p.name AS profile_name,e.title,e.icon_key,e.name_history,
      to_char(e.start_date,'YYYY-MM-DD') AS start_date,e."repeat",to_char(e.repeat_ended_on,'YYYY-MM-DD') AS repeat_ended_on,
      row_number() OVER (PARTITION BY e.profile_id ORDER BY e.start_date, e.id) AS position
    FROM calendar_events e JOIN profiles p ON p.id=e.profile_id
    WHERE p.family_id=$1 AND (
      (e."repeat"='none' AND e.start_date BETWEEN $2::date AND $3::date)
      OR (e."repeat"<>'none' AND e.start_date<=$3::date AND (e.repeat_ended_on IS NULL OR e.repeat_ended_on>=$2::date))
    )
  ) ranked
  WHERE position<=$4`;

export function createCalendarNotificationsRepository(pool: Pick<Pool, 'query'>): CalendarNotificationsRepository {
  return {
    async list(familyId, now) {
      const today = todayInVietnam(now); // One captured instant per request.
      const end = addDays(today, NOTIFICATION_WINDOW_DAYS);
      const systemEvents = systemEventsInWindow(today, end);
      const rows = (await pool.query<CalendarNotificationKidEvent>(KID_EVENT_ROWS_SQL, [familyId, today, end, NOTIFICATION_EVENT_ROWS_PER_PROFILE])).rows;
      return buildCalendarNotifications({ today, systemEvents, kidEvents: rows });
    },
  };
}

/** GET /api/v1/calendar/notifications: session-authenticated, family scoped by the session only. */
export function registerCalendarNotificationRoutes(app: App, db: AppDatabase, clock: () => Date = () => new Date()) {
  app.all('/api/v1/calendar/notifications', async c => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET') {
      c.header('Allow', 'GET');
      throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    }
    if (!db.calendarNotifications) throw new AppError(503, 'CALENDAR_UNAVAILABLE', 'Calendar is unavailable.');
    return c.json(await db.calendarNotifications.list(c.get('family').id, clock()));
  });
}
