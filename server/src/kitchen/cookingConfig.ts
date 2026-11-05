export type CookingStationKind = "pan" | "pot" | "grill";
export type CookingPieceLayer = "food" | "topping";
export type CookingHeatLevel = "low" | "medium" | "high" | "extreme";

export interface CookingStation {
  kind: CookingStationKind;
  columns: number;
  rows: number;
  excludedCells: readonly string[];
  imagePath: string;
  effectImagePath: string;
}

export interface CookingIngredient {
  id: string;
  label: string;
  width: number;
  height: number;
  layer: CookingPieceLayer;
  imagePath: string;
  rotationImagePaths?: readonly string[];
  cookedImagePath?: string;
  burntImagePath?: string;
  renderMode?: "image" | "tiles";
  shapes?: readonly CookingShape[];
}

export interface CookingShape {
  id: string;
  width: number;
  height: number;
  cells: readonly (readonly [number, number])[];
}

interface CookingPhaseBase {
  id: string;
  title: string;
  instruction: string;
}

export interface PlacementConstraint {
  kind: "effect" | "ingredient";
  targetId: string;
  minOverlap: number;
}

export interface CookingPlacementPhase extends CookingPhaseBase {
  kind: "placement";
  ingredientId: string;
  additionalIngredientIds?: readonly string[];
  minCells: number;
  constraint?: PlacementConstraint;
  transformToEffectId?: string;
  actionLabel: string;
}

export interface CookingRotationPhase extends CookingPhaseBase {
  kind: "rotation";
  rawRoundRange: readonly [number, number];
  safeRoundRange: readonly [number, number];
  actionLabel: string;
}

export interface CookingSeasoningOption {
  id: string;
  label: string;
  icon: string;
}

export interface CookingSeasoningPhase extends CookingPhaseBase {
  kind: "seasoning";
  seasoningOptions: readonly CookingSeasoningOption[];
  requiredSeasoningIds: readonly string[];
}

export interface CookingHeatPhase extends CookingPhaseBase {
  kind: "heat";
  targetLevel: CookingHeatLevel;
}

export interface CookingActionPhase extends CookingPhaseBase {
  kind: "action";
  actionId: "flip-steak" | "finish-soup" | "finish-grill";
  targetIngredientId?: string;
  actionLabel: string;
}

export type CookingPhase = CookingPlacementPhase | CookingRotationPhase | CookingSeasoningPhase | CookingHeatPhase | CookingActionPhase;

export interface CookingRecipe {
  id: string;
  title: string;
  description: string;
  station: CookingStation;
  ingredients: readonly CookingIngredient[];
  phases: readonly CookingPhase[];
  resultImagePath: string;
  resultTitle?: string;
  resultDescription?: string;
}

const PAN_EXCLUDED_CELLS = [
  "0:0", "1:0", "6:0", "7:0",
  "0:1", "7:1",
  "0:6", "7:6",
  "0:7", "1:7", "6:7", "7:7",
] as const;

