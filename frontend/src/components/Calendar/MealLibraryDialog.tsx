import { CalendarScrollPanel } from './CalendarScrollPanel';
import { CalendarIconButton } from './CalendarControls';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/core';
import { addMealLibraryEntry, removeMealLibraryEntry, updateMealLibraryEntry } from '../../api/calendarMeals';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiMessage, uiText } from '../../i18n/uiText';
import { MEAL_FOOD_CATALOG, mealFoodArt, mealFoodLabel } from '../../lib/calendarMealCatalog';
import { FOOD_GROUP_LABELS, foodGroup, calendarSearchText, type FoodGroup } from '../../lib/calendarFoodGroups';
import { applyMealLibrarySave, cleanCustomMealName, libraryEntryName, MEAL_CUSTOM_NAME_MAX, MEAL_LIBRARY_CAP } from '../../lib/calendarMealHelpers';
import type { MealFoodKey, MealLibraryEntry } from '../../types/calendarMeals';
import { CALENDAR_COPY } from './calendarCopy';
import { CALENDAR_MEALS_COPY } from './calendarMealsCopy';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';
import { FastFoodNotice } from './FastFoodNotice';
import { useCalendarLibraryMutation } from './useCalendarLibraryMutation';

interface Props {
  profileId: string;
  library: MealLibraryEntry[];
  onChanged: () => Promise<unknown>;
  onClose: () => void;
}

export const LIBRARY_FULL_CODE = 'CALENDAR_LIBRARY_FULL';

/** Adds one food to My favorites. A non-empty custom name makes a separate, named library row. */
function addFoodToLibrary(profileId: string, food: MealFoodKey, customName: string) {
  const name = cleanCustomMealName(customName);
  return addMealLibraryEntry(profileId, name ? { food, custom_name: name } : { food });
}

