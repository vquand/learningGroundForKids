import { getFoodDrinkRecipe, type FoodDrinkRecipe } from "./drink-recipes.ts";
export type FoodDrinkGameStatus = "playing" | "completed";
export interface FoodDrinkFeedback {
    kind: "wrong";
    ingredientId: string;
}
export interface FoodDrinkGameState {
    recipeId: string;
    stepIndex: number;
    status: FoodDrinkGameStatus;
    feedback: FoodDrinkFeedback | null;
    addedIngredientIds: readonly string[];
}
export type FoodDrinkGameAction = {
    type: "selectIngredient";
    ingredientId: string;
} | {
    type: "skipOptionalStep";
} | {
    type: "dismissFeedback";
} | {
    type: "restart";
};
export function createFoodDrinkGame(recipe: FoodDrinkRecipe): FoodDrinkGameState {
    return { recipeId: recipe.id, stepIndex: 0, status: "playing", feedback: null, addedIngredientIds: [] };
}
function advance(state: FoodDrinkGameState, recipe: FoodDrinkRecipe): FoodDrinkGameState {
    const nextStepIndex = state.stepIndex + 1;
    return {
        ...state,
        stepIndex: nextStepIndex,
        status: nextStepIndex >= recipe.steps.length ? "completed" : "playing",
        feedback: null,
    };
}
export function foodDrinkReducer(state: FoodDrinkGameState, action: FoodDrinkGameAction, recipe: FoodDrinkRecipe = getFoodDrinkRecipe(state.recipeId)): FoodDrinkGameState {
    if (action.type === "restart") {
        return { recipeId: state.recipeId, stepIndex: 0, status: "playing", feedback: null, addedIngredientIds: [] };
    }
    if (action.type === "dismissFeedback")
        return { ...state, feedback: null };
    if (state.status === "completed")
        return state;
    const currentStep = recipe.steps[state.stepIndex];
    if (!currentStep)
        return { ...state, status: "completed", feedback: null };
    if (action.type === "skipOptionalStep") {
        return currentStep.optional ? advance(state, recipe) : state;
    }
    if (action.type !== "selectIngredient")
        return state;
    if (action.ingredientId !== currentStep.expectedIngredientId) {
        return { ...state, feedback: { kind: "wrong", ingredientId: action.ingredientId } };
    }
    const addedIngredientIds = state.addedIngredientIds.includes(action.ingredientId)
        ? state.addedIngredientIds
        : [...state.addedIngredientIds, action.ingredientId];
    return advance({ ...state, addedIngredientIds }, recipe);
}
