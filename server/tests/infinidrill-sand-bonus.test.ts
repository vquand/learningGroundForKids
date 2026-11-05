import assert from "node:assert/strict";
import test from "node:test";

import { generateInfinidrillQuestion } from "../src/infinidrill/questions-config.js";
import { applyCommand, emptyProgress, publicState, type Progress } from "../src/infinidrill/progress.js";
import { createInfinidrillGame } from "../src/infinidrill/game.js";
import { minedTownMaterials, bonusSandFromRock } from "../src/town-building/rewards.js";

function legacyLevelSevenProgress(depthBlocks: number, firstTryMastery = 0): Progress {
  const { excavations: _oldMain, laserCuts: _oldLaser, ...initial } = createInfinidrillGame({ random: () => 0.5 });
  const currentQuestion = generateInfinidrillQuestion(7, () => 0.5);
  const game = {
    ...initial,
    worldSeed: 123_456,
    level: 7 as const,
    depthBlocks,
    depthMetres: depthBlocks * 6,
    mainQuestionsCompleted: 9,
    questionsSinceChallenge: 0,
    destroyedBlocks: depthBlocks,
    currentQuestion,
    questionCounter: 9,
    firstTryMastery,
    mode: "playing" as const,
  };
  return { revision: 9, game, caveFalls: 0, bonusQuestionsCompleted: 0, earned: {} };
}

test("every ten newly earned rocks grant bonus sand and carry the remainder", () => {
  assert.deepEqual(bonusSandFromRock(0), { sand: 0, remainder: 0 });
  assert.deepEqual(bonusSandFromRock(9), { sand: 0, remainder: 9 });
  assert.deepEqual(bonusSandFromRock(10), { sand: 1, remainder: 0 });
  assert.deepEqual(bonusSandFromRock(11, 9), { sand: 2, remainder: 0 });
  assert.deepEqual(bonusSandFromRock(25, 9), { sand: 3, remainder: 4 });
});

test("legacy fractional depth counts new head and laser cells once without crediting old ground", () => {
  const before = legacyLevelSevenProgress(120.5).game!;
  const after = {
    ...before,
    mainQuestionsCompleted: before.mainQuestionsCompleted + 1,
    excavations: [
      { from: 0, to: 120.5, left: -1, right: 1 },
      { from: 120.5, to: 121, left: -1, right: 1 },
    ],
    laserCuts: [{ from: 120.5, to: 121, left: 1, right: 2 }],
  };
  const loot = minedTownMaterials(before, after);
  assert.equal(loot.reward.rock, 4);
  assert.equal(loot.reward.sand ?? 0, 0);
  assert.equal(loot.deposits.length, 4);
  assert.deepEqual(bonusSandFromRock(loot.reward.rock ?? 0, 9), { sand: 1, remainder: 3 });
});

test("rock bonus inputs are integral, bounded, and safe", () => {
  for (const [rocks, remainder] of [
    [-1, 0], [1.5, 0], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0],
    [0, -1], [0, 10], [0, 0.5], [0, Number.NaN], [0, Number.POSITIVE_INFINITY],
    [Number.MAX_SAFE_INTEGER, 9],
  ] as const) {
    assert.throws(() => bonusSandFromRock(rocks, remainder), `${rocks}/${remainder} should be rejected`);
  }
});

test("direct sand and rock rewards share a stable carry and head/laser overlap is deduplicated", () => {
  const before = createInfinidrillGame({ random: () => 0.5 });
  const after = {
    ...before,
    mainQuestionsCompleted: before.mainQuestionsCompleted + 1,
    excavations: [{ from: 120, to: 121, left: -1, right: 1 }],
    laserCuts: [{ from: 120.5, to: 121, left: 1, right: 2 }],
  };
  const loot = minedTownMaterials(before, after);
  assert.equal(loot.reward.rock, 7);
  assert.equal(new Set(loot.deposits.map((deposit) => `${deposit.row}:${deposit.column}`)).size, 7);
  assert.deepEqual(bonusSandFromRock(loot.reward.rock ?? 0, 9), { sand: 1, remainder: 6 });

  const mixed = {
    ...before,
    mainQuestionsCompleted: before.mainQuestionsCompleted + 1,
    excavations: [{ from: 119, to: 121, left: -1, right: 1 }],
  };
  const mixedLoot = minedTownMaterials(before, mixed);
  assert.ok((mixedLoot.reward.sand ?? 0) > 0 && (mixedLoot.reward.rock ?? 0) > 0);
  const mixedBonus = bonusSandFromRock(mixedLoot.reward.rock ?? 0, 9);
  assert.equal((mixedLoot.reward.sand ?? 0) + mixedBonus.sand, (mixedLoot.reward.sand ?? 0) + Math.floor((9 + (mixedLoot.reward.rock ?? 0)) / 10));
});

