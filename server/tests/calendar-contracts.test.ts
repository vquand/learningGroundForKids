import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR_AREAS, listBodySchema, itemsByArea, writableItems, deleteOverrideSchema, medicineItemSchema, mealItemSchema } from '../src/calendar/contracts.js';
import { STUDY_KEYS, STUDY_GROUP_BY_KEY, STUDY_GROUPS } from '../src/calendar/catalog.js';
import { AppError } from '../src/errors.js';
const base = { scope: 'template', weekday: 1, area: 'study_morning', expected_revision: 0, items: [{ subject: 'math' }] };
test('all 55 unique catalog keys have correct group membership and strict study shapes', () => {
  assert.equal(STUDY_KEYS.length, 55); assert.equal(new Set(STUDY_KEYS).size, 55);
  assert.deepEqual(Object.values(STUDY_GROUPS).map(keys => keys.length), [24, 12, 19]);
  for (const subject of STUDY_KEYS) {
    assert.ok(STUDY_GROUPS[STUDY_GROUP_BY_KEY[subject]].includes(subject));
    assert.equal(listBodySchema.safeParse({ ...base, items: [{ subject }] }).success, true);
  }
  assert.equal(listBodySchema.safeParse({ scope: 'date', date: '2026-10-29', area: 'study_afternoon', expected_revision: 0, items: Array(8).fill({ subject: 'math' }) }).success, true);
  for (const change of [
    { items: [{ subject: 'made_up' }] }, { items: [{ food: 'math' }] },
    { items: [{ subject: 'math', food: 'rice' }] }, { items: Array(9).fill({ subject: 'math' }) },
    { weekday: 0 }, { weekday: 8 }, { weekday: 1.5 }, { expected_revision: -1 },
    { expected_revision: undefined }, { profile_id: 'foreign' }, { id: 'foreign-list' },
    { scope: 'date', date: '2026-02-29', weekday: undefined },
  ]) assert.equal(listBodySchema.safeParse({ ...base, ...change }).success, false, JSON.stringify(change));
});
const validation = (error: unknown) => error instanceof AppError && error.status === 422 && error.code === 'VALIDATION_ERROR';
const meal = { food: 'rice' }, customMeal = { food: 'custom', icon: 'pho', name: 'Grandma soup' };
const medicine = { medicine: { method: 'tablet', color: 'red', qty: 2, dose: '100 ml' } };
test('meal and medicine areas accept their own shapes; item schemas reject wrong-area, hybrid, unknown, fractional and malformed values', () => {
  for (const area of CALENDAR_AREAS) assert.equal(itemsByArea[area].safeParse([]).success, true);
  for (const area of ['meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner'] as const) {
    assert.doesNotThrow(() => writableItems(area, [meal, customMeal, medicine]));
    assert.equal(itemsByArea[area].safeParse(Array(8).fill(meal)).success, true);
    assert.equal(itemsByArea[area].safeParse(Array(9).fill(meal)).success, false);
    assert.throws(() => writableItems(area, [{ subject: 'math' }]), validation);
  }
  assert.doesNotThrow(() => writableItems('medicine', Array(6).fill(medicine)));
  assert.equal(itemsByArea.medicine.safeParse(Array(7).fill(medicine)).success, false);
  assert.throws(() => writableItems('medicine', [meal]), validation);
  assert.throws(() => writableItems('medicine', [customMeal]), validation);
  for (const area of ['study_morning', 'study_afternoon'] as const) assert.throws(() => writableItems(area, [meal]), validation);
  assert.equal(mealItemSchema.safeParse({ food: 'custom', icon: 'unknown', name: '\u0000 \n' }).success, false);
  assert.equal(mealItemSchema.safeParse({ food: 'custom', icon: 'tablet', name: 'Soup' }).success, false, 'custom icon must be a meal food key');
  assert.equal(mealItemSchema.safeParse({ food: 'custom', icon: 'pho', name: 'x'.repeat(41) }).success, false);
  assert.equal(mealItemSchema.safeParse({ food: 'custom', icon: 'pho', name: 'x'.repeat(40) }).success, true);
  assert.equal(mealItemSchema.safeParse({ food: 'rice', subject: 'math' }).success, false, 'hybrid meal item');
  assert.equal(mealItemSchema.safeParse({ food: 'rice', medicine: medicine.medicine }).success, false, 'hybrid meal and medicine item');
  assert.equal(medicineItemSchema.safeParse({ medicine: { method: 'unknown', color: 'red', qty: 1.5, dose: 'x'.repeat(17) } }).success, false);
  for (const qty of [0, 21, 1.5]) assert.equal(medicineItemSchema.safeParse({ medicine: { ...medicine.medicine, qty } }).success, false, `qty ${qty}`);
  assert.equal(medicineItemSchema.safeParse({ medicine: { ...medicine.medicine, dose: 'x'.repeat(17) } }).success, false);
  assert.equal(medicineItemSchema.safeParse({ medicine: { ...medicine.medicine, dose: 'x'.repeat(16) } }).success, true);
  assert.equal(medicineItemSchema.safeParse({ medicine: { ...medicine.medicine, food: 'rice' } }).success, false, 'unknown medicine key');
  assert.equal(deleteOverrideSchema.safeParse({ date: '2026-10-29', area: 'study_morning', expected_revision: '2' }).success, true);
  for (const value of ['', '-1', '1.5', '1e2', '2147483648']) assert.equal(deleteOverrideSchema.safeParse({ date: '2026-10-29', area: 'study_morning', expected_revision: value }).success, false);
});

test('every calendar item name shares the 40-character limit', async () => {
  const { renameItemSchema } = await import('../src/calendar/contracts.js');
  const base = { date: '2026-11-02', index: 0, expected_revision: 0, expected_template_revision: 0 };
  for (const area of ['meal_lunch', 'study_morning'] as const) {
    assert.equal(renameItemSchema.safeParse({ ...base, area, name: 'x'.repeat(40) }).success, true);
    assert.equal(renameItemSchema.safeParse({ ...base, area, name: 'x'.repeat(41) }).success, false);
  }
});
