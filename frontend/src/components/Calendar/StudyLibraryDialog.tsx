import { CalendarScrollPanel } from './CalendarScrollPanel';
import { CalendarIconButton } from './CalendarControls';
import { useEffect, useRef, useState } from 'react';
import { addStudyFavorite, removeStudyFavorite, updateStudyFavorite } from '../../api/calendar';
import { STUDY_CATALOG, isStudyKey, studyEntry, studyLabel, type StudyKey } from '../../lib/calendarCatalog';
import { uiText } from '../../i18n/uiText';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import type { StudyLibraryEntry } from '../../types/calendar';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';
import { useCalendarLibraryMutation } from './useCalendarLibraryMutation';
import { CALENDAR_COPY } from './calendarCopy';
import { calendarSearchText } from '../../lib/calendarFoodGroups';
import { CALENDAR_LIBRARY_CAP } from '../../lib/calendarLimits';

export function StudyLibraryDialog({ profileId, library, onChanged, onClose }: {
  profileId: string; library: StudyLibraryEntry[]; onChanged: () => Promise<unknown>; onClose: () => void;
}) {
  const language = useUiLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y(ref); useVisualViewportFit(ref);
  const [icon, setIcon] = useState<StudyKey | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<StudyLibraryEntry | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const [query, setQuery] = useState('');
  const feedback = useCalendarLibraryMutation(profileId, onChanged, () => uiText('Could not update favorites. Please try again.'));
  const { busy, error, reveal } = feedback;
  const close = () => { if (feedback.canClose()) onClose(); };
  const entries = STUDY_CATALOG.filter(entry => calendarSearchText(`${entry.en} ${entry.vi}`).includes(calendarSearchText(query)));
  const existing = library.some(entry => entry.subject === icon && entry.name === name.trim());
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { if (icon && !nameEdited) setName(studyLabel(icon, language)); }, [icon, nameEdited, language]);
  const choose = (key: StudyKey) => { if (!nameEdited || !name.trim()) setName(studyLabel(key, language)); setIcon(key); };
  const save = () => feedback.run(async () => {
    if (!icon) throw new Error('Choose an icon');
    const entry = editing ? await updateStudyFavorite(profileId, editing, icon, name.trim()) : await addStudyFavorite(profileId, icon, name.trim());
    return { revealId: entry.id, update: current => ({ ...current, study_library: [...(current.study_library ?? []).filter(row => row.id !== entry.id && row.id !== editing?.id), entry] }) };
  }, () => setEditing(null));
  const remove = (entry: StudyLibraryEntry) => feedback.run(async () => {
    await removeStudyFavorite(profileId, entry.id);
    return { update: current => ({ ...current, study_library: (current.study_library ?? []).filter(row => row.id !== entry.id) }) };
  }, () => { if (editing?.id === entry.id) { setEditing(null); setIcon(null); setName(''); setNameEdited(false); } });
  return <div ref={ref} className="meal-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <section className="meal-dialog meal-library-dialog" role="dialog" aria-modal="true" aria-labelledby="study-library-title">
      <header className="meal-dialog-header"><h2 id="study-library-title">{uiText('My subjects')}</h2><CalendarIconButton icon="close" ref={closeRef} aria-label={uiText('Close')} disabled={busy} onClick={close} /></header>
      <div className="meal-dialog-body meal-library-body">
        <div className="meal-library-column">
          <label className="calendar-field"><span>{uiText('Find an icon')}</span><input value={query} onChange={event => { setQuery(event.target.value); }} /></label>
          <CalendarScrollPanel label={uiText(CALENDAR_COPY.studyChoices)} resetKey={query}><div className="meal-food-grid">{entries.map(entry => <button key={entry.key} type="button" className="calendar-palette-choice" aria-pressed={icon === entry.key} disabled={busy} onClick={() => { if (isStudyKey(entry.key)) choose(entry.key); }}><img src={entry.art} alt="" width="32" height="32" /><span>{studyLabel(entry.key as StudyKey, language)}</span></button>)}</div></CalendarScrollPanel>
        </div>
        <div className="meal-library-column">
          <label className="calendar-field"><span>{uiText('Subject name')}</span><input className={icon ? 'calendar-name-input' : undefined} value={name} maxLength={40} disabled={!icon || busy} onChange={event => { setName(event.target.value); setNameEdited(true); }} /></label>
          <button type="button" className="calendar-save-button" disabled={!icon || !name.trim() || busy || (!editing && (existing || library.length >= CALENDAR_LIBRARY_CAP))} onClick={() => void save()}>{uiText(editing ? 'Save favorite' : existing ? 'Already in favorites' : 'Mark as favorite')}</button>
          {editing && <button type="button" className="kid-nav-action" disabled={busy} onClick={() => { setEditing(null); setIcon(null); setName(''); setNameEdited(false); }}>{uiText('Cancel')}</button>}
          <h3>{uiText('My subjects')}</h3>
          <CalendarScrollPanel label={uiText('My subjects')} revealKey={reveal.id} revealToken={reveal.token}><ol className="meal-saved-list">{library.map(entry => <li data-scroll-key={entry.id} key={entry.id} className="meal-saved-row is-custom-item"><img src={studyEntry(entry.subject).art} alt="" width="32" height="32" /><button type="button" className="calendar-item-name" aria-label={`${uiText('Edit favorite')} ${entry.name}`} disabled={busy} onClick={() => { setEditing(entry); setIcon(entry.subject); setName(entry.name); setNameEdited(true); }}>{entry.name}</button><CalendarIconButton icon="remove" disabled={busy} aria-label={`${uiText('Remove')} ${entry.name}`} onClick={() => void remove(entry)} /></li>)}</ol></CalendarScrollPanel>
        </div>
      </div>
      <footer className="meal-dialog-footer">
        <div className="meal-library-feedback">
          {feedback.saved && <p className="meal-library-status" role="status">{uiText('Favorite saved.')}</p>}
          {feedback.refreshFailed && <p className="calendar-editor-error" role="alert">{uiText(CALENDAR_COPY.refreshError)}</p>}
          {error && <p className="calendar-editor-error" role="alert">{error}</p>}
        </div>
        {feedback.refreshFailed && <button type="button" className="kid-nav-action" aria-label={uiText(CALENDAR_COPY.refreshError)} disabled={busy} onClick={() => void feedback.retry()}>{uiText(CALENDAR_COPY.retry)}</button>}
        <button type="button" className="kid-nav-action" onClick={close} disabled={busy}>{uiText('Done')}</button>
      </footer>
    </section>
  </div>;
}
