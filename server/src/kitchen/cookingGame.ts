import {
  getCookingIngredient,
  getPlacementIngredientIds,
  type CookingHeatLevel,
  type CookingPieceLayer,
  type CookingPlacementPhase,
  type CookingRecipe,
  type CookingSeasoningPhase,
  type CookingShape,
} from "./cookingConfig.ts";

export interface CookingPiece {
  id: string;
  ingredientId: string;
  layer: CookingPieceLayer;
  x: number;
  y: number;
  width: number;
  height: number;
  shapeId: string;
  cells: readonly string[];
}

export interface CookingEffect {
  id: string;
  cells: readonly string[];
}

export type CookingFeedbackKind =
  | "wrong-ingredient"
  | "outside"
  | "blocked"
  | "needs-effect-overlap"
  | "needs-ingredient-overlap"
  | "not-ready"
  | "wrong-heat"
  | "wrong-rotation"
  | "seasoning-missing";

export interface CookingFeedback {
  kind: CookingFeedbackKind;
}

export interface CookingGameState {
  recipeId: string;
  phaseIndex: number;
  status: "playing" | "completed" | "failed";
  pieces: readonly CookingPiece[];
  effects: readonly CookingEffect[];
  feedback: CookingFeedback | null;
  nextPieceId: number;
  selectedHeat: CookingHeatLevel | null;
  rotationTurns: number;
  rawRoundLimit: number;
  safeRoundLimit: number;
  seasoningIds: readonly string[];
  grillDoneness: "raw" | "good" | "burnt";
}

export type CookingGameAction =
  | { type: "place"; ingredientId: string; x: number; y: number }
  | { type: "move"; pieceId: string; x: number; y: number }
  | { type: "remove"; pieceId: string }
  | { type: "advance" }
  | { type: "rotate"; turns: number }
  | { type: "lockRotation" }
  | { type: "season"; seasoningId: string }
  | { type: "confirmSeasoning" }
  | { type: "selectHeat"; level: CookingHeatLevel }
  | { type: "confirmHeat" }
  | { type: "flip" }
  | { type: "dismissFeedback" }
  | { type: "restart" };

function cellsFor(x: number, y: number, shape: CookingShape): string[] {
  return shape.cells.map(([column, row]) => `${x + column}:${y + row}`);
}

function shapeForIngredient(ingredient: ReturnType<typeof getCookingIngredient>, pieceId: number): CookingShape | undefined {
  if (!ingredient) return undefined;
  if (ingredient.shapes?.length) return ingredient.shapes[pieceId % ingredient.shapes.length];
  return {
    id: "rectangle",
    width: ingredient.width,
    height: ingredient.height,
    cells: Array.from({ length: ingredient.width * ingredient.height }, (_, index) => [
      index % ingredient.width,
      Math.floor(index / ingredient.width),
    ] as const),
  };
}

function overlapCount(left: readonly string[], right: ReadonlySet<string>): number {
  return left.reduce((total, cell) => total + (right.has(cell) ? 1 : 0), 0);
}

function placementFeedback(
  state: CookingGameState,
  phase: CookingPlacementPhase,
  ingredient: NonNullable<ReturnType<typeof getCookingIngredient>>,
  cells: readonly string[],
  recipe: CookingRecipe,
  ignoredPieceId?: string,
): CookingFeedbackKind | null {
  const excludedCells = new Set(recipe.station.excludedCells);
  const outside = cells.some((cell) => excludedCells.has(cell));
  if (outside) return "outside";

  const occupiedOnLayer = getOccupiedCells(state, ingredient.layer);
  if (ignoredPieceId) {
    const ignoredPiece = state.pieces.find((piece) => piece.id === ignoredPieceId);
    ignoredPiece?.cells.forEach((cell) => occupiedOnLayer.delete(cell));
  }
  if (cells.some((cell) => occupiedOnLayer.has(cell))) return "blocked";

  if (phase.constraint?.kind === "effect") {
    const effectCells = new Set(
      state.effects
        .filter((effect) => effect.id === phase.constraint?.targetId)
        .flatMap((effect) => effect.cells),
    );
    if (overlapCount(cells, effectCells) < phase.constraint.minOverlap) return "needs-effect-overlap";
  }

  if (phase.constraint?.kind === "ingredient") {
    const ingredientCells = new Set(
      state.pieces
        .filter((piece) => piece.ingredientId === phase.constraint?.targetId && piece.id !== ignoredPieceId)
        .flatMap((piece) => piece.cells),
    );
    if (overlapCount(cells, ingredientCells) < phase.constraint.minOverlap) return "needs-ingredient-overlap";
  }

  return null;
}

