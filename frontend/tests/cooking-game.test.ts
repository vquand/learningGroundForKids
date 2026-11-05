import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GRILLED_PORK_RECIPE, SOUP_POT_RECIPE, STEAK_PAN_RECIPE } from "../src/features/cooking/cookingConfig.ts";
import { COOKING_MEALS, getCookingMeal } from "../src/features/cooking/cookingMeals.ts";
import { HEAT_LEVEL_PRESENTATION } from "../src/features/cooking/heatPresentation.ts";
import {
  cookingGameReducer,
  createCookingGame,
  getCookingSquareCounts,
  getOccupiedCells,
  isPhaseReady,
} from "../src/features/cooking/cookingGame.ts";

function startGrilling(overrides: Parameters<typeof createCookingGame>[1] = {}) {
  const selected = cookingGameReducer(createCookingGame(GRILLED_PORK_RECIPE, overrides), { type: "selectHeat", level: "medium" }, GRILLED_PORK_RECIPE);
  return cookingGameReducer(selected, { type: "confirmHeat" }, GRILLED_PORK_RECIPE);
}

test("choose heat before turning without cooking the pig early", () => {
  const game = createCookingGame(GRILLED_PORK_RECIPE);
  assert.equal(cookingGameReducer(game, { type: "rotate", turns: 11 }, GRILLED_PORK_RECIPE).rotationTurns, 0);
  const wrong = cookingGameReducer(game, { type: "selectHeat", level: "high" }, GRILLED_PORK_RECIPE);
  assert.equal(wrong.phaseIndex, 0); assert.equal(wrong.grillDoneness, "raw");
  const ready = cookingGameReducer(wrong, { type: "selectHeat", level: "medium" }, GRILLED_PORK_RECIPE);
  assert.equal(ready.phaseIndex, 0); assert.equal(ready.grillDoneness, "raw");
  assert.equal(ready.selectedHeat, "medium");
  assert.equal(cookingGameReducer(wrong, { type: "confirmHeat" }, GRILLED_PORK_RECIPE).phaseIndex, 0);
  assert.equal(cookingGameReducer(ready, { type: "confirmHeat" }, GRILLED_PORK_RECIPE).phaseIndex, 1);
});

test("the steak recipe describes a reusable pan station and five cooking phases", () => {
  assert.equal(STEAK_PAN_RECIPE.station.kind, "pan");
  assert.deepEqual(
    STEAK_PAN_RECIPE.phases.map((phase) => phase.kind),
    ["placement", "placement", "placement", "heat", "action"],
  );
  assert.deepEqual(
    STEAK_PAN_RECIPE.ingredients.map(({ id, width, height }) => ({ id, width, height })),
    [
      { id: "butter", width: 2, height: 1 },
      { id: "steak", width: 3, height: 4 },
      { id: "herbs", width: 2, height: 1 },
    ],
  );
});

test("the cooking menu lists playable pan and pot recipes before future cooking styles", () => {
  assert.equal(getCookingMeal("steak")?.recipeId, STEAK_PAN_RECIPE.id);
  assert.equal(COOKING_MEALS.find(({ id }) => id === "steak")?.availability, "available");
  assert.equal(getCookingMeal("potato-carrot-beef-soup")?.recipeId, SOUP_POT_RECIPE.id);
  assert.equal(COOKING_MEALS.find(({ id }) => id === "potato-carrot-beef-soup")?.availability, "available");
  assert.equal(getCookingMeal("grilled-steak")?.recipeId, GRILLED_PORK_RECIPE.id);
  assert.equal(COOKING_MEALS.find(({ id }) => id === "grilled-steak")?.availability, "available");
  assert.equal(getCookingMeal("cabbage-rolls")?.title, "Cabbage rolls with meat");
  assert.equal(getCookingMeal("cabbage-rolls")?.station, "Pot");
  assert.equal(getCookingMeal("cabbage-rolls")?.availability, "available");
  assert.equal(getCookingMeal("grilled-vegetables"), undefined);
});

test("every cooking ingredient and station uses a checked-in pastel sprite", () => {
  const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
  const paths = [
    STEAK_PAN_RECIPE.station.imagePath,
    STEAK_PAN_RECIPE.station.effectImagePath,
    STEAK_PAN_RECIPE.resultImagePath,
    ...STEAK_PAN_RECIPE.ingredients.map((ingredient) => ingredient.imagePath),
  ];

  for (const path of paths) {
    assert.ok(existsSync(`${publicRoot}${path}`), `missing cooking sprite ${path}`);
  }

  const soupPaths = [
    SOUP_POT_RECIPE.station.imagePath,
    SOUP_POT_RECIPE.resultImagePath,
    ...SOUP_POT_RECIPE.ingredients.map((ingredient) => ingredient.imagePath),
  ];
  for (const path of soupPaths) {
    assert.ok(existsSync(`${publicRoot}${path}`), `missing soup sprite ${path}`);
  }

  const grillPaths = [
    GRILLED_PORK_RECIPE.station.imagePath,
    GRILLED_PORK_RECIPE.station.effectImagePath,
    GRILLED_PORK_RECIPE.resultImagePath,
    ...GRILLED_PORK_RECIPE.ingredients.flatMap((ingredient) => [
      ingredient.imagePath,
      ...(ingredient.rotationImagePaths ?? []),
      ingredient.cookedImagePath,
      ingredient.burntImagePath,
    ]),
  ];
  for (const path of grillPaths) {
    if (path) assert.ok(existsSync(`${publicRoot}${path}`), `missing grill sprite ${path}`);
  }
});

