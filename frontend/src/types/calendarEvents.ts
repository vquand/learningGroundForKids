import type { EventParticipant, EventParticipantRef } from './calendarPeople';
/** Kid-event contract (plan section 15). The server owns every value; the browser only echoes revisions. */
export const EVENT_REPEAT_VALUES = ['none', 'weekly', 'monthly', 'yearly'] as const;
export type CalendarEventRepeat = typeof EVENT_REPEAT_VALUES[number];

export const SYSTEM_EVENT_KEYS = ['tet', 'mid_autumn', 'halloween', 'christmas', 'national_day', 'womens_day_oct20', 'womens_day_mar8', 'teachers_day', 'childrens_day'] as const;
export type SystemEventKey = typeof SYSTEM_EVENT_KEYS[number];

/** One occurrence of a kid event inside the 14-day window (`GET .../calendar` `events[]`). */
export interface CalendarEventOccurrence {
  event_id: string;
  /** Day this occurrence falls on. */
  date: string;
  title: string;
  icon_key: string;
  repeat: CalendarEventRepeat;
  /** Last day a repeating series still occurs (inclusive), or null when it has not been stopped. */
  repeat_ended_on: string | null;
  /** Series anchor: the editor saves against this date, never against `date`. */
  start_date: string;
  revision: number;
  participants?: EventParticipant[];
}

/** A kid event row as returned by create, update and stop-repeat. */
export interface CalendarKidEvent {
  id: string;
  title: string;
  icon_key: string;
  start_date: string;
  repeat: CalendarEventRepeat;
  repeat_ended_on: string | null;
  revision: number;
  participants?: EventParticipant[];
}

export interface CalendarSystemEvent {
  key: SystemEventKey;
  date: string;
}

export interface CalendarEventInput {
  participants?: EventParticipantRef[];
  title: string;
  icon_key: string;
  start_date: string;
  repeat: CalendarEventRepeat;
}

export interface CalendarEventUpdateInput extends CalendarEventInput {
  expected_revision: number;
  from_date?: string;
}
