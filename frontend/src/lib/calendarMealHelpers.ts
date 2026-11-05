import type { CalendarDay, CalendarList, CalendarScope, CalendarTemplateList } from '../types/calendar';
import type { MealFoodKey, MealLibraryEntry, MealListWrite, MealPlanItem, MealsArea, MedicineDetail, MedicineItem } from '../types/calendarMeals';
import { captureListRevisions, type CalendarListRevisions } from './calendarHelpers.ts';
import { isMealFoodKey, isMedicineColorKey, isMedicineMethodKey } from './calendarMealCatalog.ts';

/** Apply only server-confirmed rows, including edits that merge into an existing favorite. */
export function applyMealLibrarySave(library: MealLibraryEntry[], saved: MealLibraryEntry, previousId?: string): MealLibraryEntry[] {
  const rows = library.filter(entry => entry.id !== previousId || entry.id === saved.id);
  return rows.some(entry => entry.id === saved.id)
    ? rows.map(entry => entry.id === saved.id ? saved : entry)
    : [...rows, saved];
}

/** Caps shared with the server: 8 entries per meal slot, 6 on the Medicine row, 60 library rows. */
export const MEAL_SLOT_CAP = 8;
export const MEDICINE_ROW_CAP = 6;
export { CALENDAR_LIBRARY_CAP as MEAL_LIBRARY_CAP } from './calendarLimits.ts';
export const MEAL_CUSTOM_NAME_MAX = 40;
export const MEDICINE_DOSE_MAX = 16;
export const MEDICINE_QTY_MIN = 1;
export const MEDICINE_QTY_MAX = 20;

/** Icon tile geometry shared with the Meals grid CSS. */
export const MEAL_TILE_SIZE = 32;
export const MEAL_TILE_GAP = 2;

/** Large tablet pictograms: at most two columns, with room for two rows when possible. */
export function largeMealTileLayout(width: number, height: number, total: number): { tileSize: number; visible: number } {
  const tileSize = Math.max(1, Math.min(64, Math.floor((width - MEAL_TILE_GAP) / 2), Math.floor((height - MEAL_TILE_GAP) / 2)));
  return { tileSize, visible: visibleTileCount(Math.min(width, 2 * tileSize + MEAL_TILE_GAP), height, total, tileSize, MEAL_TILE_GAP) };
}

export function capForArea(area: MealsArea): number {
  return area === 'medicine' ? MEDICINE_ROW_CAP : MEAL_SLOT_CAP;
}

export function clampMedicineQty(value: number): number {
  if (!Number.isFinite(value)) return MEDICINE_QTY_MIN;
  return Math.min(MEDICINE_QTY_MAX, Math.max(MEDICINE_QTY_MIN, Math.round(value)));
}

/** Removes control characters and surrounding spaces. Output is plain text for React nodes only. */
export function cleanKidText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanCustomMealName(value: string): string {
  return cleanKidText(value).slice(0, MEAL_CUSTOM_NAME_MAX).trim();
}

export function cleanDoseNote(value: string): string | undefined {
  const cleaned = cleanKidText(value).slice(0, MEDICINE_DOSE_MAX).trim();
  return cleaned ? cleaned : undefined;
}

