import test from "node:test";
import assert from "node:assert/strict";
import { burgerReducer, createBurgerGame, tomatoAnswers, type BurgerGame } from "../src/features/cooking/burger/burgerGame.ts";

function next(game: BurgerGame) { return burgerReducer(game, { type: "next" }); }
function prep() {
  let game = createBurgerGame(0);
  game = burgerReducer(game, { type: "shape", value: "heart" });
  game = next(game);
  game = burgerReducer(game, { type: "toast", value: "golden" });
  game = next(game);
  game = burgerReducer(game, { type: "heat", value: "medium" });
  assert.equal(next(game).step, "cook");
  game = burgerReducer(game, { type: "flip" });
  game = next(game);
  game = burgerReducer(game, { type: "cheese" });
  return next(game);
}

test("required prep cannot be skipped and mistakes allow gentle retries", () => {
  let game = createBurgerGame(0);
  assert.equal(next(game).step, "shape");
  assert.deepEqual(burgerReducer(game, { type: "flip" }), game);
  game = burgerReducer(game, { type: "shape", value: "star" });
  game = next(game);
  game = burgerReducer(game, { type: "toast", value: "dark" });
  assert.equal(next(game).step, "toast");
  assert.ok(game.feedback);
  game = burgerReducer(game, { type: "toast", value: "golden" });
  assert.equal(game.feedback, "");
  assert.equal(next(game).step, "cook");
  assert.equal(prep().step, "sauce");
});

test("sauce and single topping preview swaps require confirmation", () => {
  let game = prep();
  assert.equal(next(game).step, "sauce");
  game = burgerReducer(game, { type: "sauce", value: "mayo" });
  game = burgerReducer(game, { type: "sauce", value: "ketchup" });
  assert.equal(game.sauce, "ketchup");
  assert.equal(game.step, "sauce");
  game = next(game);
  assert.equal(next(game).step, "topping");
  for (const value of ["tomato", "pickles", "lettuce"] as const) game = burgerReducer(game, { type: "topping", value });
  assert.equal(game.topping, "lettuce");
  assert.equal(next(game).step, "decorate");
});

test("only tomato takes the math path, incorrect answers retry, final choices survive", () => {
  let game = burgerReducer(prep(), { type: "sauce", value: "burger-sauce" });
  game = burgerReducer(next(game), { type: "topping", value: "tomato" });
  game = next(game);
  assert.equal(game.step, "tomato");
  game = burgerReducer(game, { type: "answer", value: 99 });
  assert.equal(next(game).step, "tomato");
  game = burgerReducer(game, { type: "answer", value: game.thickness });
  assert.equal(game.sliced, true);
  game = next(game);
  game = burgerReducer(game, { type: "pick", value: "flower" });
  game = next(game);
  assert.equal(game.step, "serve");
  assert.equal(game.shape, "heart");
  assert.equal(game.topping, "tomato");
  assert.equal(game.sauce, "burger-sauce");
});

test("questions have three unique positive choices, and replay changes thickness and clears choices", () => {
  for (const seed of [0, 0.3, 0.6, 0.99]) {
    const game = createBurgerGame(seed);
    const answers = tomatoAnswers(game.thickness);
    assert.equal(new Set(answers).size, 3);
    assert.ok(answers.includes(game.thickness));
    assert.ok(answers.every((n) => n > 0));
    const replay = createBurgerGame(seed, game.thickness);
    assert.notEqual(replay.thickness, game.thickness);
    assert.ok(replay.thickness >= 3 && replay.thickness <= 6);
    assert.equal(replay.topping, null);
    assert.equal(replay.step, "shape");
  }
});
