import type { EventParticipant } from '../../types/calendarPeople';
import { participantRefs } from '../../lib/calendarPeople';
import { EventPeoplePicker } from './EventPeoplePicker';
import { CalendarIconButton } from './CalendarControls';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { DEFAULT_EVENT_ICON_KEY } from '../../lib/calendarEventCatalog';
import {
  addCivilDays, buildEventPayload, EVENT_REPEAT_OPTIONS, EVENT_TITLE_MAX_LENGTH, eventDayWindowEnd, isLockedStart, type EventDraftProblem,
} from '../../lib/calendarEventHelpers';
import type { CalendarEventInput, CalendarEventRepeat } from '../../types/calendarEvents';
import { CALENDAR_COPY } from './calendarCopy';
import { CALENDAR_EVENTS_COPY, CALENDAR_EVENTS_SHORT_WEEKDAYS } from './calendarEventsCopy';
import { EventIconPicker } from './EventIconPicker';
import { isTopmostModal, useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';

/** The occurrence or series being edited. `revision` is the value the editor last read (updated after a 409). */
export interface EventEditTarget {
  event_id: string;
  participants?: EventParticipant[];
  title: string;
  icon_key: string;
  repeat: CalendarEventRepeat;
  revision: number;
  /** Series anchor from the server; the save sends it unchanged for a started event. */
  start_date: string;
  /** Inclusive last repeat day once stopped, else null. */
  repeat_ended_on: string | null;
  /** Date of the occurrence the editor was opened from. */
  date: string;
}

export interface EventEditorWeekDay {
  date: string;
  /** 1 (Monday) to 7 (Sunday). */
  weekday: number;
}

interface Props {
  profileId: string;
  /** null opens a new event. */
  target: EventEditTarget | null;
  initialDate: string;
  today: string;
  weekDays: readonly EventEditorWeekDay[];
  returnFocus: HTMLElement | null;
  onClose: () => void;
  /** Resolves when saved. Rejects with an Error whose message is shown and whose draft stays on screen. */
  onSave: (payload: CalendarEventInput) => Promise<void>;
  onStopRepeat: () => Promise<void>;
  onDelete: () => Promise<void>;
}

type Confirm = 'stop' | 'delete' | null;

function formatDate(date: string, language: ReturnType<typeof useUiLanguage>): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(`${date}T12:00:00+07:00`));
}

