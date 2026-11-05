import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import {
  CalendarEventApiError, createCalendarEvent, deleteCalendarEvent, stopCalendarEventRepeat, updateCalendarEvent,
} from '../../api/calendarEvents';
import { eventIconInfo, systemEventInfo, systemEventLabel } from '../../lib/calendarEventCatalog';
import {
  defaultEventDate, EVENT_ROW_GAP, EVENT_ROW_HEIGHT, refreshedEventRevision, repeatOption, visibleEventRowCount,
} from '../../lib/calendarEventHelpers';
import {
  collapseDay, dayOverflowLabelTemplate, expandDay, expandedCardHeight, expandedCardMaxHeight, shouldCollapseForEscape,
  shouldCollapseForPointer, type ExpandedDay,
} from '../../lib/calendarEventExpansion';
import { CALENDAR_DAY_HEADING_HEIGHT, isCalendarWeekend } from '../../lib/calendarHelpers';
import type { CalendarDay, CalendarWeek, CalendarWindow } from '../../types/calendar';
import type { CalendarEventInput, CalendarEventOccurrence } from '../../types/calendarEvents';
import { CALENDAR_COPY, CALENDAR_WEEKDAY_KEYS } from './calendarCopy';
import { CALENDAR_EVENTS_COPY } from './calendarEventsCopy';
import { EventEditorDrawer, type EventEditTarget } from './EventEditorDrawer';
import { EventDayRow, formatEventDate, kidEventName, RepeatBadge, EventTitle } from './EventRowParts';
import { EventDayDialog } from './EventDayDialog';
import './Events.css';

export interface EventsViewProps {
  profileId: string;
  week: CalendarWeek;
  data: CalendarWindow;
  today: string;
  onChanged: () => Promise<unknown>;
  readOnly?: boolean;
  /** Toolbar action slot owned by CalendarPage. The Add event button is portaled here, never rendered in the view. */
  toolbarSlot?: HTMLElement | null;
}

interface EditorState {
  target: EventEditTarget | null;
  initialDate: string;
  returnTo: HTMLElement | null;
}

type DayRow = EventDayRow;

/** Where focus goes after an expansion change: the card's "Show fewer" control, or the day's "+N" button. */
interface FocusRequest {
  date: string;
  target: 'collapse' | 'more';
}

const EVENT_VARS = {
  '--events-row-height': `${EVENT_ROW_HEIGHT}px`,
  '--events-row-gap': `${EVENT_ROW_GAP}px`,
  '--calendar-day-heading-height': `${CALENDAR_DAY_HEADING_HEIGHT}px`,
} as CSSProperties;

/** Tracks how many rows fit the day list. Every row shows until the first measurement lands. */
function useRowCapacity(total: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setHeight(element.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[entries.length - 1]?.contentRect.height;
      if (measured !== undefined) setHeight(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visible = height === null ? total : visibleEventRowCount(height, total);
  return { ref, visible };
}

/**
 * Expanded day card layout. The card is an overlay anchored to the top of its slot. It grows downward to its content
 * height, capped so it ends 12px above the viewport bottom, and scrolls inside only past that cap. The first fit starts
 * from the collapsed slot height so the height transition has a start value; later fits re-measure with the height released.
 */
function useExpandedCardLayout(expanded: boolean, slotRef: RefObject<HTMLElement | null>, cardRef: RefObject<HTMLElement | null>, listRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const card = cardRef.current;
    const list = listRef.current;
    if (!expanded || !slot || !card || !list) return undefined;

    const fit = (starting: boolean) => {
      const slotBox = slot.getBoundingClientRect();
      const max = expandedCardMaxHeight(window.innerHeight, slotBox.top);
      card.style.setProperty('--events-expanded-max', `${max}px`);
      card.style.height = starting ? `${slotBox.height}px` : '';
      // With the height at auto, scrollHeight is the full content; the border is added back in.
      const natural = Math.ceil(card.scrollHeight + card.offsetHeight - card.clientHeight);
      card.style.height = `${expandedCardHeight(natural, max)}px`;
    };

    fit(true);
    const onResize = () => fit(false);
    window.addEventListener('resize', onResize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fit(false));
    observer?.observe(list);
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      card.style.removeProperty('height');
      card.style.removeProperty('--events-expanded-max');
    };
  }, [expanded, slotRef, cardRef, listRef]);
}