test("wrong answers, pauses, and no-excavation state changes earn no mining reward", () => {
  const runtime = {
    random: () => 0.5,
    questionFactory: (level: Parameters<typeof generateInfinidrillQuestion>[0], random: Parameters<typeof generateInfinidrillQuestion>[1]) => generateInfinidrillQuestion(level, random),
  };
  const started = applyCommand(emptyProgress(), { type: "replay" }, 0, runtime);
  const question = started.game!.currentQuestion!;
  const wrong = applyCommand(started, { type: "submit-answer", questionId: question.id, answer: Number(question.answer) + 1 }, 100, runtime);
  assert.deepEqual(minedTownMaterials(started.game, wrong.game).reward, {});

  const paused = applyCommand(started, { type: "pause" }, 200, runtime);
  assert.deepEqual(minedTownMaterials(started.game, paused.game).reward, {});
  const noExcavation = { ...started.game!, mainQuestionsCompleted: started.game!.mainQuestionsCompleted + 1, excavations: [], laserCuts: [] };
  assert.deepEqual(minedTownMaterials(started.game, noExcavation).reward, {});
});

test("private rock carry survives pause and replay but never appears in public state", () => {
  const started = applyCommand(emptyProgress(), { type: "replay" }, 0, { random: () => 0.5 });
  const carried = { ...started, townRockRemainder: 9 } as Progress & { townRockRemainder?: number };
  const paused = applyCommand(carried, { type: "pause" }, 100, { random: () => 0.5 }) as Progress & { townRockRemainder?: number };
  const replayed = applyCommand(carried, { type: "replay" }, 200, { random: () => 0.5 }) as Progress & { townRockRemainder?: number };
  assert.equal(paused.townRockRemainder, 9);
  assert.equal(replayed.townRockRemainder, 9);
  assert.equal("townRockRemainder" in publicState(replayed), false);
  const legacy = applyCommand(started, { type: "pause" }, 300, { random: () => 0.5 }) as Progress & { townRockRemainder?: number };
  assert.equal(legacy.townRockRemainder ?? 0, 0);
});

test("legacy depth saves without excavation history reward only the newly appended cut", () => {
  const before = legacyLevelSevenProgress(120);
  const question = before.game!.currentQuestion!;
  const after = applyCommand(before, {
    type: "submit-answer",
    questionId: question.id,
    answer: Number(question.answer),
  }, 100, { random: () => 0.5 });
  const newCut = after.game!.excavations?.at(-1);
  assert.ok(newCut && newCut.to > newCut.from);
  const expectedCells = Math.round((newCut.to - newCut.from) * (newCut.right - newCut.left + 1) * 2);
  const loot = minedTownMaterials(before.game, after.game);
  assert.equal(loot.reward.sand ?? 0, 0, "legacy surface history must not become new sand");
  assert.equal(loot.reward.rock, expectedCells, "only the new deep cut earns rock");
  assert.equal(loot.deposits.length, expectedCells);
});

test("a legacy save answering at its level boundary is stationary and earns no town loot", () => {
  const before = legacyLevelSevenProgress(140);
  const question = before.game!.currentQuestion!;
  const after = applyCommand(before, {
    type: "submit-answer",
    questionId: question.id,
    answer: Number(question.answer),
  }, 100, { random: () => 0.5 });
  const loot = minedTownMaterials(before.game, after.game);
  assert.deepEqual(loot.reward, {});
  assert.deepEqual(loot.deposits, []);
  assert.equal(after.game!.depthBlocks, 140);
});
