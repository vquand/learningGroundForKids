import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { CalendarApiError } from '../../api/calendar';
import { deleteMealPlanOverride, saveMealPlanList } from '../../api/calendarMeals';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { renameCalendarItem } from '../../api/calendar';
import { uiMessage, uiText } from '../../i18n/uiText';
import { mealFoodArt, mealFoodLabel, medicineColorCss, medicineColorLabel, medicineMethodArt, medicineMethodLabel } from '../../lib/calendarMealCatalog';
import { parseMealPlanItems, largeMealTileLayout, visibleTileCount, buildMealListWriteFromRevisions, MEAL_TILE_GAP, MEAL_TILE_SIZE } from '../../lib/calendarMealHelpers';
import {
  CALENDAR_DAY_HEADING_HEIGHT, isCalendarWeekend, refreshListSnapshot, restoreRevisionOf, snapshotListRevisions, type CalendarListRevisions,
} from '../../lib/calendarHelpers';
import type { CalendarDay, CalendarWeek, CalendarWindow } from '../../types/calendar';
import type { MealPlanItem, MealsArea, MedicineTemplateRevision } from '../../types/calendarMeals';
import { CALENDAR_COPY, CALENDAR_WEEKDAY_KEYS } from './calendarCopy';
import { CALENDAR_MEALS_COPY } from './calendarMealsCopy';
import { MealEditorDrawer, type MealDraft } from './MealEditorDrawer';
import { MealLibraryDialog } from './MealLibraryDialog';
import { captureMedicineTemplateRevisions, withMedicineRepeats } from '../../lib/calendarMedicineRepeats';
import './Meals.css';

export interface MealsViewProps {
  profileId: string;
  week: CalendarWeek;
  data: CalendarWindow;
  today: string;
  /** Resolves with the refreshed window so an open editor can adopt the current revisions after a 409. */
  onChanged: () => Promise<CalendarWindow | undefined>;
  readOnly?: boolean;
  /** Toolbar action slot owned by CalendarPage. The My favorites button is portaled here; readOnly renders none. */
  toolbarSlot?: HTMLElement | null;
}

interface EditorState {
  medicineRevisions: MedicineTemplateRevision[];
  date: string;
  area: MealsArea;
  key: string;
  /** Revisions captured when the editor opened. Saves and restores send these, never live query data. */
  revisions: CalendarListRevisions<MealsArea>;
}

const MEAL_ROWS: readonly { area: MealsArea; label: string }[] = [
  { area: 'meal_breakfast', label: CALENDAR_MEALS_COPY.mealBreakfast },
  { area: 'meal_lunch', label: CALENDAR_MEALS_COPY.mealLunch },
  { area: 'meal_snack', label: CALENDAR_MEALS_COPY.mealAfternoonSnack },
  { area: 'meal_dinner', label: CALENDAR_MEALS_COPY.mealDinner },
];

const MEDICINE_ROW: { area: MealsArea; label: string } = { area: 'medicine', label: CALENDAR_MEALS_COPY.medicineRow };

// Row caps (meal rows and the medicine row) live in Meals.css. Rows shrink below their caps on short screens.
// The heading height is shared with Study so the day headings line up across views.
/** Muted empty-dish artwork shown in meal cells with nothing planned (the text stays for screen readers). */
export const MEAL_EMPTY_DISH_ART = '/calendar/icons/ui/empty_dish.webp';

const MEAL_GRID_VARS = {
  '--calendar-day-heading-height': `${CALENDAR_DAY_HEADING_HEIGHT}px`,
} as CSSProperties;

type Language = ReturnType<typeof useUiLanguage>;

function formatDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${date}T12:00:00+07:00`));
}

function dayLabel(day: CalendarDay, today: string, language: Language): string {
  const date = formatDate(day.date, language);
  return day.date === today ? `${date} · ${uiText(CALENDAR_COPY.today)}` : date;
}

function rowLabel(area: MealsArea): string {
  if (area === 'medicine') return uiText(MEDICINE_ROW.label);
  return uiText(MEAL_ROWS.find((row) => row.area === area)?.label ?? MEAL_ROWS[0]!.label);
}

/** Accessible description of one entry; the tiles themselves are aria-hidden. */
function describeMealItem(item: MealPlanItem, language: Language): string {
  if ('medicine' in item) {
    const { method, color, qty, dose } = item.medicine;
    const base = uiMessage(CALENDAR_MEALS_COPY.medicineTile, {
      method: medicineMethodLabel(method, language),
      color: medicineColorLabel(color, language),
      qty,
    });
    return dose ? `${base}, ${dose}` : base;
  }
  if (item.food === 'custom') return item.name;
  return mealFoodLabel(item.food, language);
}

/** Tracks how many square tiles fit the stack. Everything shows until the first measurement lands. */
function useTileCapacity(total: number, medicine: boolean) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number; large: boolean } | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const media = window.matchMedia('(pointer: coarse), (max-width: 1180px)');
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height, large: !medicine && media.matches });
    };
    measure();
    media.addEventListener('change', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => { observer?.disconnect(); media.removeEventListener('change', measure); };
  }, [medicine]);

  const layout = size?.large
    ? largeMealTileLayout(size.width, size.height, total)
    : { tileSize: MEAL_TILE_SIZE, visible: size === null ? total : visibleTileCount(size.width, size.height, total, MEAL_TILE_SIZE, MEAL_TILE_GAP) };
  return { ref, ...layout, large: size?.large ?? false };
}

function ItemTile({ item }: { item: MealPlanItem }) {
  if ('medicine' in item) {
    const { method, color, qty } = item.medicine;
    return (
      <span className="meal-tile meal-tile--medicine" style={{ '--meal-medicine-color': medicineColorCss(color) } as CSSProperties} title={medicineMethodLabel(method)}>
        <img src={medicineMethodArt(method)} alt="" width={MEAL_TILE_SIZE} height={MEAL_TILE_SIZE} draggable={false} />
        <span className="meal-tile-dot" aria-hidden="true" />
        <span className="meal-tile-qty">{qty}x</span>
      </span>
    );
  }
  const key = item.food === 'custom' ? item.icon : item.food;
  return (
    <span className={`meal-tile${item.food === 'custom' ? ' is-custom-item' : ''}`} title={item.food === 'custom' ? item.name : undefined}>
      <img src={mealFoodArt(key)} alt="" width={MEAL_TILE_SIZE} height={MEAL_TILE_SIZE} draggable={false} />
    </span>
  );
}

interface MealCellProps {
  day: CalendarDay;
  area: MealsArea;
  today: string;
  readOnly: boolean;
  onEdit: (day: CalendarDay, area: MealsArea, cell: HTMLButtonElement) => void;
  cellRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
}

function MealCell({ day, area, today, readOnly, onEdit, cellRefs }: MealCellProps) {
  const language = useUiLanguage();
  const list = day.lists[area];
  const items = parseMealPlanItems(list.items, area);
  const { ref: stackRef, visible, tileSize, large } = useTileCapacity(items.length, area === 'medicine');
  const shown = items.slice(0, visible);
  const remaining = items.length - shown.length;
  const key = `${day.date}:${area}`;
  const editable = !readOnly && (area !== 'medicine' || !day.is_past);
  const summary = items.length
    ? uiMessage(CALENDAR_MEALS_COPY.plannedMeals, { items: items.map((item) => describeMealItem(item, language)).join(', ') })
    : uiText(CALENDAR_COPY.noItems);
  const rowAndDate = { row: rowLabel(area), date: dayLabel(day, today, language) };
  const label = uiMessage(CALENDAR_MEALS_COPY.editMealCell, rowAndDate);
  const description = `${label}. ${summary}`;
  // Read-only cells never say "Edit": they only describe the planned entries.
  const readOnlyLabel = uiMessage(CALENDAR_MEALS_COPY.readOnlyCell, {
    ...rowAndDate,
    items: items.length ? items.map((item) => describeMealItem(item, language)).join(', ') : uiText(CALENDAR_COPY.noItems),
  });
  const classes = [
    'meal-cell',
    isCalendarWeekend(day.weekday) ? 'is-weekend' : '',
    day.date === today ? 'is-today' : '',
    day.is_past ? 'is-past' : '',
    items.length === 0 ? 'is-empty' : '',
    readOnly ? 'is-readonly' : '',
  ].filter(Boolean).join(' ');
  const body = (
    <span ref={stackRef} className={`meal-tile-stack${large ? ' meal-tile-stack--large' : ''}`} style={{ '--meal-tile-size': `${tileSize}px` } as CSSProperties} aria-hidden="true">
      {items.length === 0 && (
        <span className="meal-empty-cell">
          <img
            className="meal-empty-dish"
            src={MEAL_EMPTY_DISH_ART}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('is-missing-art'); }}
          />
          <span className="meal-empty-label">{uiText(CALENDAR_COPY.noItems)}</span>
        </span>
      )}
      {shown.map((item, index) => <ItemTile key={index} item={item} />)}
      {remaining > 0 && <span className="meal-tile meal-tile--more">+{remaining}</span>}
    </span>
  );

  if (!editable) {
    const ariaLabel = readOnly ? readOnlyLabel : `${description} · ${uiText(CALENDAR_COPY.pastDay)}`;
    return (
      <div className={classes} role="group" aria-label={ariaLabel} title={readOnly ? undefined : uiText(CALENDAR_COPY.pastDay)}>
        {body}
      </div>
    );
  }

  return (
    <button
      ref={(element) => { cellRefs.current[key] = element; }}
      type="button"
      className={classes}
      aria-label={description}
      onClick={(event) => onEdit(day, area, event.currentTarget)}
    >
      {body}
    </button>
  );
}

export function MealsView({ profileId, week, data, today, onChanged, readOnly = false, toolbarSlot = null }: MealsViewProps) {
  const language = useUiLanguage();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const weekdays = week.days.slice(0, 7);
  const editorDay = editor ? weekdays.find((day) => day.date === editor.date) : undefined;
  const editorList = editorDay && editor ? editorDay.lists[editor.area] : undefined;
  const returnFocus = editor ? cellRefs.current[`${editor.date}:${editor.area}`] ?? null : null;

  const openEditor = useCallback((day: CalendarDay, area: MealsArea) => {
    setEditor({ date: day.date, area, key: `${day.date}:${area}`, revisions: snapshotListRevisions(data, day, area), medicineRevisions: captureMedicineTemplateRevisions(data, area) });
  }, [data]);

  const closeEditor = useCallback(() => setEditor(null), []);

  // After a displayed 409 the draft stays. The editor adopts the refreshed revisions, so the next Save is deliberate.
  const adoptRefreshedRevisions = useCallback((key: string, fresh: CalendarWindow | undefined) => {
    if (!fresh) return;
    setEditor((current) => {
      if (!current || current.key !== key) return current;
      const next = refreshListSnapshot(fresh, current.date, current.area);
      return next ? { ...current, revisions: next.revisions, medicineRevisions: captureMedicineTemplateRevisions(fresh, current.area) } : current;
    });
  }, []);

  const refreshAfterConflict = useCallback(async (key: string): Promise<Error> => {
    adoptRefreshedRevisions(key, await onChanged());
    return new Error(uiText(CALENDAR_COPY.saveConflict));
  }, [adoptRefreshedRevisions, onChanged]);

  const save = useCallback(async (draft: MealDraft) => {
    if (!editor) return;
    const input = withMedicineRepeats(buildMealListWriteFromRevisions(editor.revisions, draft.scope, draft.items), draft.medicineRepeats ?? [], editor.medicineRevisions);
    try {
      await saveMealPlanList(profileId, input);
      await onChanged();
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 409) throw await refreshAfterConflict(editor.key);
      if (error instanceof CalendarApiError && error.code === 'CALENDAR_MEDICINE_FULL') throw new Error(uiText(CALENDAR_MEALS_COPY.repeatDayFull));
      throw new Error(uiText(CALENDAR_COPY.saveError));
    }
  }, [editor, onChanged, profileId, refreshAfterConflict]);

  const restore = useCallback(async () => {
    if (!editor) return;
    const revision = restoreRevisionOf(editor.revisions);
    // The day had no override when the editor opened, so there is nothing to delete at that revision.
    if (revision === null) throw await refreshAfterConflict(editor.key);
    try {
      await deleteMealPlanOverride(profileId, editor.revisions.date, editor.revisions.area, revision);
      await onChanged();
    } catch (error) {
      if (error instanceof CalendarApiError && error.status === 409) throw await refreshAfterConflict(editor.key);
      throw new Error(uiText(CALENDAR_COPY.restoreError));
    }
  }, [editor, onChanged, profileId, refreshAfterConflict]);

  const rows = [...MEAL_ROWS, MEDICINE_ROW];

  return (
    <>
      {!readOnly && toolbarSlot && createPortal(
        <button type="button" className="calendar-toolbar-button" onClick={() => setLibraryOpen(true)}>
          <svg className="calendar-toolbar-gear" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.66 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.61.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.09.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
          </svg>
          <span className="calendar-toolbar-label">{uiText(CALENDAR_MEALS_COPY.myMeals)}</span>
        </button>,
        toolbarSlot,
      )}
      <section className="calendar-grid-wrap meal-grid-wrap" aria-label={uiText(CALENDAR_MEALS_COPY.mealsGridLabel)} style={MEAL_GRID_VARS}>
        <div className="meal-grid">
          <div className="calendar-grid-corner" aria-hidden="true" />
          {weekdays.map((day) => (
            <div key={day.date} className={`calendar-day-heading${isCalendarWeekend(day.weekday) ? ' is-weekend' : ''}${day.date === today ? ' is-today' : ''}${day.is_past ? ' is-past' : ''}`}>
              <strong>{uiText(CALENDAR_WEEKDAY_KEYS[day.weekday - 1] ?? CALENDAR_WEEKDAY_KEYS[0])}</strong>
              <span>{dayLabel(day, today, language)}</span>
            </div>
          ))}
          {rows.map((row) => (
            <div key={row.area} className={`meal-row${row.area === 'medicine' ? ' meal-row--medicine' : ''}`} role="row">
              <div className={`meal-row-label${row.area === 'medicine' ? ' meal-row-label--medicine' : ''}`} role="rowheader">
                <span>{rowLabel(row.area)}</span>
              </div>
              {weekdays.map((day) => (
                <MealCell
                  key={`${day.date}:${row.area}`}
                  day={day}
                  area={row.area}
                  today={today}
                  readOnly={readOnly}
                  onEdit={openEditor}
                  cellRefs={cellRefs}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
      {!readOnly && libraryOpen && (
        createPortal(<MealLibraryDialog profileId={profileId} library={data.meal_library ?? []} onChanged={onChanged} onClose={() => setLibraryOpen(false)} />, toolbarSlot?.closest('.calendar-page') ?? document.body)
      )}
      {/* Fixed overlays must sit outside the animated week's transformed containing block. */}
      {!readOnly && editor && editorDay && editorList && createPortal(
        <MealEditorDrawer
          key={editor.key}
          profileId={profileId}
          day={editorDay}
          area={editor.area}
          list={editorList}
          library={data.meal_library ?? []}
          onClose={closeEditor}
          onSave={save}
          onRestore={restore}
          onLibraryChanged={onChanged}
          onRename={async (index, name) => {
            if (!editorDay || !editorList) return;
            try {
              await renameCalendarItem(profileId, { date: editorDay.date, area: editor.area, index, name, expected_revision: editor.revisions.overrideRevision ?? editor.revisions.templateRevision, expected_template_revision: editor.revisions.templateRevision });
              await onChanged();
            } catch (error) {
              if (error instanceof CalendarApiError && error.status === 409) throw await refreshAfterConflict(editor.key);
              throw error;
            }
          }}
          returnFocus={returnFocus}
        />, toolbarSlot?.closest('.calendar-page') ?? document.body
      )}
    </>
  );
}

