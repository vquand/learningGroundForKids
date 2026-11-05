import { participantLabel } from '../../lib/calendarPeople';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import type { UiLanguage } from '../../lib/uiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { repeatOption } from '../../lib/calendarEventHelpers';
import type { CalendarEventOccurrence, CalendarSystemEvent } from '../../types/calendarEvents';
import { CALENDAR_EVENTS_COPY } from './calendarEventsCopy';

/** One row of a day list: a system event (read-only) or a kid event occurrence. Used by the expandable day card. */
export type EventDayRow =
  | { kind: 'system'; key: string; event: CalendarSystemEvent }
  | { kind: 'kid'; key: string; occurrence: CalendarEventOccurrence };

export function formatEventDate(date: string, language: UiLanguage): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(`${date}T12:00:00+07:00`));
}

/** Accessible name for a kid event row. It states whether the event repeats, so the decorative badge can stay hidden. */
export function kidEventName(occurrence: CalendarEventOccurrence, language: UiLanguage): string {
  const badge = repeatOption(occurrence.repeat).badge;
  const summary = uiMessage(CALENDAR_EVENTS_COPY.eventSummary, { title: occurrence.title, date: formatEventDate(occurrence.date, language) });
  const people = occurrence.participants?.map(person => participantLabel(person,language)).join(', ');
  return [summary,badge ? uiText(badge,language) : '',people].filter(Boolean).join(', ');
}

/** Decorative: the row's accessible name already says whether the event repeats. */
export function RepeatBadge({ repeat }: { repeat: CalendarEventOccurrence['repeat'] }) {
  const badge = repeatOption(repeat).badge;
  if (!badge) return null;
  return (
    <span className="events-repeat-badge" aria-hidden="true" title={uiText(badge)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    </span>
  );
}

export function EventTitle({occurrence}:{occurrence:CalendarEventOccurrence}) {
  const language = useUiLanguage();
  const people = occurrence.participants?.map(p => participantLabel(p,language)).join(', ');
  return <span className="events-row-title"><span>{occurrence.title}</span>{people && <small className="events-row-people">{people}</small>}</span>;
}
