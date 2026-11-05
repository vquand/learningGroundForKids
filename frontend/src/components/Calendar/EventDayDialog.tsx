import { useEffect, useRef } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { eventIconInfo, systemEventInfo, systemEventLabel } from '../../lib/calendarEventCatalog';
import type { CalendarEventOccurrence } from '../../types/calendarEvents';
import { CalendarIconButton } from './CalendarControls';
import { CalendarScrollPanel } from './CalendarScrollPanel';
import { formatEventDate, kidEventName, RepeatBadge, EventTitle, type EventDayRow } from './EventRowParts';
import { isTopmostModal, useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';

export function EventDayDialog({ date, rows, onClose, onAdd, onEdit }: {
  date: string;
  rows: EventDayRow[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (event: CalendarEventOccurrence, element: HTMLButtonElement) => void;
}) {
  const language = useUiLanguage();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y(ref);
  useVisualViewportFit(ref);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return <div className="meal-dialog-backdrop events-day-backdrop">
    <section ref={ref} className="meal-dialog events-day-dialog" role="dialog" aria-modal="true" aria-labelledby="events-day-title"
      onKeyDown={event => { if (event.key === 'Escape' && isTopmostModal(ref.current)) { event.stopPropagation(); onClose(); } }}>
      <header className="meal-dialog-header"><h2 id="events-day-title">{uiMessage('Arrange events for {date}', { date: formatEventDate(date, language) })}</h2>
        <CalendarIconButton ref={closeRef} icon="close" aria-label={uiText('Close')} onClick={onClose} />
      </header>
      <CalendarScrollPanel label={uiText('Events for this day')}>
        <div className="events-day-dialog-list">
          {!rows.length && <p>{uiText('Empty day')}</p>}
          {rows.map(row => row.kind === 'system'
            ? <div key={row.key} className="events-row events-row--system"><img src={systemEventInfo(row.event.key).art} alt="" width="32" height="32" /><span>{systemEventLabel(row.event.key, language)}</span></div>
            : <button key={row.key} type="button" className="events-row events-row--kid is-custom-item" aria-label={kidEventName(row.occurrence, language)} onClick={event => onEdit(row.occurrence, event.currentTarget)}>
              <img src={eventIconInfo(row.occurrence.icon_key).art} alt="" width="32" height="32" /><EventTitle occurrence={row.occurrence} /><RepeatBadge repeat={row.occurrence.repeat} />
            </button>)}
        </div>
      </CalendarScrollPanel>
      <footer className="meal-dialog-footer"><button type="button" className="kid-nav-action" onClick={onClose}>{uiText('Done')}</button><button type="button" className="calendar-save-button" onClick={onAdd}>{uiText('Add event')}</button></footer>
    </section>
  </div>;
}
