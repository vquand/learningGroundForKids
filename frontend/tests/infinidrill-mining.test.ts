import test from 'node:test';
import assert from 'node:assert/strict';
import { depositAt, diggingColumns, mineDeposits } from '../../server/src/infinidrill/mining.ts';
import { createInfinidrillGame, infinidrillReducer } from '../../server/src/infinidrill/game.ts';

test('head widths are 3, 4, 5, 6, 7 visible tiles with either-side extra columns', () => {
  for (let tier = 0; tier <= 4; tier++) {
    const left = diggingColumns(tier, 0), right = diggingColumns(tier, .99);
    assert.equal(left.right - left.left + 1, tier + 3);
    assert.equal(right.right - right.left + 1, tier + 3);
    if (tier % 2) { assert.equal(left.left, right.left - 1); assert.equal(left.right, right.right - 1); }
    else assert.deepEqual(left, right);
  }
});

test('stable deposits vary horizontally and diamond blocks occur one-quarter as often', () => {
  let diamonds = 0, nuggets = 0;
  const columns = new Set<number>();
  for (let seed = 0; seed < 100; seed++) for (let row = 0; row < 720; row++) for (let column = -3; column <= 3; column++) {
    const kind = depositAt(seed, row / 2, column);
    assert.equal(kind, depositAt(seed, row / 2, column));
    if (kind) columns.add(column);
    if (kind === 'crystals') diamonds++;
    if (kind === 'nuggets') nuggets++;
  }
  assert.equal(columns.size, 7);
  assert.ok(Math.abs(diamonds / nuggets - .25) < .025, `${diamonds} diamonds / ${nuggets} nuggets`);
});

test('only deposits in mined columns award resources, and two consecutive empty digs are possible', () => {
  let emptyPair = false;
  for (let seed = 0; seed < 100; seed++) {
    const first = mineDeposits(seed, 0, 2, diggingColumns(0, 0));
    const second = mineDeposits(seed, 2, 4, diggingColumns(0, 0));
    if (!first.length && !second.length) emptyPair = true;
    for (const item of first) {
      assert.ok(item.column >= -1 && item.column <= 1);
      assert.equal(item.kind, depositAt(seed, item.row, item.column));
    }
    const wide = mineDeposits(seed, 0, 2, diggingColumns(4, 0));
    assert.ok(wide.length >= first.length);
  }
  assert.ok(emptyPair);
});

test('server earnings match deposited tiles and duplicate answers cannot collect twice', () => {
  const runtime = { random: () => 0, now: () => 1000 };
  for (const seed of [1, 10]) {
    const initial = { ...createInfinidrillGame(runtime), worldSeed: seed };
    const questionId = initial.currentQuestion!.id;
    const game = infinidrillReducer({ ...initial, input: String(initial.currentQuestion!.answer) }, { type: 'submit-answer', questionId }, runtime);
    const deposits = mineDeposits(seed, 0, game.depthBlocks, diggingColumns(0, 0));
    assert.deepEqual(game.lastEvent.deposits, deposits);
    assert.deepEqual(game.resources, { crystals: deposits.filter(item => item.kind === 'crystals').length, nuggets: deposits.filter(item => item.kind === 'nuggets').length });
    assert.equal(game.depthBlocks, 2, 'Empty digs still advance');
    assert.deepEqual(infinidrillReducer(game, { type: 'submit-answer', questionId }, runtime), game);
  }
});

