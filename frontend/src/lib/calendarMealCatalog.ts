import { getUiLanguage, type UiLanguage } from './uiLanguage.ts';
import type { MealFoodKey, MedicineColorKey, MedicineMethodKey } from '../types/calendarMeals.ts';

export interface MealFoodCatalogEntry { key: MealFoodKey; en: string; vi: string; art: string; }
export interface MedicineMethodCatalogEntry { key: MedicineMethodKey; en: string; vi: string; art: string; }
export interface MedicineColorEntry { key: MedicineColorKey; en: string; vi: string; css: string; }

const foodEntries = [
  ['rice', 'Rice', 'Cơm'],
  ['sticky_rice', 'Sticky rice', 'Xôi'],
  ['porridge', 'Porridge', 'Cháo'],
  ['pho', 'Pho', 'Phở'],
  ['noodles', 'Noodles', 'Mì'],
  ['fried_rice', 'Fried rice', 'Cơm rang'],
  ['banh_mi', 'Banh mi', 'Bánh mì'],
  ['sandwich', 'Sandwich', 'Bánh sandwich'],
  ['eggs', 'Eggs', 'Trứng'],
  ['grilled_chicken', 'Grilled chicken', 'Gà nướng'],
  ['fried_chicken', 'Fried chicken', 'Gà rán'],
  ['pork', 'Pork', 'Thịt lợn'],
  ['beef', 'Beef', 'Thịt bò'],
  ['fish', 'Fish', 'Cá'],
  ['shrimp', 'Shrimp', 'Tôm'],
  ['tofu', 'Tofu', 'Đậu phụ'],
  ['vegetables', 'Vegetables', 'Rau'],
  ['salad', 'Salad', 'Salad'],
  ['soup', 'Soup', 'Canh'],
  ['spring_rolls', 'Spring rolls', 'Nem rán'],
  ['dumplings', 'Dumplings', 'Há cảo'],
  ['pizza', 'Pizza', 'Pizza'],
  ['pasta', 'Pasta', 'Mì Ý'],
  ['burger', 'Burger', 'Bánh mì kẹp thịt'],
  ['fruit', 'Fruit', 'Hoa quả'],
  ['banana', 'Banana', 'Chuối'],
  ['apple', 'Apple', 'Táo'],
  ['orange', 'Orange', 'Cam'],
  ['watermelon', 'Watermelon', 'Dưa hấu'],
  ['yogurt', 'Yogurt', 'Sữa chua'],
  ['cheese', 'Cheese', 'Phô mai'],
  ['bread', 'Bread', 'Bánh mì sandwich'],
  ['cake', 'Cake', 'Bánh ngọt'],
  ['cookies', 'Cookies', 'Bánh quy'],
  ['ice_cream', 'Ice cream', 'Kem'],
  ['chocolate', 'Chocolate', 'Sô cô la'],
  ['milk_box', 'Milk box with straw', 'Sữa hộp có ống hút'],
  ['canned_milk', 'Canned milk', 'Sữa lon'],
  ['soy_milk', 'Soy milk', 'Sữa đậu nành'],
  ['juice', 'Juice', 'Nước ép'],
  ['water', 'Water', 'Nước lọc'],
  ['tea', 'Tea', 'Trà'],
  ['sausage', 'Sausage', 'Xúc xích'],
  ['fast_food', 'Fast food', 'Đồ ăn nhanh'],
  ['vegetable_soup', 'Vegetable soup', 'Canh rau củ'],
  ['fish_fillet', 'Fish fillet on a plate', 'Phi lê cá trên đĩa'],
  ['grilled_fish', 'Grilled fish', 'Cá nướng'],
  ['canned_fish', 'Canned fish', 'Cá hộp'],
  ['fish_soup', 'Fish soup', 'Canh cá'],
  ['tomato', 'Tomato', 'Cà chua'],
  ['potato', 'Potato', 'Khoai tây'],
  ['cabbage', 'Cabbage', 'Bắp cải'],
  ['carrot', 'Carrot', 'Cà rốt'],
  ['radish', 'Radish', 'Củ cải'],
  ['water_spinach', 'Water spinach', 'Rau muống'],
  ['malabar_spinach', 'Malabar spinach', 'Rau mồng tơi'],
  ['mustard_greens', 'Mustard greens', 'Rau cải'],
  ['bok_choy', 'Bok choy', 'Cải thìa'],
  ['napa_cabbage', 'Napa cabbage', 'Cải thảo'],
  ['raw_beef', 'Raw beef', 'Thịt bò sống'],
  ['beef_plate', 'Cooked beef on a plate', 'Thịt bò chín trên đĩa'],
  ['beef_stew', 'Beef stew in a pot', 'Bò hầm trong nồi'],
  ['grilled_beef', 'Grilled beef', 'Bò nướng'],
  ['raw_pork', 'Raw pork', 'Thịt lợn sống'],
  ['pork_plate', 'Cooked pork on a plate', 'Thịt lợn chín trên đĩa'],
  ['braised_pork', 'Braised pork in a pot', 'Thịt kho trong nồi'],
  ['grilled_pork', 'Grilled pork skewers', 'Thịt lợn xiên nướng'],
  ['rotisserie_pork', 'Rotisserie pork', 'Lợn quay'],
  ['raw_poultry', 'Raw poultry', 'Thịt gia cầm sống'],
  ['poultry_plate', 'Cooked poultry on plate', 'Gia cầm chín trên đĩa'],
  ['poultry_soup', 'Poultry soup in a pot', 'Canh gia cầm trong nồi'],
  ['rotisserie_poultry', 'Rotisserie poultry', 'Gia cầm quay'],
  ['shrimp_plate', 'Cooked shrimp', 'Tôm chín'],
  ['steamed_fish', 'Steamed fish', 'Cá hấp'],
  ['fried_fish', 'Fried fish fillet', 'Phi lê cá rán'],
  ['raw_fish_fillet', 'Raw fish fillet', 'Phi lê cá sống'],
  ['steamed_carrot', 'Steamed carrots', 'Cà rốt hấp'],
  ['stir_fried_water_spinach', 'Stir-fried water spinach', 'Rau muống xào'],
  ['malabar_spinach_soup', 'Malabar spinach soup', 'Canh mồng tơi'],
  ['boiled_cabbage', 'Boiled cabbage', 'Bắp cải luộc'],
  ['grilled_pork_ribs', 'Grilled pork ribs', 'Sườn lợn nướng'],
] as const satisfies readonly (readonly [MealFoodKey, string, string])[];