interface DayCardProps {
  day: CalendarDay;
  today: string;
  rows: DayRow[];
  readOnly: boolean;
  /** This day's card is the expanded overlay: every row is listed and the "+N" control is not shown. */
  expanded: boolean;
  onOpen: (occurrence: CalendarEventOccurrence, element: HTMLButtonElement) => void;
  onExpand: (date: string) => void;
  onCollapse: () => void;
  onArrange?: (date: string, element: HTMLButtonElement) => void;
}

/**
 * The date container above a day card. It is the same `calendar-day-heading` markup Study and Meals render, so the
 * weekend tint, today highlight and past dimming match. The card keeps the weekday and date in its accessible name.
 */
function EventsDayHeading({ day, today, onArrange }: { day: CalendarDay; today: string; onArrange?: DayCardProps['onArrange'] }) {
  const language = useUiLanguage();
  const dateLabel = formatEventDate(day.date, language);
  const isToday = day.date === today;
  const content = <>
    <strong>{uiText(CALENDAR_WEEKDAY_KEYS[day.weekday - 1] ?? CALENDAR_WEEKDAY_KEYS[0])}</strong>
    <span>{isToday ? `${dateLabel} · ${uiText(CALENDAR_COPY.today)}` : dateLabel}</span>
  </>;
  return (
    <div className={`calendar-day-heading${isCalendarWeekend(day.weekday) ? ' is-weekend' : ''}${isToday ? ' is-today' : ''}${day.is_past ? ' is-past' : ''}`}>
      {onArrange ? <button type="button" className="events-date-button" aria-label={uiMessage('Arrange events for {date}', { date: dateLabel })} onClick={event => onArrange(day.date, event.currentTarget)}>{content}</button> : content}
    </div>
  );
}

