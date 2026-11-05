import { CalendarScrollPanel } from './CalendarScrollPanel';
import { CalendarIconButton } from './CalendarControls';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { mealFoodArt, mealFoodLabel, medicineColorCss, medicineColorLabel, medicineMethodArt, medicineMethodLabel } from '../../lib/calendarMealCatalog';
import {
  addPlanItem, canAddPlanItem, capForArea, libraryEntryName, libraryEntryToItem, MEAL_CUSTOM_NAME_MAX, MEAL_LIBRARY_CAP, mealEditorScope, parseMealPlanItems, removePlanItemAt,
} from '../../lib/calendarMealHelpers';
import type { CalendarDay, CalendarList, CalendarScope } from '../../types/calendar';
import type { MealLibraryEntry, MealPlanItem, MealsArea, MedicineItem, MedicineRepeatDraft } from '../../types/calendarMeals';
import { CALENDAR_COPY, CALENDAR_WEEKDAY_KEYS } from './calendarCopy';
import { CALENDAR_MEALS_COPY } from './calendarMealsCopy';
import { MealLibraryDialog } from './MealLibraryDialog';
import { MedicineDialog } from './MedicineDialog';
import { RenameItemDialog } from './RenameItemDialog';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';
import { FastFoodNotice } from './FastFoodNotice';
import { MEDICINE_WEEKDAY_LABELS } from '../../lib/calendarMedicineRepeats';
import { hasFastFood } from '../../lib/calendarFoodGroups';

export interface MealDraft { items: MealPlanItem[]; scope: CalendarScope; medicineRepeats?: MedicineRepeatDraft[]; }

interface Props {
  profileId: string;
  day: CalendarDay;
  area: MealsArea;
  list: CalendarList;
  library: MealLibraryEntry[];
  onClose: () => void;
  onSave: (draft: MealDraft) => Promise<void>;
  onRestore: () => Promise<void>;
  onLibraryChanged: () => Promise<unknown>;
  onRename: (index: number, name: string) => Promise<void>;
  returnFocus: HTMLButtonElement | null;
}

type DialogKind = 'library' | 'medicine';
type Language = ReturnType<typeof useUiLanguage>;

function formatDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${date}T12:00:00+07:00`));
}

function weekdayName(weekday: number): string {
  return uiText(CALENDAR_WEEKDAY_KEYS[weekday - 1] ?? CALENDAR_WEEKDAY_KEYS[0]);
}

function slotLabel(area: MealsArea): string {
  switch (area) {
    case 'meal_breakfast': return uiText(CALENDAR_MEALS_COPY.mealBreakfast);
    case 'meal_lunch': return uiText(CALENDAR_MEALS_COPY.mealLunch);
    case 'meal_snack': return uiText(CALENDAR_MEALS_COPY.mealAfternoonSnack);
    case 'meal_dinner': return uiText(CALENDAR_MEALS_COPY.mealDinner);
    case 'medicine': return uiText(CALENDAR_MEALS_COPY.medicineRow);
  }
}

/** Icon and label for one entry. Medicine entries show the method icon, a colour dot and quantity. */
function EntryIcon({ item }: { item: MealPlanItem }) {
  if ('medicine' in item) {
    return <img src={medicineMethodArt(item.medicine.method)} alt="" width="32" height="32" draggable={false} className="meal-entry-icon" />;
  }
  const key = item.food === 'custom' ? item.icon : item.food;
  return <img src={mealFoodArt(key)} alt="" width="32" height="32" draggable={false} className="meal-entry-icon" />;
}

function EntryText({ item, language, weekdays }: { item: MealPlanItem; language: Language; weekdays?: number[] }) {
  if ('medicine' in item) {
    const { method, color, qty, dose } = item.medicine;
    const detail = [medicineColorLabel(color, language), `${qty}x`, dose, weekdays?.map(day => uiText(MEDICINE_WEEKDAY_LABELS[day - 1] ?? 'MON')).join('/')].filter(Boolean).join(' · ');
    return (
      <span className="meal-entry-text">
        <strong>{medicineMethodLabel(method, language)}</strong>
        <small>{detail}</small>
      </span>
    );
  }
  const name = item.food === 'custom' ? item.name : mealFoodLabel(item.food, language);
  return <span className="meal-entry-text"><strong>{name}</strong></span>;
}

export function MealEditorDrawer({ profileId, day, area, list, library, onClose, onSave, onRestore, onLibraryChanged, onRename, returnFocus }: Props) {
  const language = useUiLanguage();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalA11y(dialogRef);
  useVisualViewportFit(dialogRef);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<MealDraft>(() => ({
    items: parseMealPlanItems(list.items, area),
    scope: mealEditorScope(list),
  }));
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [renaming, setRenaming] = useState<{ index: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isMedicineRow = area === 'medicine';
  const cap = capForArea(area);
  const full = !canAddPlanItem(draft.items, area);
  const dateLabel = formatDate(day.date, language);
  const title = isMedicineRow
    ? uiMessage(CALENDAR_MEALS_COPY.medicineDrawerTitle, { date: dateLabel })
    : uiMessage(CALENDAR_MEALS_COPY.mealDrawerTitle, { row: slotLabel(area), date: dateLabel });

  const close = () => {
    onClose();
    window.setTimeout(() => returnFocus?.focus(), 0);
  };

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    // While a child dialog is open, Escape belongs to that dialog, not to the drawer.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || dialog || renaming) return;
      onClose();
      window.setTimeout(() => returnFocus?.focus(), 0);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialog, renaming, onClose, returnFocus]);

  const openDialog = (kind: DialogKind, opener: HTMLElement) => {
    dialogOpenerRef.current = opener;
    setDialog(kind);
  };

  const closeDialog = () => {
    setDialog(null);
    window.setTimeout(() => dialogOpenerRef.current?.focus(), 0);
  };

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

  const addLibraryEntry = (entry: MealLibraryEntry) => {
    setDraft((current) => ({ ...current, items: addPlanItem(current.items, libraryEntryToItem(entry), area) }));
  };

  const removeEntry = (index: number) => {
    setDraft((current) => ({ ...current, items: removePlanItemAt(current.items, index), medicineRepeats: current.medicineRepeats?.filter(repeat => repeat.item !== current.items[index]) }));
  };

  const addMedicine = (item: MedicineItem, weekdays: number[]) => {
    const reminder = { ...item, series_id: crypto.randomUUID() };
    setDraft(current => current.items.length >= cap ? current : ({ ...current,
      items: addPlanItem(current.items, reminder, area), medicineRepeats: [...(current.medicineRepeats ?? []), { item: reminder, weekdays }],
    }));
    closeDialog();
  };

  const medicineFull = isMedicineRow && full;
  const scopeDateLabel = list.source === 'override' ? uiText(CALENDAR_COPY.onlyDateChanged).replace('{date}', dateLabel) : uiText(CALENDAR_COPY.onlyDate).replace('{date}', dateLabel);

  const addButton = (
    <button
      type="button"
      className="meal-add-button"
      disabled={day.is_past || full || busy}
      onClick={(event) => openDialog('medicine', event.currentTarget)}
    >
      {uiText(CALENDAR_MEALS_COPY.addMedicine)}
    </button>
  );

  const entryList = draft.items.length ? (
    <ol className="meal-entry-list">
      {draft.items.map((item, index) => {
        const name = 'medicine' in item ? medicineMethodLabel(item.medicine.method, language) : item.food === 'custom' ? item.name : mealFoodLabel(item.food, language);
        return (
          <li key={index} className={`meal-entry${'medicine' in item ? ' meal-entry--medicine' : item.food === 'custom' ? ' is-custom-item' : ''}`} style={'medicine' in item ? { '--meal-medicine-color': medicineColorCss(item.medicine.color) } as CSSProperties : undefined}>
            <div className="meal-entry-main">
              <EntryIcon item={item} />
              {'medicine' in item && <span className="meal-tile-dot" aria-hidden="true" />}
              {'medicine' in item ? <EntryText item={item} language={language} weekdays={draft.medicineRepeats?.find(repeat => repeat.item === item)?.weekdays} /> : <button type="button" className="calendar-item-name" disabled={JSON.stringify(draft.items) !== JSON.stringify(parseMealPlanItems(list.items, area))} aria-label={`${uiText('Rename')} ${name}`} onClick={() => setRenaming({ index: list.items.findIndex(value => value === item), name })}>{name}</button>}
            </div>
            <CalendarIconButton icon="remove" aria-label={uiMessage(CALENDAR_MEALS_COPY.removeEntry, { name })} disabled={day.is_past || busy} onClick={() => removeEntry(index)} />
          </li>
        );
      })}
    </ol>
  ) : (
    <p className="meal-entry-empty">{uiText(isMedicineRow ? CALENDAR_MEALS_COPY.noMedicineEntries : CALENDAR_MEALS_COPY.noMealEntries)}</p>
  );

  return (
    <><aside ref={dialogRef} className="calendar-editor meal-editor" role="dialog" aria-modal="true" aria-labelledby="meal-editor-title">
      <header className="calendar-editor-header">
        <div>
          <p className="calendar-eyebrow">{uiText(isMedicineRow ? CALENDAR_MEALS_COPY.medicineRow : CALENDAR_COPY.meals)}</p>
          <h2 id="meal-editor-title">{title}</h2>
        </div>
        <CalendarIconButton icon="close" ref={closeRef} aria-label={uiText(CALENDAR_MEALS_COPY.closeMealEditor)} onClick={close} disabled={busy} />
      </header>

      <div className="calendar-editor-body meal-editor-body">
        {isMedicineRow ? (
          <section className="meal-medicine-panel" aria-label={uiText(CALENDAR_MEALS_COPY.medicineRow)}>
            <p className="meal-notice">{uiText(CALENDAR_MEALS_COPY.medicineNotice)}</p>
            <button type="button" className="meal-add-button meal-add-button--wide" disabled={day.is_past || full || busy} onClick={(event) => openDialog('medicine', event.currentTarget)}>
              {uiText(CALENDAR_MEALS_COPY.addMedicine)}
            </button>
          </section>
        ) : (
          <section className="calendar-palette meal-library-panel" aria-label={uiText(CALENDAR_MEALS_COPY.myMealsChoices)}>
            <div className="calendar-section-heading meal-section-heading"><h3>{uiText(CALENDAR_MEALS_COPY.myMeals)}</h3><span>{library.length}/{MEAL_LIBRARY_CAP}</span></div>
            <button type="button" className="calendar-library-button" disabled={busy} onClick={(event) => openDialog('library', event.currentTarget)}>{uiText(CALENDAR_MEALS_COPY.setUpMyMeals)}</button>
            {addButton}
            <FastFoodNotice visible={hasFastFood(draft.items)} />
            {library.length === 0 ? (
              <div className="meal-empty-library" role="status">
                <strong>{uiText(CALENDAR_MEALS_COPY.emptyLibraryTitle)}</strong>
                <p>{uiText(CALENDAR_MEALS_COPY.emptyLibraryDescription)}</p>
              </div>
            ) : (
              <CalendarScrollPanel label={uiText(CALENDAR_MEALS_COPY.myMealsChoices)}>
                <div className="calendar-palette-grid meal-library-grid">
                  {library.map((entry) => {
                    const name = libraryEntryName(entry, (key) => mealFoodLabel(key, language));
                    return (
                      <button key={entry.id} type="button" className="calendar-palette-choice" title={name} disabled={day.is_past || full || busy} aria-label={uiMessage(CALENDAR_MEALS_COPY.addMealTile, { name })} onClick={() => addLibraryEntry(entry)}>
                        <img src={mealFoodArt(entry.food_key)} alt="" width="32" height="32" draggable={false} />
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
              </CalendarScrollPanel>
            )}
          </section>
        )}

        <section className="calendar-ordered-list meal-entry-panel" aria-label={uiText(isMedicineRow ? CALENDAR_MEALS_COPY.medicineRow : CALENDAR_MEALS_COPY.inThisMeal)}>
          <div className="calendar-section-heading meal-section-heading meal-entry-heading">
            <h3>{uiText(isMedicineRow ? CALENDAR_MEALS_COPY.medicineRow : CALENDAR_MEALS_COPY.inThisMeal)}</h3>
            <span>{uiText(JSON.stringify(draft.items) === JSON.stringify(list.items) ? 'Tap a name to rename it.' : 'Save this plan before renaming.')} · {draft.items.length}/{cap}</span>
          </div>
          {entryList}
          {medicineFull && <p className="meal-cap-note" role="status">{uiMessage(CALENDAR_MEALS_COPY.medicineRowFull, { max: cap })}</p>}
          {!isMedicineRow && full && <p className="meal-cap-note" role="status">{uiMessage(CALENDAR_MEALS_COPY.mealSlotFull, { max: cap })}</p>}
        </section>
      </div>

      <fieldset className="calendar-scope-choice" disabled={day.is_past}>
        <legend>{uiText(CALENDAR_COPY.saveThisPlan)}</legend>
        <label><input type="radio" name="meal-scope" checked={draft.scope === 'template'} onChange={() => setDraft((current) => ({ ...current, scope: 'template' }))} />{uiMessage(CALENDAR_COPY.everyWeekday, { weekday: weekdayName(day.weekday) })}</label>
        <label><input type="radio" name="meal-scope" checked={draft.scope === 'date'} onChange={() => setDraft((current) => ({ ...current, scope: 'date' }))} />{scopeDateLabel}</label>
        {list.source === 'override' && <button type="button" className="calendar-restore-button" onClick={() => void restore()} disabled={busy}>{uiText(CALENDAR_COPY.restoreWeeklyPlan)}</button>}
      </fieldset>

      <footer className="calendar-editor-actions">
        {error && <p className="calendar-editor-error" role="alert">{error}</p>}
        <button type="button" className="kid-nav-action" onClick={close} disabled={busy}>{uiText(CALENDAR_COPY.cancel)}</button>
        <button type="button" className="calendar-save-button" onClick={() => void submit()} disabled={busy || day.is_past}>{busy ? uiText(CALENDAR_COPY.saving) : uiText(CALENDAR_COPY.save)}</button>
      </footer>

      {dialog === 'library' && (
        <MealLibraryDialog profileId={profileId} library={library} onChanged={onLibraryChanged} onClose={closeDialog} />
      )}
      {dialog === 'medicine' && (
        <MedicineDialog weekday={day.weekday} onCancel={closeDialog} onSave={addMedicine} />
      )}
    </aside>
    {renaming && <RenameItemDialog name={renaming.name} maxLength={MEAL_CUSTOM_NAME_MAX} onClose={() => setRenaming(null)} onSave={async name => { await onRename(renaming.index, name); close(); }} />}
    </>
  );
}
