import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyProgress, startSession, applyAction, normalizeProgress, publicState, generateQuestion, difficultyWeights, type Progress } from '../src/math-wall/game.js';
import type { Question } from '../src/math-wall/questions.js';
const settings = { animal: 'cow', language: 'en', wall: 'brick' } as const;
const pick = (n: number) => Math.floor(n / 2);
const midpoint = pick;
function lane(question: Question): number { assert.equal(question.response.mode, 'choice'); return question.response.correct; }
function choices(question: Question): readonly string[] { assert.equal(question.response.mode, 'choice'); return question.response.choices; }
function answer(question: Question): number { assert.equal(typeof question.answer, 'number'); return question.answer as number; }

test('questions have one correct choice, bounded arithmetic and no negative subtraction', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    for (let seed = 0; seed < 100; seed++) {
      let x = seed + 1;
      const q = generateQuestion(difficulty, n => { x = (x * 1664525 + 1013904223) >>> 0; return x % n; });
      assert.equal(new Set(choices(q)).size, 3);
      assert.equal(choices(q)[lane(q)], String(answer(q)));
      assert.ok(answer(q) >= 0 && answer(q) <= (difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 99));
    }
  }
});
test('harder probabilities grow with progress and drop after a successful harder wall', () => {
  const initial = difficultyWeights(0, false);
  const later = difficultyWeights(30, false);
  const cooldown = difficultyWeights(30, true);
  assert.ok(later.hard > initial.hard);
  assert.ok(cooldown.hard < later.hard);
  assert.ok(cooldown.medium < later.medium);
});
test('deadline prevents early scoring; server awards points once and hides correct lane', () => {
  let p = startSession(emptyProgress(), settings, 1000, pick);
  assert.equal(publicState(p, 1000).session?.correctLane, null);
  assert.throws(() => applyAction(p, { type: 'settle' }, 2000, pick));
  p = applyAction(p, { type: 'lane', lane: lane(p.session!.question) }, 2000, pick);
  const deadline = p.session!.deadline;
  p = applyAction(p, { type: 'settle' }, deadline, pick);
  assert.equal(p.session!.score, p.session!.difficulty === 'easy' ? 1 : p.session!.difficulty === 'medium' ? 2 : 3);
  assert.equal(p.stats.passed, 1);
  assert.throws(() => applyAction(p, { type: 'settle' }, deadline, pick));
  assert.throws(() => applyAction(p, { type: 'lane', lane: 0 }, deadline, pick));
});
test('pause freezes wall time; resume preserves remaining time; finish and restart preserve personal best', () => {
  let p = startSession(emptyProgress(), settings, 1000, pick);
  const remaining = p.session!.deadline - 2000;
  p = applyAction(p, { type: 'pause' }, 2000, pick);
  assert.throws(() => applyAction(p, { type: 'lane', lane: 0 }, 90000, pick));
  p = applyAction(p, { type: 'resume' }, 90000, pick);
  assert.equal(p.session!.deadline, 90000 + remaining);
  p = applyAction(p, { type: 'lane', lane: lane(p.session!.question) }, 90001, pick);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
  const best = p.best;
  p = applyAction(p, { type: 'finish' }, p.session!.deadline + 1, pick);
  p = startSession(p, settings, 100000, pick);
  assert.equal(p.best, best);
  assert.equal(p.session!.score, 0);
  assert.ok(publicState(p, 100000).achievements.some(a => a.id === 'first' && a.earned));
});
test('wrong lane splashes, then ends the session without advancing to another wall', () => {
  let p = startSession(emptyProgress(), settings, 1000, pick);
  p = applyAction(p, { type: 'lane', lane: (lane(p.session!.question) + 1) % 3 }, 2000, pick);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
  assert.equal(p.session!.result, 'splash');
  assert.equal(p.session!.score, 0);
  assert.throws(() => applyAction(p, { type: 'next' }, p.session!.deadline - 1, pick));
  p = applyAction(p, { type: 'next' }, p.session!.deadline + 2400, pick);
  assert.equal(p.session!.wave, 1);
  assert.equal(p.session!.phase, 'finished');
  assert.throws(() => applyAction(p, { type: 'next' }, 100000, pick));
  assert.throws(() => applyAction(p, { type: 'resume' }, 100000, pick));
});
test('failure retains the stopped wall number, earned points, and best when replaying', () => {
  let p = startSession(emptyProgress(), settings, 1000, pick);
  for (let i = 0; i < 2; i++) {
    p = applyAction(p, { type: 'lane', lane: lane(p.session!.question) }, p.session!.deadline - 1, pick);
    p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
    p = applyAction(p, { type: 'next' }, p.session!.deadline, pick);
  }
  p = applyAction(p, { type: 'lane', lane: (lane(p.session!.question) + 1) % 3 }, p.session!.deadline - 1, pick);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
  p = applyAction(p, { type: 'next' }, p.session!.deadline, pick);
  assert.equal(p.session!.phase, 'finished');
  assert.equal(p.session!.wave, 3);
  assert.equal(p.session!.score, 2);
  assert.equal(p.best, 2);
  p = startSession(p, settings, 100000, pick);
  assert.equal(p.session!.wave, 1);
  assert.equal(p.session!.score, 0);
  assert.equal(p.best, 2);
});
test('pause and legacy paused failure recovery cannot resume a failed game', () => {
  let p = startSession(emptyProgress(), settings, 1000, pick);
  p = applyAction(p, { type: 'lane', lane: (lane(p.session!.question) + 1) % 3 }, 1001, pick);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
  assert.equal(applyAction(p, { type: 'pause' }, p.session!.deadline - 1000, pick).session!.phase, 'finished');
  p.session!.phase = 'paused'; p.session!.pausedFrom = 'resolved';
  assert.equal(applyAction(p, { type: 'resume' }, 100000, pick).session!.phase, 'finished');
});
test('medium and hard walls use their time allowances, points and lifetime badge counters', () => {
  for (const [difficulty, milliseconds, score] of [['medium', 15000, 2], ['hard', 20000, 3]] as const) {
    let p = startSession(emptyProgress(), settings, 1000, pick);
    p.session!.question = generateQuestion(difficulty, pick);
    p.session!.difficulty = difficulty;
    p.session!.lane = lane(p.session!.question);
    p.session!.deadline = 1000 + milliseconds;
    p = applyAction(p, { type: 'settle' }, 1000 + milliseconds, pick);
    assert.equal(p.best, score);
    assert.equal(p.stats[difficulty], 1);
    assert.equal(p.session!.cooldown, true);
    p = applyAction(p, { type: 'next' }, 1000 + milliseconds + 2200, () => 0);
    assert.equal(p.session!.difficulty, 'hard');
    assert.equal(p.session!.deadline, 1000 + milliseconds + 2200 + 20000);
  }
});
test('late lane changes cannot replace the locked answer; finishing settles an expired wall exactly once', () => {
  let p = startSession(emptyProgress(), settings, 1000, pick);
  const deadline = p.session!.deadline;
  p = applyAction(p, { type: 'lane', lane: lane(p.session!.question) }, deadline - 1, pick);
  assert.throws(() => applyAction(p, { type: 'lane', lane: 0 }, deadline, pick));
  p = applyAction(p, { type: 'finish' }, deadline, pick);
  assert.equal(p.best, 1);
  assert.equal(p.stats.passed, 1);
  assert.throws(() => applyAction(p, { type: 'settle' }, deadline + 1, pick));
});
test('session badges include only newly unlocked milestones, persist through finish, and reset on replay', () => {
  const prior = emptyProgress(); prior.stats.passed = 9;
  let p = startSession(prior, settings, 1000, pick);
  assert.deepEqual(publicState(p, 1000).session?.earnedBadges, []);
  p = applyAction(p, { type: 'lane', lane: lane(p.session!.question) }, 1001, pick);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
  assert.deepEqual(publicState(p, 11000).session?.earnedBadges.map(a => a.id), ['ten']);
  p = applyAction(p, { type: 'pause' }, 11001, pick);
  p = JSON.parse(JSON.stringify(p));
  assert.deepEqual(publicState(p, 11002).session?.earnedBadges.map(a => a.id), ['ten']);
  p = applyAction(p, { type: 'finish' }, 11003, pick);
  assert.deepEqual(publicState(p, 11003).session?.earnedBadges.map(a => a.id), ['ten']);
  p = startSession(p, settings, 20000, pick);
  assert.deepEqual(publicState(p, 20000).session?.earnedBadges, []);
  assert.deepEqual(publicState(p, 20000).achievements.filter(a => a.earned).map(a => a.id), ['first', 'ten']);
});
test('legacy sessions without badge-award tracking never label older collection badges as session awards', () => {
  const prior = emptyProgress(); prior.stats.passed = 10;
  const p = startSession(prior, settings, 1000, pick);
  delete p.session!.earnedBadges;
  assert.deepEqual(publicState(p, 1000).session?.earnedBadges, []);
  assert.equal(publicState(p, 1000).achievements.filter(a => a.earned).length, 2);
});
test('Math Scientist unlocks exactly on the tenth verified hard wall and survives replay', () => {
  const prior = emptyProgress(); prior.stats.hard = 9; prior.stats.passed = 9;
  let p = startSession(prior, settings, 1000, pick);
  const scientist = () => publicState(p, 1000).achievements.find(a => a.id === 'scientist');
  assert.equal(scientist()?.earned, false);
  p.session!.question = generateQuestion('hard', pick);
  p.session!.difficulty = 'hard';
  p.session!.lane = lane(p.session!.question);
  p = applyAction(p, { type: 'settle' }, p.session!.deadline, pick);
  assert.equal(scientist()?.name, 'Math Scientist');
  assert.equal(scientist()?.current, 10);
  assert.equal(scientist()?.earned, true);
  assert.equal(publicState(p, 0).session!.earnedBadges.filter(a => a.id === 'scientist').length, 1);
  assert.throws(() => applyAction(p, { type: 'settle' }, p.session!.deadline, pick));
  p = applyAction(p, { type: 'finish' }, p.session!.deadline, pick);
  p = startSession(p, settings, 100000, pick);
  assert.equal(scientist()?.earned, true);
  assert.deepEqual(publicState(p, 0).session!.earnedBadges, []);
});