export const STEAK_PAN_RECIPE: CookingRecipe = {
  id: "pan-seared-steak",
  title: "Butter-basted steak",
  description: "Fit, sizzle, season, and flip a cozy little steak.",
  station: {
    kind: "pan",
    columns: 8,
    rows: 8,
    excludedCells: PAN_EXCLUDED_CELLS,
    imagePath: "/minigames/cooking/steak/pastel-pan.png",
    effectImagePath: "/minigames/cooking/steak/melted-butter.png",
  },
  ingredients: [
    {
      id: "butter",
      label: "Butter",
      width: 2,
      height: 1,
      layer: "food",
      imagePath: "/minigames/cooking/steak/butter.png",
    },
    {
      id: "steak",
      label: "Steak",
      width: 3,
      height: 4,
      layer: "food",
      imagePath: "/minigames/cooking/steak/raw-steak.png",
      cookedImagePath: "/minigames/cooking/steak/cooked-steak.png",
    },
    {
      id: "herbs",
      label: "Herbs",
      width: 2,
      height: 1,
      layer: "topping",
      imagePath: "/minigames/cooking/steak/herbs.png",
    },
  ],
  phases: [
    {
      id: "melt-butter",
      kind: "placement",
      title: "Butter the pan",
      instruction: "Cover at least 4 pan squares with butter.",
      ingredientId: "butter",
      minCells: 4,
      transformToEffectId: "melted-butter",
      actionLabel: "Melt butter",
    },
    {
      id: "place-steak",
      kind: "placement",
      title: "Lay in the steak",
      instruction: "Place the steak with at least 4 squares over melted butter.",
      ingredientId: "steak",
      minCells: 12,
      constraint: { kind: "effect", targetId: "melted-butter", minOverlap: 4 },
      actionLabel: "Start searing",
    },
    {
      id: "season-steak",
      kind: "placement",
      title: "Add the herbs",
      instruction: "Place the herb bundle across 2 steak squares.",
      ingredientId: "herbs",
      minCells: 2,
      constraint: { kind: "ingredient", targetId: "steak", minOverlap: 2 },
      actionLabel: "Baste the steak",
    },
    {
      id: "control-heat",
      kind: "heat",
      title: "Choose the heat",
      instruction: "Pick the heat that gives steak a quick sear without scorching it.",
      targetLevel: "high",
    },
    {
      id: "flip-steak",
      kind: "action",
      title: "Flip the steak",
      instruction: "Tap the steak to select it, then flip it to reveal the golden sear.",
      actionId: "flip-steak",
      targetIngredientId: "steak",
      actionLabel: "Flip steak",
    },
  ],
  resultImagePath: "/minigames/cooking/steak/cooked-steak.png",
  resultTitle: "Golden, cozy, and ready!",
  resultDescription: "You layered the butter, steak, and herbs, found the gentle heat, and flipped it at the right time.",
};

const SOUP_ROW_WIDTHS = [5, 7, 9, 11, 11, 11, 11, 11, 9, 7, 5] as const;
const SOUP_EXCLUDED_CELLS = SOUP_ROW_WIDTHS.flatMap((width, row) => {
  const start = (11 - width) / 2;
  return Array.from({ length: 11 }, (_, column) => (
    column < start || column >= start + width ? `${column}:${row}` : null
  )).filter((cell): cell is string => cell !== null);
});

