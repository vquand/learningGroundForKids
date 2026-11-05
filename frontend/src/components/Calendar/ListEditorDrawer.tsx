import { CalendarScrollPanel } from './CalendarScrollPanel';
import { CalendarButtonGroup, CalendarIconButton } from './CalendarControls';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { isStudyKey, STUDY_CATALOG, studyEntry, studyLabel, type StudyGroup, type StudyKey } from '../../lib/calendarCatalog';
import {
  hasStudy, toggleStudy, dragRowOffset, moveStudyItem, moveStudyItemTo, removeStudyItem, renameStudyDraftItem, STUDY_LIST_CAP,
} from '../../lib/calendarHelpers';
import { reduceRowDrag, rowDragView, type RowDragEvent, type RowDragState, type RowDragView } from '../../lib/calendarDragState';
import type { CalendarDay, CalendarList, CalendarScope, StudyArea, StudyItem, StudyLibraryEntry, StudyLanguage } from '../../types/calendar';
import { filterStudyChoices, setStudyLanguage } from '../../lib/calendarStudyPlan';
import { StudyLanguageBadge } from './StudyLanguageBadge';
import { StudyLibraryDialog } from './StudyLibraryDialog';
import { RenameItemDialog } from './RenameItemDialog';
import { CALENDAR_COPY, CALENDAR_WEEKDAY_KEYS } from './calendarCopy';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';

interface Draft { items: StudyItem[]; scope: CalendarScope; }

interface Props {
  profileId: string;
  library: StudyLibraryEntry[];
  onLibraryChanged: () => Promise<unknown>;
  onRename: (index: number, name: string) => Promise<CalendarList>;
  day: CalendarDay;
  area: StudyArea;
  list: CalendarList;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<void>;
  onRestore: () => Promise<void>;
  returnFocus: HTMLButtonElement | null;
}

const GROUPS: readonly { id: StudyGroup; label: string }[] = [
  { id: 'subject', label: CALENDAR_COPY.subjects },
  { id: 'pe', label: CALENDAR_COPY.pe },
  { id: 'club', label: CALENDAR_COPY.clubs },
];

