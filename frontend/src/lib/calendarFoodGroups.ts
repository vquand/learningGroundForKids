import type { MealFoodKey, MealPlanItem } from '../types/calendarMeals';

export function hasFastFood(items: readonly MealPlanItem[]): boolean {
  return items.some(item => !('medicine' in item) && (item.food === 'fast_food' || (item.food === 'custom' && item.icon === 'fast_food')));
}

export const FOOD_GROUP_LABELS = ['All foods', 'Staples', 'Fish and seafood', 'Meat and protein', 'Vegetables', 'Fruit', 'Drinks', 'Treats'] as const;
export type FoodGroup = typeof FOOD_GROUP_LABELS[number];
const vegetables = new Set<MealFoodKey>(['vegetable_soup', 'vegetables', 'salad', 'tomato', 'potato', 'cabbage', 'carrot', 'radish', 'water_spinach', 'malabar_spinach', 'mustard_greens', 'bok_choy', 'napa_cabbage', 'steamed_carrot', 'stir_fried_water_spinach', 'malabar_spinach_soup', 'boiled_cabbage']);
const seafood = new Set<MealFoodKey>(['fish', 'shrimp', 'fish_fillet', 'grilled_fish', 'canned_fish', 'fish_soup', 'shrimp_plate', 'steamed_fish', 'fried_fish', 'raw_fish_fillet']);
const protein = new Set<MealFoodKey>(['sausage', 'eggs', 'tofu', 'grilled_chicken', 'fried_chicken', 'pork', 'beef', 'raw_beef', 'beef_plate', 'beef_stew', 'grilled_beef', 'raw_pork', 'pork_plate', 'braised_pork', 'grilled_pork', 'rotisserie_pork', 'raw_poultry', 'poultry_plate', 'poultry_soup', 'rotisserie_poultry', 'grilled_pork_ribs']);
const fruit = new Set<MealFoodKey>(['fruit', 'banana', 'apple', 'orange', 'watermelon']);
const drinks = new Set<MealFoodKey>(['milk_box', 'canned_milk', 'soy_milk', 'juice', 'water', 'tea']);
const treats = new Set<MealFoodKey>(['yogurt', 'cheese', 'cake', 'cookies', 'ice_cream', 'chocolate']);
export function foodGroup(key: MealFoodKey): FoodGroup {
  if (vegetables.has(key)) return 'Vegetables';
  if (seafood.has(key)) return 'Fish and seafood';
  if (protein.has(key)) return 'Meat and protein';
  if (fruit.has(key)) return 'Fruit';
  if (drinks.has(key)) return 'Drinks';
  if (treats.has(key)) return 'Treats';
  return 'Staples';
}
// Pure shared normalization; this module has no server runtime dependencies.
export { calendarSearchText } from '../../../server/src/calendar/search.ts';
