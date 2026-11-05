import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FOOD_AND_DRINK_CUP_OPTIONS,
  FOOD_AND_DRINK_RECIPES,
  getRecipeIngredients,
  type FoodDrinkRecipe,
} from "../src/features/food-and-drink/foodAndDrinkConfig.ts";
import {
  createFoodDrinkGame,
  foodDrinkReducer,
} from "../src/features/food-and-drink/foodAndDrinkGame.ts";

test("the MVP recipes include all four child-friendly preparation steps", () => {
  assert.deepEqual(
    FOOD_AND_DRINK_RECIPES.map((recipe) => recipe.title),
    ["Lemonade", "Mint Tea", "Iced Coffee"],
  );

  for (const recipe of FOOD_AND_DRINK_RECIPES) {
    assert.equal(recipe.steps[0]?.kind, "prepare");
    assert.equal(recipe.steps.at(-1)?.kind, "decorate");
    assert.ok(recipe.steps.some((step) => step.kind === "assemble"));
    assert.ok(recipe.steps.some((step) => step.kind === "mix"));
    assert.ok(recipe.ingredients.length >= 2);
    assert.ok(getRecipeIngredients(recipe, "shelf").length >= 1);
    assert.ok(recipe.steps.every((step) =>
      recipe.ingredients.some((item) => item.id === step.expectedIngredientId),
    ));
  }
});

test("every visible choice is used by the recipe and has a generated asset", () => {
  const publicRoot = fileURLToPath(new URL("../public", import.meta.url));

  for (const recipe of FOOD_AND_DRINK_RECIPES) {
    const expectedIds = new Set(recipe.steps.map((step) => step.expectedIngredientId));
    const visibleItems = recipe.ingredients;

    for (const item of visibleItems) {
      if (!item) continue;
      assert.ok(expectedIds.has(item.id), `${recipe.title} shows unused choice ${item.id}`);
      assert.ok(
        existsSync(`${publicRoot}${item.imagePath}`),
        `${recipe.title} is missing generated asset ${item.imagePath}`,
      );
    }
  }
});

test("lemonade teaches the intended ingredient order", () => {
  const lemonade = FOOD_AND_DRINK_RECIPES[0] as FoodDrinkRecipe;
  assert.deepEqual(
    lemonade.steps.map((step) => step.expectedIngredientId),
    ["lemon", "ice", "water", "sugar", "mint-leaf"],
  );
});

test("free cup choices are backed by generated assets", () => {
  const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
  assert.deepEqual(
    FOOD_AND_DRINK_CUP_OPTIONS.map((cup) => cup.size),
    ["small", "medium", "large", "tall", "mug"],
  );
  for (const cup of FOOD_AND_DRINK_CUP_OPTIONS) {
    assert.ok(existsSync(`${publicRoot}${cup.imagePath}`), `missing cup asset ${cup.imagePath}`);
  }
});

test("a correct ingredient advances one step and completes deterministically", () => {
  const recipe = FOOD_AND_DRINK_RECIPES[0] as FoodDrinkRecipe;
  let game = createFoodDrinkGame(recipe);

  for (const step of recipe.steps.slice(0, -1)) {
    game = foodDrinkReducer(game, { type: "selectIngredient", ingredientId: step.expectedIngredientId }, recipe);
    assert.equal(game.stepIndex, recipe.steps.indexOf(step) + 1);
    assert.equal(game.feedback, null);
  }

  game = foodDrinkReducer(game, { type: "skipOptionalStep" }, recipe);
  assert.equal(game.status, "completed");
  assert.equal(game.stepIndex, recipe.steps.length);
  assert.deepEqual(game.addedIngredientIds, ["lemon", "ice", "water", "sugar"]);
});

test("a wrong selection gives gentle feedback without losing progress", () => {
  const recipe = FOOD_AND_DRINK_RECIPES[1] as FoodDrinkRecipe;
  const initial = createFoodDrinkGame(recipe);
  const wrongId = recipe.ingredients.find((item) => item.id !== recipe.steps[0].expectedIngredientId)?.id ?? "ice";
  const afterWrong = foodDrinkReducer(initial, { type: "selectIngredient", ingredientId: wrongId }, recipe);

  assert.equal(afterWrong.status, "playing");
  assert.equal(afterWrong.stepIndex, 0);
  assert.deepEqual(afterWrong.feedback, { kind: "wrong", ingredientId: wrongId });
  assert.equal(foodDrinkReducer(afterWrong, { type: "dismissFeedback" }, recipe).feedback, null);
});

test("optional garnish can be skipped and restart returns to the first step", () => {
  const recipe = FOOD_AND_DRINK_RECIPES[2] as FoodDrinkRecipe;
  let game = createFoodDrinkGame(recipe);

  for (const step of recipe.steps.slice(0, -1)) {
    game = foodDrinkReducer(game, { type: "selectIngredient", ingredientId: step.expectedIngredientId }, recipe);
  }
  assert.equal(game.stepIndex, recipe.steps.length - 1);

  game = foodDrinkReducer(game, { type: "skipOptionalStep" }, recipe);
  assert.equal(game.status, "completed");
  assert.equal(foodDrinkReducer(game, { type: "restart" }, recipe).stepIndex, 0);
  assert.equal(foodDrinkReducer(game, { type: "restart" }, recipe).status, "playing");
});
