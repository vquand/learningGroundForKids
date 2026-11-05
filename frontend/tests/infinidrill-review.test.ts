import assert from 'node:assert/strict';
import test from 'node:test';
import { createInfinidrillGame, infinidrillReducer } from '../src/features/infinidrill/game.ts';
import { INFINIDRILL_UPGRADES, isUpgradeUsable } from '../src/features/infinidrill/upgrades.ts';
import { generateInfinidrillQuestion, selectInfinidrillQuestion } from '../../server/src/infinidrill/questions-config.ts';
import { evaluate } from '../../server/src/questions/equation.ts';
import type { InfinidrillGameState, InfinidrillLevel } from '../src/features/infinidrill/types.ts';

function runtime() {
  let clock = 0;
  const configuration = { random: (() => { let value = 13; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32; }; })(), now: () => clock };
  return { configuration, advance: (milliseconds: number) => { clock += milliseconds; } };
}

function answer(game: InfinidrillGameState, configuration: ReturnType<typeof runtime>['configuration']) {
  const id = game.currentQuestion!.id;
  for (const digit of String(Number(game.currentQuestion!.answer))) game = infinidrillReducer(game, { type: 'input-digit', digit: Number(digit) }, configuration);
  return infinidrillReducer(game, { type: 'submit-answer', questionId: id }, configuration);
}

function seeded(seed = 42) {
  let value = seed;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32; };
}

test('the shared generator preserves stage mapping, operand rules, result bounds, and chain sizes', () => {
  const levels: readonly InfinidrillLevel[] = Array.from({ length: 18 }, (_, index) => (index + 1) as InfinidrillLevel);
  const expected = ['add-1d', 'sub-1d', 'add-chain-1d', 'sub-chain-1d', 'mixed-chain-1d', 'addsub-2d1d', 'addsub-2d1d-regroup', 'add-2d', 'sub-2d', 'chain-2d-3', 'chain-2d-4', 'mul-1d', 'mul-teens-small', 'mul-teens-large', 'addsub-3d1d', 'addsub-3d2d', 'chain-3d-3', 'chain-3d-4'];
  for (const [index, level] of levels.entries()) {
    const random = seeded(level * 91);
    for (let sample = 0; sample < 150; sample += 1) {
      const question = generateInfinidrillQuestion(level, random);
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
      if (level === 3 || level === 4 || level === 5) assert.ok(question.card.operands.length === 3 || question.card.operands.length === 4);
      if (level === 10 || level === 17) assert.equal(question.card.operands.length, 3);
      if (level === 11 || level === 18) assert.equal(question.card.operands.length, 4);
      if (level === 12) assert.ok(question.card.operands.every((value) => value <= 9) && question.card.operands.filter((value) => value === 0).length <= 1);
      if (level === 13) assert.ok(question.card.operands[0]! >= 10 && question.card.operands[0]! <= 19 && question.card.operands[1]! >= 1 && question.card.operands[1]! <= 5);
      if (level === 14 && question.card.operators[0] === '×') assert.ok(question.card.operands[0]! >= 10 && question.card.operands[0]! <= 19 && question.card.operands[1]! >= 6 && question.card.operands[1]! <= 10);
      if (level === 14 && question.card.operators[0] === '÷') assert.equal(question.card.operands[0]! % question.card.operands[1]!, 0);
      if (level >= 15) assert.ok(results.every((value) => value >= 100 && value <= 999));
    }
  }
});

test('constant-random stage selection keeps producing fresh cards through fallback enumeration', () => {
  for (const stage of [8, 12, 18] as const) {
    const seen = new Set<string>();
    for (let sample = 0; sample < 30; sample += 1) {
      const question = selectInfinidrillQuestion(stage, () => 0, seen);
      assert.ok(question);
      assert.equal(seen.has(question.key), false);
      seen.add(question.key);
    }
  }
});

