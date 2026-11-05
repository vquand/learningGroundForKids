import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, emptyProgress, normalizeProgress, publicState, startSession, type Progress } from '../src/math-wall/game.js';
import { generateQuestion, questionKey, selectQuestion, type Question } from '../src/math-wall/questions.js';
import { equationCard } from '../src/questions/equation.js';
import { enumerateLevelCards } from '../src/questions/ladder.js';
import { stableRepairRandom } from '../src/math-wall/repository.js';

function random(seed: number) {
  return (n: number) => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return Math.floor(((t ^ t >>> 14) >>> 0) / 4294967296 * n);
  };
}
const settings = { animal: 'cow', language: 'en', wall: 'brick' } as const;
const midpoint = (n: number) => Math.floor(n / 2);
function lane(question: Question): number {
  assert.equal(question.response.mode, 'choice');
  return question.response.correct;
}
function choices(question: Question): readonly string[] {
  assert.equal(question.response.mode, 'choice');
  return question.response.choices;
}
function answer(question: Question): number {
  assert.equal(typeof question.answer, 'number');
  return question.answer as number;
}
function isCounting(question: Question): boolean { return question.card.kind === 'counting'; }
function isSimple(question: Question): boolean {
  return question.card.kind === 'equation'
    && question.card.operators.every((operator) => operator === '+' || operator === '−')
    && question.card.operands.some((operand) => operand < 2);
}

test('counting is about 20% of easy questions; 0/1 operands are about 10% where available', () => {
  let easyCounting = 0;
  let mediumCounting = 0;
  let hardCounting = 0;
  let easyArithmetic = 0;
  let easySimple = 0;
  let mediumArithmetic = 0;
  let mediumSimple = 0;
  for (const [difficulty, record] of [['easy', 'easy'], ['medium', 'medium'], ['hard', 'hard']] as const) {
    const pick = random(12345);
    for (let i = 0; i < 12000; i += 1) {
      const q = generateQuestion(difficulty, pick);
      if (isCounting(q)) {
        if (record === 'easy') easyCounting++;
        if (record === 'medium') mediumCounting++;
        if (record === 'hard') hardCounting++;
        continue;
      }
      assert.equal(q.card.kind, 'equation');
      assert.equal(q.card.blank, 'result');
      assert.equal(choices(q)[lane(q)], String(answer(q)));
      assert.equal(new Set(choices(q)).size, 3);
      if (record === 'easy') { easyArithmetic++; if (isSimple(q)) easySimple++; }
      if (record === 'medium') { mediumArithmetic++; if (isSimple(q)) mediumSimple++; }
    }
  }
  assert.ok(easyCounting / 12000 > .18 && easyCounting / 12000 < .22, `counting frequency: ${easyCounting / 12000}`);
  assert.equal(mediumCounting, 0);
  assert.equal(hardCounting, 0);
  assert.ok(easySimple / easyArithmetic > .08 && easySimple / easyArithmetic < .12, `easy simple operand frequency: ${easySimple / easyArithmetic}`);
  assert.ok(mediumSimple / mediumArithmetic > .08 && mediumSimple / mediumArithmetic < .12, `medium simple operand frequency: ${mediumSimple / mediumArithmetic}`);
});

test('question identity ignores choices, difficulty and reversed addition/multiplication', () => {
  for (const operator of ['+', '×'] as const) {
    assert.equal(questionKey(equationCard('add-1d', [3, 4], [operator])), questionKey(equationCard('add-2d', [4, 3], [operator])));
  }
  assert.notEqual(questionKey(equationCard('sub-1d', [4, 3], ['−'])), questionKey(equationCard('sub-2d', [8, 3], ['−'])));
  assert.notEqual(questionKey(equationCard('add-1d', [3, 4], ['+'])), questionKey(equationCard('add-1d', [3, 5], ['+'])));
});