export function getOccupiedCells(state: CookingGameState, layer?: CookingPieceLayer): Set<string> {
  return new Set(
    state.pieces
      .filter((piece) => !layer || piece.layer === layer)
      .flatMap((piece) => piece.cells),
  );
}

export function getCookingSquareCounts(state: CookingGameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const piece of state.pieces) {
    counts.set(piece.ingredientId, (counts.get(piece.ingredientId) ?? 0) + piece.cells.length);
  }
  for (const effect of state.effects) {
    counts.set(effect.id, (counts.get(effect.id) ?? 0) + effect.cells.length);
  }
  return counts;
}

export function createCookingGame(
  recipe: CookingRecipe,
  overrides: Partial<CookingGameState> = {},
): CookingGameState {
  const rotation = recipe.phases.find((phase) => phase.kind === "rotation");
  const sample = ([min, max]: readonly [number, number]) => min + Math.floor(Math.random() * (max - min + 1));
  return {
    recipeId: recipe.id,
    phaseIndex: 0,
    status: "playing",
    pieces: [],
    effects: [],
    feedback: null,
    nextPieceId: 1,
    selectedHeat: null,
    rotationTurns: 0,
    rawRoundLimit: rotation ? sample(rotation.rawRoundRange) : 10,
    safeRoundLimit: rotation ? sample(rotation.safeRoundRange) : 20,
    seasoningIds: [],
    grillDoneness: "raw",
    ...overrides,
  };
}

function isPlacementReady(state: CookingGameState, phase: CookingPlacementPhase): boolean {
  const ingredientIds = new Set(getPlacementIngredientIds(phase));
  const coveredCells = state.pieces
    .filter((piece) => ingredientIds.has(piece.ingredientId))
    .reduce((total, piece) => total + piece.cells.length, 0);
  return coveredCells >= phase.minCells;
}

export function isPhaseReady(state: CookingGameState, recipe: CookingRecipe): boolean {
  const phase = recipe.phases[state.phaseIndex];
  if (!phase) return false;
  if (phase.kind === "placement") return isPlacementReady(state, phase);
  if (phase.kind === "rotation") return state.status === "playing" && state.grillDoneness === "good";
  if (phase.kind === "seasoning") return state.seasoningIds.length > 0 && phase.requiredSeasoningIds.every((id) => state.seasoningIds.includes(id));
  return phase.kind === "action";
}

function advanceRotation(state: CookingGameState): CookingGameState {
  if (state.grillDoneness !== "good") return { ...state, feedback: { kind: "wrong-rotation" } };
  return { ...state, phaseIndex: state.phaseIndex + 1, feedback: null };
}

function applySeasoning(
  state: CookingGameState,
  phase: CookingSeasoningPhase,
  seasoningId: string,
  autoAdvance = true,
): CookingGameState {
  const valid = phase.seasoningOptions.some((option) => option.id === seasoningId);
  if (!valid) return { ...state, feedback: { kind: "seasoning-missing" } };
  if (state.seasoningIds.includes(seasoningId)) return state;

  const seasoningIds = autoAdvance ? [...state.seasoningIds, seasoningId] : [seasoningId];
  const complete = phase.requiredSeasoningIds.every((id) => seasoningIds.includes(id));
  return {
    ...state,
    seasoningIds,
    phaseIndex: autoAdvance && complete ? state.phaseIndex + 1 : state.phaseIndex,
    feedback: null,
  };
}

