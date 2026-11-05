import type { CalendarScope } from './calendar';

// Frontend mirrors of the server catalog keys (server/src/calendar/catalog.ts). Parity is enforced by
// server/tests/calendar-meal-parity.test.ts; labels and artwork live in lib/calendarMealCatalog.ts.
export const MEAL_FOOD_KEYS = [
  'rice', 'sticky_rice', 'porridge', 'pho', 'noodles', 'fried_rice', 'banh_mi', 'sandwich', 'eggs', 'grilled_chicken',
  'fried_chicken', 'pork', 'beef', 'fish', 'shrimp', 'tofu', 'vegetables', 'salad', 'soup', 'spring_rolls',
  'dumplings', 'pizza', 'pasta', 'burger', 'fruit', 'banana', 'apple', 'orange', 'watermelon', 'yogurt',
  'cheese', 'bread', 'cake', 'cookies', 'ice_cream', 'chocolate', 'milk_box', 'canned_milk', 'soy_milk', 'juice',
  'water', 'tea', 'sausage', 'fast_food', 'vegetable_soup',
  'fish_fillet', 'grilled_fish', 'canned_fish', 'fish_soup', 'tomato', 'potato', 'cabbage', 'carrot', 'radish', 'water_spinach', 'malabar_spinach', 'mustard_greens', 'bok_choy', 'napa_cabbage', 'raw_beef', 'beef_plate', 'beef_stew', 'grilled_beef', 'raw_pork', 'pork_plate', 'braised_pork', 'grilled_pork', 'rotisserie_pork', 'raw_poultry', 'poultry_plate', 'poultry_soup', 'rotisserie_poultry', 'shrimp_plate', 'steamed_fish', 'fried_fish', 'raw_fish_fillet', 'steamed_carrot', 'stir_fried_water_spinach', 'malabar_spinach_soup', 'boiled_cabbage', 'grilled_pork_ribs',
] as const;
export type MealFoodKey = typeof MEAL_FOOD_KEYS[number];

export const MEDICINE_METHOD_KEYS = ['tablet', 'capsule', 'syrup', 'drops', 'cream_tube', 'powder_in_water', 'inhaler', 'patch', 'eye_nose_drops'] as const;
export type MedicineMethodKey = typeof MEDICINE_METHOD_KEYS[number];

export const MEDICINE_COLOR_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white'] as const;
export type MedicineColorKey = typeof MEDICINE_COLOR_KEYS[number];

export const MEAL_SLOT_AREAS = ['meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner'] as const;
export type MealSlotArea = typeof MEAL_SLOT_AREAS[number];
/** Every list area the Meals view writes: four meal slots plus the own-row medicine list. */
export type MealsArea = MealSlotArea | 'medicine';

export interface MealFoodItem { food: MealFoodKey; series_id?: string; }
export interface MealCustomItem { food: 'custom'; icon: MealFoodKey; name: string; series_id?: string; }
export interface MedicineDetail { method: MedicineMethodKey; color: MedicineColorKey; qty: number; dose?: string; }
export interface MedicineItem { medicine: MedicineDetail; series_id?: string; }
export interface MedicineRepeatDraft { item: MedicineItem & { series_id: string }; weekdays: number[]; }
export interface MedicineTemplateRevision { weekday: number; expected_revision: number; }
interface MedicineRepeatWrite { medicine_repeats?: MedicineRepeatDraft[]; expected_medicine_revisions?: MedicineTemplateRevision[]; }
export type MealPlanItem = MealFoodItem | MealCustomItem | MedicineItem;

export interface MealLibraryEntry { id: string; food_key: MealFoodKey; custom_name: string | null; }
export interface MealLibraryWriteBody { food: MealFoodKey; custom_name?: string; }

export interface MealListWriteTemplate extends MedicineRepeatWrite {
  scope: 'template';
  weekday: number;
  area: MealsArea;
  items: MealPlanItem[];
  expected_revision: number;
}
export interface MealListWriteDate extends MedicineRepeatWrite {
  scope: 'date';
  date: string;
  area: MealsArea;
  items: MealPlanItem[];
  expected_revision: number;
}
export type MealListWrite = MealListWriteTemplate | MealListWriteDate;

/** Scope choice shared with the study editor. */
export type MealPlanScope = CalendarScope;
