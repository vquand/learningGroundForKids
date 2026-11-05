import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, emptyProgress, normalizeProgress, publicState } from '../src/infinidrill/progress.ts';
import type { Progress } from '../src/infinidrill/progress.ts';
import { generateInfinidrillQuestion, selectInfinidrillQuestion } from '../src/infinidrill/questions-config.ts';
import { enumerateLevelCards } from '../src/questions/ladder.ts';
import { equationCard, evaluate, withBlank } from '../src/questions/equation.ts';
import { makeQuestion, questionKey } from '../src/questions/identity.ts';
import type { InfinidrillQuestion } from '../src/infinidrill/types.ts';

test('an entire expedition has no duplicate equations or Venn questions across main, bonus, pause and reload', () => {
  for (const random of [() => 0, () => .5, () => .999]) {
    const runtime = { random };
    let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, runtime);
    const seen = new Set<string>();
    let now = 0, bonuses = 0;
    while (p.game!.mode !== 'core') {
      now += 1000;
      assert.ok(now < 300000, 'expedition must remain playable');
      if (p.game!.mode === 'challenge-choice') {
        p = applyCommand(p, { type: 'choose-challenge', choice: 'B' }, now, runtime);
        bonuses++;
      } else if (p.game!.mode === 'upgrade-reward') {
        p = applyCommand(p, { type: 'choose-upgrade-reward', upgradeId: p.game!.upgradeChoices[0]! }, now, runtime);
      } else {
        const q = p.game!.currentQuestion!;
        assert.equal(seen.has(q.key), false, `repeated ${q.key} at level ${p.game!.level}`);
        seen.add(q.key);
        p = applyCommand(p, { type: 'pause' }, now, runtime);
        p = applyCommand(JSON.parse(JSON.stringify(p)), { type: 'resume' }, now + 1, runtime);
        p = applyCommand(p, { type: 'submit-answer', questionId: q.id, answer: Number(q.answer) }, now + 2, runtime);
      }
    }
    assert.ok(bonuses > 5);
    assert.equal('seenQuestions' in publicState(p).game!, false, 'private keys must not leak hidden operands');
    p = applyCommand(p, { type: 'replay' }, now + 1000, runtime);
    assert.equal(p.game!.mainQuestionsCompleted, 0);
    assert.ok(seen.has(p.game!.currentQuestion!.key), 'replay starts a fresh pool');
  }
});

test('identity ignores reversed sums/products, blank positions and levels, but retains subtraction order and Venn targets', () => {
  const plus = generateInfinidrillQuestion(1, () => .4);
  assert.equal(plus.card.kind, 'equation');
  if (plus.card.kind !== 'equation') return;
  assert.equal(questionKey(plus.card), questionKey({ ...plus.card, operands: [...plus.card.operands].reverse(), blank: 0 }));
  const missing = withBlank(plus.card, 0);
  assert.ok(missing);
  assert.equal(questionKey(plus.card), questionKey(missing!));
  const subtraction = equationCard('sub-1d', [8, 3], ['−']);
  assert.notEqual(questionKey(subtraction), questionKey({ ...subtraction, operands: [...subtraction.operands].reverse() }));
});

test('a custom repeated question cannot bypass history; old saves recover their current card without changing its grading', () => {
  const q = generateInfinidrillQuestion(1, () => .7);
  assert.equal(q.card.kind, 'equation');
  if (q.card.kind !== 'equation') return;
  const reversed = makeQuestion({ ...q.card, operands: [...q.card.operands].reverse() }, 'reversed');
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0, { questionFactory: () => q as InfinidrillQuestion });
  const { seenQuestions: _seen, ...legacy } = p.game!;
  p = { ...p, game: legacy };
  p = applyCommand(p, { type: 'submit-answer', questionId: p.game!.currentQuestion!.id, answer: Number(q.answer) }, 1000, { questionFactory: () => reversed as InfinidrillQuestion });
  assert.equal(p.game!.mainQuestionsCompleted, 1);
  assert.notEqual(p.game!.currentQuestion!.key, q.key);
  assert.equal(p.game!.seenQuestions!.length, 2);
  assert.equal('seenQuestions' in publicState(p).game!, false);
});