test('legacy saves retain earned balances and their previously cleared shaft', () => {
  const runtime = { random: () => 0, now: () => 1000 };
  const { worldSeed, excavations, ...legacy } = createInfinidrillGame(runtime);
  const initial = { ...legacy, depthBlocks: 6, depthMetres: 36, resources: { crystals: 50, nuggets: 70 }, input: String(legacy.currentQuestion!.answer) };
  const game = infinidrillReducer(initial, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
  assert.ok(game.resources.crystals >= 50 && game.resources.nuggets >= 70);
  assert.deepEqual(game.excavations![0], { from: 0, to: 6, left: -1, right: 1 });
});

test('equipped cabin, engine and treads tiers stack visible-tile depth bonuses', () => {
  const runtime = { random: () => 0, now: () => 1000 };
  const initial = createInfinidrillGame(runtime);
  const game = { ...initial, equippedUpgradeIds: { ...initial.equippedUpgradeIds, cabin: 'cabin-2', engine: 'engine-3', treads: 'treads-1' }, input: String(initial.currentQuestion!.answer) };
  const next = infinidrillReducer(game, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
  assert.equal(next.depthMetres, 30, 'Base 12m plus six visible 3m tiles');
});

test('only equipped accessories fire automatically, deeper then wider, on either side', () => {
  for (let tier = 1; tier <= 4; tier++) for (const side of [0, .99]) {
    const runtime = { random: () => side, now: () => 1000 };
    const initial = createInfinidrillGame(runtime);
    const game = { ...initial, equippedUpgradeIds: { ...initial.equippedUpgradeIds, accessory: `accessory-${tier}` }, input: String(initial.currentQuestion!.answer) };
    const next = infinidrillReducer(game, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
    const laser = next.lastEvent.laser!;
    assert.ok(laser, `Tier ${tier} must fire`);
    const steps = laser.steps!;
    assert.equal(steps.length, [2, 4, 4, 6][tier - 1]);
    steps.forEach((step, index) => {
      assert.equal(step.right - step.left + 1, tier < 3 ? 1 : 3);
      assert.equal(step.from, laser.from + index / 2);
      if (side < .5) assert.ok(step.right < -1); else assert.ok(step.left > 1);
      if (index) assert.equal(step.left - steps[index - 1]!.left, side < .5 ? -1 : 1, 'Each deeper row steps outward');
    });
    assert.equal((laser.to - laser.from) * 2, [2, 4, 4, 6][tier - 1]);
    assert.equal(laser.from, next.depthBlocks);
  }
});

test('laser trajectories stay outside the widest possible cut of every equipped head tier', () => {
  for (let tier = 0; tier <= 4; tier++) for (const side of [0, .99]) {
    const runtime = { random: () => side, now: () => 1000 };
    const initial = createInfinidrillGame(runtime);
    const game = { ...initial, equippedUpgradeIds: { ...initial.equippedUpgradeIds, head: tier ? `head-${tier}` : 'starter-head', accessory: 'accessory-4' }, input: String(initial.currentQuestion!.answer) };
    const next = infinidrillReducer(game, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
    const radius = 1 + Math.ceil(tier / 2);
    for (const step of next.lastEvent.laser!.steps!) assert.ok(side < .5 ? step.right < -radius : step.left > radius);
  }
});

test('subsequent digs cannot award previously laser-mined deposits twice', () => {
  const runtime = { random: () => 0, now: () => 1000 };
  let game = createInfinidrillGame(runtime);
  game = { ...game, worldSeed: 0, equippedUpgradeIds: { ...game.equippedUpgradeIds, accessory: 'accessory-4' } };
  const earned = new Set<string>();
  for (let i = 0; i < 4; i++) {
    game = infinidrillReducer({ ...game, input: String(game.currentQuestion!.answer) }, { type: 'submit-answer', questionId: game.currentQuestion!.id }, runtime);
    for (const item of game.lastEvent.deposits ?? []) {
      const key = `${item.row}:${item.column}`;
      assert.equal(earned.has(key), false, 'Each deposit awarded once');
      earned.add(key);
    }
  }
  assert.equal(earned.size, game.resources.crystals + game.resources.nuggets);
  assert.ok(earned.size > 0);
});

test('stashed and unequipped accessories cannot fire, wrong answers cannot dig, and upgrades respect level gates', () => {
  const runtime = { random: () => 0, now: () => 1000 };
  const initial = createInfinidrillGame(runtime);
  const stashed = { ...initial, ownedUpgradeIds: ['accessory-4'], input: String(initial.currentQuestion!.answer) };
  const next = infinidrillReducer(stashed, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
  assert.equal(next.lastEvent.laser, undefined);
  const wrong = infinidrillReducer({ ...stashed, input: String(initial.currentQuestion!.answer + 1) }, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
  assert.equal(wrong.depthBlocks, 0);
  assert.equal(wrong.lastEvent.laser, undefined);
  const boundary = infinidrillReducer({ ...stashed, depthBlocks: 19.5, depthMetres: 117, equippedUpgradeIds: { ...initial.equippedUpgradeIds, accessory: 'accessory-4', cabin: 'cabin-4', engine: 'engine-4', treads: 'treads-4' } }, { type: 'submit-answer', questionId: initial.currentQuestion!.id }, runtime);
  assert.equal(boundary.depthBlocks, 20);
  assert.equal(boundary.level, 1, 'More digging does not skip first-try mastery');
  assert.equal(boundary.lastEvent.laser, undefined, 'Laser cannot blast into an unmastered next layer');
});