test('a long session never repeats, including deterministic random collisions, pause and saved JSON reload', () => {
  let p: Progress = startSession(emptyProgress(), settings, 1000, midpoint);
  const seen = new Set<string>();
  for (let wave = 0; wave < 500; wave += 1) {
    const q = p.session!.question;
    assert.equal(seen.has(q.key), false, `repeated ${q.key}`);
    seen.add(q.key);
    assert.equal(p.session!.seenQuestions!.length, wave + 1);
    p = applyAction(p, { type: 'lane', lane: lane(q) }, p.session!.deadline - 1, midpoint);
    p = applyAction(p, { type: 'settle' }, p.session!.deadline, midpoint);
    if (wave === 100) {
      p = applyAction(p, { type: 'pause' }, p.session!.deadline - 1, midpoint);
      p = JSON.parse(JSON.stringify(p));
      p = applyAction(p, { type: 'resume' }, 10000000, midpoint);
    }
    p = applyAction(p, { type: 'next' }, p.session!.deadline, midpoint);
  }
  assert.equal('seenQuestions' in publicState(p, 0).session!, false, 'history stays server-owned');
  p = applyAction(p, { type: 'finish' }, p.session!.deadline - 1, midpoint);
  p = startSession(p, settings, 100000000, midpoint);
  assert.equal(p.session!.seenQuestions!.length, 1, 'replay gets a fresh question history');
});

test('correct-answer lanes never repeat three times, even across saved pauses and fixed random choices', () => {
  for (const pick of [() => 0, midpoint, (n: number) => n - 1, random(78)]) {
    let p = startSession(emptyProgress(), settings, 1000, pick);
    const lanes: number[] = [];
    for (let wave = 0; wave < 120; wave += 1) {
      const q = p.session!.question;
      lanes.push(lane(q));
      if (lanes.length >= 3) assert.ok(new Set(lanes.slice(-3)).size > 1, `three walls in lane ${lane(q)}`);
      p = applyAction(p, { type: 'lane', lane: lane(q) }, p.session!.deadline - 1, pick);
      p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
      if (wave % 2 === 0) {
        p = applyAction(p, { type: 'pause' }, p.session!.deadline - 1, pick);
        p = applyAction(JSON.parse(JSON.stringify(p)), { type: 'resume' }, p.session!.deadline + 1000, pick);
      }
      p = applyAction(p, { type: 'next' }, p.session!.deadline, pick);
      assert.deepEqual(p.session!.recentCorrectLanes, [lanes.at(-1)!, lane(p.session!.question)].slice(-2));
    }
    assert.equal('recentCorrectLanes' in publicState(p, 0).session!, false);
  }
});

test('an older saved session still excludes its current question from the next wave', () => {
  let p = startSession(emptyProgress(), settings, 1000, midpoint);
  const original = p.session!.question.key;
  delete p.session!.seenQuestions;
  p = applyAction(p, { type: 'lane', lane: lane(p.session!.question) }, p.session!.deadline - 1, midpoint);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, midpoint);
  p = applyAction(p, { type: 'next' }, p.session!.deadline, midpoint);
  assert.notEqual(p.session!.question.key, original);
  assert.equal(p.session!.seenQuestions!.length, 2);
});

test('the same broken saved Math Wall question repairs to the same replacement', () => {
  const broken = {
    ...emptyProgress(),
    session: {
      ...settings,
      phase: 'playing' as const,
      pausedFrom: 'playing' as const,
      remaining: 0,
      deadline: 10000,
      lane: 1,
      wave: 4,
      score: 0,
      streak: 0,
      difficulty: 'medium' as const,
      question: { id: 'broken', notAQuestion: true },
      result: null,
      cooldown: false,
    },
  } as unknown as Progress;
  const first = normalizeProgress(broken, stableRepairRandom(broken));
  const second = normalizeProgress(broken, stableRepairRandom(broken));
  assert.deepEqual(second, first);
});

test('an exhausted curriculum returns no question instead of repeating or retrying forever', () => {
  const seen = new Set<string>();
  for (let n = 1; n <= 10; n += 1) seen.add(`count:${n}`);
  for (let a = 0; a <= 9; a += 1) for (let b = 0; b + a <= 9; b += 1) seen.add(questionKey(equationCard('add-1d', [a, b], ['+'])));
  for (const level of ['addsub-20', 'add-2d', 'sub-2d', 'mul-1d'] as const) for (const card of enumerateLevelCards(level, { blank: 'result' })) seen.add(questionKey(card));
  assert.equal(selectQuestion('easy', () => 0, seen, 'waddle-question-1'), null);
  seen.delete(questionKey(equationCard('add-1d', [4, 5], ['+'])));
  const remaining = selectQuestion('easy', () => 0, seen, 'waddle-question-2');
  assert.equal(remaining?.card.kind, 'equation');
  assert.deepEqual(remaining?.card.kind === 'equation' ? remaining.card.operands : null, [4, 5]);
});