const methodEntries = [
  ['tablet', 'Tablet', 'Viên nén'],
  ['capsule', 'Capsule', 'Viên nang'],
  ['syrup', 'Syrup', 'Siro'],
  ['drops', 'Drops', 'Thuốc nhỏ giọt'],
  ['cream_tube', 'Cream', 'Thuốc bôi'],
  ['powder_in_water', 'Powder in water', 'Thuốc bột pha nước'],
  ['inhaler', 'Inhaler', 'Thuốc xịt hít'],
  ['patch', 'Patch', 'Miếng dán'],
  ['eye_nose_drops', 'Eye / nose drops', 'Thuốc nhỏ mắt / mũi'],
] as const satisfies readonly (readonly [MedicineMethodKey, string, string])[];

const colorEntries = [
  ['red', 'Red', 'Đỏ', '#d64545'],
  ['orange', 'Orange', 'Cam', '#f08a24'],
  ['yellow', 'Yellow', 'Vàng', '#f2c12e'],
  ['green', 'Green', 'Xanh lá', '#3fa34d'],
  ['blue', 'Blue', 'Xanh dương', '#3b7dd8'],
  ['purple', 'Purple', 'Tím', '#8e5bd0'],
  ['pink', 'Pink', 'Hồng', '#e879a6'],
  ['white', 'White', 'Trắng', '#fbfaf5'],
] as const satisfies readonly (readonly [MedicineColorKey, string, string, string])[];

/** Meal food palette. Keys mirror server MEAL_FOOD_KEYS; art paths follow the calendar icon manifest. */
export const MEAL_FOOD_CATALOG: readonly { key: MealFoodKey; en: string; vi: string; art: string }[] = foodEntries.map(([key, en, vi]) => ({
  key,
  en,
  vi,
  art: `/calendar/icons/meals/${key}.webp`,
}));

/** Medicine method icons. Mirrors server MEDICINE_METHOD_KEYS. */
export const MEDICINE_METHOD_CATALOG: readonly { key: MedicineMethodKey; en: string; vi: string; art: string }[] = methodEntries.map(([key, en, vi]) => ({
  key,
  en,
  vi,
  art: `/calendar/icons/medicine/${key}.webp`,
}));

/** Medicine colour swatches. Mirrors server MEDICINE_COLOR_KEYS; `css` tints tiles and dots. */
export const MEDICINE_COLORS: readonly MedicineColorEntry[] = colorEntries.map(([key, en, vi, css]) => ({ key, en, vi, css }));

const FOOD_BY_KEY = new Map<string, (typeof MEAL_FOOD_CATALOG)[number]>(MEAL_FOOD_CATALOG.map((entry) => [entry.key, entry]));
const METHOD_BY_KEY = new Map<string, (typeof MEDICINE_METHOD_CATALOG)[number]>(MEDICINE_METHOD_CATALOG.map((entry) => [entry.key, entry]));
const COLOR_BY_KEY = new Map<string, MedicineColorEntry>(MEDICINE_COLORS.map((entry) => [entry.key, entry]));

export function isMealFoodKey(value: unknown): value is MealFoodKey {
  return typeof value === 'string' && FOOD_BY_KEY.has(value);
}

export function isMedicineMethodKey(value: unknown): value is MedicineMethodKey {
  return typeof value === 'string' && METHOD_BY_KEY.has(value);
}

export function isMedicineColorKey(value: unknown): value is MedicineColorKey {
  return typeof value === 'string' && COLOR_BY_KEY.has(value);
}

export function mealFoodLabel(key: MealFoodKey, language: UiLanguage = getUiLanguage()): string {
  const entry = FOOD_BY_KEY.get(key);
  return entry ? (language === 'vi' ? entry.vi : entry.en) : key;
}

export function mealFoodArt(key: MealFoodKey): string {
  return FOOD_BY_KEY.get(key)?.art ?? `/calendar/icons/meals/${key}.webp`;
}

export function medicineMethodLabel(key: MedicineMethodKey, language: UiLanguage = getUiLanguage()): string {
  const entry = METHOD_BY_KEY.get(key);
  return entry ? (language === 'vi' ? entry.vi : entry.en) : key;
}

export function medicineMethodArt(key: MedicineMethodKey): string {
  return METHOD_BY_KEY.get(key)?.art ?? `/calendar/icons/medicine/${key}.webp`;
}

export function medicineColorLabel(key: MedicineColorKey, language: UiLanguage = getUiLanguage()): string {
  const entry = COLOR_BY_KEY.get(key);
  return entry ? (language === 'vi' ? entry.vi : entry.en) : key;
}

export function medicineColorCss(key: MedicineColorKey): string {
  return COLOR_BY_KEY.get(key)?.css ?? '#ffffff';
}