function dayNumber(date: string): number {
  return Number(date.slice(8, 10));
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

function problemMessage(problem: EventDraftProblem): string {
  switch (problem) {
    case 'title_required': return uiText(CALENDAR_EVENTS_COPY.nameRequired);
    case 'title_too_long': return uiText(CALENDAR_EVENTS_COPY.nameTooLong);
    case 'day_invalid':
    case 'day_out_of_range': return uiText(CALENDAR_EVENTS_COPY.dayRange);
    default: return uiText(CALENDAR_EVENTS_COPY.validationError);
  }
}

export function EventEditorDrawer({ profileId, target, initialDate, today, weekDays, returnFocus, onClose, onSave, onStopRepeat, onDelete }: Props) {
  const language = useUiLanguage();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalA11y(dialogRef);
  useVisualViewportFit(dialogRef);
  const storedStart = target?.start_date;
  const lockedStart = target !== null && isLockedStart(storedStart, today);
  const dateEditable = !lockedStart;
  const maxDate = eventDayWindowEnd(today);
  const firstDay = addCivilDays(today, 1 - (new Date(`${today}T12:00:00Z`).getUTCDay() || 7));

  const [people, setPeople] = useState<EventParticipant[]>(target?.participants ?? []);
  const [title, setTitle] = useState(target?.title ?? '');
  const [icon, setIcon] = useState(target?.icon_key ?? DEFAULT_EVENT_ICON_KEY);
  const [date, setDate] = useState(storedStart ?? initialDate);
  const [repeat, setRepeat] = useState<CalendarEventRepeat>(target?.repeat ?? 'none');
  const [problem, setProblem] = useState<EventDraftProblem | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const close = useCallback(() => {
    onClose();
    window.setTimeout(() => returnFocus?.focus(), 0);
  }, [onClose, returnFocus]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopmostModal(dialogRef.current)) return;
      // Escape first cancels a pending stop/delete confirmation; a second press closes the drawer.
      if (confirm) { setConfirm(null); return; }
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, confirm]);

  const submit = async () => {
    setError('');
    const result = buildEventPayload(
      { title, icon_key: icon, start_date: dateEditable ? date : (storedStart ?? date), repeat },
      { today, editing: target !== null, lockedStart },
    );
    if (!result.ok) { setProblem(result.problem); return; }
    setProblem(null);
    setBusy(true);
    try {
      await onSave({...result.value, participants:participantRefs(people)});
      close();
    } catch (caught) {
      setError(messageOf(caught, uiText(CALENDAR_EVENTS_COPY.saveError)));
    } finally {
      setBusy(false);
    }
  };

  const runConfirmed = async (action: 'stop' | 'delete') => {
    setError('');
    setBusy(true);
    try {
      if (action === 'stop') await onStopRepeat();
      else await onDelete();
      close();
    } catch (caught) {
      setError(messageOf(caught, uiText(action === 'stop' ? CALENDAR_EVENTS_COPY.stopError : CALENDAR_EVENTS_COPY.deleteError)));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const titleHintId = 'events-title-hint';
  const titleProblem = problem === 'title_required' || problem === 'title_too_long';
  const heading = uiText(target ? CALENDAR_EVENTS_COPY.editEvent : CALENDAR_EVENTS_COPY.newEvent);
  // Stop repeating only applies to a live series: one-offs and already-stopped series have nothing to stop.
  const canStopRepeating = target !== null && target.repeat !== 'none' && target.repeat_ended_on === null;

  return (
    <aside ref={dialogRef} className="calendar-editor events-editor" role="dialog" aria-modal="true" aria-labelledby="events-editor-title">
      <header className="calendar-editor-header">
        <div>
          <p className="calendar-eyebrow">{uiText(CALENDAR_COPY.events)}</p>
          <h2 id="events-editor-title">{heading}</h2>
        </div>
        <CalendarIconButton icon="close" ref={closeRef} aria-label={uiText(CALENDAR_EVENTS_COPY.closeEventEditor)} onClick={close} disabled={busy} />
      </header>
      <div className="events-editor-body">
        <div className="events-editor-form">
          <div className="calendar-field events-field">
            <label htmlFor="events-title-input">{uiText(CALENDAR_EVENTS_COPY.eventName)}</label>
            <input
              id="events-title-input"
              type="text"
              value={title}
              maxLength={EVENT_TITLE_MAX_LENGTH}
              autoComplete="off"
              disabled={busy}
              aria-invalid={titleProblem}
              aria-describedby={titleHintId}
              onChange={(event) => { setTitle(event.currentTarget.value); setProblem(null); }}
            />
            <p id={titleHintId} className={`events-hint${titleProblem ? ' is-problem' : ''}`}>
              {problem && titleProblem ? problemMessage(problem) : uiText(CALENDAR_EVENTS_COPY.eventNameHint)}
            </p>
          </div>
          <fieldset className="calendar-field events-day-field">
            <legend>{uiText(CALENDAR_EVENTS_COPY.day)}</legend>
            <input
              type="date"
              aria-label={uiText(CALENDAR_EVENTS_COPY.day)}
              value={date}
              min={firstDay}
              max={maxDate}
              disabled={!dateEditable || busy}
              onChange={(event) => { setDate(event.currentTarget.value); if (!target && event.currentTarget.value < today) setRepeat('none'); setProblem(null); }}
            />
            <div className="events-quick-days" role="group" aria-label={uiText(CALENDAR_EVENTS_COPY.quickDays)}>
              {weekDays.map((day) => {
                const past = day.date < today;
                const label = formatDate(day.date, language);
                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`events-quick-day${date === day.date ? ' is-selected' : ''}`}
                    aria-pressed={date === day.date}
                    aria-label={uiMessage(CALENDAR_EVENTS_COPY.setDayTo, { date: label })}
                    disabled={!dateEditable || busy || day.date > maxDate}
                    onClick={() => { setDate(day.date); if (past && !target) setRepeat('none'); setProblem(null); }}
                  >
                    <span>{uiText(CALENDAR_EVENTS_SHORT_WEEKDAYS[day.weekday - 1] ?? CALENDAR_EVENTS_SHORT_WEEKDAYS[0])}</span>
                    <strong>{dayNumber(day.date)}</strong>
                  </button>
                );
              })}
            </div>
            {lockedStart && <p className="events-note">{uiText(CALENDAR_EVENTS_COPY.lockedStart)}</p>}
            {date < today && repeat === 'none' && <p className="events-note">{uiText('Past event · No reminder')}</p>}
            {target && <p className="events-note">{uiText('Name changes apply from the selected occurrence onward.')}</p>}
            {target?.repeat_ended_on && <p className="events-note">{uiMessage(CALENDAR_EVENTS_COPY.stoppedOn, { date: formatDate(target.repeat_ended_on, language) })}</p>}
          </fieldset>
          <fieldset className="events-repeat">
            <legend>{uiText(CALENDAR_EVENTS_COPY.repeat)}</legend>
            <div className="events-repeat-options">
              {EVENT_REPEAT_OPTIONS.map((option) => (
                <label key={option.value} className={`events-repeat-option${repeat === option.value ? ' is-checked' : ''}`}>
                  <input
                    type="radio"
                    name="event-repeat"
                    value={option.value}
                    checked={repeat === option.value}
                    disabled={busy || (date < today && (!target || target.repeat === 'none') && option.value !== 'none')}
                    onChange={() => setRepeat(option.value)}
                  />
                  <span>{uiText(option.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <EventPeoplePicker profileId={profileId} value={people} onChange={setPeople} disabled={busy} />
          {confirm && <p className="events-note">{uiText(confirm === 'stop' ? CALENDAR_EVENTS_COPY.stopNote : CALENDAR_EVENTS_COPY.deleteNote)}</p>}
          {error && <p className="events-error" role="alert">{error}</p>}
        </div>
        <section className="events-icon-column">
          <EventIconPicker value={icon} onChange={setIcon} />
        </section>
      </div>
      <footer className="calendar-editor-actions events-editor-actions">
        <div className="events-danger-group">
          {canStopRepeating && confirm === null && (
            <button type="button" className="kid-nav-action" disabled={busy} onClick={() => setConfirm('stop')}>{uiText(CALENDAR_EVENTS_COPY.stopRepeating)}</button>
          )}
          {target && confirm === null && (
            <button type="button" className="kid-nav-action events-delete-button" disabled={busy} onClick={() => setConfirm('delete')}>{uiText(CALENDAR_EVENTS_COPY.deleteEvent)}</button>
          )}
          {confirm && (
            <>
              <span className="events-confirm-question">{uiText(confirm === 'stop' ? CALENDAR_EVENTS_COPY.stopQuestion : CALENDAR_EVENTS_COPY.deleteQuestion)}</span>
              <button type="button" className="events-confirm-yes" disabled={busy} onClick={() => void runConfirmed(confirm)}>
                {uiText(confirm === 'stop' ? CALENDAR_EVENTS_COPY.yesStop : CALENDAR_EVENTS_COPY.yesDelete)}
              </button>
              <button type="button" className="kid-nav-action" disabled={busy} onClick={() => setConfirm(null)}>
                {uiText(confirm === 'stop' ? CALENDAR_EVENTS_COPY.keepRepeating : CALENDAR_EVENTS_COPY.keepEvent)}
              </button>
            </>
          )}
        </div>
        <div className="events-save-group">
          <button type="button" className="kid-nav-action" onClick={close} disabled={busy}>{uiText(CALENDAR_COPY.cancel)}</button>
          <button type="button" className="calendar-save-button" onClick={() => void submit()} disabled={busy || confirm !== null}>
            {busy ? uiText(CALENDAR_COPY.saving) : uiText(CALENDAR_COPY.save)}
          </button>
        </div>
      </footer>
    </aside>
  );
}