function placePiece(
  state: CookingGameState,
  action: Extract<CookingGameAction, { type: "place" }>,
  recipe: CookingRecipe,
): CookingGameState {
  const phase = recipe.phases[state.phaseIndex];
  const ingredient = getCookingIngredient(recipe, action.ingredientId);
  const allowedIngredientIds = phase?.kind === "placement" ? getPlacementIngredientIds(phase) : [];
  if (phase?.kind !== "placement" || !allowedIngredientIds.includes(action.ingredientId) || !ingredient) {
    return { ...state, feedback: { kind: "wrong-ingredient" } };
  }

  const shape = shapeForIngredient(ingredient, state.nextPieceId);
  if (!shape) return { ...state, feedback: { kind: "wrong-ingredient" } };
  const cells = cellsFor(action.x, action.y, shape);
  const outside = action.x < 0
    || action.y < 0
    || action.x + shape.width > recipe.station.columns
    || action.y + shape.height > recipe.station.rows
    || cells.some((cell) => cell.split(":").some((coordinate) => Number(coordinate) < 0));
  if (outside) return { ...state, feedback: { kind: "outside" } };
  const feedback = placementFeedback(state, phase, ingredient, cells, recipe);
  if (feedback) return { ...state, feedback: { kind: feedback } };

  const piece: CookingPiece = {
    id: `piece-${state.nextPieceId}`,
    ingredientId: ingredient.id,
    layer: ingredient.layer,
    x: action.x,
    y: action.y,
    width: shape.width,
    height: shape.height,
    shapeId: shape.id,
    cells,
  };
  return {
    ...state,
    pieces: [...state.pieces, piece],
    feedback: null,
    nextPieceId: state.nextPieceId + 1,
  };
}

function movePiece(
  state: CookingGameState,
  action: Extract<CookingGameAction, { type: "move" }>,
  recipe: CookingRecipe,
): CookingGameState {
  const phase = recipe.phases[state.phaseIndex];
  const piece = state.pieces.find((candidate) => candidate.id === action.pieceId);
  const ingredient = piece ? getCookingIngredient(recipe, piece.ingredientId) : undefined;
  const allowedIngredientIds = phase?.kind === "placement" ? getPlacementIngredientIds(phase) : [];
  if (phase?.kind !== "placement" || !piece || !ingredient || !allowedIngredientIds.includes(piece.ingredientId)) {
    return { ...state, feedback: { kind: "wrong-ingredient" } };
  }

  const shape = ingredient.shapes?.find((candidate) => candidate.id === piece.shapeId) ?? {
    id: piece.shapeId,
    width: piece.width,
    height: piece.height,
    cells: Array.from({ length: piece.width * piece.height }, (_, index) => [
      index % piece.width,
      Math.floor(index / piece.width),
    ] as const),
  };
  const cells = cellsFor(action.x, action.y, shape);
  const outside = action.x < 0
    || action.y < 0
    || action.x + shape.width > recipe.station.columns
    || action.y + shape.height > recipe.station.rows;
  if (outside) return { ...state, feedback: { kind: "outside" } };
  const feedback = placementFeedback(state, phase, ingredient, cells, recipe, piece.id);
  if (feedback) return { ...state, feedback: { kind: feedback } };

  return {
    ...state,
    pieces: state.pieces.map((candidate) => candidate.id === piece.id
      ? { ...candidate, x: action.x, y: action.y, cells }
      : candidate),
    feedback: null,
  };
}

