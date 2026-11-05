import assert from 'node:assert/strict';
import test from 'node:test';
import { generateInfinidrillCard, selectInfinidrillQuestion } from '../src/infinidrill/questions-config.ts';
import { equationCard, evaluate, withBlank } from '../src/questions/equation.ts';
import { choiceResponse, numericChoices, numericChoiceResponse } from '../src/questions/choices.ts';
import { compareChoiceResponse, compareCard } from '../src/questions/compare.ts';
import { DIFFICULTY_LADDER, enumerateLevelCards } from '../src/questions/ladder.ts';
import { gradeQuestion, makeQuestion, questionKey } from '../src/questions/identity.ts';
import { ANIMAL_CATALOG, pictureCard, pictureChoices } from '../src/questions/picture.ts';
import { publicQuestion } from '../src/questions/projection.ts';
import { selectQuestion } from '../src/questions/select.ts';
import type { Card, EquationCard, LevelId, RandomSource } from '../src/questions/types.ts';

function seeded(seed: number): RandomSource {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = (value + Math.imul(value ^ value >>> 7, 61 | value)) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function keys(cards: Iterable<Card>): Set<string> {
  return new Set([...cards].map(questionKey));
}

test('InfiniDrill stage mapping uses the shared finite pools', () => {
  const mapping: readonly [LevelId, number][] = [
    ['add-1d', 1], ['sub-1d', 2], ['add-chain-1d', 3], ['sub-chain-1d', 4], ['mixed-chain-1d', 5],
    ['addsub-2d1d', 6], ['addsub-2d1d-regroup', 7], ['add-2d', 8], ['sub-2d', 9], ['chain-2d-3', 10],
    ['chain-2d-4', 11], ['mul-1d', 12], ['mul-teens-small', 13], ['addsub-3d1d', 15], ['addsub-3d2d', 16],
    ['chain-3d-3', 17], ['chain-3d-4', 18],
  ];
  for (const [id, stage] of mapping) {
    const card = generateInfinidrillCard(stage as Parameters<typeof generateInfinidrillCard>[0], () => 0.4);
    assert.equal(card?.kind, 'equation');
    assert.ok(card);
    if (id.startsWith('chain-')) {
      assert.equal(card.kind, 'equation');
      const threeDigit = id.startsWith('chain-3d');
      const count = id.endsWith('-3') ? 3 : 4;
      assert.equal(card.operands.length, count);
      const results = evaluate(card.operands, card.operators);
      assert.ok(results.every((value) => value >= (threeDigit ? 100 : 0) && value <= (threeDigit ? 999 : 99)));
    } else {
      assert.ok(keys(enumerateLevelCards(id)).has(questionKey(card)));
    }
  }
  const stage14 = [...enumerateLevelCards('mul-teens-large'), ...enumerateLevelCards('div-1d')];
  assert.ok(stage14.every((card) => card.kind === 'equation'));
});

test('InfiniDrill Venn stages use the shared small and large pools', () => {
  for (const [stage, id] of [[1, 'venn-small'], [3, 'venn-large']] as const) {
    const card = generateInfinidrillCard(stage, () => 0.1);
    assert.equal(card?.kind, 'venn');
    assert.ok(card && keys(enumerateLevelCards(id)).has(questionKey(card)));
  }
});

test('InfiniDrill question mix keeps Venn, operand blanks, and stage-14 operations unbiased', () => {
  for (const stage of [1, 2, 3, 6, 11] as const) {
    const random = seeded(stage * 101);
    let venn = 0;
    let equations = 0;
    let operandBlanks = 0;
    for (let sample = 0; sample < 2_000; sample += 1) {
      const card = generateInfinidrillCard(stage, random);
      assert.ok(card);
      if (card.kind === 'venn') { venn += 1; continue; }
      equations += 1;
      if (card.kind === 'equation' && card.blank !== 'result') operandBlanks += 1;
    }
    assert.ok(venn / 2_000 > 0.15 && venn / 2_000 < 0.25, `stage ${stage} Venn share ${venn / 2_000}`);
    assert.ok(operandBlanks / equations > 0.30 && operandBlanks / equations < 0.40, `stage ${stage} operand share ${operandBlanks / equations}`);
  }

  const random = seeded(14_000);
  let multiplication = 0;
  let division = 0;
  for (let sample = 0; sample < 2_000; sample += 1) {
    const card = generateInfinidrillCard(14, random);
    assert.equal(card?.kind, 'equation');
    if (card?.kind !== 'equation') continue;
    if (card.operators[0] === '×') multiplication += 1;
    if (card.operators[0] === '÷') division += 1;
  }
  assert.ok(multiplication / (multiplication + division) > 0.45 && multiplication / (multiplication + division) < 0.55);
});

test('InfiniDrill constant-random selection does not repeat add-2d, mul-1d, or chain-3d-4 cards', () => {
  for (const [stage, count] of [[8, 30], [12, 30], [18, 30] ] as const) {
    const seen = new Set<string>();
    for (let sample = 0; sample < count; sample += 1) {
      const question = selectInfinidrillQuestion(stage, () => 0, seen);
      assert.ok(question, `stage ${stage} exhausted too early`);
      assert.equal(seen.has(question.key), false, `stage ${stage} repeated ${question.key}`);
      seen.add(question.key);
    }
  }
});

test('large chain generators and strided enumeration obey every chain rule and operator pattern', () => {
  const cases = [
    { id: 'chain-2d-3' as const, count: 3, firstMin: 20, firstMax: 79, operandMin: 0, operandMax: 99, resultMin: 0, resultMax: 99 },
    { id: 'chain-2d-4' as const, count: 4, firstMin: 20, firstMax: 79, operandMin: 0, operandMax: 99, resultMin: 0, resultMax: 99 },
    { id: 'chain-3d-3' as const, count: 3, firstMin: 100, firstMax: 899, operandMin: 10, operandMax: 99, resultMin: 100, resultMax: 999 },
    { id: 'chain-3d-4' as const, count: 4, firstMin: 100, firstMax: 899, operandMin: 10, operandMax: 99, resultMin: 100, resultMax: 999 },
  ];
  for (const rule of cases) {
    const patterns = new Set<string>();
    const check = (card: Card) => {
      assert.equal(card.kind, 'equation');
      if (card.kind !== 'equation') return;
      assert.equal(card.operands.length, rule.count);
      assert.ok(card.operands[0]! >= rule.firstMin && card.operands[0]! <= rule.firstMax);
      assert.ok(card.operands.slice(1).every((operand) => operand >= rule.operandMin && operand <= rule.operandMax));
      const results = evaluate(card.operands, card.operators);
      assert.ok(results.every((result) => result >= rule.resultMin && result <= rule.resultMax));
      if (rule.id.startsWith('chain-2d')) {
        assert.ok(card.operands.slice(1).some((operand) => operand < 10));
        assert.ok(card.operands.slice(1).some((operand) => operand >= 10));
      }
      patterns.add(card.operators.join(','));
    };
    for (let seed = 0; seed < 4000; seed += 1) check(DIFFICULTY_LADDER.find((entry) => entry.id === rule.id)!.generator(seeded(seed)));
    assert.equal(patterns.size, 2 ** (rule.count - 1));
    const enumeration = enumerateLevelCards(rule.id);
    for (let index = 0; index < 20000; index += 1) {
      const next = enumeration.next();
      if (next.done) break;
      if (index % 997 === 0) check(next.value);
    }
  }
});

test('new exact pools cover addsub-20, mul-2to5, count-10 and compare-100', () => {
  const addsub = [...enumerateLevelCards('addsub-20')].filter((card) => card.kind === 'equation');
  assert.equal(addsub.length, 462);
  assert.ok(addsub.every((card) => card.operands[0]! + (card.operators[0] === '+' ? card.operands[1]! : 0) <= 20));
  assert.equal([...enumerateLevelCards('mul-2to5')].length, 16);
  assert.equal([...enumerateLevelCards('count-10')].length, 10);
  assert.equal([...enumerateLevelCards('compare-100')].length, 99 * 99);
});

test('all sampled generators produce members of their finite enumeration', () => {
  for (const entry of DIFFICULTY_LADDER) {
    const known = new Set<string>();
    if (entry.id !== 'chain-2d-4' && entry.id !== 'chain-3d-3' && entry.id !== 'chain-3d-4') for (const card of entry.enumerate()) known.add(questionKey(card));
    for (let seed = 0; seed < 80; seed += 1) {
      const card = entry.generator(seeded(seed));
      if (known.size > 0) assert.equal(known.has(questionKey(card)), true, `${entry.id} generated an unenumerated card`);
    }
  }
});

test('operator filters affect generation and enumeration', () => {
  const additions = [...enumerateLevelCards('addsub-20', { operators: ['+'] })];
  assert.ok(additions.length > 0 && additions.every((card) => card.kind === 'equation' && card.operators.every((operator) => operator === '+')));
  assert.equal([...enumerateLevelCards('addsub-20', { operators: ['×'] })].length, 0);
  for (const random of [() => 0, () => 0.999999]) {
    const card = DIFFICULTY_LADDER.find((entry) => entry.id === 'addsub-2d1d')!.generator(random, { operators: ['+'] });
    assert.equal(card.kind === 'equation' ? card.operators[0] : null, '+');
  }
});

test('constant random sources generate every ladder level and blank any selects a solvable blank', () => {
  for (const entry of DIFFICULTY_LADDER) for (const random of [() => 0, () => 0.999999]) {
    assert.doesNotThrow(() => entry.generator(random));
    assert.doesNotThrow(() => entry.generator(random, { blank: 'any' }));
    assert.doesNotThrow(() => selectQuestion(entry.id, random, new Set()));
  }
  const blanked = [...enumerateLevelCards('mul-1d', { blank: 0 })];
  assert.ok(blanked.length > 0 && blanked.every((card) => card.kind === 'equation' && card.blank === 0));
  const anyBlank = [...enumerateLevelCards('mul-1d', { blank: 'any' })];
  assert.ok(anyBlank.length > 0 && anyBlank.every((card) => card.kind === 'equation' && card.blank !== 'result'));
});

test('identity ignores blanks and commutative order but preserves subtraction and division order', () => {
  const plus = generateInfinidrillCard(1, () => 0.4);
  assert.equal(plus?.kind, 'equation');
  if (plus?.kind !== 'equation') return;
  assert.equal(questionKey({ kind: 'equation', level: 'add-1d', operands: plus.operands, operators: ['+'], blank: 'result' }), questionKey({ kind: 'equation', level: 'add-1d', operands: [...plus.operands].reverse(), operators: ['+'], blank: 0 }));
  assert.notEqual(questionKey({ kind: 'equation', level: 'sub-1d', operands: [4, 3], operators: ['−'], blank: 'result' }), questionKey({ kind: 'equation', level: 'sub-1d', operands: [3, 4], operators: ['−'], blank: 'result' }));
  assert.notEqual(questionKey({ kind: 'equation', level: 'div-1d', operands: [6, 3], operators: ['÷'], blank: 'result' }), questionKey({ kind: 'equation', level: 'div-1d', operands: [3, 6], operators: ['÷'], blank: 'result' }));
});

test('withBlank returns only uniquely solvable nonnegative equations', () => {
  const samples: EquationCard[] = [];
  for (const id of ['add-1d', 'sub-1d', 'add-chain-1d', 'mixed-chain-1d', 'mul-1d', 'mul-teens-large', 'div-1d', 'chain-3d-3'] as const) {
    const entry = DIFFICULTY_LADDER.find((candidate) => candidate.id === id)!;
    for (let seed = 0; seed < 24; seed += 1) samples.push(entry.generator(seeded(seed)) as EquationCard);
  }
  for (const card of samples) for (let position = 0; position < card.operands.length; position += 1) {
    const blank = withBlank(card, position);
    if (!blank) continue;
    const target = evaluate(card.operands, card.operators).at(-1)!;
    const solutions: number[] = [];
    for (let candidate = 0; candidate <= 1000; candidate += 1) {
      const operands = [...card.operands]; operands[position] = candidate;
      try { if (evaluate(operands, card.operators).at(-1) === target) solutions.push(candidate); } catch { /* invalid divisor */ }
    }
    assert.deepEqual(solutions, [card.operands[position]!]);
  }
});

test('invalid equations and unsafe blanks are rejected', () => {
  assert.throws(() => equationCard('sub-1d', [3, 5], ['−']));
  assert.throws(() => equationCard('div-1d', [7, 2], ['÷']));
  assert.throws(() => equationCard('chain-2d-3', [1, 2, 2], ['+', '÷']));
  assert.equal(withBlank({ kind: 'equation', level: 'mul-1d', operands: [0, 2], operators: ['×'], blank: 'result' }, 1), null);
  assert.equal(withBlank({ kind: 'equation', level: 'div-1d', operands: [0, 2], operators: ['÷'], blank: 'result' }, 1), null);
  assert.ok(withBlank({ kind: 'equation', level: 'div-1d', operands: [6, 3], operators: ['÷'], blank: 'result' }, 1));
});

test('numeric choices are deterministic, distinct, nonnegative and include the answer', () => {
  for (const answer of [0, 3, 17, 99]) {
    const left = numericChoices(answer, { count: 5, min: 0, max: 100, random: seeded(answer) });
    const right = numericChoices(answer, { count: 5, min: 0, max: 100, random: seeded(answer) });
    assert.deepEqual(left, right);
    assert.equal(new Set(left).size, 5); assert.ok(left.includes(answer)); assert.ok(left.every((value) => value >= 0));
  }
});

test('numeric choice edge cases and choice responses are covered', () => {
  const zero = numericChoices(0, { count: 3, min: 0, max: 5, random: () => 0.999999 });
  assert.equal(new Set(zero).size, 3); assert.ok(zero.includes(0)); assert.ok(zero.every((value) => value >= 0));
  assert.throws(() => numericChoices(2, { count: 3, min: 3, max: 5, random: () => 0 } ), RangeError);
  assert.throws(() => numericChoices(2, { count: 4, min: 1, max: 3, random: () => 0 } ), RangeError);
  const response = choiceResponse(7, [6, 8], () => 0.5);
  assert.equal(response.choices[response.correct], '7');
  const numericResponse = numericChoiceResponse(0, { count: 3, min: 0, max: 5, random: () => 0 });
  assert.equal(numericResponse.choices[numericResponse.correct], '0');
  const compareResponse = compareChoiceResponse(compareCard(2, 8), () => 0.999999);
  assert.deepEqual(compareResponse.choices, ['<', '=', '>']);
  const picturePositions = new Set<number>();
  for (let seed = 0; seed < 12; seed += 1) {
    const choices = pictureChoices('rabbit', 'en', seeded(seed));
    picturePositions.add(choices.indexOf(ANIMAL_CATALOG.rabbit.en));
  }
  assert.ok(picturePositions.size > 1);
});

test('selectQuestion exhausts a small level without repeats and returns null with constant random', () => {
  const seen = new Set<string>();
  for (let count = 0; count < 10; count += 1) {
    const card = selectQuestion('count-10', () => 0, seen)!;
    assert.ok(card); assert.equal(seen.has(questionKey(card)), false); seen.add(questionKey(card));
  }
  assert.equal(selectQuestion('count-10', () => 0, seen), null);
});

test('selectQuestion applies filters during random attempts and enumeration fallback', () => {
  const selected = selectQuestion('count-10', () => 0, new Set(), { filter: (card) => card.kind === 'counting' && card.count > 5 });
  assert.equal(selected?.kind, 'counting');
  assert.ok(selected?.kind === 'counting' && selected.count > 5);
  assert.equal(selectQuestion('mul-1d', () => 0, new Set(), { operators: ['+'] }), null);
});

test('publicQuestion strips private answer, grading, operands, intermediate results and key', () => {
  const equation = makeQuestion({ kind: 'equation', level: 'add-1d', operands: [4, 3], operators: ['+'], blank: 0 }, 'private-id');
  const projected = JSON.stringify(publicQuestion(equation));
  for (const forbidden of ['"answer"', '"correct"', '"key"', '"intermediateResults"', '"operands"']) assert.equal(projected.includes(forbidden), false, forbidden);
  assert.equal(projected.includes(equation.key), false);
  assert.equal(projected.includes('4'), false, 'the hidden operand must not leak through the opaque id or projection');
  const parsed = publicQuestion(equation);
  assert.deepEqual(parsed.card.kind === 'equation' ? parsed.card.values : [], [null, 3]);
  assert.deepEqual(parsed.card.kind === 'equation' ? parsed.card.result : null, 7);
  const choiceProjection = publicQuestion(makeQuestion({ kind: 'equation', level: 'add-1d', operands: [4, 3], operators: ['+'], blank: 0 }, 'private-choice', { mode: 'choice', choices: ['4', '5', '7'], correct: 2 }));
  assert.equal(JSON.stringify(choiceProjection).includes('"correct"'), false);
});

test('every public kind keeps display data but strips grading fields and hidden identity', () => {
  const questions = [
    makeQuestion({ kind: 'venn', level: 'venn-small', regions: { leftOnly: 1, shared: 1, rightOnly: 0 }, target: 'shared', friend: 'star', items: [{ region: 'leftOnly', pink: true, kind: 'capybara' }, { region: 'shared', pink: true, kind: 'star' }] }, 'opaque-venn'),
    makeQuestion({ kind: 'counting', level: 'count-10', count: 4, picture: 'star' }, 'opaque-count'),
    makeQuestion({ kind: 'compare', level: 'compare-100', left: 2, right: 8 }, 'opaque-compare'),
    makeQuestion(pictureCard('rabbit'), 'opaque-picture', { mode: 'choice', choices: ['Rabbit', 'Cat', 'Dog'], correct: 0 }),
  ];
  for (const question of questions) {
    const json = JSON.stringify(publicQuestion(question));
    for (const forbidden of ['"answer"', '"correct"', '"key"', '"regions"']) assert.equal(json.includes(forbidden), false, `${question.card.kind}:${forbidden}`);
  }
  const picture = makeQuestion(pictureCard('rabbit'), 'opaque-picture', { mode: 'choice', choices: ['Rabbit', 'Cat', 'Dog'], correct: 0 });
  const publicPicture = publicQuestion(picture);
  const publicCounting = publicQuestion(questions[1]!);
  assert.equal(publicPicture.card.kind === 'picture' ? publicPicture.card.subject : null, 'rabbit');
  assert.equal(publicCounting.card.kind === 'counting' ? publicCounting.card.count : null, 4);
});

test('choice grading uses the submitted index while typed grading uses the private answer', () => {
  const choice = makeQuestion({ kind: 'compare', level: 'compare-100', left: 2, right: 8 }, 'opaque-choice', { mode: 'choice', choices: ['<', '=', '>'], correct: 0 });
  const typed = makeQuestion({ kind: 'picture', level: 'picture-animals', subject: 'rabbit' }, 'opaque-typed');
  assert.equal(gradeQuestion(choice, 0), true);
  assert.equal(gradeQuestion(choice, '<'), false);
  assert.equal(gradeQuestion(typed, 'rabbit'), true);
  assert.equal(gradeQuestion(typed, 'Rabbit'), false);
  assert.equal(ANIMAL_CATALOG.rabbit.en, 'Rabbit');
  assert.equal(pictureChoices('rabbit', 'vi', () => 0).length, 3);
});
