import test from "node:test";
import assert from "node:assert/strict";
import {
  createInfinidrillGame,
  infinidrillReducer,
} from "../src/features/infinidrill/game.ts";
import { INFINIDRILL_UPGRADES } from "../src/features/infinidrill/upgrades.ts";
import { getInfinidrillQuote } from "../src/features/infinidrill/quotes.ts";
import { generateInfinidrillQuestion, selectInfinidrillQuestion } from '../../server/src/infinidrill/questions-config.ts';
import { evaluate } from '../../server/src/questions/equation.ts';
import type { InfinidrillGameState, InfinidrillLevel, RandomSource } from "../src/features/infinidrill/types.ts";

function enterAndSubmit(state: InfinidrillGameState, at: number, runtime: { random: RandomSource; now: () => number }, answer = Number(state.currentQuestion!.answer)): InfinidrillGameState {
  let next = state;
  for (const digit of String(answer)) next = infinidrillReducer(next, { type: "input-digit", digit: Number(digit) }, runtime);
  return infinidrillReducer(next, { type: "submit-answer", questionId: state.currentQuestion!.id, at }, runtime);
}

function seeded(seed: number): RandomSource {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

test('shared question levels retain stage mapping, bounds, carries, borrows and chain sizes', () => {
  const levels: readonly InfinidrillLevel[] = Array.from({ length: 18 }, (_, index) => (index + 1) as InfinidrillLevel);
  const expected = ['add-1d', 'sub-1d', 'add-chain-1d', 'sub-chain-1d', 'mixed-chain-1d', 'addsub-2d1d', 'addsub-2d1d-regroup', 'add-2d', 'sub-2d', 'chain-2d-3', 'chain-2d-4', 'mul-1d', 'mul-teens-small', 'mul-teens-large', 'addsub-3d1d', 'addsub-3d2d', 'chain-3d-3', 'chain-3d-4'];
  for (const [index, level] of levels.entries()) for (let sample = 0; sample < 150; sample += 1) {
    const question = generateInfinidrillQuestion(level, seeded(level * 91 + sample));
    if (question.card.kind === 'venn') continue;
    if (level === 14) assert.ok(question.card.level === 'mul-teens-large' || question.card.level === 'div-1d');
    else assert.equal(question.card.level, expected[index]);
    const results = evaluate(question.card.operands, question.card.operators);
    assert.ok(results.every((value) => Number.isInteger(value) && value >= 0 && value <= 999));
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer <= 999);
    if (level <= 5) assert.ok(question.card.operands.every((value) => value >= 0 && value <= 9));
    if (level === 6 || level === 7) {
      const [left, right] = question.card.operands;
      assert.ok(left! >= 10 && left! <= 99 && right! >= 0 && right! <= 9);
      const carries = question.card.operators[0] === '+' ? left! % 10 + right! >= 10 : right! > left! % 10;
      assert.equal(carries, level === 7);
    }
    if ([3, 4, 5].includes(level)) assert.ok(question.card.operands.length === 3 || question.card.operands.length === 4);
    if (level === 10 || level === 17) assert.equal(question.card.operands.length, 3);
    if (level === 11 || level === 18) assert.equal(question.card.operands.length, 4);
    if (level === 12) assert.ok(question.card.operands.every((value) => value <= 9) && question.card.operands.filter((value) => value === 0).length <= 1);
    if (level === 13) assert.ok(question.card.operands[0]! >= 10 && question.card.operands[0]! <= 19 && question.card.operands[1]! >= 1 && question.card.operands[1]! <= 5);
    if (level === 14 && question.card.operators[0] === '×') assert.ok(question.card.operands[0]! >= 10 && question.card.operands[0]! <= 19 && question.card.operands[1]! >= 6 && question.card.operands[1]! <= 10);
    if (level === 14 && question.card.operators[0] === '÷') assert.equal(question.card.operands[0]! % question.card.operands[1]!, 0);
    if (level >= 15) assert.ok(results.every((value) => value >= 100 && value <= 999));
  }
});