test("grill uses counted turns, one glaze, then serving", () => {
  assert.deepEqual(GRILLED_PORK_RECIPE.phases.map((phase) => phase.kind), ["heat", "rotation", "seasoning", "action"]);
  for (let i = 0; i < 100; i++) {
    const game = startGrilling();
    assert.ok(game.rawRoundLimit >= 10 && game.rawRoundLimit <= 13);
    assert.ok(game.safeRoundLimit >= 20 && game.safeRoundLimit <= 24);
  }
});

test("grill boundaries count complete turns and burning requires restart", () => {
  for (const rawRoundLimit of [10, 13]) for (const safeRoundLimit of [20, 24]) {
    let game = startGrilling({ rawRoundLimit, safeRoundLimit });
    const step = (turns: number) => { game = cookingGameReducer(game, { type: "rotate", turns }, GRILLED_PORK_RECIPE); };
    step(rawRoundLimit + .875);
    assert.equal(game.grillDoneness, "raw");
    game = cookingGameReducer(game, { type: "lockRotation" }, GRILLED_PORK_RECIPE);
    assert.equal(game.phaseIndex, 1);
    step(.125);
    assert.equal(game.grillDoneness, "good");
    step(safeRoundLimit - rawRoundLimit - .125);
    assert.equal(game.grillDoneness, "good");
    step(.125);
    assert.equal(game.grillDoneness, "burnt");
    assert.equal(game.status, "failed");
    assert.equal(cookingGameReducer(game, { type: "lockRotation" }, GRILLED_PORK_RECIPE).phaseIndex, 1);
    assert.equal(cookingGameReducer(game, { type: "season", seasoningId: "honey" }, GRILLED_PORK_RECIPE).status, "failed");
    game = cookingGameReducer(game, { type: "restart" }, GRILLED_PORK_RECIPE);
    assert.equal(game.status, "playing"); assert.equal(game.rotationTurns, 0);
  }
});

test("either slow fractional turns or whole turns can finish with any glaze", () => {
  for (const seasoningId of ["honey", "sugar", "butter"]) {
    let game = startGrilling({ rawRoundLimit: 10, safeRoundLimit: 20 });
    for (let i = 0; i < 88; i++) game = cookingGameReducer(game, { type: "rotate", turns: .125 }, GRILLED_PORK_RECIPE);
    assert.equal(game.grillDoneness, "good");
    game = cookingGameReducer(game, { type: "lockRotation" }, GRILLED_PORK_RECIPE);
    assert.equal(game.phaseIndex, 2);
    assert.equal(cookingGameReducer(game, { type: "rotate", turns: 20 }, GRILLED_PORK_RECIPE).rotationTurns, 11);
    assert.equal(cookingGameReducer(game, { type: "season", seasoningId: "unknown" }, GRILLED_PORK_RECIPE).phaseIndex, 2);
    game = cookingGameReducer(game, { type: "season", seasoningId }, GRILLED_PORK_RECIPE);
    assert.equal(game.phaseIndex, 2);
    game = cookingGameReducer(game, { type: "confirmSeasoning" }, GRILLED_PORK_RECIPE);
    assert.equal(game.phaseIndex, 3);
    game = cookingGameReducer(game, { type: "flip" }, GRILLED_PORK_RECIPE);
    assert.equal(game.status, "completed");
  }
});

test("invalid turn inputs do not corrupt grilling progress", () => {
  const game = startGrilling();
  for (const turns of [NaN, Infinity, -1, 0]) assert.deepEqual(cookingGameReducer(game, { type: "rotate", turns }, GRILLED_PORK_RECIPE), game);
});