test('legacy Waddle Wall shapes, including a paused save, load-play-save-load idempotently', () => {
  const legacy = {
    revision: 7,
    best: 4,
    stats: { passed: 4, medium: 1, hard: 0, streak: 2 },
    session: {
      ...settings,
      phase: 'paused' as const,
      pausedFrom: 'playing' as const,
      remaining: 5000,
      deadline: 10000,
      lane: 1,
      wave: 3,
      score: 4,
      streak: 2,
      difficulty: 'medium' as const,
      question: { id: 'old-waddle-question', difficulty: 'medium', expression: '7 − 2', counting: null, choices: [4, 5, 6], answer: 5, correctLane: 1 },
      result: null,
      cooldown: false,
      seenQuestions: ['count:5', '3+4', '7−2', '3×4'],
    },
  };
  const loaded = normalizeProgress(legacy as unknown as Progress, midpoint);
  assert.equal(loaded.session!.question.id, 'old-waddle-question');
  assert.equal(loaded.session!.question.key, '−:7,2');
  assert.deepEqual(loaded.session!.seenQuestions, ['count:5', '+:3,4', '−:7,2', '×:3,4']);
  const resumed = applyAction(loaded, { type: 'resume' }, 5000, midpoint);
  const current = resumed.session!.question;
  resumed.session!.lane = lane(current);
  const settled = applyAction(resumed, { type: 'settle' }, resumed.session!.deadline, midpoint);
  const advanced = applyAction(settled, { type: 'next' }, settled.session!.deadline, midpoint);
  const reloaded = normalizeProgress(JSON.parse(JSON.stringify(advanced)) as Progress, midpoint);
  assert.deepEqual(reloaded, advanced);
});

test('legacy Waddle Wall saves derive difficulty from the old question shape', () => {
  const legacy = {
    ...emptyProgress(),
    session: {
      ...settings,
      phase: 'playing' as const,
      pausedFrom: 'playing' as const,
      remaining: 5000,
      deadline: 10000,
      lane: 1,
      wave: 2,
      score: 0,
      streak: 0,
      question: { difficulty: 'hard', expression: '12 + 7', counting: null, choices: [18, 19, 20], answer: 19, correctLane: 1 },
      result: null,
      cooldown: false,
    },
  };
  const normalized = normalizeProgress(legacy as unknown as Progress, midpoint);
  assert.equal(normalized.session!.difficulty, 'hard');
  assert.equal(normalized.session!.question.card.level, 'add-2d');
});
