import { GRILLED_PORK_RECIPE, SOUP_POT_RECIPE, STEAK_PAN_RECIPE } from "./cookingConfig.ts";

export type CookingMealAvailability = "available" | "coming-soon";

export interface CookingMealOption {
  id: string;
  title: string;
  description: string;
  station: string;
  icon: string;
  availability: CookingMealAvailability;
  recipeId?: string;
  imagePath?: string;
}

export const COOKING_MEALS: readonly CookingMealOption[] = [
  {
    id: "hamburger",
    title: "Cozy cheeseburger",
    description: "Shape little buns, cook a cheesy patty, and build your own burger with Chef Capy.",
    station: "Burger counter",
    icon: "🍔",
    availability: "available",
  },
  {
    id: "steak",
    title: "Butter-basted steak",
    description: "Layer the butter, nestle in the steak, season, choose the heat, and flip it golden.",
    station: "Pan",
    icon: "🥩",
    availability: "available",
    recipeId: STEAK_PAN_RECIPE.id,
    imagePath: STEAK_PAN_RECIPE.resultImagePath,
  },
  {
    id: "potato-carrot-beef-soup",
    title: "Potato, carrot & beef soup",
    description: "Pack a generous pot with beef, potatoes, and carrots before bringing it to a gentle simmer.",
    station: "Pot",
    icon: "🍲",
    availability: "available",
    recipeId: SOUP_POT_RECIPE.id,
    imagePath: SOUP_POT_RECIPE.resultImagePath,
  },
  {
    id: "grilled-steak",
    title: "Forest rotisserie pork",
    description: "Turn until golden, choose a yummy glaze, and serve on a big dish.",
    station: "Grill",
    icon: "🥩",
    availability: "available",
    recipeId: GRILLED_PORK_RECIPE.id,
    imagePath: GRILLED_PORK_RECIPE.resultImagePath,
  },
  {
    id: "cabbage-rolls",
    title: "Cabbage rolls with meat",
    description: "Chop beef and veggies, mix, steam, roll, and simmer in tomato sauce.",
    station: "Pot",
    icon: "🥬",
    availability: "available",
  },
];

export function getCookingMeal(mealId: string) {
  return COOKING_MEALS.find((meal) => meal.id === mealId);
}
