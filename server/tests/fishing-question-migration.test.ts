import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson } from '../src/town-building/repository.js';
import { applyCommand, emptyProgress, normalizeProgress, publicState } from '../src/fishing/game.js';
import { stableRepairId, stableRepairRandom } from '../src/fishing/repository.js';
import { fromFishingQuestion, fishingSeenKey } from '../src/questions/legacy.js';
import { BAIT_LEVELS } from '../src/fishing/config.js';
import type { FishingProgress } from '../src/fishing/types.js';

const fixtures: readonly unknown[] = [
  { id: 'hidden-left', baitId: 'chewy', expression: '? − 4 = 5', layout: { values: [null, 4], operator: '−', result: 5 }, attempts: 2, answer: 9, operands: [9, 4] },
  { id: 'hidden-right', baitId: 'chewy', expression: '9 − ? = 5', layout: { values: [9, null], operator: '−', result: 5 }, attempts: 1, answer: 4, operands: [9, 4] },
  { id: 'hidden-result', baitId: 'baby', expression: '10 + 4 = ?', layout: { values: [10, 4], operator: '+', result: null }, attempts: 3, answer: 14, operands: [10, 4] },
  { id: 'text-only', baitId: 'baby', expression: '? + 4 = 14', attempts: 1 },
  { id: 'division', baitId: 'master', expression: '12 ÷ 3 = ?', attempts: 0, answer: 4, operands: [12, 3] },
  { id: 'subtraction', baitId: 'leafy', expression: '18 − ? = 9', attempts: 4, answer: 9, operands: [18, 9] },
];

test('Fishing legacy fixtures convert hidden positions, text-only equations, division and subtraction', () => {
  const expected = [[9, 4, 0], [9, 4, 1], [10, 4, 'result'], [10, 4, 0], [12, 3, 'result'], [18, 9, 1]] as const;
  fixtures.forEach((fixture, index) => {
    const question = fromFishingQuestion(fixture, BAIT_LEVELS);
    assert.ok(question, `fixture ${index} should convert`);
    if (!question || question.card.kind !== 'equation') return;
    assert.deepEqual(question.card.operands, expected[index]!.slice(0, 2));
    assert.equal(question.card.blank, expected[index]![2]);
    assert.equal(typeof question.answer, 'number');
  });
});

test('Fishing normalizes old seen keys and round-trips load-play-save-load without changing the issued question', () => {
  const legacy = emptyProgress();
  legacy.recentFacts = ['+:3:4', '−:9:4', '×:2:5', '÷:12:3'];
  (legacy as unknown as { question: unknown }).question = fixtures[2];
  const loaded = normalizeProgress(legacy, () => 0, () => 'issued');
  assert.deepEqual(loaded.recentFacts, ['+:3,4', '−:9,4', '×:2,5', '÷:12,3', '+:4,10']);
  assert.equal(loaded.question?.attempts, 3);
  const played = applyCommand(loaded, { type: 'answer', questionId: loaded.question!.id, answer: loaded.question!.question.answer as number }, 1, () => 0, () => 'next');
  const saved = structuredClone(played);
  const reloaded = normalizeProgress(saved, () => 0, () => 'different-id');
  assert.equal(canonicalJson(reloaded), canonicalJson(saved));
  assert.equal(publicState(reloaded, 1).question, null);
});

test('an unconvertible saved question repairs to the same hash-seeded question with reset attempts', () => {
  const broken = emptyProgress();
  broken.points.pond = 60;
  (broken as unknown as { question: unknown }).question = { id: 'old-id', baitId: 'chewy', expression: 'not an equation', attempts: 7, answer: 99, operands: [1] };
  const first = normalizeProgress(broken as FishingProgress, stableRepairRandom(broken), stableRepairId(broken));
  const second = normalizeProgress(broken as FishingProgress, stableRepairRandom(broken), stableRepairId(broken));
  assert.equal(canonicalJson(first.question), canonicalJson(second.question));
  assert.equal(first.question?.attempts, 0);
  assert.equal(first.question?.baitId, 'chewy');
  assert.notEqual(first.question?.id, 'old-id');
});

test('old fishing fact keys normalize to the shared identity, including commutative order', () => {
  assert.equal(fishingSeenKey('+:3:4'), '+:3,4');
  assert.equal(fishingSeenKey('×:5:2'), '×:2,5');
  assert.equal(fishingSeenKey('÷:12:3'), '÷:12,3');
  assert.equal(fishingSeenKey('bad'), null);
});