function advancePlacement(
  state: CookingGameState,
  phase: CookingPlacementPhase,
): CookingGameState {
  if (!isPlacementReady(state, phase)) return { ...state, feedback: { kind: "not-ready" } };

  if (!phase.transformToEffectId) {
    return { ...state, phaseIndex: state.phaseIndex + 1, feedback: null };
  }

  const transformedPieces = state.pieces.filter((piece) => piece.ingredientId === phase.ingredientId);
  const effectCells = [...new Set(transformedPieces.flatMap((piece) => piece.cells))];
  return {
    ...state,
    phaseIndex: state.phaseIndex + 1,
    pieces: state.pieces.filter((piece) => piece.ingredientId !== phase.ingredientId),
    effects: [...state.effects, { id: phase.transformToEffectId, cells: effectCells }],
    feedback: null,
  };
}

export function cookingGameReducer(
  state: CookingGameState,
  action: CookingGameAction,
  recipe: CookingRecipe,
): CookingGameState {
  if (action.type === "restart") return createCookingGame(recipe);
  if (action.type === "dismissFeedback") return { ...state, feedback: null };
  if (state.status !== "playing") return state;

  if (action.type === "place") return placePiece(state, action, recipe);
  if (action.type === "move") return movePiece(state, action, recipe);
  if (action.type === "remove") {
    return { ...state, pieces: state.pieces.filter((piece) => piece.id !== action.pieceId), feedback: null };
  }

  const phase = recipe.phases[state.phaseIndex];
  if (!phase) return state;

  if (action.type === "advance") {
    if (phase.kind !== "placement") return { ...state, feedback: { kind: "not-ready" } };
    return advancePlacement(state, phase);
  }

  if (action.type === "rotate") {
    if (phase.kind !== "rotation" || !Number.isFinite(action.turns) || action.turns <= 0) return state;
    const rotationTurns = state.rotationTurns + action.turns;
    const rounds = Math.floor(rotationTurns + 1e-8);
    const grillDoneness = rounds > state.safeRoundLimit ? "burnt" : rounds > state.rawRoundLimit ? "good" : "raw";
    return { ...state, rotationTurns, grillDoneness, status: grillDoneness === "burnt" ? "failed" : "playing", feedback: null };
  }

  if (action.type === "lockRotation") {
    if (phase.kind !== "rotation") return state;
    return advanceRotation(state);
  }

  if (action.type === "season") {
    if (phase.kind !== "seasoning") return state;
    return applySeasoning(state, phase, action.seasoningId, recipe.station.kind !== "grill");
  }

  if (action.type === "confirmSeasoning") {
    if (phase.kind !== "seasoning" || recipe.station.kind !== "grill") return state;
    if (!isPhaseReady(state, recipe)) return { ...state, feedback: { kind: "seasoning-missing" } };
    return { ...state, phaseIndex: state.phaseIndex + 1, feedback: null };
  }

  if (action.type === "confirmHeat") {
    if (phase.kind !== "heat" || recipe.station.kind !== "grill") return state;
    if (state.selectedHeat !== phase.targetLevel) return { ...state, feedback: { kind: "wrong-heat" } };
    return { ...state, phaseIndex: state.phaseIndex + 1, feedback: null };
  }

  if (action.type === "selectHeat") {
    if (phase.kind !== "heat") return state;
    if (recipe.station.kind === "grill") {
      return { ...state, selectedHeat: action.level, feedback: null };
    }
    if (action.level !== phase.targetLevel) {
      return {
        ...state,
        grillDoneness: phase.targetLevel === "medium" && (action.level === "high" || action.level === "extreme")
          ? "burnt"
          : "raw",
        feedback: { kind: "wrong-heat" },
      };
    }
    return {
      ...state,
      phaseIndex: state.phaseIndex + 1,
      grillDoneness: state.grillDoneness,
      feedback: null,
    };
  }

  if (action.type === "flip" && phase.kind === "action") {
    return {
      ...state,
      phaseIndex: recipe.phases.length,
      status: "completed",
      feedback: null,
    };
  }

  return state;
}
