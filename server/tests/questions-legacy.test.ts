import assert from 'node:assert/strict';
import test from 'node:test';
import { fromFishingQuestion, fromInfinidrillQuestion, fromMathWallQuestion, fromRoadRacingQuestion, fishingSeenKey, mathWallSeenKey, questionKeyFromInfinidrill, roadRacingSeenKey } from '../src/questions/legacy.ts';
import { publicQuestion } from '../src/questions/projection.ts';
import { BAIT_LEVELS } from '../src/fishing/config.ts';

test('InfiniDrill legacy equation, missing operand, Venn question and key convert', () => {
  const equation = fromInfinidrillQuestion({ id: 'earth-6-24 + 3', level: 6, expression: '24 + 3', operands: [24, 3], operators: ['+'], answer: 27, intermediateResults: [27], layout: { values: [24, 3], result: null }, kind: 'mixed' });
  assert.equal(equation?.key, '+:3,24');
  assert.equal(equation?.card.level, 'addsub-2d1d');
  assert.equal(equation?.card.kind === 'equation' ? equation.card.blank : null, 'result');
  assert.equal(equation?.answer, 27);
  const missing = fromInfinidrillQuestion({ id: 'missing', level: 1, expression: '? + 3 = 7', operands: [4, 3], operators: ['+'], answer: 4, intermediateResults: [7], missingOperand: 0, layout: { values: [null, 3], result: 7 }, kind: 'addition' });
  assert.equal(missing?.key, '+:3,4');
  assert.equal(missing?.card.kind === 'equation' ? missing.card.blank : null, 0);
  assert.equal(missing?.answer, 4);
  const venn = fromInfinidrillQuestion({ id: 'venn', level: 2, operands: [1, 2, 0], operators: ['+', '+'], answer: 2, intermediateResults: [3, 3], venn: { target: 'left', friend: 'star', items: [{ region: 'leftOnly', kind: 'capybara', pink: true }, { region: 'shared', kind: 'star', pink: true }] } });
  assert.equal(venn?.key, 'venn:left:1,1,0');
  assert.equal(venn?.card.level, 'venn-small');
  assert.equal(venn?.answer, 2);
  assert.equal(fromInfinidrillQuestion({ level: 1, operands: [3, 5], operators: ['−'], answer: 0 }), null);
  assert.equal(questionKeyFromInfinidrill('+:24,3'), '+:3,24');
  assert.equal(questionKeyFromInfinidrill('venn:left:1,1,0'), 'venn:left:1,1,0');
  assert.equal(questionKeyFromInfinidrill('bad'), null);
});

test('InfiniDrill conversion is idempotent for new data and accepts a plain old equation shape', () => {
  const plain = fromInfinidrillQuestion({
    id: 'plain-old', level: 8, operands: [24, 35], operators: ['+'], answer: 59,
  });
  assert.ok(plain);
  assert.equal(plain.card.kind, 'equation');
  assert.deepEqual(fromInfinidrillQuestion(plain), plain);
  assert.equal(questionKeyFromInfinidrill(plain), plain.key);

  const missing = fromInfinidrillQuestion({
    id: 'missing-old', level: 1, operands: [4, 3], operators: ['+'], answer: 4,
    missingOperand: 0,
  });
  assert.ok(missing);
  assert.deepEqual(fromInfinidrillQuestion(missing), missing);

  const venn = fromInfinidrillQuestion({
    id: 'venn-old', level: 3, answer: 0,
    venn: { target: 'rightOnly', friend: 'star', items: [] },
  });
  assert.ok(venn);
  assert.deepEqual(fromInfinidrillQuestion(venn), venn);
});

test('legacy questions without IDs receive stable opaque handles', () => {
  const input = { level: 8, operands: [24, 35], operators: ['+'], answer: 59 };
  const first = fromInfinidrillQuestion(input);
  const second = fromInfinidrillQuestion(input);
  assert.ok(first && second);
  assert.equal(first.id, second.id);
  assert.match(first.id, /^earth-question-/);
  assert.equal(first.id.includes(first.key), false);
  assert.equal(first.id.includes('24'), false);
  assert.equal(first.id.includes('35'), false);
  const other = fromInfinidrillQuestion({ level: 8, operands: [25, 34], operators: ['+'], answer: 59 });
  assert.ok(other);
  assert.equal(other.id, first.id);
  assert.notEqual(other.key, first.key);
  assert.equal(first.id, 'earth-question-legacy-0');
});

test('Waddle Wall legacy questions and seen keys convert', () => {
  const counting = fromMathWallQuestion({ difficulty: 'easy', expression: '?', counting: 4, choices: [3, 4, 5], answer: 4, correctLane: 1 });
  assert.equal(counting?.key, 'count:4');
  assert.equal(counting?.card.level, 'count-10');
  assert.equal(counting?.answer, 4);
  const arithmetic = fromMathWallQuestion({ difficulty: 'hard', expression: '4 × 6', counting: null, choices: [22, 24, 26], answer: 24, correctLane: 1 });
  assert.equal(arithmetic?.key, '×:4,6');
  assert.equal(arithmetic?.card.kind === 'equation' ? arithmetic.card.blank : null, 'result');
  assert.equal(arithmetic?.answer, 24);
  assert.equal(mathWallSeenKey('count:4'), 'count:4');
  assert.equal(mathWallSeenKey('4+5'), '+:4,5');
  assert.equal(mathWallSeenKey('5−4'), '−:5,4');
  assert.equal(mathWallSeenKey('4×5'), '×:4,5');
  assert.equal(fromMathWallQuestion({ difficulty: 'medium', expression: '3 − 5', counting: null, choices: [0, 1, 2], answer: 0, correctLane: 0 }), null);
  const first = fromMathWallQuestion({ difficulty: 'easy', expression: '2 + 3', counting: null, choices: [4, 5, 6], answer: 5 });
  const second = fromMathWallQuestion({ difficulty: 'easy', expression: '4 + 1', counting: null, choices: [4, 5, 6], answer: 5 });
  assert.ok(first && second);
  assert.equal(first.id, second.id);
  assert.notEqual(first.key, second.key);
  assert.equal(first.id, 'waddle-question-legacy-0');
});