const BEEF_SHAPES: readonly CookingShape[] = [
  { id: "beef-square", width: 2, height: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
];

const VEGETABLE_SHAPES: readonly CookingShape[] = [
  { id: "vegetable-domino", width: 2, height: 1, cells: [[0, 0], [1, 0]] },
  { id: "vegetable-corner", width: 2, height: 2, cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "vegetable-trio", width: 3, height: 1, cells: [[0, 0], [1, 0], [2, 0]] },
];

export const SOUP_POT_RECIPE: CookingRecipe = {
  id: "potato-carrot-beef-soup",
  title: "Potato, carrot & beef soup",
  description: "Pack a generous pot with beef, potatoes, and carrots before bringing it to a gentle simmer.",
  station: {
    kind: "pot",
    columns: 11,
    rows: 11,
    excludedCells: SOUP_EXCLUDED_CELLS,
    imagePath: "/minigames/cooking/soup/pastel-pot.png",
    effectImagePath: "/minigames/cooking/soup/potato-carrot-beef-soup.png",
  },
  ingredients: [
    {
      id: "beef",
      label: "Beef",
      width: 2,
      height: 2,
      layer: "food",
      imagePath: "/minigames/cooking/soup/beef-tile.png",
      renderMode: "image",
      shapes: BEEF_SHAPES,
    },
    {
      id: "potato",
      label: "Potato",
      width: 2,
      height: 2,
      layer: "topping",
      imagePath: "/minigames/cooking/soup/potato-tile.png",
      renderMode: "tiles",
      shapes: VEGETABLE_SHAPES,
    },
    {
      id: "carrot",
      label: "Carrot",
      width: 2,
      height: 2,
      layer: "topping",
      imagePath: "/minigames/cooking/soup/carrot-tile.png",
      renderMode: "tiles",
      shapes: VEGETABLE_SHAPES,
    },
  ],
  phases: [
    {
      id: "pack-beef",
      kind: "placement",
      title: "Fit the beef",
      instruction: "Pack as much beef as you can into the bottom layer of the pot.",
      ingredientId: "beef",
      minCells: 8,
      actionLabel: "Add potatoes & carrots",
    },
    {
      id: "pack-vegetables",
      kind: "placement",
      title: "Fit the potatoes & carrots",
      instruction: "Add vegetables on the top layer. They may sit over the beef, but not over one another.",
      ingredientId: "potato",
      additionalIngredientIds: ["carrot"],
      minCells: 10,
      actionLabel: "Bring to a simmer",
    },
    {
      id: "simmer-soup",
      kind: "heat",
      title: "Choose a gentle simmer",
      instruction: "Low heat keeps the broth calm while the vegetables soften.",
      targetLevel: "low",
    },
    {
      id: "serve-soup",
      kind: "action",
      title: "Serve the soup",
      instruction: "Give the pot one last stir, then serve the cozy bowl.",
      actionId: "finish-soup",
      actionLabel: "Serve soup",
    },
  ],
  resultImagePath: "/minigames/cooking/soup/potato-carrot-beef-soup.png",
  resultTitle: "A warm bowl for a cozy day!",
  resultDescription: "You packed beef into the bottom layer, nestled vegetables above it, and kept the simmer gentle.",
};

export const GRILLED_PORK_RECIPE: CookingRecipe = {
  id: "grilled-steak",
  title: "Forest rotisserie pork",
  description: "Turn the handle, stop when golden, then choose a yummy glaze.",
  station: {
    kind: "grill",
    columns: 1,
    rows: 1,
    excludedCells: [],
    imagePath: "/minigames/cooking/grill/forest-rotisserie.png",
    effectImagePath: "/minigames/cooking/grill/forest-rotisserie.png",
  },
  ingredients: [
    {
      id: "grill-pork",
      label: "Pork roast",
      width: 1,
      height: 1,
      layer: "food",
      imagePath: "/minigames/cooking/grill/raw-pork-v2.png",
      cookedImagePath: "/minigames/cooking/grill/good-pork-v2.png",
      burntImagePath: "/minigames/cooking/grill/burnt-pork-v2.png",
    },
  ],
  phases: [
    {
      id: "grill-heat",
      kind: "heat",
      title: "Warm up the grill",
      instruction: "Choose a flame, then tap Heat OK when the grill is ready. Medium heat is just right.",
      targetLevel: "medium",
    },
    {
      id: "turn-spit",
      kind: "rotation",
      title: "Turn the spit",
      instruction: "Turn at your own pace. Watch the pig and stop when it looks golden.",
      rawRoundRange: [10, 13],
      safeRoundRange: [20, 24],
      actionLabel: "Done grilling",
    },
    {
      id: "season-roast",
      kind: "seasoning",
      title: "Season the pork",
      instruction: "Choose honey, melted sugar, or butter for your roast.",
      seasoningOptions: [
        { id: "honey", label: "Honey", icon: "🍯" },
        { id: "sugar", label: "Melted sugar", icon: "🍬" },
        { id: "butter", label: "Butter", icon: "🧈" },
      ],
      requiredSeasoningIds: [],
    },
    {
      id: "serve-grill",
      kind: "action",
      title: "Serve the pork",
      instruction: "The crust is golden. Lift the pork from the spit and serve it warm.",
      actionId: "finish-grill",
      actionLabel: "Serve pork",
    },
  ],
  resultImagePath: "/minigames/cooking/grill/served-pork.png",
  resultTitle: "Golden from every side!",
  resultDescription: "You turned the roast golden and added your favourite glaze. Time to share!",
};

export const COOKING_RECIPES: readonly CookingRecipe[] = [STEAK_PAN_RECIPE, SOUP_POT_RECIPE, GRILLED_PORK_RECIPE];

export function getCookingIngredient(recipe: CookingRecipe, ingredientId: string) {
  return recipe.ingredients.find((ingredient) => ingredient.id === ingredientId);
}

export function getPlacementIngredientIds(phase: CookingPlacementPhase): string[] {
  return [phase.ingredientId, ...(phase.additionalIngredientIds ?? [])];
}

export function getCookingRecipe(recipeId: string) {
  return COOKING_RECIPES.find((recipe) => recipe.id === recipeId)
    ?? (recipeId === "steak" ? STEAK_PAN_RECIPE : undefined);
}