test("the soup recipe uses 2x2 beef pieces and separate food layers", () => {
  assert.equal(SOUP_POT_RECIPE.station.kind, "pot");
  assert.equal(SOUP_POT_RECIPE.station.rows, 11);
  assert.equal(SOUP_POT_RECIPE.station.columns, 11);
  assert.deepEqual(
    SOUP_POT_RECIPE.phases.map((phase) => phase.kind),
    ["placement", "placement", "heat", "action"],
  );
  const beef = SOUP_POT_RECIPE.ingredients.find(({ id }) => id === "beef");
  const potato = SOUP_POT_RECIPE.ingredients.find(({ id }) => id === "potato");
  const vegetablePhase = SOUP_POT_RECIPE.phases[1];
  assert.equal(beef?.renderMode, "image");
  assert.deepEqual(beef?.shapes, [
    { id: "beef-square", width: 2, height: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  ]);
  assert.equal(beef?.layer, "food");
  assert.equal(potato?.layer, "topping");
  assert.deepEqual(vegetablePhase?.kind === "placement" ? vegetablePhase.additionalIngredientIds : [], ["carrot"]);
});

test("soup beef pieces stay 2x2 and vegetables may cover the beef layer", () => {
  let game = createCookingGame(SOUP_POT_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "beef", x: 2, y: 2 }, SOUP_POT_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "beef", x: 2, y: 5 }, SOUP_POT_RECIPE);
  assert.equal(game.pieces.length, 2);
  assert.equal(game.pieces[0]?.shapeId, "beef-square");
  assert.equal(game.pieces[1]?.shapeId, "beef-square");
  assert.equal(getCookingSquareCounts(game).get("beef"), 8);

  game = cookingGameReducer(game, { type: "advance" }, SOUP_POT_RECIPE);
  const topped = cookingGameReducer(
    game,
    { type: "place", ingredientId: "potato", x: 2, y: 2 },
    SOUP_POT_RECIPE,
  );
  assert.equal(topped.pieces.length, 3);
  assert.equal(topped.feedback, null);
  assert.equal(getOccupiedCells(topped, "food").size, 8);
  assert.equal(getCookingSquareCounts(topped).get("potato"), 2);
  assert.equal(getOccupiedCells(topped, "topping").size, 2);
});

test("placement pieces can move without changing their shape or layer", () => {
  let game = createCookingGame(SOUP_POT_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "beef", x: 2, y: 2 }, SOUP_POT_RECIPE);
  game = cookingGameReducer(game, { type: "move", pieceId: "piece-1", x: 5, y: 4 }, SOUP_POT_RECIPE);
  assert.deepEqual(game.pieces[0], {
    id: "piece-1",
    ingredientId: "beef",
    layer: "food",
    x: 5,
    y: 4,
    width: 2,
    height: 2,
    shapeId: "beef-square",
    cells: ["5:4", "6:4", "5:5", "6:5"],
  });

  game = cookingGameReducer(game, { type: "place", ingredientId: "beef", x: 2, y: 2 }, SOUP_POT_RECIPE);
  const blocked = cookingGameReducer(game, { type: "move", pieceId: "piece-1", x: 2, y: 2 }, SOUP_POT_RECIPE);
  assert.deepEqual(blocked.pieces[0]?.cells, ["5:4", "6:4", "5:5", "6:5"]);
  assert.deepEqual(blocked.feedback, { kind: "blocked" });
});

test("the steak flip targets the steak and reveals its cooked-side sprite", () => {
  const steak = STEAK_PAN_RECIPE.ingredients.find(({ id }) => id === "steak");
  const flipPhase = STEAK_PAN_RECIPE.phases.find(({ id }) => id === "flip-steak");

  assert.equal(steak?.cookedImagePath, STEAK_PAN_RECIPE.resultImagePath);
  assert.equal(flipPhase?.kind, "action");
  if (flipPhase?.kind === "action") assert.equal(flipPhase.targetIngredientId, "steak");
});

test("butter must cover four cells, then melts into a non-blocking condition layer", () => {
  let game = createCookingGame(STEAK_PAN_RECIPE);

  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 3 }, STEAK_PAN_RECIPE);
  assert.equal(isPhaseReady(game, STEAK_PAN_RECIPE), false);
  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 4 }, STEAK_PAN_RECIPE);
  assert.equal(isPhaseReady(game, STEAK_PAN_RECIPE), true);
  assert.equal(getOccupiedCells(game).size, 4);

  game = cookingGameReducer(game, { type: "advance" }, STEAK_PAN_RECIPE);

  assert.equal(game.phaseIndex, 1);
  assert.equal(game.pieces.length, 0);
  assert.equal(getOccupiedCells(game).size, 0);
  assert.equal(getCookingSquareCounts(game).get("melted-butter"), 4);
  assert.deepEqual([...game.effects[0]!.cells].sort(), ["2:3", "2:4", "3:3", "3:4"]);
});