export function MealLibraryDialog({ profileId, library, onChanged, onClose }: Props) {
  const language = useUiLanguage();
  const closeRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  useModalA11y(backdropRef);
  useVisualViewportFit(backdropRef);
  const [customName, setCustomName] = useState('');
  const [selectedFood, setSelectedFood] = useState<MealFoodKey | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FoodGroup>('All foods');
  const [editing, setEditing] = useState<MealLibraryEntry | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const feedback = useCalendarLibraryMutation(profileId, onChanged, caught => (
    caught instanceof ApiError && caught.code === LIBRARY_FULL_CODE
      ? uiText(CALENDAR_MEALS_COPY.libraryFull) : uiText(CALENDAR_MEALS_COPY.libraryError)
  ));
  const { busy, error, saved, setSaved, reveal } = feedback;
  const close = () => { if (feedback.canClose()) onClose(); };

  const full = library.length >= MEAL_LIBRARY_CAP;
  const filteredFoods = MEAL_FOOD_CATALOG.filter(entry => (category === 'All foods' || foodGroup(entry.key) === category) && calendarSearchText(`${entry.en} ${entry.vi}`).includes(calendarSearchText(search)));


  useEffect(() => { if (selectedFood && !nameEdited) setCustomName(mealFoodLabel(selectedFood, language)); }, [selectedFood, nameEdited, language]);

  useEffect(() => { closeRef.current?.focus(); }, []);

  const addFood = (food: MealFoodKey) => feedback.run(async () => {
    const label = mealFoodLabel(food, language);
    const entry = editing
      ? await updateMealLibraryEntry(profileId, editing, { food, ...(customName.trim() !== label ? { custom_name: customName.trim() } : {}) })
      : await addFoodToLibrary(profileId, food, customName.trim() === label ? '' : customName);
    return { revealId: entry.id, update: current => ({ ...current, meal_library: applyMealLibrarySave(current.meal_library ?? [], entry, editing?.id) }) };
  }, () => setEditing(null));

  const removeEntry = (entry: MealLibraryEntry) => feedback.run(async () => {
    await removeMealLibraryEntry(profileId, entry.id);
    return { update: current => ({ ...current, meal_library: (current.meal_library ?? []).filter(row => row.id !== entry.id) }) };
  }, () => {
    if (editing?.id === entry.id) { setEditing(null); setSelectedFood(null); setCustomName(''); setNameEdited(false); }
  });

  return (
    <div ref={backdropRef} className="meal-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <section className="meal-dialog meal-library-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-library-title">
        <header className="meal-dialog-header">
          <div>
            <p className="calendar-eyebrow">{uiText(CALENDAR_COPY.meals)}</p>
            <h2 id="meal-library-title">{uiText(CALENDAR_MEALS_COPY.myMeals)}</h2>
          </div>
          <CalendarIconButton icon="close" ref={closeRef} aria-label={uiText(CALENDAR_MEALS_COPY.closeDialog)} disabled={busy} onClick={close} />
        </header>

        <div className="meal-dialog-body meal-library-body">
          <div className="meal-library-column">
            <p className="meal-dialog-intro">{uiText(CALENDAR_MEALS_COPY.libraryIntro)}</p>
            <div className="calendar-food-filters">
              <label className="calendar-field"><span>{uiText('Find an icon')}</span><input value={search} onChange={event => { setSearch(event.target.value); }} /></label>
              <label className="calendar-field"><span>{uiText('Food group')}</span><select value={category} onChange={event => { const value = FOOD_GROUP_LABELS.find(label => label === event.target.value); if (value) { setCategory(value); } }}>{FOOD_GROUP_LABELS.map(label => <option key={label} value={label}>{uiText(label)}</option>)}</select></label>
            </div>
            <CalendarScrollPanel label={uiText(CALENDAR_MEALS_COPY.foodPalette)} resetKey={`${category}:${search}`}><div className="meal-food-grid">
              {filteredFoods.map((food) => {
                const name = mealFoodLabel(food.key, language);
                return (
                  <button
                    key={food.key}
                    type="button"
                    className="calendar-palette-choice"
                    aria-pressed={selectedFood === food.key}
                    title={name}
                    disabled={(full && !editing) || busy}
                    aria-label={uiMessage(CALENDAR_MEALS_COPY.addFoodTile, { name })}
                    onClick={() => { if (!nameEdited || !customName.trim()) setCustomName(name); setSelectedFood(food.key); setSaved(false); }}
                  >
                    <img src={mealFoodArt(food.key)} alt="" width="32" height="32" draggable={false} />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
            </CalendarScrollPanel>
          </div>

          <div className="meal-library-column meal-saved-column">
            <label className="calendar-field">
              <span>{uiText(CALENDAR_MEALS_COPY.customNameLabel)}</span>
              <input
                type="text"
                className={selectedFood ? 'calendar-name-input' : undefined}
                disabled={!selectedFood || busy}
                maxLength={MEAL_CUSTOM_NAME_MAX}
                value={customName}
                autoComplete="off"
                aria-describedby="meal-custom-name-hint"
                onChange={(event) => { setCustomName(event.target.value); setNameEdited(true); setSaved(false); }}
              />
              <small id="meal-custom-name-hint">{uiText(CALENDAR_MEALS_COPY.customNameHint)}</small>
            </label>
            <button type="button" className="calendar-save-button" disabled={!selectedFood || !customName.trim() || (full && !editing) || busy || (!editing && library.some(entry => entry.food_key === selectedFood && (entry.custom_name ?? mealFoodLabel(entry.food_key, language)) === customName.trim()))} onClick={() => { if (selectedFood) void addFood(selectedFood); }}>{uiText(editing ? 'Save favorite' : library.some(entry => entry.food_key === selectedFood && (entry.custom_name ?? mealFoodLabel(entry.food_key, language)) === customName.trim()) ? 'Already in favorites' : 'Mark as favorite')}</button>
            {editing && <button type="button" className="kid-nav-action" disabled={busy} onClick={() => { setEditing(null); setSelectedFood(null); setCustomName(''); setNameEdited(false); setSaved(false); }}>{uiText('Cancel')}</button>}
            <div className="calendar-section-heading meal-section-heading">
              <h3>{uiText(CALENDAR_MEALS_COPY.savedInMyMeals)}</h3>
              <span>{uiMessage(CALENDAR_MEALS_COPY.savedCount, { count: library.length, max: MEAL_LIBRARY_CAP })}</span>
            </div>
            {library.length === 0 ? (
              <p className="meal-entry-empty">{uiText(CALENDAR_MEALS_COPY.libraryEmpty)}</p>
            ) : (
              <CalendarScrollPanel label={uiText(CALENDAR_MEALS_COPY.savedInMyMeals)} revealKey={reveal.id} revealToken={reveal.token}><ol className="meal-saved-list">
                {library.map((entry) => {
                  const name = libraryEntryName(entry, (key) => mealFoodLabel(key, language));
                  return (
                    <li data-scroll-key={entry.id} key={entry.id} className={`meal-saved-row${entry.custom_name ? ' is-custom-item' : ''}`}>
                      <img src={mealFoodArt(entry.food_key)} alt="" width="32" height="32" draggable={false} />
                      <button type="button" className="calendar-item-name" aria-label={`${uiText('Edit favorite')} ${name}`} disabled={busy} onClick={() => { setEditing(entry); setSelectedFood(entry.food_key); setCustomName(name); setNameEdited(entry.custom_name !== null); setSaved(false); }}>{name}</button>
                      <CalendarIconButton icon="remove"
                        aria-label={uiMessage(CALENDAR_MEALS_COPY.removeLibraryEntry, { name })}
                        disabled={busy}
                        onClick={() => void removeEntry(entry)}
                       />
                    </li>
                  );
                })}
              </ol></CalendarScrollPanel>
            )}

          </div>
        </div>

        <footer className="meal-dialog-footer">
          <FastFoodNotice visible={selectedFood === 'fast_food'} />
          <div className="meal-library-feedback">
            {saved && !error && <p className="meal-library-status" role="status">{uiText(CALENDAR_MEALS_COPY.favoriteSaved)}</p>}
            {feedback.refreshFailed && <p className="calendar-editor-error" role="alert">{uiText(CALENDAR_COPY.refreshError)}</p>}
            {error && <p className="calendar-editor-error" role="alert">{error}</p>}
          </div>
          {feedback.refreshFailed && <button type="button" className="kid-nav-action" aria-label={uiText(CALENDAR_COPY.refreshError)} disabled={busy} onClick={() => void feedback.retry()}>{uiText(CALENDAR_COPY.retry)}</button>}
          <button type="button" className="calendar-save-button" disabled={busy} onClick={close}>{uiText(CALENDAR_MEALS_COPY.done)}</button>
        </footer>
      </section>
    </div>
  );
}