test('constant-random selection avoids repeats through finite fallback enumeration', () => {
  for (const level of [8, 12, 18] as const) {
    const seen = new Set<string>();
    for (let sample = 0; sample < 30; sample += 1) {
      const question = selectInfinidrillQuestion(level, () => 0, seen);
      assert.ok(question);
      assert.equal(seen.has(question.key), false);
      seen.add(question.key);
    }
  }
});

test("wrong main answers keep the question for retry and reset its fast streak", () => {
  const runtime = { random: () => 0.1, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  const questionId = game.currentQuestion!.id;
  game = infinidrillReducer(game, { type: "input-digit", digit: (Number(game.currentQuestion!.answer) + 1) % 10 }, runtime);
  game = infinidrillReducer(game, { type: "submit-answer", questionId, at: 1000 }, runtime);
  assert.equal(game.currentQuestion!.id, questionId);
  assert.equal(game.questionAttempted, true);
  assert.equal(game.fastStreak, 0);
  assert.equal(game.feedback, "wrong");
});

test("five quick first-try answers open a cave and cave positions give no resources", () => {
  const runtime = { random: () => 0, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  for (let index = 0; index < 5; index += 1) game = enterAndSubmit(game, 1_000, runtime);
  assert.equal(game.level, 2);
  assert.equal(game.depthBlocks, 20);
  assert.equal(game.depthMetres, 120);
  assert.equal(game.lastEvent.kind, "cave-fall");
  assert.equal(game.lastEvent.depth?.blocks, 10);
  assert.equal(game.lastEvent.depth?.crystals, 0);
  assert.equal(game.destroyedBlocks, 10);
  assert.equal(game.resources.crystals, 1, 'Only the diamond actually mined before the cave is awarded');
});

test("every seventh main success opens the A/B challenge and A resumes drilling", () => {
  const runtime = { random: () => 0.8, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  for (let index = 0; index < 7; index += 1) game = enterAndSubmit(game, 20_000, runtime);
  assert.equal(game.mode, "challenge-choice");
  assert.equal(game.questionsSinceChallenge, 0);
  game = infinidrillReducer(game, { type: "choose-challenge", choice: "A" }, runtime);
  assert.equal(game.mode, "playing");
  assert.ok(game.currentQuestion);
});

test("level changes reset mastery and speed streak after slow boundary practice", () => {
  const runtime = { random: () => 0, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  for (let index = 0; index < 10; index += 1) {
    game = enterAndSubmit(game, (index + 1) * 20_000, runtime);
    if (game.mode === "challenge-choice") game = infinidrillReducer(game, { type: "choose-challenge", choice: "A" }, runtime);
  }
  assert.equal(game.level, 2);
  assert.equal(game.firstTryMastery, 0);
  assert.equal(game.fastStreak, 0);
});

test("boundary practice does not re-mine deposits or move depth", () => {
  const runtime = { random: () => 0, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  game = { ...game, depthBlocks: 20, depthMetres: 120, firstTryMastery: 0 };
  game = enterAndSubmit(game, 20_000, runtime);
  assert.equal(game.mode, "playing");
  assert.equal(game.level, 1);
  assert.equal(game.depthBlocks, 20);
  assert.equal(game.lastEvent.depth?.kind, "practice");
  assert.equal(game.lastEvent.depth?.metres, 0);
  assert.equal(game.lastEvent.depth?.crystals, 0);
  assert.equal(game.destroyedBlocks, 0);
});

test("a cave and the seventh-question choice retain both event details", () => {
  const runtime = { random: () => 0, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  game = { ...game, depthBlocks: 4, depthMetres: 24, firstTryMastery: 4, fastStreak: 4, questionsSinceChallenge: 6 };
  game = enterAndSubmit(game, 1_000, runtime);
  assert.equal(game.mode, "challenge-choice");
  assert.equal(game.lastEvent.kind, "challenge");
  assert.equal(game.lastEvent.depth?.kind, "cave-fall");
  assert.equal(game.lastEvent.depth?.crystals, 0);
});

test("a quick expedition reaches the Earth core through all 18 levels", () => {
  const runtime = { random: () => 0.1, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  let at = 0;
  let answers = 0;
  while (game.mode !== "core" && answers < 200) {
    if (game.mode === "challenge-choice") {
      game = infinidrillReducer(game, { type: "choose-challenge", choice: "A" }, runtime);
      continue;
    }
    assert.equal(game.mode, "playing");
    at = game.questionStartedAt + 1_000;
    game = enterAndSubmit(game, at, runtime);
    answers += 1;
  }
  assert.equal(game.mode, "core");
  assert.equal(game.level, 18);
  assert.equal(game.depthBlocks, 18 * 20);
  assert.equal(game.depthMetres, 18 * 20 * 6);
  assert.ok(game.resources.crystals > 0);
  assert.equal(game.finishedAt, at);
});

test("a wrong B challenge loses the free upgrade opportunity without counting as a main question", () => {
  const runtime = { random: () => 0.8, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  for (let index = 0; index < 7; index += 1) game = enterAndSubmit(game, 20_000, runtime);
  game = infinidrillReducer(game, { type: "choose-challenge", choice: "B" }, runtime);
  assert.equal(game.mode, "bonus-question");
  const questionId = game.currentQuestion!.id;
  game = infinidrillReducer(game, { type: "input-digit", digit: (game.currentQuestion!.answer + 1) % 10 }, runtime);
  game = infinidrillReducer(game, { type: "submit-answer", questionId, at: 1_000 }, runtime);
  assert.equal(game.mode, "playing");
  assert.equal(game.feedback, "challenge-failed");
  assert.equal(game.mainQuestionsCompleted, 7);
});

test("a successful B challenge stores a free part even when its prerequisite is not owned", () => {
  const runtime = { random: () => 0.2, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  game = {
    ...game,
    mode: "upgrade-reward",
    currentQuestion: null,
    upgradeChoices: ["engine-2"],
  };
  game = infinidrillReducer(game, { type: "choose-upgrade-reward", upgradeId: "engine-2" }, runtime);
  assert.ok(game.ownedUpgradeIds.includes("engine-2"));
  assert.equal(game.equippedUpgradeIds.engine, "starter-engine");
  assert.equal(game.mode, "playing");
});

test("a usable free reward is received and equipped immediately", () => {
  const runtime = { random: () => 0.2, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  game = {
    ...game,
    mode: "upgrade-reward",
    currentQuestion: null,
    upgradeChoices: ["head-1"],
  };
  game = infinidrillReducer(game, { type: "choose-upgrade-reward", upgradeId: "head-1" }, runtime);
  assert.equal(game.ownedUpgradeIds.includes("head-1"), true);
  assert.equal(game.equippedUpgradeIds.head, "head-1");
  assert.equal(game.lastEvent.upgrade?.upgradeId, "head-1");
});

test('returning one upgraded slot to basic keeps all owned tiers, other equipment and balances', () => {
  const runtime = { random: () => 0, now: () => 1000 };
  const initial = createInfinidrillGame(runtime);
  const game = { ...initial, ownedUpgradeIds: ['head-1', 'head-2', 'head-3', 'engine-1'], equippedUpgradeIds: { ...initial.equippedUpgradeIds, head: 'head-3', engine: 'engine-1' } };
  const basic = infinidrillReducer(game, { type: 'equip-upgrade', upgradeId: 'starter-head' }, runtime);
  assert.equal(basic.equippedUpgradeIds.head, 'starter-head');
  assert.equal(basic.equippedUpgradeIds.engine, 'engine-1');
  assert.deepEqual(basic.ownedUpgradeIds, game.ownedUpgradeIds);
  assert.deepEqual(basic.resources, game.resources);
  assert.equal(infinidrillReducer(basic, { type: 'equip-upgrade', upgradeId: 'head-3' }, runtime).equippedUpgradeIds.head, 'head-3');
});

test("purchase enforces prerequisites and never makes balances negative", () => {
  const runtime = { random: () => 0.1, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  game = { ...game, mode: "workshop", resources: { crystals: 7, nuggets: 12 } };
  const before = game.resources;
  game = infinidrillReducer(game, { type: "purchase-upgrade", upgradeId: "head-2" }, runtime);
  assert.deepEqual(game.resources, before);
  game = infinidrillReducer(game, { type: "purchase-upgrade", upgradeId: "head-1" }, runtime);
  assert.equal(game.ownedUpgradeIds.includes("head-1"), true);
  assert.ok(game.resources.crystals >= 0 && game.resources.nuggets >= 0);
  game = infinidrillReducer(game, { type: "purchase-upgrade", upgradeId: "head-2" }, runtime);
  assert.equal(game.ownedUpgradeIds.includes("head-2"), true);
  assert.ok(game.resources.crystals >= 0 && game.resources.nuggets >= 0);
});

test("duplicate successful submissions are ignored by the question token", () => {
  const runtime = { random: () => 0.4, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  const oldId = game.currentQuestion!.id;
  game = enterAndSubmit(game, 1_000, runtime);
  const afterFirst = game;
  game = infinidrillReducer(game, { type: "submit-answer", questionId: oldId, at: 1_000 }, runtime);
  assert.deepEqual(game, afterFirst);
});

test("pause and workshop time do not count toward the 15-second fast threshold", () => {
  const runtime = { random: () => 0.1, now: () => 0 };
  let game = createInfinidrillGame(runtime);
  const questionId = game.currentQuestion!.id;
  game = infinidrillReducer(game, { type: "pause", at: 1_000 }, runtime);
  assert.equal(game.mode, "paused");
  game = infinidrillReducer(game, { type: "resume", at: 20_000 }, runtime);
  assert.equal(game.questionStartedAt, 19_000);
  for (const digit of String(game.currentQuestion!.answer)) game = infinidrillReducer(game, { type: "input-digit", digit: Number(digit) }, runtime);
  game = infinidrillReducer(game, { type: "submit-answer", questionId, at: 30_000 }, runtime);
  assert.equal(game.fastStreak, 1);
});

test("replay returns to a fresh Earth session", () => {
  const runtime = { random: () => 0.5, now: () => 10_000 };
  let game = createInfinidrillGame(runtime);
  game = { ...game, depthBlocks: 50, resources: { crystals: 100, nuggets: 4 }, ownedUpgradeIds: ["head-1"], mode: "core" };
  game = infinidrillReducer(game, { type: "replay", at: 50_000 }, runtime);
  assert.equal(game.mode, "playing");
  assert.equal(game.level, 1);
  assert.equal(game.depthBlocks, 0);
  assert.deepEqual(game.resources, { crystals: 0, nuggets: 0 });
  assert.deepEqual(game.ownedUpgradeIds, []);
  assert.equal(game.currentQuestion!.card.level, 'add-1d');
});

test("the catalog contains five fixed slots with four cosmetic tiers", () => {
  assert.equal(INFINIDRILL_UPGRADES.length, 20);
  assert.deepEqual(new Set(INFINIDRILL_UPGRADES.map((part) => part.slot)), new Set(["head", "cabin", "accessory", "engine", "treads"]));
  assert.ok(INFINIDRILL_UPGRADES.every((part) => part.tier === 1 ? part.prerequisiteId === null : part.prerequisiteId !== null));
});

test("animal thoughts use the matching curated pool and generic thoughts for custom avatars", () => {
  const rabbitThought = getInfinidrillQuote("rabbit-snow", () => 0);
  assert.equal(rabbitThought, "Any carrots down here?");
  const capybaraThought = getInfinidrillQuote("capybara-calm", () => 0);
  assert.equal(capybaraThought, "A warm mud bath would be nice.");
  const customThought = getInfinidrillQuote("uploaded-photo", () => 0);
  assert.equal(customThought, "Is that a potato-shaped rock?");
});
