import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CALENDAR_LIBRARY_CAP } from '../src/lib/calendarLimits.ts';
import { MEAL_LIBRARY_CAP } from '../src/lib/calendarMealHelpers.ts';
import type { CalendarDay, CalendarList, CalendarTemplateList } from '../src/types/calendar.ts';
import type { MealPlanItem } from '../src/types/calendarMeals.ts';
import {
  addPlanItem, buildMealListWrite, canAddPlanItem, capForArea, cleanCustomMealName, cleanDoseNote, isMealPlanItem, libraryEntryName, libraryEntryToItem, MEAL_SLOT_CAP,
  MEDICINE_ROW_CAP, mealEditorScope, medicineItem, parseMealPlanItems, removePlanItemAt, tileColumns, tileRows, visibleTileCount, MEAL_TILE_GAP, MEAL_TILE_SIZE,
} from '../src/lib/calendarMealHelpers.ts';

const empty = (): CalendarList => ({ id: null, items: [], revision: 0, source: 'empty' });
const day: CalendarDay = {
  date: '2026-11-03', weekday: 2, is_past: false,
  lists: {
    study_morning: empty(), study_afternoon: empty(), study_extra: empty(),
    meal_breakfast: empty(), meal_lunch: { id: 'override-lunch', items: [{ food: 'rice' }], revision: 5, source: 'override' },
    meal_snack: empty(), meal_dinner: empty(), medicine: empty(),
  },
};
const lunchTemplate: CalendarTemplateList = { id: 'template-lunch', items: [{ food: 'soup' }], revision: 9, source: 'template' };
const rice: MealPlanItem = { food: 'rice' };
const pho: MealPlanItem = { food: 'pho' };
const medicine = (qty = 2): MealPlanItem => ({ medicine: { method: 'tablet', color: 'red', qty } });

test('study and meal libraries share the reviewed server cap', () => {
  const source = readFileSync(new URL('../../server/src/calendar/catalog.ts', import.meta.url), 'utf8');
  const serverCap = /export const LIBRARY_CAP = (\d+);/.exec(source)?.[1];
  assert.ok(serverCap);
  assert.equal(CALENDAR_LIBRARY_CAP, Number(serverCap));
  assert.equal(MEAL_LIBRARY_CAP, CALENDAR_LIBRARY_CAP);
});

test('meal and medicine caps: 8 per slot, 6 on the Medicine row', () => {
  assert.equal(MEAL_SLOT_CAP, 8);
  assert.equal(MEDICINE_ROW_CAP, 6);
  assert.equal(capForArea('meal_dinner'), 8);
  assert.equal(capForArea('medicine'), 6);
  const eight = Array.from({ length: 8 }, () => rice);
  assert.equal(canAddPlanItem(eight, 'meal_lunch'), false);
  assert.equal(addPlanItem(eight, pho, 'meal_lunch').length, 8);
  // Foods and medicine share the same slot cap.
  assert.equal(addPlanItem([...Array.from({ length: 7 }, () => rice)], medicine(), 'meal_lunch').length, 8);
  assert.equal(addPlanItem(Array.from({ length: 6 }, () => medicine()), medicine(), 'medicine').length, 6);
  assert.equal(addPlanItem(Array.from({ length: 6 }, () => medicine()), medicine(), 'meal_lunch').length, 7);
  assert.deepEqual(removePlanItemAt([rice, pho], 0), [pho]);
  assert.deepEqual(removePlanItemAt([rice, pho], 5), [rice, pho]);
  assert.deepEqual(removePlanItemAt([rice, pho], -1), [rice, pho]);
});

test('stored items are validated strictly and the Medicine row keeps medicine entries only', () => {
  const raw = [
    { food: 'rice' },
    { food: 'custom', icon: 'pho', name: 'Bà ngoại nấu' },
    { medicine: { method: 'syrup', color: 'blue', qty: 1, dose: '5 ml' } },
    { food: 'mystery' },
    { food: 'custom', icon: 'rice', name: '' },
    { food: 'custom', icon: 'rice', name: 'x'.repeat(41) },
    { medicine: { method: 'tablet', color: 'red', qty: 0 } },
    { medicine: { method: 'tablet', color: 'red', qty: 2.5 } },
    { medicine: { method: 'tablet', color: 'red', qty: 21 } },
    { medicine: { method: 'tablet', color: 'red', qty: 2, dose: 'y'.repeat(17) } },
    { food: 'rice', extra: true, study: 'math' },
    'rice',
    null,
  ];
  assert.deepEqual(parseMealPlanItems(raw, 'meal_breakfast'), [
    { food: 'rice' },
    { food: 'custom', icon: 'pho', name: 'Bà ngoại nấu' },
    { medicine: { method: 'syrup', color: 'blue', qty: 1, dose: '5 ml' } },
    { food: 'rice', extra: true, study: 'math' },
  ]);
  assert.deepEqual(parseMealPlanItems(raw, 'medicine'), [{ medicine: { method: 'syrup', color: 'blue', qty: 1, dose: '5 ml' } }]);
  assert.equal(isMealPlanItem({ food: 'custom', icon: 'rice', name: 'Cơm nhà' }), true);
  assert.equal(isMealPlanItem({ food: 'custom', icon: 'custom', name: 'Cơm nhà' }), false);
});

test('library rows become meal items; custom names keep the food as the icon', () => {
  assert.deepEqual(libraryEntryToItem({ id: 'a', food_key: 'fish', custom_name: null }), { food: 'fish' });
  assert.deepEqual(libraryEntryToItem({ id: 'b', food_key: 'fish', custom_name: 'Cá kho' }), { food: 'custom', icon: 'fish', name: 'Cá kho' });
  assert.equal(libraryEntryName({ id: 'c', food_key: 'tea', custom_name: null }, () => 'Tea'), 'Tea');
  assert.equal(libraryEntryName({ id: 'c', food_key: 'tea', custom_name: 'Trà sữa' }, () => 'Tea'), 'Trà sữa');
});

