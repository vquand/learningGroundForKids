import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, emptyProgress, publicState } from '../src/infinidrill/progress.ts';
import { generateInfinidrillCard, generateInfinidrillQuestion } from '../src/infinidrill/questions-config.ts';
import { evaluate, equationAnswer, withBlank } from '../src/questions/equation.ts';
import { vennAnswer, vennCard } from '../src/questions/venn.ts';
import { makeQuestion } from '../src/questions/identity.ts';
import type { EquationCard } from '../src/questions/types.ts';
import type { InfinidrillQuestion } from '../src/infinidrill/types.ts';

function seeded(seed = 37) { let value = seed; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32; }; }

test('missing operands have exactly one nonnegative whole-number solution', () => {
  const random = seeded(); let tested = 0;
  for (let level = 1; level <= 18; level++) for (let sample = 0; sample < 50; sample++) {
    const question = generateInfinidrillQuestion(level as Parameters<typeof generateInfinidrillQuestion>[0], random);
    if (question.card.kind !== 'equation' || question.card.blank === 'result') continue;
    const card = question.card;
    if (card.blank === 'result') continue;
    const blank = card.blank;
    const target = evaluate(card.operands, card.operators).at(-1);
    const solutions: number[] = [];
    for (let value = 0; value <= 999; value++) {
      const operands = card.operands.map((operand, index) => index === blank ? value : operand);
      try { if (evaluate(operands, card.operators).at(-1) === target) solutions.push(value); } catch { /* invalid divisor */ }
    }
    assert.deepEqual(solutions, [card.operands[blank]], question.key); tested++;
  }
  assert.ok(tested > 150);
});

test('multiplication bounds cover all three difficulty bands without two zero factors', () => {
  const random = seeded(); let hard = 0;
  for (let index = 0; index < 500; index++) for (const stage of [12, 13, 14] as const) {
    const card = generateInfinidrillCard(stage, random);
    if (!card || card.kind !== 'equation' || card.operators[0] !== '×') continue;
    const [left, right] = card.operands as [number, number];
    assert.ok(left >= (stage === 12 ? 0 : 10) && left <= (stage === 12 ? 9 : 19));
    assert.ok(right >= (stage === 12 ? 0 : stage === 13 ? 1 : 6) && right <= (stage === 12 ? 9 : stage === 13 ? 5 : 10));
    assert.ok(left !== 0 || right !== 0); if (stage === 14) hard++;
  }
  assert.ok(hard > 150);
  const zero = generateInfinidrillCard(12, () => 0);
  assert.equal(zero?.kind === 'equation' ? withBlank(zero, 1) : null, null, '0 × ? = 0 is ambiguous');
});

test('Venn membership and every target count include shared friends exactly once', () => {
  const random = seeded(), targets = new Set<string>(), friends = new Set<string>();
  for (let index = 0; index < 500; index++) {
    const card = vennCard(6, random, 'venn-large'); targets.add(card.target); friends.add(card.friend);
    const left = card.items.filter((item) => item.pink), right = card.items.filter((item) => item.kind === card.friend);
    const counts = { leftOnly: left.filter((item) => item.kind !== card.friend).length, shared: left.filter((item) => item.kind === card.friend).length, rightOnly: right.filter((item) => !item.pink).length, left: left.length, right: right.length, union: card.items.length };
    assert.equal(vennAnswer(card), counts[card.target]); assert.ok(card.items.length <= 18);
    for (const item of card.items) assert.equal(item.region, item.pink ? item.kind === card.friend ? 'shared' : 'leftOnly' : 'rightOnly');
  }
  assert.equal(targets.size, 6); assert.equal(friends.size, 6);
});

test('public variants hide solutions and persisted hidden operands, and grading stays authoritative', () => {
  const missingCard: EquationCard = { kind: 'equation', level: 'addsub-2d1d', operands: [24, 3], operators: ['+'], blank: 1 };
  const missing = makeQuestion(withBlank(missingCard, 1)!, 'missing');
  const venn = makeQuestion(vennCard(6, seeded(), 'venn-large'), 'venn');
  for (const question of [missing, venn]) {
    let p = applyCommand(emptyProgress(), { type: 'replay' }, 1000, { questionFactory: () => question as InfinidrillQuestion });
    const original = p.game!.currentQuestion!; const shown = publicState(p).game!.currentQuestion!;
    const serialized = JSON.stringify(shown);
    assert.equal(serialized.includes('answer'), false);
    assert.equal(serialized.includes('key'), false);
    if (question.card.kind === 'equation') {
      assert.equal(shown.card.kind, 'equation');
      if (shown.card.kind === 'equation') assert.equal(shown.card.values[1], null);
    } else {
      assert.equal(shown.card.kind, 'venn');
      if (shown.card.kind === 'venn') assert.equal(JSON.stringify(shown).includes('regions'), false);
    }
    const wrong = applyCommand(p, { type: 'submit-answer', questionId: original.id, answer: Number(original.answer) + 1 }, 1100);
    assert.equal(wrong.game!.mainQuestionsCompleted, 0);
    p = applyCommand(wrong, { type: 'submit-answer', questionId: original.id, answer: Number(original.answer) }, 1200);
    assert.equal(p.game!.mainQuestionsCompleted, 1);
    assert.throws(() => applyCommand(p, { type: 'submit-answer', questionId: original.id, answer: Number(original.answer) }, 1300), /already changed/);
  }
});