test('Road Racing legacy shapes and all seen-key families convert', () => {
  assert.equal(fromRoadRacingQuestion({ id: 'c1', kind: 'compare', numbers: [3, 8], choices: ['<', '=', '>'], correct: 0 })?.key, 'compare:3,8');
  const addition = fromRoadRacingQuestion({ id: 'a1', kind: 'arithmetic', values: [null, 3, 7], operator: '+', choices: ['3', '4', '5'], correct: 0 });
  assert.equal(addition?.key, '+:3,4');
  assert.equal(addition?.card.kind === 'equation' ? addition.card.blank : null, 0);
  assert.equal(addition?.answer, 4);
  const multiplication = fromRoadRacingQuestion({ id: 'm1', kind: 'arithmetic', values: [4, 6, null], operator: '×', choices: ['22', '24', '26'], correct: 1 });
  assert.equal(multiplication?.key, '×:4,6');
  assert.equal(multiplication?.card.kind === 'equation' ? multiplication.card.blank : null, 'result');
  assert.equal(multiplication?.answer, 24);
  const picture = fromRoadRacingQuestion({ id: 'p1', kind: 'picture', animal: 'rabbit', language: 'vi', choices: ['Thỏ', 'Mèo', 'Chó'], correct: 0 });
  assert.equal(picture?.key, 'picture:rabbit');
  assert.equal(picture?.answer, 'rabbit');
  assert.equal(picture?.response.mode === 'choice' ? picture.response.choices[picture.response.correct] : null, 'Thỏ');
  assert.equal(fromRoadRacingQuestion({ id: 'v1', kind: 'venn', venn: { leftOnly: 1, shared: 2, rightOnly: 0 }, target: 'shared', choices: ['1', '2', '3'], correct: 1 })?.key, 'venn:shared:1,2,0');
  assert.equal(roadRacingSeenKey('c:3:8'), 'compare:3,8');
  assert.equal(roadRacingSeenKey('a:13:3:true:0'), '−:13,3');
  assert.equal(roadRacingSeenKey('m:4:6'), '×:4,6');
  assert.equal(roadRacingSeenKey('p:rabbit'), 'picture:rabbit');
  assert.equal(roadRacingSeenKey('v:1:2:0:shared'), 'venn:shared:1,2,0');
  assert.equal(fromRoadRacingQuestion({ id: 'bad', kind: 'arithmetic', values: [3, 5, null], operator: '-', choices: ['0', '1', '2'], correct: 0 }), null);
  const first = fromRoadRacingQuestion({ kind: 'compare', numbers: [3, 8], choices: ['<', '=', '>'], correct: 0 });
  const second = fromRoadRacingQuestion({ kind: 'compare', numbers: [4, 9], choices: ['<', '=', '>'], correct: 0 });
  assert.ok(first && second);
  assert.equal(first.id, second.id);
  assert.notEqual(first.key, second.key);
  assert.equal(first.id, 'legacy-question-legacy-0');
  const currentFirst = fromRoadRacingQuestion({ card: { kind: 'compare', level: 'compare-100', left: 3, right: 8 }, response: { mode: 'choice', choices: ['<', '=', '>'], correct: 0 } });
  const currentSecond = fromRoadRacingQuestion({ card: { kind: 'compare', level: 'compare-100', left: 4, right: 9 }, response: { mode: 'choice', choices: ['<', '=', '>'], correct: 0 } });
  assert.ok(currentFirst && currentSecond);
  assert.equal(currentFirst.id, currentSecond.id);
  assert.notEqual(currentFirst.key, currentSecond.key);
  assert.equal(currentFirst.id, 'road-question-legacy-0');
});

test('Fishing legacy question and fact keys convert while projection stays private', () => {
  const question = fromFishingQuestion({ id: 'fish1', baitId: 'chewy', expression: '? − 8 = 12', layout: { values: [null, 8], operator: '−', result: 12 }, answer: 20, operands: [20, 8], attempts: 0 }, BAIT_LEVELS);
  assert.equal(question?.key, '−:20,8');
  assert.equal(question?.card.level, 'sub-2d');
  assert.equal(question?.card.kind === 'equation' ? question.card.blank : null, 0);
  assert.equal(question?.answer, 20);
  assert.equal(fishingSeenKey('×:4:6'), '×:4,6');
  assert.equal(fishingSeenKey('−:20:8'), '−:20,8');
  assert.equal('answer' in publicQuestion(question!), false);
  assert.equal(fromFishingQuestion({ baitId: 'chewy', operands: [3, 5], layout: { values: [3, 5], operator: '−', result: null }, answer: 0 }, BAIT_LEVELS), null);
  const first = fromFishingQuestion({ baitId: 'chewy', expression: '10 − 5 = ?', operands: [10, 5] }, BAIT_LEVELS);
  const second = fromFishingQuestion({ baitId: 'chewy', expression: '12 − 5 = ?', operands: [12, 5] }, BAIT_LEVELS);
  assert.ok(first && second);
  assert.equal(first.id, second.id);
  assert.notEqual(first.key, second.key);
  assert.equal(first.id, 'fishing-question-legacy-0');
});
