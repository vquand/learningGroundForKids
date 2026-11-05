export type FoodDrinkStepKind = "prepare" | "assemble" | "mix" | "decorate";
export type FoodDrinkIngredientPlacement = "shelf" | "fridge" | "dispenser";
export interface FoodDrinkIngredient {
    id: string;
    label: string;
    emoji: string;
    imagePath: string;
    placement: FoodDrinkIngredientPlacement;
    hint: string;
}
export interface FoodDrinkStep {
    id: string;
    kind: FoodDrinkStepKind;
    label: string;
    instruction: string;
    /** References an item in FoodDrinkRecipe.ingredients. */
    expectedIngredientId: string;
    optional?: boolean;
}
export interface FoodDrinkRecipe {
    id: string;
    title: string;
    difficulty: "easy" | "medium" | "hard";
    description: string;
    accent: string;
    /** Every ingredient available for this drink; placement controls where it appears in the kitchen. */
    ingredients: readonly FoodDrinkIngredient[];
    steps: readonly FoodDrinkStep[];
}
export interface FoodDrinkCupOption {
    id: string;
    label: string;
    size: "small" | "medium" | "large" | "tall" | "mug";
    imagePath: string;
}
export const FOOD_AND_DRINK_CUP_OPTIONS: readonly FoodDrinkCupOption[] = [
    { id: "small-red-rim", label: "Small coral cup", size: "small", imagePath: "/minigames/food-and-drink/kitchen/cup-small-red-rim.png" },
    { id: "medium-mint-dots", label: "Medium mint cup", size: "medium", imagePath: "/minigames/food-and-drink/kitchen/cup-medium-mint-dots.png" },
    { id: "large-plain", label: "Large cream cup", size: "large", imagePath: "/minigames/food-and-drink/kitchen/cup-large-plain.png" },
    { id: "tall-glass-aqua", label: "Tall aqua glass", size: "tall", imagePath: "/minigames/food-and-drink/kitchen/cup-tall-glass-aqua.png" },
    { id: "cat-face-yellow", label: "Sunny cat mug", size: "mug", imagePath: "/minigames/food-and-drink/kitchen/cup-cat-face-yellow.png" },
];
const ingredient = (id: string, label: string, emoji: string, placement: FoodDrinkIngredientPlacement, hint: string): FoodDrinkIngredient => ({
    id,
    label,
    emoji,
    placement,
    hint,
    imagePath: `/minigames/food-and-drink/kitchen/${id}.png`,
});
const lemon = ingredient("lemon", "Lemon", "🍋", "shelf", "A sunny squeeze");
const sugar = ingredient("sugar", "Sugar", "🍚", "shelf", "Just a little sweet");
const teaBag = ingredient("tea-bag", "Tea bag", "🫖", "shelf", "A cozy tea blend");
const coffee = ingredient("coffee", "Coffee", "☕", "shelf", "A warm coffee scoop");
const milk = ingredient("milk", "Milk", "🥛", "shelf", "A creamy splash");
const mint = ingredient("mint-leaf", "Mint leaf", "🌿", "shelf", "A fresh finishing touch");
const cocoa = ingredient("cocoa-dust", "Cocoa", "🍫", "shelf", "A tiny chocolate sprinkle");
const ice = ingredient("ice", "Ice", "🧊", "fridge", "Cool cubes from the fridge");
const water = ingredient("water", "Water", "💧", "dispenser", "Fresh water from the tap");
export const FOOD_AND_DRINK_RECIPES: readonly FoodDrinkRecipe[] = [
    {
        id: "lemonade",
        title: "Lemonade",
        difficulty: "easy",
        description: "A bright, zippy drink for a sunny day.",
        accent: "#f4c95d",
        ingredients: [lemon, sugar, mint, ice, water],
        steps: [
            { id: "lemon", kind: "prepare", label: "Squeeze", instruction: "Squeeze the lemon into the cup.", expectedIngredientId: lemon.id },
            { id: "ice", kind: "assemble", label: "Add ice", instruction: "Add a few cool ice cubes from the fridge.", expectedIngredientId: ice.id },
            { id: "water", kind: "assemble", label: "Fill", instruction: "Fill the cup with fresh water.", expectedIngredientId: water.id },
            { id: "sugar", kind: "mix", label: "Stir", instruction: "Add sugar and give it a gentle stir.", expectedIngredientId: sugar.id },
            { id: "mint", kind: "decorate", label: "Garnish", instruction: "Add a mint leaf, or skip it for a simple lemonade.", expectedIngredientId: mint.id, optional: true },
        ],
    },
    {
        id: "mint-tea",
        title: "Mint Tea",
        difficulty: "medium",
        description: "A warm, gentle cup with a fresh minty finish.",
        accent: "#82b883",
        ingredients: [teaBag, sugar, mint, water],
        steps: [
            { id: "tea", kind: "prepare", label: "Choose tea", instruction: "Place the tea bag in your cup.", expectedIngredientId: teaBag.id },
            { id: "water", kind: "assemble", label: "Pour", instruction: "Pour in warm water from the dispenser.", expectedIngredientId: water.id },
            { id: "sugar", kind: "mix", label: "Sweeten", instruction: "Stir in a little sugar.", expectedIngredientId: sugar.id },
            { id: "mint", kind: "decorate", label: "Garnish", instruction: "Add mint, or skip the garnish when your tea is ready.", expectedIngredientId: mint.id, optional: true },
        ],
    },
    {
        id: "iced-coffee",
        title: "Iced Coffee",
        difficulty: "medium",
        description: "A cool, creamy coffee for a little energy.",
        accent: "#b7856a",
        ingredients: [coffee, milk, cocoa, ice],
        steps: [
            { id: "coffee", kind: "prepare", label: "Scoop", instruction: "Add coffee to your cup.", expectedIngredientId: coffee.id },
            { id: "ice", kind: "assemble", label: "Chill", instruction: "Drop in a few ice cubes from the fridge.", expectedIngredientId: ice.id },
            { id: "milk", kind: "mix", label: "Mix", instruction: "Pour in milk and give the drink a gentle stir.", expectedIngredientId: milk.id },
            { id: "cocoa", kind: "decorate", label: "Sprinkle", instruction: "Sprinkle cocoa, or skip the garnish when it is ready.", expectedIngredientId: cocoa.id, optional: true },
        ],
    },
];
export function getRecipeIngredients(recipe: FoodDrinkRecipe, placement?: FoodDrinkIngredientPlacement): readonly FoodDrinkIngredient[] {
    return placement
        ? recipe.ingredients.filter((ingredient) => ingredient.placement === placement)
        : recipe.ingredients;
}
export function getRecipeIngredient(recipe: FoodDrinkRecipe, ingredientId: string): FoodDrinkIngredient | undefined {
    return recipe.ingredients.find((ingredient) => ingredient.id === ingredientId);
}
export const DEFAULT_FOOD_AND_DRINK_RECIPE: FoodDrinkRecipe = FOOD_AND_DRINK_RECIPES[0]!;
export function getFoodDrinkRecipe(recipeId: string): FoodDrinkRecipe {
    return FOOD_AND_DRINK_RECIPES.find((recipe) => recipe.id === recipeId) ?? DEFAULT_FOOD_AND_DRINK_RECIPE;
}