export function medicineItem(detail: { method: MedicineDetail['method']; color: MedicineDetail['color']; qty: number; dose?: string }): MedicineItem {
  const dose = detail.dose === undefined ? undefined : cleanDoseNote(detail.dose);
  return { medicine: { method: detail.method, color: detail.color, qty: clampMedicineQty(detail.qty), ...(dose ? { dose } : {}) } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidMedicineDetail(value: unknown): value is MedicineDetail {
  if (!isPlainObject(value)) return false;
  const { method, color, qty, dose } = value;
  if (!isMedicineMethodKey(method) || !isMedicineColorKey(color)) return false;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < MEDICINE_QTY_MIN || qty > MEDICINE_QTY_MAX) return false;
  return dose === undefined || (typeof dose === 'string' && dose.length <= MEDICINE_DOSE_MAX);
}

/** Strict shape check for a stored meal-area item. Unknown keys and out-of-range values are rejected. */
export function isMealPlanItem(value: unknown): value is MealPlanItem {
  if (!isPlainObject(value)) return false;
  if ('medicine' in value) return isValidMedicineDetail(value.medicine);
  if (value.food === 'custom') {
    return isMealFoodKey(value.icon) && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= MEAL_CUSTOM_NAME_MAX;
  }
  return isMealFoodKey(value.food);
}

/** Keeps only valid items for this area. The Medicine row takes medicine entries only. */
export function parseMealPlanItems(items: readonly unknown[], area: MealsArea): MealPlanItem[] {
  return items.filter(isMealPlanItem).filter((item) => area !== 'medicine' || 'medicine' in item).slice(0, capForArea(area));
}

export function isMedicineItem(item: MealPlanItem): item is MedicineItem {
  return 'medicine' in item;
}

/** The item added when a kid taps a "My meals" tile. Custom names keep the food as the icon. */
export function libraryEntryToItem(entry: MealLibraryEntry): MealPlanItem {
  return entry.custom_name
    ? { food: 'custom', icon: entry.food_key, name: entry.custom_name }
    : { food: entry.food_key };
}

export function libraryEntryName(entry: MealLibraryEntry, foodLabel: (key: MealFoodKey) => string): string {
  return entry.custom_name ?? foodLabel(entry.food_key);
}

export function canAddPlanItem(items: readonly MealPlanItem[], area: MealsArea): boolean {
  return items.length < capForArea(area);
}

export function addPlanItem(items: readonly MealPlanItem[], item: MealPlanItem, area: MealsArea): MealPlanItem[] {
  if (!canAddPlanItem(items, area)) return [...items];
  return [...items, item];
}

export function removePlanItemAt(items: readonly MealPlanItem[], index: number): MealPlanItem[] {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return [...items];
  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function medicineCount(items: readonly MealPlanItem[]): number {
  return items.filter(isMedicineItem).length;
}

/**
 * Builds the PUT body for a meal or medicine list. "Every <weekday>" writes the template revision (0 when no
 * template row exists yet). "Only this day" writes the override revision when the day already has an override,
 * otherwise 0, so the first override is created. Same rules as the study editor.
 */
/** Meal or medicine PUT body built only from revisions captured when the editor opened (see calendarHelpers). */
export function buildMealListWriteFromRevisions(
  revisions: CalendarListRevisions<MealsArea>,
  scope: CalendarScope,
  items: readonly MealPlanItem[],
): MealListWrite {
  if (scope === 'template') {
    return {
      scope,
      weekday: revisions.weekday,
      area: revisions.area,
      items: [...items],
      expected_revision: revisions.templateRevision,
    };
  }
  return {
    scope,
    date: revisions.date,
    area: revisions.area,
    items: [...items],
    expected_revision: revisions.overrideRevision ?? 0,
  };
}

export function buildMealListWrite(
  context: { day: Pick<CalendarDay, 'date' | 'weekday' | 'lists'>; area: MealsArea; template: CalendarTemplateList },
  scope: CalendarScope,
  items: readonly MealPlanItem[],
): MealListWrite {
  return buildMealListWriteFromRevisions(captureListRevisions(context.day, context.area, context.template), scope, items);
}

export function mealEditorScope(list: CalendarList): CalendarScope {
  return list.source === 'override' ? 'date' : 'template';
}

/** Columns of square tiles that fit in a box. Matches a wrapping flex row with the same gap. */
export function tileColumns(width: number, tile = MEAL_TILE_SIZE, gap = MEAL_TILE_GAP): number {
  if (!(width > 0) || !(tile > 0) || !(gap >= 0)) return 0;
  return Math.max(0, Math.floor((width + gap) / (tile + gap)));
}

export function tileRows(height: number, tile = MEAL_TILE_SIZE, gap = MEAL_TILE_GAP): number {
  if (!(height > 0) || !(tile > 0) || !(gap >= 0)) return 0;
  return Math.max(0, Math.floor((height + gap) / (tile + gap)));
}

/**
 * How many tiles to draw in a box of width x height. When everything fits, all are shown. Otherwise one
 * slot is kept for the "+N" overflow tile, so the drawn tiles plus the badge never exceed the box.
 */
export function visibleTileCount(width: number, height: number, total: number, tile = MEAL_TILE_SIZE, gap = MEAL_TILE_GAP): number {
  if (!(total > 0)) return 0;
  const capacity = tileColumns(width, tile, gap) * tileRows(height, tile, gap);
  if (total <= capacity) return total;
  return Math.max(0, Math.min(total - 1, capacity - 1));
}
