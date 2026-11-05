import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, emptyProgress, publicState, type Progress } from '../src/infinidrill/progress.js';
import { INFINIDRILL_UPGRADES } from '../src/infinidrill/upgrades.ts';
const runtime = { random: () => 0 };
function answer(p: Progress, now = 1000) {
  return applyCommand(p, { type: 'submit-answer', questionId: p.game!.currentQuestion!.id, answer: Number(p.game!.currentQuestion!.answer) }, now, runtime);
}
test('wrong answers give no awards; first correct answer earns once and replay keeps its timestamp', () => {
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  p = applyCommand(p, { type: 'submit-answer', questionId: p.game!.currentQuestion!.id, answer: (Number(p.game!.currentQuestion!.answer) + 1) % 1000 }, 1000, runtime);
  assert.deepEqual(p.earned, {});
  assert.equal(p.game!.depthMetres, 0);
  p = answer(p, 2000);
  assert.deepEqual(Object.keys(p.earned), ['infinidrill-first-drill']);
  const earnedAt = p.earned['infinidrill-first-drill'];
  p = answer(applyCommand(p, { type: 'replay' }, 3000, runtime), 4000);
  assert.equal(p.earned['infinidrill-first-drill'], earnedAt);
});
test('public questions hide solutions and stale question IDs cannot award twice', () => {
  const p = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  const question = publicState(p).game!.currentQuestion!;
  assert.equal('answer' in question, false);
  assert.equal('key' in question, false);
  assert.throws(() => applyCommand(answer(p), { type: 'submit-answer', questionId: p.game!.currentQuestion!.id, answer: Number(p.game!.currentQuestion!.answer) }, 2000, runtime), /already changed/);
});
test('five fast first-try answers earn cave and depth badges; slow answers do not earn cave badge', () => {
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  for (let i = 1; i <= 5; i++) p = answer(p, i * 1000);
  assert.equal(p.game!.depthMetres, 120);
  assert.equal(p.caveFalls, 1);
  assert.ok(p.earned['infinidrill-cave-finder']);
  assert.ok(p.earned['infinidrill-first-layer']);
  let slow = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  for (let i = 1; i <= 5; i++) slow = answer(slow, i * 16000);
  assert.equal(slow.earned['infinidrill-cave-finder'], undefined);
});
test('bonus badge requires a correct bonus; invalid reward IDs and unaffordable purchases award no parts', () => {
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  for (let i = 1; i <= 7; i++) p = answer(p, i * 1000);
  p = applyCommand(p, { type: 'choose-challenge', choice: 'B' }, 8000, runtime);
  p = answer(p, 9000);
  assert.equal(p.bonusQuestionsCompleted, 1);
  assert.ok(p.earned['infinidrill-bonus-brave']);
  const invalid = applyCommand(p, { type: 'choose-upgrade-reward', upgradeId: 'made-up' }, 10000, runtime);
  assert.deepEqual(invalid.game!.ownedUpgradeIds, []);
  let broke = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  broke = applyCommand(broke, { type: 'open-workshop' }, 100, runtime);
  broke = applyCommand(broke, { type: 'purchase-upgrade', upgradeId: INFINIDRILL_UPGRADES[0]!.id }, 200, runtime);
  assert.deepEqual(broke.game!.ownedUpgradeIds, []);
});
test('full verified expedition earns answer, depth and core milestones; workshop collects 20 unique parts', () => {
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  let now = 0;
  while (p.game!.mode !== 'core') {
    now += 1000;
    p = p.game!.mode === 'challenge-choice' ? applyCommand(p, { type: 'choose-challenge', choice: 'A' }, now, runtime) : answer(p, now);
    assert.ok(now < 250000);
  }
  for (const id of ['infinidrill-ten-answers', 'infinidrill-fifty-answers', 'infinidrill-deep-digger', 'infinidrill-mantle-explorer', 'infinidrill-core-champion']) assert.ok(p.earned[id], id);
  assert.equal(p.game!.depthMetres, 2160);
  let workshop = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
  workshop = { ...workshop, game: { ...workshop.game!, resources: { crystals: 100000, nuggets: 100000 } } };
  workshop = applyCommand(workshop, { type: 'open-workshop' }, 0, runtime);
  for (const part of INFINIDRILL_UPGRADES) workshop = applyCommand(workshop, { type: 'purchase-upgrade', upgradeId: part.id }, 1000, runtime);
  assert.equal(workshop.game!.ownedUpgradeIds.length, 20);
  assert.ok(workshop.earned['infinidrill-workshop-master']);
});