test('old InfiniDrill JSON loads, plays, saves and reloads through canonical shared questions', () => {
  const started = applyCommand(emptyProgress(), { type: 'replay' }, 0, { random: () => .5 });
  const oldShape = { id: 'earth-8-24 + 35', level: 8, operands: [24, 35], operators: ['+'], answer: 59 };
  const legacy = {
    ...started,
    game: { ...started.game!, level: 8 as const, currentQuestion: oldShape, seenQuestions: ['+:35,24'] },
  } as unknown as Progress;
  const loaded = normalizeProgress(JSON.parse(JSON.stringify(legacy)) as Progress);
  assert.equal(loaded.game!.currentQuestion!.card.kind, 'equation');
  assert.equal(loaded.game!.currentQuestion!.id, oldShape.id);
  assert.equal(loaded.game!.currentQuestion!.key, '+:24,35');
  assert.deepEqual(loaded.game!.seenQuestions, ['+:24,35']);

  const played = applyCommand(loaded, {
    type: 'submit-answer', questionId: loaded.game!.currentQuestion!.id, answer: 59,
  }, 1000, { random: () => .5 });
  const reloaded = normalizeProgress(JSON.parse(JSON.stringify(played)) as Progress);
  assert.equal(reloaded.game!.mainQuestionsCompleted, 1);
  assert.ok(reloaded.game!.currentQuestion);
  assert.equal(reloaded.game!.currentQuestion!.card.kind, 'equation');
  assert.ok(reloaded.game!.seenQuestions!.includes('+:24,35'));
  assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(reloaded)) as Progress), reloaded);
});

test('paused saves with an unconvertible current question are repaired before resume', () => {
  const started = applyCommand(emptyProgress(), { type: 'replay' }, 0, { random: () => .5 });
  const paused = {
    ...started,
    game: { ...started.game!, mode: 'paused' as const, currentQuestion: { id: 'broken', notAQuestion: true } },
  } as unknown as Progress;
  const repaired = normalizeProgress(paused, { random: () => .5 });
  assert.equal(repaired.game!.mode, 'paused');
  assert.ok(repaired.game!.currentQuestion);
  assert.equal(repaired.game!.currentQuestion!.id, 'earth-question-2');
});

test('finite question exhaustion stops safely without repeated questions, extra rewards or a false core achievement', () => {
  const pool = [...enumerateLevelCards('mul-1d')];
  const seen = new Set(pool.map(questionKey));
  assert.equal(seen.size, 54);
  assert.equal(selectInfinidrillQuestion(12, () => 0, seen), null);
  let p = applyCommand(emptyProgress(), { type: 'replay' }, 0);
  const currentQuestion = makeQuestion(pool[0]!, 'last-question') as InfinidrillQuestion;
  p = { ...p, game: { ...p.game!, level: 12, currentQuestion, seenQuestions: [...seen], questionsSinceChallenge: 6 } };
  p = applyCommand(p, { type: 'submit-answer', questionId: currentQuestion.id, answer: Number(currentQuestion.answer) }, 1000);
  assert.equal(p.game!.mode, 'question-exhausted');
  assert.equal(p.game!.currentQuestion, null);
  assert.equal(p.game!.finishedAt, null);
  assert.equal(p.earned['infinidrill-core-champion'], undefined);
  assert.throws(() => applyCommand(p, { type: 'submit-answer', questionId: currentQuestion.id, answer: Number(currentQuestion.answer) }, 2000), /already changed/);
  p = applyCommand(p, { type: 'replay' }, 3000);
  assert.equal(p.game!.seenQuestions!.length, 1);
});

test('fallback pools preserve every layer and never produce fractions or negative intermediate results', () => {
  for (let stage = 1; stage <= 18; stage++) {
    const seen = new Set<string>();
    for (let sample = 0; sample < 30; sample++) {
      const q = selectInfinidrillQuestion(stage as Parameters<typeof selectInfinidrillQuestion>[0], () => 0, seen)!;
      assert.ok(q);
      assert.equal(seen.has(q.key), false);
      seen.add(q.key);
      if (q.card.kind === 'equation') {
        const results = evaluate(q.card.operands, q.card.operators);
        assert.ok(results.every((value) => Number.isInteger(value) && value >= 0 && value <= 999));
        if (stage === 12) assert.ok(q.card.operands.every((value) => value >= 0 && value <= 9) && q.card.operands.filter((value) => value === 0).length <= 1);
        if (stage === 13) assert.ok(q.card.operands[0]! >= 10 && q.card.operands[0]! <= 19 && q.card.operands[1]! >= 1 && q.card.operands[1]! <= 5);
      }
    }
  }
});
