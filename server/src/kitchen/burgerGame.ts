export const BUN_SHAPES = ["round", "heart", "flower", "star", "square"] as const;
export type BunShape = typeof BUN_SHAPES[number];
export type Sauce = "ketchup" | "mayo" | "burger-sauce";
export type Topping = "lettuce" | "tomato" | "pickles";
export type Pick = "flower" | "star" | "heart";
export const BURGER_STEPS = ["shape", "toast", "cook", "cheese", "sauce", "topping", "tomato", "decorate", "serve"] as const;
export type BurgerStep = typeof BURGER_STEPS[number];
export interface BurgerGame {
  step: BurgerStep;
  shape: BunShape | null;
  toasted: boolean;
  heated: boolean;
  flipped: boolean;
  cheese: boolean;
  sauce: Sauce | null;
  topping: Topping | null;
  pick: Pick | null;
  thickness: number;
  sliced: boolean;
  feedback: string;
  animation: number;
}
export type BurgerAction =
  | { type: "shape"; value: BunShape }
  | { type: "toast"; value: "pale" | "golden" | "dark" }
  | { type: "heat"; value: "low" | "medium" | "high" }
  | { type: "sauce"; value: Sauce }
  | { type: "topping"; value: Topping }
  | { type: "pick"; value: Pick }
  | { type: "answer"; value: number }
  | { type: "flip" | "cheese" | "next" };

export function createBurgerGame(random = Math.random(), previousThickness?: number): BurgerGame {
  const pool = [3, 4, 5, 6].filter((n) => n !== previousThickness);
  const thickness = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random * pool.length)))] ?? 4;
  return { step: "shape", shape: null, toasted: false, heated: false, flipped: false,
    cheese: false, sauce: null, topping: null, pick: null, thickness, sliced: false, feedback: "", animation: 0 };
}

export function tomatoAnswers(thickness: number): number[] {
  const choices = [thickness - 1, thickness, thickness + 1];
  const offset = thickness % 3;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

export function isBurgerStepReady(game: BurgerGame): boolean {
  switch (game.step) {
    case "shape": return game.shape !== null;
    case "toast": return game.toasted;
    case "cook": return game.flipped;
    case "cheese": return game.cheese;
    case "sauce": return game.sauce !== null;
    case "topping": return game.topping !== null;
    case "tomato": return game.sliced;
    case "decorate": return game.pick !== null;
    case "serve": return false;
  }
}

export function burgerReducer(game: BurgerGame, action: BurgerAction): BurgerGame {
  const updated = { ...game, feedback: "", animation: game.animation + 1 };
  if (action.type === "next") {
    if (!isBurgerStepReady(game)) return { ...game, feedback: "Let's finish this little step first." };
    const next = game.step === "topping" && game.topping !== "tomato"
      ? "decorate" : BURGER_STEPS[BURGER_STEPS.indexOf(game.step) + 1];
    return next ? { ...updated, step: next } : game;
  }
  switch (action.type) {
    case "shape": return game.step === "shape" ? { ...updated, shape: action.value } : game;
    case "toast":
      if (game.step !== "toast") return game;
      return action.value === "golden" ? { ...updated, toasted: true }
        : { ...game, feedback: action.value === "pale" ? "A little more toasting! Try golden." : "That's a bit too toasty. Try golden!" };
    case "heat":
      if (game.step !== "cook" || game.flipped) return game;
      return action.value === "medium" ? { ...updated, heated: true }
        : { ...game, feedback: "Medium heat makes a lovely patty. Give it a try!" };
    case "flip": return game.step === "cook" && game.heated ? { ...updated, flipped: true } : game;
    case "cheese": return game.step === "cheese" ? { ...updated, cheese: true } : game;
    case "sauce": return game.step === "sauce" ? { ...updated, sauce: action.value } : game;
    case "topping": return game.step === "topping" ? { ...updated, topping: action.value } : game;
    case "answer":
      if (game.step !== "tomato" || game.sliced) return game;
      return action.value === game.thickness ? { ...updated, sliced: true }
        : { ...game, feedback: `Count ${game.thickness} little 1 cm pieces. Try again!` };
    case "pick": return game.step === "decorate" ? { ...updated, pick: action.value } : game;
  }
}