test("pieces cannot overlap on the same layer or leave the usable pan cells", () => {
  let game = createCookingGame(STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 3 }, STEAK_PAN_RECIPE);

  const overlapping = cookingGameReducer(
    game,
    { type: "place", ingredientId: "butter", x: 3, y: 3 },
    STEAK_PAN_RECIPE,
  );
  assert.equal(overlapping.pieces.length, 1);
  assert.equal(overlapping.feedback?.kind, "blocked");

  const outsidePan = cookingGameReducer(
    game,
    { type: "place", ingredientId: "butter", x: 0, y: 0 },
    STEAK_PAN_RECIPE,
  );
  assert.equal(outsidePan.pieces.length, 1);
  assert.equal(outsidePan.feedback?.kind, "outside");
});

test("the steak needs at least four cells over melted butter", () => {
  let game = createCookingGame(STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 3 }, STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 4 }, STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "advance" }, STEAK_PAN_RECIPE);

  const missesButter = cookingGameReducer(
    game,
    { type: "place", ingredientId: "steak", x: 4, y: 2 },
    STEAK_PAN_RECIPE,
  );
  assert.equal(missesButter.pieces.length, 0);
  assert.equal(missesButter.feedback?.kind, "needs-effect-overlap");

  game = cookingGameReducer(game, { type: "place", ingredientId: "steak", x: 1, y: 2 }, STEAK_PAN_RECIPE);
  assert.equal(game.pieces.length, 1);
  assert.equal(isPhaseReady(game, STEAK_PAN_RECIPE), true);
  game = cookingGameReducer(game, { type: "advance" }, STEAK_PAN_RECIPE);
  assert.equal(game.phaseIndex, 2);
});

test("herbs stack on the steak before the heat-control phase", () => {
  let game = createCookingGame(STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 3 }, STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "butter", x: 2, y: 4 }, STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "advance" }, STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "place", ingredientId: "steak", x: 1, y: 2 }, STEAK_PAN_RECIPE);
  game = cookingGameReducer(game, { type: "advance" }, STEAK_PAN_RECIPE);

  const besideSteak = cookingGameReducer(
    game,
    { type: "place", ingredientId: "herbs", x: 4, y: 2 },
    STEAK_PAN_RECIPE,
  );
  assert.equal(besideSteak.feedback?.kind, "needs-ingredient-overlap");

  game = cookingGameReducer(game, { type: "place", ingredientId: "herbs", x: 1, y: 2 }, STEAK_PAN_RECIPE);
  assert.equal(isPhaseReady(game, STEAK_PAN_RECIPE), true);
  game = cookingGameReducer(game, { type: "advance" }, STEAK_PAN_RECIPE);
  assert.equal(game.phaseIndex, 3);
});

test("the configured heat choice advances deterministically, then flipping completes the steak", () => {
  let game = createCookingGame(STEAK_PAN_RECIPE, { phaseIndex: 3 });

  game = cookingGameReducer(game, { type: "selectHeat", level: "low" }, STEAK_PAN_RECIPE);
  assert.equal(game.phaseIndex, 3);
  assert.equal(game.feedback?.kind, "wrong-heat");

  game = cookingGameReducer(game, { type: "selectHeat", level: "high" }, STEAK_PAN_RECIPE);
  assert.equal(game.phaseIndex, 4);
  assert.equal(game.feedback, null);

  game = cookingGameReducer(game, { type: "flip" }, STEAK_PAN_RECIPE);
  assert.equal(game.status, "completed");
  assert.equal(game.phaseIndex, STEAK_PAN_RECIPE.phases.length);

  game = cookingGameReducer(game, { type: "restart" }, STEAK_PAN_RECIPE);
  assert.equal(game.status, "playing");
  assert.equal(game.phaseIndex, 0);
  assert.equal(game.pieces.length, 0);
  assert.equal(game.effects.length, 0);
});

test("heat choices use unique colors and progressively larger flames", () => {
  assert.deepEqual(
    HEAT_LEVEL_PRESENTATION.map(({ level }) => level),
    ["low", "medium", "high", "extreme"],
  );
  assert.equal(new Set(HEAT_LEVEL_PRESENTATION.map(({ colorToken }) => colorToken)).size, 4);

  const sizes = HEAT_LEVEL_PRESENTATION.map(({ flameSize }) => flameSize);
  assert.ok(sizes.every((size, index) => index === 0 || size > sizes[index - 1]!));
});

test("releasing after counted turns preserves readiness", () => {
  let game = startGrilling({ rawRoundLimit: 10, safeRoundLimit: 20 });
  game = cookingGameReducer(game, { type: "rotate", turns: 11 }, GRILLED_PORK_RECIPE);
  assert.equal(isPhaseReady(game, GRILLED_PORK_RECIPE), true);
  game = cookingGameReducer(game, { type: "rotate", turns: 0 }, GRILLED_PORK_RECIPE);
  assert.equal(isPhaseReady(game, GRILLED_PORK_RECIPE), true);
  game = cookingGameReducer(game, { type: "restart" }, GRILLED_PORK_RECIPE);
  assert.equal(isPhaseReady(game, GRILLED_PORK_RECIPE), false);
});