test('kid text is cleaned before it is sent, and dose notes and quantities are bounded', () => {
  assert.equal(cleanCustomMealName('  Cơm\u0007  nhà  '), 'Cơm nhà');
  assert.equal(cleanCustomMealName('a'.repeat(40)).length, 40);
  assert.equal(cleanDoseNote('   '), undefined);
  assert.equal(cleanDoseNote('100 ml'), '100 ml');
  assert.deepEqual(medicineItem({ method: 'drops', color: 'green', qty: 99, dose: '  2 drops\n' }), {
    medicine: { method: 'drops', color: 'green', qty: 20, dose: '2 drops' },
  });
  assert.deepEqual(medicineItem({ method: 'patch', color: 'pink', qty: 0 }), { medicine: { method: 'patch', color: 'pink', qty: 1 } });
});

test('template saves send the template revision; "only this day" uses the override revision or zero', () => {
  const context = { day, area: 'meal_lunch' as const, template: lunchTemplate };
  assert.deepEqual(buildMealListWrite(context, 'template', [pho]), {
    scope: 'template', weekday: 2, area: 'meal_lunch', items: [pho], expected_revision: 9,
  });
  // The lunch override exists, so its revision is the one to send.
  assert.deepEqual(buildMealListWrite(context, 'date', [pho]), {
    scope: 'date', date: '2026-11-03', area: 'meal_lunch', items: [pho], expected_revision: 5,
  });
  // No override on dinner yet: the first override is created with revision 0.
  assert.deepEqual(buildMealListWrite({ ...context, area: 'meal_dinner', template: { ...lunchTemplate, revision: 3 } }, 'date', [pho]).expected_revision, 0);
  // The Medicine row writes its own area with medicine entries.
  assert.deepEqual(buildMealListWrite({ day, area: 'medicine', template: { ...lunchTemplate, revision: 0, items: [] } }, 'template', [medicine()]), {
    scope: 'template', weekday: 2, area: 'medicine', items: [medicine()], expected_revision: 0,
  });
  assert.equal(mealEditorScope(day.lists.meal_lunch), 'date');
  assert.equal(mealEditorScope(day.lists.meal_dinner), 'template');
});

test('visible tile count fits the box, keeps one slot for "+N", and never reports more tiles than the box holds', () => {
  assert.equal(MEAL_TILE_SIZE, 32);
  assert.equal(MEAL_TILE_GAP, 2);
  assert.equal(tileColumns(32), 1);
  assert.equal(tileColumns(31), 0);
  assert.equal(tileColumns(66), 2);
  assert.equal(tileRows(34), 1);
  assert.equal(tileRows(33), 1);
  assert.equal(tileRows(31), 0);
  // Everything fits: no badge needed.
  assert.equal(visibleTileCount(149, 106, 8), 8);
  assert.equal(visibleTileCount(1000, 1000, 8), 8);
  // Overflow: capacity 9 at 104x106 px; eight fit, and nine would need the badge slot.
  assert.equal(visibleTileCount(104, 106, 8), 8);
  assert.equal(visibleTileCount(104, 106, 9), 9);
  assert.equal(visibleTileCount(104, 106, 10), 8);
  // One column, two rows (capacity 2): one tile plus "+2".
  assert.equal(visibleTileCount(32, 68, 3), 1);
  assert.equal(visibleTileCount(32, 106, 3), 3);
  assert.equal(visibleTileCount(0, 106, 3), 0);
  assert.equal(visibleTileCount(104, 106, 0), 0);
});

test('maximum content fits the computed cell boxes at the required landscape sizes', () => {
  // Cell content boxes (border and padding removed) from the Meals CSS: 2px border and 5px padding on meal cells,
  // 3px padding on the 76px Medicine row. Widths follow the 7 flexible day columns at each viewport.
  const at1024 = { width: 104, mealHeight: 106, medicineHeight: 66 };
  const at1366 = { width: 149, mealHeight: 106, medicineHeight: 66 };
  const at1180 = { width: 126, mealHeight: 119, medicineHeight: 66 };
  for (const box of [at1024, at1366, at1180]) {
    assert.ok(visibleTileCount(box.width, box.mealHeight, 8) === 8, `eight meal entries fit ${JSON.stringify(box)}`);
    assert.ok(visibleTileCount(box.width, box.medicineHeight, 6) === 6, `six medicine entries fit ${JSON.stringify(box)}`);
  }
});
test('server-confirmed favorite saves insert, update and merge duplicate rows without losing other favorites', async () => {
  const { applyMealLibrarySave } = await import('../src/lib/calendarMealHelpers.ts');
  const rice = { id: 'rice', food_key: 'rice' as const, custom_name: null };
  const eggs = { id: 'eggs', food_key: 'eggs' as const, custom_name: 'Breakfast eggs' };
  assert.deepEqual(applyMealLibrarySave([rice], eggs), [rice, eggs]);
  assert.deepEqual(applyMealLibrarySave([rice, eggs], eggs), [rice, eggs]);
  const renamed = { ...eggs, custom_name: 'Egg omelette' };
  assert.deepEqual(applyMealLibrarySave([rice, eggs], renamed, eggs.id), [rice, renamed]);
  assert.deepEqual(applyMealLibrarySave([rice, eggs], rice, eggs.id), [rice]);
});