function formatDate(date: string, language: ReturnType<typeof useUiLanguage>): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${date}T12:00:00+07:00`));
}

function weekdayName(weekday: number): string {
  return uiText(CALENDAR_WEEKDAY_KEYS[weekday - 1] ?? CALENDAR_WEEKDAY_KEYS[0]);
}

function releasePointer(handle: HTMLElement, pointerId: number) {
  try { handle.releasePointerCapture(pointerId); } catch { /* the pointer was not captured */ }
}

export function ListEditorDrawer({ profileId, library, onLibraryChanged, onRename, day, area, list, onClose, onSave, onRestore, returnFocus }: Props) {
  const language = useUiLanguage();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalA11y(dialogRef);
  useVisualViewportFit(dialogRef);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const dragRef = useRef<RowDragState | null>(null);
  const handleRef = useRef<HTMLElement | null>(null);
  const [dragView, setDragView] = useState<RowDragView | null>(null);
  // Server positions stay stable while the local draft can add, remove and reorder rows.
  const originalIndices = useRef(new WeakMap<StudyItem, number>());
  const [draft, setDraft] = useState<Draft>(() => {
    const items = list.items.filter((item): item is StudyItem => Boolean(item && typeof item === 'object' && 'subject' in item && isStudyKey(item.subject)));
    items.forEach(item => originalIndices.current.set(item, list.items.indexOf(item)));
    return { items, scope: list.source === 'override' ? 'date' : 'template' };
  });
  const [group, setGroup] = useState<StudyGroup | 'favorites'>(() => library.length ? 'favorites' : 'subject');
  const [search, setSearch] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [renaming, setRenaming] = useState<{ index: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = useCallback(() => { onClose(); window.setTimeout(() => returnFocus?.focus(), 0); }, [onClose, returnFocus]);

  // Every row-drag transition goes through the pure reducer; this applies its result to the ref, pointer capture, UI and draft.
  const applyDrag = useCallback((event: RowDragEvent) => {
    const transition = reduceRowDrag(dragRef.current, event);
    dragRef.current = transition.state;
    if (transition.state === null) {
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle && transition.endedPointerId !== null) releasePointer(handle, transition.endedPointerId);
    }
    setDragView(rowDragView(transition.state));
    if (transition.commit) {
      const { from, to } = transition.commit;
      setDraft((current) => ({ ...current, items: moveStudyItemTo(current.items, from, to) }));
    }
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || libraryOpen || renaming) return;
      // Escape cancels an in-progress row drag first; a second press closes the drawer.
      if (dragRef.current) { applyDrag({ type: 'cancel' }); return; }
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, applyDrag, libraryOpen, renaming]);

  // Pointer up/cancel and window blur end a drag even when the pointer ends outside the list. Unmount clears it.
  useEffect(() => {
    const onPointerEnd = (event: PointerEvent) => applyDrag({ type: 'release', pointerId: event.pointerId });
    const onPointerCancel = (event: PointerEvent) => applyDrag({ type: 'cancel', pointerId: event.pointerId });
    const onBlur = () => applyDrag({ type: 'cancel' });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onBlur);
      dragRef.current = null;
      handleRef.current = null;
    };
  }, [applyDrag]);

  const palette = useMemo(() => filterStudyChoices(group === 'favorites' ? library.map(entry => ({ ...studyEntry(entry.subject), favoriteId: entry.id, name: entry.name })) : STUDY_CATALOG.filter((entry) => entry.group === group), search), [group, library, search]);
  const rowLabel = uiText(area === 'study_extra' ? CALENDAR_COPY.extra : area === 'study_morning' ? CALENDAR_COPY.morning : CALENDAR_COPY.afternoon);
  const dateLabel = formatDate(day.date, language);
  const title = uiMessage(CALENDAR_COPY.editList, { row: rowLabel, date: dateLabel });

  const submit = async () => {
    setBusy(true); setError('');
    try { await onSave(draft); close(); }
    catch (caught) { setError(caught instanceof Error && caught.message ? caught.message : uiText(CALENDAR_COPY.saveError)); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    setBusy(true); setError('');
    try { await onRestore(); close(); }
    catch (caught) { setError(caught instanceof Error && caught.message ? caught.message : uiText(CALENDAR_COPY.restoreError)); }
    finally { setBusy(false); }
  };

  const changeTeachingLanguage = (index: number, language: StudyLanguage | '') => {
    setDraft(current => ({ ...current, items: current.items.map((item, position) => {
      if (position !== index) return item;
      const replacement = setStudyLanguage(item, language);
      const origin = originalIndices.current.get(item);
      if (origin !== undefined) originalIndices.current.set(replacement, origin);
      return replacement;
    }) }));
  };

  const startRowDrag = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (day.is_past || event.button !== 0 || dragRef.current || draft.items.length < 2) return;
    const rects = draft.items.map((_, rowIndex) => rowRefs.current[rowIndex]?.getBoundingClientRect() ?? null);
    const dragged = rects[index];
    const first = rects[0];
    const second = rects[1];
    if (!dragged || !first || !second) return;
    const step = second.top - first.top;
    if (!(step > 0)) return;
    // Capture on press, not after movement, so a release outside the list still reaches the drag.
    handleRef.current = event.currentTarget;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* window listeners still end the drag */ }
    applyDrag({
      type: 'press',
      pointerId: event.pointerId,
      index,
      count: draft.items.length,
      x: event.clientX,
      y: event.clientY,
      grabOffset: event.clientY - (dragged.top + dragged.height / 2),
      step,
      otherCenters: rects.flatMap((rect, rowIndex) => (rect && rowIndex !== index ? [rect.top + rect.height / 2] : [])),
    });
  };

  const moveRowDrag = (event: ReactPointerEvent<HTMLOListElement>) => {
    if (!dragRef.current) return;
    applyDrag({ type: 'move', pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  };

  const onListLostCapture = (event: ReactPointerEvent<HTMLOListElement>) => {
    applyDrag({ type: 'cancel', pointerId: event.pointerId });
  };

  return (
    <><aside ref={dialogRef} className={`calendar-editor calendar-study-editor${day.is_past ? ' is-past-editor' : ''}`} role="dialog" aria-modal="true" aria-labelledby="calendar-editor-title">
      <header className="calendar-editor-header">
        <div>
          <p className="calendar-eyebrow">{uiText(CALENDAR_COPY.study)}</p>
          <h2 id="calendar-editor-title">{title}</h2>
        </div>
        <CalendarIconButton icon="close" ref={closeRef} aria-label={uiText(CALENDAR_COPY.closeEditor)} onClick={close} disabled={busy} />
      </header>
      <div className="calendar-editor-body">
        {!day.is_past && <section className="calendar-palette">
          <div className="calendar-section-heading"><h3>{uiText(CALENDAR_COPY.study)}</h3><span>{uiMessage(CALENDAR_COPY.selectedEntries, { count: draft.items.length, max: STUDY_LIST_CAP })}</span></div>
          <div className="calendar-group-tabs" role="tablist" aria-label={uiText(CALENDAR_COPY.studyGroups)}>
            {GROUPS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={group === item.id} className={group === item.id ? 'is-active' : ''} onClick={() => { setGroup(item.id); }}>{uiText(item.label)}</button>)}
            <button type="button" role="tab" aria-selected={group === 'favorites'} className={group === 'favorites' ? 'is-active' : ''} onClick={() => { setGroup('favorites'); }}>{uiText('Favorites')}</button>
          </div>
          <label className="calendar-field calendar-subject-search"><span>{uiText('Search subjects')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
          {group === 'favorites' && <button type="button" className="calendar-library-button" onClick={() => setLibraryOpen(true)}>{uiText('Manage favorite subjects')}</button>}
          <CalendarScrollPanel label={uiText(CALENDAR_COPY.studyChoices)} resetKey={`${group}:${search}`}><div className="calendar-palette-grid">
            {palette.map((entry) => {
              const customName = 'name' in entry && typeof entry.name === 'string' ? entry.name : undefined;
              const name = customName ?? studyLabel(entry.key as StudyKey, language);
              const choice: StudyItem = { subject: entry.key as StudyKey, ...(customName ? { name: customName } : {}) };
              const selected = hasStudy(draft.items, choice);
              return <button key={'favoriteId' in entry ? String(entry.favoriteId) : entry.key} type="button" className={`calendar-palette-choice${customName ? ' is-custom-item' : ''}`} title={name} disabled={day.is_past || (!selected && draft.items.length >= STUDY_LIST_CAP)} aria-pressed={selected} aria-label={uiMessage(CALENDAR_COPY.addToList, { name })} onClick={() => setDraft((current) => ({ ...current, items: toggleStudy(current.items, choice) }))}>
                <img src={entry.art} alt="" width="32" height="32" />
                <span>{name}</span>
              </button>;
            })}
          </div>
          </CalendarScrollPanel>
        </section>}
        <section className="calendar-ordered-list" aria-label={uiText(CALENDAR_COPY.selectedStudySubjects)}>
          <div className="calendar-section-heading"><h3>{uiText(CALENDAR_COPY.yourOrder)}</h3><span>{uiText('Tap a name to rename it.')}</span></div>
          {draft.items.length ? <ol
            className={`calendar-study-order${dragView ? ' is-drag-active' : ''}`}
            onPointerMove={moveRowDrag}
            onLostPointerCapture={onListLostCapture}
          >
            {draft.items.map((item, index) => {
              const name = item.name ?? studyLabel(item.subject, language);
              const offset = dragView ? dragRowOffset(index, dragView.from, dragView.target, dragView.dy, dragView.step) : 0;
              const dragging = dragView?.from === index;
              const transform = dragging
                ? `translate3d(0, ${offset}px, 0) scale(1.02)`
                : offset ? `translate3d(0, ${offset}px, 0)` : undefined;
              return <li
                key={`${item.subject}-${index}`}
                ref={(element) => { rowRefs.current[index] = element; }}
                className={[dragging ? 'is-dragging' : '', item.name ? 'is-custom-item' : ''].filter(Boolean).join(' ')}
                style={transform ? { transform } : undefined}
              >
                <div className="calendar-order-handle" onPointerDown={(event) => startRowDrag(event, index)}>
                  <img src={studyEntry(item.subject).art} alt="" width="32" height="32" draggable={false} />
                  <button type="button" className="calendar-item-name" disabled={busy} aria-label={`${uiText('Rename')} ${name}`} onPointerDown={event => event.stopPropagation()} onClick={() => setRenaming({ index, name })}>{name}</button>
                </div>
                {day.is_past ? <StudyLanguageBadge language={item.teaching_language} /> : <CalendarButtonGroup
                  label={uiMessage('Teaching language for {name}', { name })}
                  buttons={([
                    { value: '', label: 'N/A', accessibleLabel: uiText('Unspecified') },
                    { value: 'en', label: 'EN', accessibleLabel: uiText('English') },
                    { value: 'vi', label: 'VI', accessibleLabel: uiText('Vietnamese') },
                  ] as const).map(option => ({
                    key: option.value, label: option.label, accessibleLabel: option.accessibleLabel,
                    pressed: (item.teaching_language ?? '') === option.value, disabled: busy,
                    onClick: () => changeTeachingLanguage(index, option.value),
                  }))}
                />}
                {!day.is_past && <CalendarButtonGroup label={name} buttons={[
                  { key: 'up', label: '↑', accessibleLabel: uiMessage(CALENDAR_COPY.moveUp, { name }), disabled: busy || index === 0, onClick: () => setDraft(current => ({ ...current, items: moveStudyItem(current.items, index, -1) })) },
                  { key: 'down', label: '↓', accessibleLabel: uiMessage(CALENDAR_COPY.moveDown, { name }), disabled: busy || index === draft.items.length - 1, onClick: () => setDraft(current => ({ ...current, items: moveStudyItem(current.items, index, 1) })) },
                  { key: 'remove', label: '×', accessibleLabel: uiMessage(CALENDAR_COPY.removeStudy, { name }), disabled: busy, onClick: () => setDraft(current => ({ ...current, items: removeStudyItem(current.items, index) })) },
                ]} />}
              </li>;
            })}
          </ol> : <p className="calendar-list-empty">{uiText(CALENDAR_COPY.noItems)}</p>}
        </section>
      </div>
      {!day.is_past && <fieldset className="calendar-scope-choice">
        <legend>{uiText(CALENDAR_COPY.saveThisPlan)}</legend>
        <label><input type="radio" name="calendar-scope" checked={draft.scope === 'template'} onChange={() => setDraft((current) => ({ ...current, scope: 'template' }))} />{uiMessage(CALENDAR_COPY.everyWeekday, { weekday: weekdayName(day.weekday) })}</label>
        <label><input type="radio" name="calendar-scope" checked={draft.scope === 'date'} onChange={() => setDraft((current) => ({ ...current, scope: 'date' }))} />{uiText(list.source === 'override' ? CALENDAR_COPY.onlyDateChanged : CALENDAR_COPY.onlyDate).replace('{date}', dateLabel)}</label>
        {list.source === 'override' && <button type="button" className="calendar-restore-button" onClick={() => void restore()} disabled={busy}>{uiText(CALENDAR_COPY.restoreWeeklyPlan)}</button>}
      </fieldset>}
      <footer className="calendar-editor-actions">
        {error && <p className="calendar-editor-error" role="alert">{error}</p>}
        <button type="button" className="kid-nav-action" onClick={close} disabled={busy}>{uiText(day.is_past ? 'Done' : CALENDAR_COPY.cancel)}</button>
        {!day.is_past && <button type="button" className="calendar-save-button" onClick={() => void submit()} disabled={busy}>{busy ? uiText(CALENDAR_COPY.saving) : uiText(CALENDAR_COPY.save)}</button>}
      </footer>
    </aside>
    {libraryOpen && <StudyLibraryDialog profileId={profileId} library={library} onChanged={onLibraryChanged} onClose={() => setLibraryOpen(false)} />}
    {renaming && <RenameItemDialog name={renaming.name} maxLength={40} onClose={() => setRenaming(null)} onSave={async name => {
      const item = draft.items[renaming.index];
      if (!item) return;
      const originalIndex = originalIndices.current.get(item);
      const updated = renameStudyDraftItem([item], 0, name)[0];
      if (!updated) return;
      let replacement = updated;
      let savedItems: CalendarList['items'] | undefined;
      if (originalIndex !== undefined) {
        const saved = await onRename(originalIndex, name);
        savedItems = saved.items;
        const savedItem = saved.items[originalIndex];
        if (savedItem && 'subject' in savedItem && isStudyKey(savedItem.subject)) replacement = setStudyLanguage(savedItem as StudyItem, item.teaching_language ?? '');
        originalIndices.current.set(replacement, originalIndex);
      }
      setDraft(current => ({ ...current, items: current.items.map((value, position) => {
        if (position === renaming.index) return replacement;
        const origin = originalIndices.current.get(value);
        const serverItem = origin === undefined ? undefined : savedItems?.[origin];
        if (origin === undefined || !serverItem || !('series_id' in serverItem) || typeof serverItem.series_id !== 'string') return value;
        const merged = { ...value, series_id: serverItem.series_id };
        originalIndices.current.set(merged, origin);
        return merged;
      }) }));
      setRenaming(null);
    }} />}
    </>
  );
}