test('a natural fast expedition visits every Earth level and ends exactly at the core', () => {
  const clock = runtime();
  let game = createInfinidrillGame(clock.configuration);
  const visited = new Set<number>();
  let choices = 0;
  for (let iteration = 0; iteration < 200 && game.mode !== 'core'; iteration++) {
    visited.add(game.level);
    if (game.mode === 'challenge-choice') {
      choices++;
      game = infinidrillReducer(game, { type: 'choose-challenge', choice: 'B' }, clock.configuration);
    } else if (game.mode === 'upgrade-reward') {
      assert.equal(new Set(game.upgradeChoices).size, game.upgradeChoices.length);
      assert.ok(game.upgradeChoices.every(id => !game.ownedUpgradeIds.includes(id)));
      game = infinidrillReducer(game, { type: 'choose-upgrade-reward', upgradeId: game.upgradeChoices[0]! }, clock.configuration);
    } else {
      clock.advance(1000);
      game = answer(game, clock.configuration);
    }
  }
  assert.equal(game.mode, 'core');
  assert.equal(visited.size, 18);
  assert.equal(game.mainQuestionsCompleted, 90);
  assert.equal(choices, Math.floor(89 / 7));
  assert.equal(game.depthBlocks, 360);
  assert.equal(game.depthMetres, 2160);
  assert.ok(game.destroyedBlocks < game.depthBlocks, 'Cave positions do not count as mined soil');
  assert.ok(game.resources.crystals > 0 && game.resources.nuggets > 0);
});

test('15 seconds is not fast and retries cannot earn first-try mastery', () => {
  const clock = runtime();
  let game = createInfinidrillGame(clock.configuration);
  clock.advance(15000);
  game = answer(game, clock.configuration);
  assert.equal(game.fastStreak, 0);
  assert.equal(game.firstTryMastery, 1);
  const id = game.currentQuestion!.id;
  game = infinidrillReducer(game, { type: 'input-digit', digit: (Number(game.currentQuestion!.answer) + 1) % 10 }, clock.configuration);
  game = infinidrillReducer(game, { type: 'submit-answer', questionId: id }, clock.configuration);
  clock.advance(1000);
  game = answer(game, clock.configuration);
  assert.equal(game.firstTryMastery, 1);
  assert.equal(game.fastStreak, 0);
});

test('the next question clock starts after its drilling animation becomes ready', () => {
  const clock = runtime();
  let game = createInfinidrillGame(clock.configuration);
  clock.advance(1000);
  game = answer(game, clock.configuration);
  clock.advance(1600);
  game = infinidrillReducer(game, { type: 'question-ready', questionId: game.currentQuestion!.id }, clock.configuration);
  clock.advance(14999);
  game = answer(game, clock.configuration);
  assert.equal(game.fastStreak, 2);
});

test('a stashed tier-three reward requires the whole chain and costs no second purchase', () => {
  const clock = runtime();
  let game = createInfinidrillGame(clock.configuration);
  game = { ...game, mode: 'upgrade-reward', currentQuestion: null, upgradeChoices: ['engine-3'], resources: { crystals: 1000, nuggets: 100 } };
  game = infinidrillReducer(game, { type: 'choose-upgrade-reward', upgradeId: 'engine-3' }, clock.configuration);
  const wallet = game.resources;
  assert.equal(isUpgradeUsable(game.ownedUpgradeIds, 'engine-3'), false);
  game = infinidrillReducer(game, { type: 'open-workshop' }, clock.configuration);
  game = infinidrillReducer(game, { type: 'equip-upgrade', upgradeId: 'engine-3' }, clock.configuration);
  assert.equal(game.equippedUpgradeIds.engine, 'starter-engine');
  for (const id of ['engine-1', 'engine-2']) game = infinidrillReducer(game, { type: 'purchase-upgrade', upgradeId: id }, clock.configuration);
  assert.equal(isUpgradeUsable(game.ownedUpgradeIds, 'engine-3'), true);
  assert.deepEqual(game.resources, { crystals: wallet.crystals - 7, nuggets: wallet.nuggets - 12 });
  game = infinidrillReducer(game, { type: 'equip-upgrade', upgradeId: 'engine-3' }, clock.configuration);
  assert.equal(game.equippedUpgradeIds.engine, 'engine-3');
  const after = game;
  game = infinidrillReducer(game, { type: 'purchase-upgrade', upgradeId: 'engine-3' }, clock.configuration);
  assert.deepEqual(game, after);
});

test('the all-owned optional reward grants resources without a duplicate part', () => {
  const clock = runtime();
  let game = createInfinidrillGame(clock.configuration);
  game = { ...game, mode: 'bonus-question', ownedUpgradeIds: INFINIDRILL_UPGRADES.map(part => part.id) };
  game = answer(game, clock.configuration);
  assert.equal(game.mode, 'playing');
  assert.deepEqual(game.resources, { crystals: 1, nuggets: 4 });
  assert.equal(game.ownedUpgradeIds.length, 20);
  assert.equal(game.mainQuestionsCompleted, 0);
  assert.equal(game.depthBlocks, 0);
});