function EventsDayCard({ day, today, rows, readOnly, expanded, onOpen, onExpand, onCollapse, onArrange }: DayCardProps) {
  const language = useUiLanguage();
  const cardId = useId();
  const slotRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const { ref: listRef, visible: fittingRows } = useRowCapacity(rows.length);
  useExpandedCardLayout(expanded, slotRef, cardRef, listRef);
  // An expanded card lists every row. The collapsed card lists what fits and reserves a row for "+N".
  const visible = expanded ? rows.length : fittingRows;
  const shown = rows.slice(0, visible);
  const remaining = rows.length - shown.length;
  const interactive = !readOnly;
  const dateLabel = formatEventDate(day.date, language);
  const isToday = day.date === today;
  const classes = [
    'events-day',
    isCalendarWeekend(day.weekday) ? 'is-weekend' : '',
    isToday ? 'is-today' : '',
    day.is_past ? 'is-past' : '',
    expanded ? 'is-expanded' : '',
  ].filter(Boolean).join(' ');

  // The weekday and date are shown in the heading container above; this label keeps them in the card's name.
  // An empty day still renders the full card (border, tint, today and past styling) with a visible "Empty day" label.
  const empty = rows.length === 0;
  const cardName = `${uiText(CALENDAR_WEEKDAY_KEYS[day.weekday - 1] ?? CALENDAR_WEEKDAY_KEYS[0])} ${dateLabel}${isToday ? `, ${uiText(CALENDAR_COPY.today)}` : ''}${empty ? `, ${uiText(CALENDAR_EVENTS_COPY.emptyDay)}` : ''}`;
  return (
    <div ref={slotRef} className="events-day-slot">
      <section ref={cardRef} id={cardId} className={classes} aria-label={cardName} data-day={day.date}>
        {!readOnly && onArrange && <button type="button" className="events-day-open" aria-label={uiMessage('Arrange events for {date}', { date: dateLabel })} onClick={event => onArrange(day.date, event.currentTarget)} />}
        {/* Keyboard and screen-reader collapse only: visually hidden until it takes focus. */}
        {expanded && (
          <button type="button" className="events-collapse" aria-controls={cardId} onClick={onCollapse}>{uiText(CALENDAR_EVENTS_COPY.showFewer)}</button>
        )}
        <div ref={listRef} className="events-day-list">
          {empty && (
            <p className="events-empty">
              <svg className="events-empty-calendar" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <rect x="7" y="10" width="34" height="31" rx="5" fill="#e9e4da" stroke="#8a949a" strokeWidth="2.5" />
                <path d="M7 19h34" stroke="#8a949a" strokeWidth="2.5" />
                <path d="M16 6v8M32 6v8" stroke="#8a949a" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M15 27h6M27 27h6M15 34h6M27 34h6" stroke="#b3bbbf" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="events-empty-label">{uiText(CALENDAR_EVENTS_COPY.emptyDay)}</span>
            </p>
          )}
          {shown.map((row) => {
            if (row.kind === 'system') {
              const label = systemEventLabel(row.event.key, language);
              return (
                <div key={row.key} className="events-row events-row--system" title={label}>
                  <img src={systemEventInfo(row.event.key).art} alt="" width="24" height="24" draggable={false} />
                  <span className="events-row-title"><span className="events-sr-only">{uiText(CALENDAR_EVENTS_COPY.specialDay)}: </span>{label}</span>
                </div>
              );
            }
            const occurrence = row.occurrence;
            const badge = repeatOption(occurrence.repeat).badge;
            const name = kidEventName(occurrence, language);
            const rowClass = `events-row events-row--kid is-custom-item${badge ? ' is-repeating' : ''}`;
            const content = (
              <>
                <img src={eventIconInfo(occurrence.icon_key).art} alt="" width="24" height="24" draggable={false} />
                <EventTitle occurrence={occurrence} />
                <RepeatBadge repeat={occurrence.repeat} />
              </>
            );
            if (!interactive) {
              return <div key={row.key} className={`${rowClass} is-readonly`} role="group" aria-label={name} title={occurrence.title}>{content}</div>;
            }
            return (
              <button
                key={row.key}
                type="button"
                className={rowClass}
                aria-label={name}
                title={occurrence.title}
                onClick={(event) => onOpen(occurrence, event.currentTarget)}
              >
                {content}
              </button>
            );
          })}
          {remaining > 0 && (
            <button
              type="button"
              className="events-more"
              aria-expanded={false}
              aria-label={uiMessage(dayOverflowLabelTemplate(rows.length), { count: rows.length, date: dateLabel })}
              onClick={() => onExpand(day.date)}
            >
              {uiMessage(CALENDAR_EVENTS_COPY.moreEventsShort, { count: remaining })}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export function EventsView({ profileId, week, data, today, onChanged, readOnly = false, toolbarSlot = null }: EventsViewProps) {
  useUiLanguage();
  const days = week.days.slice(0, 7);
  const weekDates = days.map((day) => day.date);
  const [arrangedDay, setArrangedDay] = useState<{ date: string; opener: HTMLButtonElement } | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  // Set when a 409 carried no revision. Only window data that arrived after the conflict (a new `data` object
  // that differs from the baseline read at conflict time) may advance the editor's revision.
  const [revisionSync, setRevisionSync] = useState<{ eventId: string; baseline: CalendarWindow } | null>(null);
  const addRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  // One card at a time. Expanding a card collapses the previous one.
  const [expandedDate, setExpandedDate] = useState<ExpandedDay>(null);
  const focusRequest = useRef<FocusRequest | null>(null);
  // A week switch drops an expansion whose day is no longer shown. Adjusted during render, so no stale card reappears.
  if (expandedDate !== null && !weekDates.includes(expandedDate)) setExpandedDate(collapseDay());

  // Focus lands on the control the expansion change just mounted (the card's "Show fewer" or the day's "+N").
  // The "+N" button is mounted a frame later than the collapse (the card re-measures how many rows fit), so retry briefly.
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    const control = request.target === 'more' ? '.events-more' : '.events-collapse';
    let frames = 0;
    let handle = 0;
    const attempt = () => {
      const element = rootRef.current?.querySelector<HTMLElement>(`.events-day[data-day="${request.date}"] ${control}`);
      if (element) {
        focusRequest.current = null;
        element.focus({ preventScroll: true });
        return;
      }
      if (++frames < 12) handle = requestAnimationFrame(attempt);
      else focusRequest.current = null;
    };
    attempt();
    return () => cancelAnimationFrame(handle);
  }, [expandedDate]);

  // While a card is expanded, a press outside it collapses it, and Escape collapses it too. The editor pauses both:
  // a row opened from the card leaves the card expanded underneath, and the editor's own Escape handling is untouched.
  useEffect(() => {
    if (expandedDate === null || editor !== null || arrangedDay !== null) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const card = rootRef.current?.querySelector<HTMLElement>(`.events-day[data-day="${expandedDate}"]`);
      const inside = card !== null && card !== undefined && event.target instanceof Node && card.contains(event.target);
      if (shouldCollapseForPointer(expandedDate, inside)) setExpandedDate(collapseDay());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !shouldCollapseForEscape(expandedDate)) return;
      focusRequest.current = { date: expandedDate, target: 'more' };
      setExpandedDate(collapseDay());
    };
    // Capture phase: the collapse sees the press before any control handles it, and the press itself is never cancelled.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expandedDate, editor, arrangedDay]);

  useEffect(() => {
    if (!revisionSync || data === revisionSync.baseline) return;
    const { eventId } = revisionSync;
    const revision = refreshedEventRevision(data.events, eventId);
    setRevisionSync(null);
    if (revision === null) return;
    setEditor((current) => (current?.target?.event_id === eventId ? { ...current, target: { ...current.target, revision } } : current));
  }, [data, revisionSync]);

  const closeEditor = () => setEditor(null);

  const openCreate = () => {
    setExpandedDate(collapseDay());
    setEditor({ target: null, initialDate: defaultEventDate(weekDates, today), returnTo: addRef.current });
  };

  const openDay = (date: string, opener: HTMLButtonElement) => {
    setExpandedDate(collapseDay());
    setArrangedDay({ date, opener });
  };
  const closeDay = () => {
    const opener = arrangedDay?.opener;
    setArrangedDay(null);
    window.setTimeout(() => opener?.focus(), 0);
  };

  const addFromDay = () => {
    if (!arrangedDay) return;
    const { date, opener } = arrangedDay;
    setArrangedDay(null);
    setEditor({ target: null, initialDate: date, returnTo: opener });
  };

  const openOccurrence = (occurrence: CalendarEventOccurrence, element: HTMLButtonElement) => {
    const returnTo = arrangedDay?.opener ?? element;
    setArrangedDay(null);
    setEditor({
      target: {
        event_id: occurrence.event_id,
        participants: occurrence.participants,
        title: occurrence.title,
        icon_key: occurrence.icon_key,
        repeat: occurrence.repeat,
        revision: occurrence.revision,
        start_date: occurrence.start_date,
        repeat_ended_on: occurrence.repeat_ended_on,
        date: occurrence.date,
      },
      initialDate: occurrence.date,
      returnTo,
    });
  };

  const expandFromMore = (date: string) => {
    focusRequest.current = { date, target: 'collapse' };
    setExpandedDate(expandDay(date));
  };
  const collapseFromControl = () => {
    if (expandedDate === null) return;
    focusRequest.current = { date: expandedDate, target: 'more' };
    setExpandedDate(collapseDay());
  };

  /** Keeps the draft: a conflict only refreshes the revision the next write must send. */
  const adoptCurrentRevision = (error: CalendarEventApiError, eventId: string) => {
    if (error.currentRevision !== undefined) {
      const revision = error.currentRevision;
      setEditor((current) => (current?.target?.event_id === eventId ? { ...current, target: { ...current.target, revision } } : current));
    } else {
      setRevisionSync({ eventId, baseline: data });
    }
    void onChanged();
  };

  /** Converts an API error into the message the drawer shows. Always throws. */
  const raise = (error: unknown, eventId: string | undefined, conflictMessage: string, fallback: string): never => {
    if (error instanceof CalendarEventApiError) {
      if (error.kind === 'conflict') {
        if (eventId) adoptCurrentRevision(error, eventId);
        throw new Error(uiText(conflictMessage));
      }
      if (error.code === 'CALENDAR_PARTICIPANT_UNAVAILABLE') throw new Error(uiText('Some people are no longer available. Choose people again.'));
      if (error.kind === 'events_full') throw new Error(uiText(CALENDAR_EVENTS_COPY.eventsFull));
      if (error.kind === 'not_found') {
        void onChanged();
        throw new Error(uiText(CALENDAR_EVENTS_COPY.notFound));
      }
      if (error.kind === 'validation') throw new Error(uiText(CALENDAR_EVENTS_COPY.validationError));
    }
    throw new Error(uiText(fallback));
  };

  const saveEvent = async (payload: CalendarEventInput) => {
    const target = editor?.target ?? null;
    try {
      if (target) await updateCalendarEvent(profileId, target.event_id, { ...payload, expected_revision: target.revision, from_date: target.date });
      else await createCalendarEvent(profileId, payload);
    } catch (error) {
      raise(error, target?.event_id, CALENDAR_EVENTS_COPY.saveConflict, CALENDAR_EVENTS_COPY.saveError);
    }
    await onChanged();
  };

  const stopRepeat = async () => {
    const target = editor?.target;
    if (!target) return;
    try {
      await stopCalendarEventRepeat(profileId, target.event_id, target.revision);
    } catch (error) {
      raise(error, target.event_id, CALENDAR_EVENTS_COPY.actionConflict, CALENDAR_EVENTS_COPY.stopError);
    }
    await onChanged();
  };

  const removeEvent = async () => {
    const target = editor?.target;
    if (!target) return;
    try {
      await deleteCalendarEvent(profileId, target.event_id, target.revision);
    } catch (error) {
      raise(error, target.event_id, CALENDAR_EVENTS_COPY.actionConflict, CALENDAR_EVENTS_COPY.deleteError);
    }
    await onChanged();
  };

  const rowsFor = (date: string): DayRow[] => [
    ...data.system_events.filter((event) => event.date === date).map((event) => ({ kind: 'system' as const, key: `system:${event.key}:${date}`, event })),
    ...data.events.filter((event) => event.date === date).map((occurrence) => ({ kind: 'kid' as const, key: `kid:${occurrence.event_id}:${date}`, occurrence })),
  ];

  return (
    <section ref={rootRef} className="events-view" aria-label={uiText(CALENDAR_COPY.events)} style={EVENT_VARS}>
      {!readOnly && toolbarSlot && createPortal(
        <button ref={addRef} type="button" className="calendar-toolbar-button" onClick={openCreate}>
          <span className="calendar-toolbar-plus" aria-hidden="true">+</span>
          <span className="calendar-toolbar-label">{uiText(CALENDAR_EVENTS_COPY.addEvent)}</span>
        </button>,
        toolbarSlot,
      )}
      <div className="events-week">
        {/* Seven heading containers fill the first grid row; the seven day cards fill the second, so the widths align. */}
        {days.map((day) => <EventsDayHeading key={`heading:${day.date}`} day={day} today={today} onArrange={readOnly ? undefined : openDay} />)}
        {days.map((day) => (
          <EventsDayCard
            key={day.date}
            day={day}
            today={today}
            rows={rowsFor(day.date)}
            readOnly={readOnly}
            expanded={expandedDate === day.date}
            onOpen={openOccurrence}
            onExpand={expandFromMore}
            onCollapse={collapseFromControl}
            onArrange={readOnly ? undefined : openDay}
          />
        ))}
      </div>
      {arrangedDay && !readOnly && createPortal(<EventDayDialog date={arrangedDay.date} rows={rowsFor(arrangedDay.date)} onClose={closeDay} onEdit={openOccurrence} onAdd={addFromDay} />, toolbarSlot?.closest('.calendar-page') ?? document.body)}
      {/* A transformed week pane would offset and shorten the fixed editor. */}
      {editor && !readOnly && createPortal(
        <EventEditorDrawer
          profileId={profileId}
          key={editor.target?.event_id ?? 'new'}
          target={editor.target}
          initialDate={editor.initialDate}
          today={today}
          weekDays={days.map((day) => ({ date: day.date, weekday: day.weekday }))}
          returnFocus={editor.returnTo}
          onClose={closeEditor}
          onSave={saveEvent}
          onStopRepeat={stopRepeat}
          onDelete={removeEvent}
        />, toolbarSlot?.closest('.calendar-page') ?? document.body
      )}
    </section>
  );
}

