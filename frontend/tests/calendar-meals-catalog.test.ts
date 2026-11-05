import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMealFoodKey, isMedicineColorKey, isMedicineMethodKey, MEAL_FOOD_CATALOG, MEDICINE_COLORS, MEDICINE_METHOD_CATALOG, mealFoodArt, mealFoodLabel, medicineColorCss, medicineColorLabel, medicineMethodLabel,
} from '../src/lib/calendarMealCatalog.ts';
import { MEAL_FOOD_KEYS, MEDICINE_COLOR_KEYS, MEDICINE_METHOD_KEYS } from '../src/types/calendarMeals.ts';

test('meal food catalog has 81 unique keys with EN, VI and icon paths', () => {
  assert.equal(MEAL_FOOD_CATALOG.length, 81);
  assert.equal(new Set(MEAL_FOOD_CATALOG.map((entry) => entry.key)).size, 81);
  for (const entry of MEAL_FOOD_CATALOG) {
    assert.ok(entry.en.trim(), entry.key);
    assert.ok(entry.vi.trim(), entry.key);
    assert.equal(entry.art, `/calendar/icons/meals/${entry.key}.webp`);
  }
  assert.deepEqual(MEAL_FOOD_CATALOG.map((entry) => entry.key), [...MEAL_FOOD_KEYS]);
});

test('medicine method catalog has 9 unique methods with icon paths', () => {
  assert.equal(MEDICINE_METHOD_CATALOG.length, 9);
  assert.equal(new Set(MEDICINE_METHOD_CATALOG.map((entry) => entry.key)).size, 9);
  for (const entry of MEDICINE_METHOD_CATALOG) {
    assert.equal(entry.art, `/calendar/icons/medicine/${entry.key}.webp`);
    assert.ok(entry.en.trim() && entry.vi.trim(), entry.key);
  }
  assert.deepEqual(MEDICINE_METHOD_CATALOG.map((entry) => entry.key), [...MEDICINE_METHOD_KEYS]);
});

test('medicine colours have 8 unique keys, CSS colours and both labels', () => {
  assert.equal(MEDICINE_COLORS.length, 8);
  assert.equal(new Set(MEDICINE_COLORS.map((entry) => entry.key)).size, 8);
  for (const entry of MEDICINE_COLORS) {
    assert.match(entry.css, /^#[0-9a-f]{6}$/i, entry.key);
    assert.ok(entry.en.trim() && entry.vi.trim(), entry.key);
  }
  assert.deepEqual(MEDICINE_COLORS.map((entry) => entry.key), [...MEDICINE_COLOR_KEYS]);
});

test('key guards and labels follow the active UI language with safe fallbacks', () => {
  assert.equal(isMealFoodKey('rice'), true);
  assert.equal(isMealFoodKey('custom'), false);
  assert.equal(isMealFoodKey(undefined), false);
  assert.equal(isMedicineMethodKey('tablet'), true);
  assert.equal(isMedicineMethodKey('pill'), false);
  assert.equal(isMedicineColorKey('red'), true);
  assert.equal(isMedicineColorKey('black'), false);
  assert.equal(mealFoodLabel('rice', 'en'), 'Rice');
  assert.equal(mealFoodLabel('rice', 'vi'), 'Cơm');
  assert.equal(mealFoodLabel('milk_box', 'vi'), 'Sữa hộp có ống hút');
  assert.equal(mealFoodArt('pho'), '/calendar/icons/meals/pho.webp');
  assert.equal(medicineMethodLabel('syrup', 'vi'), 'Siro');
  assert.equal(isMedicineMethodKey('eye_nose_drops'), true);
  assert.equal(medicineMethodLabel('eye_nose_drops', 'vi'), 'Thuốc nhỏ mắt / mũi');
  assert.equal(medicineColorLabel('red', 'vi'), 'Đỏ');
  assert.equal(medicineColorLabel('red', 'en'), 'Red');
  assert.equal(medicineColorCss('blue'), '#3b7dd8');
});
