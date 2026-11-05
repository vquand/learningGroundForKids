import assert from 'node:assert/strict';
import test from 'node:test';
import { answerForCard, gradeQuestion } from '../src/questions/identity.js';
import { publicQuestion } from '../src/questions/projection.js';
import { promptText } from '../src/questions/text.js';
import { enumerateLevelCards } from '../src/questions/ladder.js';
import { emptyProgress, startRace, act, normalizeProgress, publicState, payout, advance, finishRace, forfeit, playerSpeed, OPPONENT_PACE, type Progress } from '../src/road-racing/game.js';
import { makeQuestion } from '../src/road-racing/questions.js';
import { stableRepairRandom } from '../src/road-racing/repository.js';
import { roadSettingsSchema } from '../src/road-racing/routes.js';
import { summarizeChild } from '../src/parent-reports/summary.js';

const setup = { animal: 'capybara' as const, language: 'en' as const, difficulty: 'hard' as const };
const fresh = () => startRace(emptyProgress(), setup, 1000, () => 0, 'race-a');
function choices(question: ReturnType<typeof makeQuestion>): readonly string[] {
  assert.equal(question.response.mode, 'choice');
  return question.response.choices;
}
function correctChoice(question: ReturnType<typeof makeQuestion>): number {
  assert.equal(question.response.mode, 'choice');
  return question.response.correct;
}
function forceWrongQuestion(progress: Progress, firstAttemptAt: number): Progress {
  const question = progress.race!.question;
  const wrong = (correctChoice(question) + 1) % 3;
  const retry = act(progress, { type: 'answer', questionId: question.id, choice: wrong }, firstAttemptAt, () => 0);
  return act(retry, { type: 'answer', questionId: question.id, choice: wrong }, firstAttemptAt + 200, () => 0);
}

test('race setup requires one reviewed difficulty and rejects extra client controls', () => {
  assert.equal(roadSettingsSchema.safeParse({ ...setup, difficulty: 'easy' }).success, true);
  assert.equal(roadSettingsSchema.safeParse({ animal: 'capybara', language: 'en' }).success, false);
  assert.equal(roadSettingsSchema.safeParse({ ...setup, difficulty: 'expert' }).success, false);
  assert.equal(roadSettingsSchema.safeParse({ ...setup, opponentPace: 1 }).success, false);
});

test('six distinct racers, random player lane, three choices, no secret answers in projection', () => {
  const p = fresh(), r = p.race!;
  assert.equal(new Set(r.racers.map((racer) => racer.animal)).size, 6);
  assert.equal(r.racers.filter((racer) => racer.player).length, 1);
  const view = publicState(p, 1000);
  assert.equal(view.race!.question.response.mode, 'choice');
  assert.equal(view.race!.question.response.choices.length, 3);
  assert.equal('answer' in view.race!.question, false);
  assert.equal('correct' in view.race!.question, false);
  const oppositeLane = startRace(emptyProgress(), setup, 1000, () => .999, 'race-b').race!;
  assert.notEqual(r.racers.findIndex((racer) => racer.player), oppositeLane.racers.findIndex((racer) => racer.player));
  assert.deepEqual(r.racers.filter((racer) => !racer.player).map((racer) => racer.pace), oppositeLane.racers.filter((racer) => !racer.player).map((racer) => racer.pace), 'cosmetic lane assignment cannot change opponent difficulty');
});

test('independent stack expiry, cap never refreshes, wrong answers do not clear stacks', () => {
  let p = fresh();
  for (const now of [1200, 1700, 2200, 2400]) {
    const q = p.race!.question;
    p = act(p, { type: 'answer', questionId: q.id, choice: correctChoice(q) }, now, () => 0);
  }
  assert.deepEqual(p.race!.stacks, [3200, 3700, 4200]);
  const q = p.race!.question;
  p = act(p, { type: 'answer', questionId: q.id, choice: (correctChoice(q) + 1) % 3 }, 2600, () => 0);
  assert.deepEqual(p.race!.stacks, [3200, 3700, 4200]);
  advance(p, 3200); assert.deepEqual(p.race!.stacks, [3700, 4200]);
  advance(p, 4200); assert.deepEqual(p.race!.stacks, []);
  assert.equal(p.stats.charged, 0, 'milestone is pending until completion');
});

test('two wrong answers force-finish the same question, reveal it, and add one slowdown', () => {
  let p = fresh();
  const first = p.race!.question, wrong = (correctChoice(first) + 1) % 3;
  p = act(p, { type: 'answer', questionId: first.id, choice: wrong }, 1200, () => 0);
  assert.equal(p.race!.question.id, first.id);
  assert.deepEqual(p.race!.question.response, first.response);
  assert.deepEqual(p.race!.triedChoices, [wrong]);
  assert.equal(p.race!.wrongAttempts, 1);
  assert.equal(publicState(p, 1200).race!.attemptsLeft, 1);
  assert.equal(p.race!.feedback?.kind, 'retry');
  p = act(p, { type: 'answer', questionId: first.id, choice: wrong }, 1400, () => 0);
  assert.notEqual(p.race!.question.id, first.id);
  assert.equal(p.race!.feedback?.kind, 'forced');
  assert.equal(p.race!.feedback?.forced, true);
  assert.equal(p.race!.feedback?.answer, first.response.mode === 'choice' ? first.response.choices[correctChoice(first)] : '');
  assert.equal(p.race!.wrongAttempts, 0);
  assert.deepEqual(p.race!.triedChoices, []);
  assert.deepEqual(p.race!.slows, [3400]);
  assert.equal(p.race!.slowed, true);
  assert.equal(p.race!.correct, 0);
});

test('retry-correct counts as correct without either effect, while first-try-correct adds a buff', () => {
  let retry = fresh(), retryQuestion = retry.race!.question;
  retry = act(retry, { type: 'answer', questionId: retryQuestion.id, choice: (correctChoice(retryQuestion) + 1) % 3 }, 1200, () => 0);
  retry = act(retry, { type: 'answer', questionId: retryQuestion.id, choice: correctChoice(retryQuestion) }, 1400, () => 0);
  assert.equal(retry.race!.correct, 1);assert.deepEqual(retry.race!.stacks, []);assert.deepEqual(retry.race!.slows, []);
  assert.equal(retry.race!.feedback?.kind, 'retry-correct');
  finishRace(retry, 1, 2000);assert.equal(retry.stats.correct, 1);assert.equal(retry.stats.slowed, 0);

  const firstTryQuestion = fresh().race!.question;
  const firstTry = act(fresh(), { type: 'answer', questionId: firstTryQuestion.id, choice: correctChoice(firstTryQuestion) }, 1200, () => 0);
  assert.deepEqual(firstTry.race!.stacks, [3200]);assert.deepEqual(firstTry.race!.slows, []);
});

test('net player speed follows the reviewed slowdown table from negative three to positive three', () => {
  assert.deepEqual([-3,-2,-1,0,1,2,3].map(net => playerSpeed(Math.max(net, 0), Math.max(-net, 0))), [1,2,4,8,11,14,17]);
});

test('buff and slowdown caps remove the soonest buff and ignore excess debuffs', () => {
  let kicked = fresh();
  kicked.race!.stacks = [2000, 3000, 4000];
  const kickedQuestion = kicked.race!.question, kickedWrong = (correctChoice(kickedQuestion) + 1) % 3;
  kicked = act(kicked, { type: 'answer', questionId: kickedQuestion.id, choice: kickedWrong }, 1200, () => 0);
  kicked = act(kicked, { type: 'answer', questionId: kickedQuestion.id, choice: kickedWrong }, 1400, () => 0);
  assert.deepEqual(kicked.race!.stacks, [3000, 4000]);assert.deepEqual(kicked.race!.slows, [3400]);assert.equal(kicked.race!.peakSlows, 1);

  let twoSlows = fresh();twoSlows.race!.slows=[2000,3000];
  const twoQuestion=twoSlows.race!.question;
  twoSlows=act(twoSlows,{type:'answer',questionId:twoQuestion.id,choice:correctChoice(twoQuestion)},1200,()=>0);
  assert.deepEqual(twoSlows.race!.stacks,[3200]);

  let threeSlows = fresh();threeSlows.race!.slows=[2000,3000,4000];
  for(const now of [1200,1400]){
    const q=threeSlows.race!.question,wrong=(correctChoice(q)+1)%3;
    threeSlows=act(threeSlows,{type:'answer',questionId:q.id,choice:wrong},now,()=>0);
  }
  assert.equal(threeSlows.race!.slows.length,3);assert.equal(threeSlows.race!.peakSlows,3);
  const ignoredQuestion=threeSlows.race!.question,ignoredWrong=(correctChoice(ignoredQuestion)+1)%3;
  threeSlows=act(threeSlows,{type:'answer',questionId:ignoredQuestion.id,choice:ignoredWrong},1600,()=>0);
  threeSlows=act(threeSlows,{type:'answer',questionId:ignoredQuestion.id,choice:ignoredWrong},1800,()=>0);
  assert.equal(threeSlows.race!.slows.length,3);assert.equal(threeSlows.race!.peakSlows,3);

  let capped = fresh();capped.race!.stacks=[2000,3000,4000];
  const cappedQuestion=capped.race!.question;
  capped=act(capped,{type:'answer',questionId:cappedQuestion.id,choice:correctChoice(cappedQuestion)},1200,()=>0);
  assert.deepEqual(capped.race!.stacks,[2000,3000,4000]);
});

test('spamming one choice keeps each wrong question until its second press and caps slowdowns', () => {
  let p = fresh(), now = 1200, forcedQuestions = 0, answeredQuestions = 0;
  while (p.race!.status === 'racing' && now < 220000) {
    const question = p.race!.question, sequence = p.race!.sequence, spammedChoice = 0;
    const first = act(p, { type: 'answer', questionId: question.id, choice: spammedChoice }, now, () => 0);
    if (first.race!.status !== 'racing') { p = first; break; }
    if (correctChoice(question) === spammedChoice) {
      assert.equal(first.race!.sequence, sequence + 1);
      answeredQuestions++;
      p = first;
    } else {
      assert.equal(first.race!.question.id, question.id);
      assert.equal(first.race!.sequence, sequence);
      assert.equal(first.race!.wrongAttempts, 1);
      const second = act(first, { type: 'answer', questionId: question.id, choice: spammedChoice }, now + 220, () => 0);
      if (second.race!.status !== 'racing') { p = second; break; }
      assert.equal(second.race!.sequence, sequence + 1);
      assert.equal(second.race!.feedback?.kind, 'forced');
      forcedQuestions++;
      answeredQuestions++;
      p = second;
    }
    assert.ok(p.race!.slows.length <= 3);
    assert.ok(p.race!.peakSlows <= 3);
    now += answeredQuestions < 4 ? 440 : 5000;
  }
  assert.equal(p.race!.status, 'finished');
  assert.ok(answeredQuestions > 0);
  assert.ok(forcedQuestions > 0);
  assert.ok(p.race!.peakSlows <= 3);
});

test('a non-current question id is rejected after a retry without changing the retry state', () => {
  let p = fresh();
  const question = p.race!.question, wrong = (correctChoice(question) + 1) % 3;
  p = act(p, { type: 'answer', questionId: question.id, choice: wrong }, 1200, () => 0);
  const before = JSON.stringify(p);
  assert.throws(() => act(p, { type: 'answer', questionId: `${question.id}-old`, choice: wrong }, 1400, () => 0), /changed/);
  assert.equal(JSON.stringify(p), before);
});

test('peak stacks reaches three only while no slowdown is active', () => {
  let accurate = fresh();
  for (const now of [1200, 1700, 2200]) {
    const question = accurate.race!.question;
    accurate = act(accurate, { type: 'answer', questionId: question.id, choice: correctChoice(question) }, now, () => 0);
  }
  assert.equal(accurate.race!.peakStacks, 3);
  assert.equal(accurate.race!.peakSlows, 0);

  let slowed = forceWrongQuestion(fresh(), 1200);
  for (const now of [1600, 1800, 2000]) {
    const question = slowed.race!.question;
    slowed = act(slowed, { type: 'answer', questionId: question.id, choice: correctChoice(question) }, now, () => 0);
  }
  assert.equal(slowed.race!.peakSlows, 1);
  assert.equal(slowed.race!.peakStacks, 2);
});

test('effects expire independently, and finish or forfeit clears both effect lists', () => {
  const p=fresh();p.race!.stacks=[2000,3000];p.race!.slows=[2500];
  advance(p,2000);assert.deepEqual(p.race!.stacks,[3000]);assert.deepEqual(p.race!.slows,[2500]);
  advance(p,2500);assert.deepEqual(p.race!.slows,[]);
  finishRace(p,1,3000);assert.deepEqual(p.race!.stacks,[]);assert.deepEqual(p.race!.slows,[]);
  const abandoned=fresh();abandoned.race!.stacks=[2000];abandoned.race!.slows=[2200];
  const left=act(abandoned,{type:'leave'},1200,()=>0);assert.deepEqual(left.race!.stacks,[]);assert.deepEqual(left.race!.slows,[]);
});

test('reload and replay preserve the current question attempt state, and old races default new fields', () => {
  let p=fresh(),q=p.race!.question,wrong=(correctChoice(q)+1)%3;
  p=act(p,{type:'answer',questionId:q.id,choice:wrong},1200,()=>0);
  const saved=JSON.parse(JSON.stringify(p)) as Progress, reloaded=normalizeProgress(saved,()=>.99);
  assert.equal(reloaded.race!.question.id,q.id);assert.equal(reloaded.race!.wrongAttempts,1);assert.deepEqual(reloaded.race!.triedChoices,[wrong]);
  assert.deepEqual(act(reloaded,{type:'answer',questionId:q.id,choice:wrong},1400,()=>0).race!.slows,[3400]);
  const old=JSON.parse(JSON.stringify(fresh())) as Progress;
  delete (old.race as unknown as Record<string,unknown>).slows;
  delete (old.race as unknown as Record<string,unknown>).wrongAttempts;
  delete (old.race as unknown as Record<string,unknown>).triedChoices;
  delete (old.race as unknown as Record<string,unknown>).slowed;
  delete (old.race as unknown as Record<string,unknown>).peakSlows;
  delete (old.stats as unknown as Record<string,unknown>).slowed;
  delete (old.stats as unknown as Record<string,unknown>).snailPodiums;
  const normalized=normalizeProgress(old,()=>0);
  assert.deepEqual(normalized.race!.slows,[]);assert.deepEqual(normalized.race!.triedChoices,[]);assert.equal(normalized.race!.wrongAttempts,0);
  assert.equal(normalized.race!.slowed,false);assert.equal(normalized.race!.peakSlows,0);assert.equal(normalized.stats.slowed,0);assert.equal(normalized.stats.snailPodiums,0);
});

test('slowdown achievements count only finished races, with top three and peak two required for Snail Survivor', () => {
  const forfeited=forceWrongQuestion(forceWrongQuestion(fresh(),1200),1600);forfeit(forfeited);
  assert.equal(forfeited.stats.slowed,0);assert.equal(forfeited.stats.snailPodiums,0);
  const fourth=forceWrongQuestion(forceWrongQuestion(fresh(),1200),1600);finishRace(fourth,4,2000);
  assert.equal(fourth.stats.slowed,1);assert.equal(fourth.stats.snailPodiums,0);assert.equal(fourth.earned['road-racing-slowed']!==undefined,true);
  const podium=forceWrongQuestion(forceWrongQuestion(fresh(),1200),1600);finishRace(podium,3,2000);
  assert.equal(podium.stats.slowed,1);assert.equal(podium.stats.snailPodiums,1);assert.ok(podium.earned['road-racing-slowed']);assert.ok(podium.earned['road-racing-snail']);
});

test('old questions cannot award twice, forged choice rejected, absence forfeits before simulation', () => {
  const p = fresh(), q = p.race!.question;
  const next = act(p, { type: 'answer', questionId: q.id, choice: correctChoice(q) }, 1200, () => 0);
  assert.throws(() => act(next, { type: 'answer', questionId: q.id, choice: correctChoice(q) }, 1200, () => 0));
  assert.throws(() => act(p, { type: 'answer', questionId: q.id, choice: 3 }, 1100, () => 0));
  next.stats.streak = 2;
  const lost = act(next, { type: 'tick' }, 8000, () => 0);
  assert.equal(lost.race!.status, 'forfeited'); assert.equal(lost.stats.streak, 0);
  assert.equal(lost.stats.finished, 0); assert.deepEqual(lost.earned, {});
});

test('reviewed payouts use unrounded ratios and last gets nothing', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(payout), [
    { stamina: 60, wood: 40, wool: 40 }, { stamina: 47, wood: 31, wool: 31 }, { stamina: 43, wood: 29, wool: 29 },
    { stamina: 41, wood: 28, wool: 28 }, { stamina: 39, wood: 26, wool: 26 }, {},
  ]);
});

test('completed last place counts, forfeits do not, earned streak badges remain permanent', () => {
  const p = fresh(); p.stats.streak = 2; p.race!.peakStacks = 3;
  finishRace(p, 6, 2000);
  assert.equal(p.stats.last, 1); assert.equal(p.stats.finished, 1); assert.equal(p.stats.charged, 1);
  assert.equal(p.stats.streak, 0); assert.ok(p.earned['road-racing-last']);
  const win = startRace(p, setup, 3000, () => 0, 'race-b'); win.stats.streak = 2;
  finishRace(win, 1, 4000); assert.ok(win.earned['road-racing-streak']);
  const leave = startRace(win, setup, 5000, () => 0, 'race-c');
  const lost = act(leave, { type: 'leave' }, 5100, () => 0);
  assert.equal(lost.stats.streak, 0); assert.ok(lost.earned['road-racing-streak']);
});

test('kind rotation, language prompts, bounded choices and 400 nonrepeating cards', () => {
  for (const language of ['en', 'vi'] as const) {
    const seen: string[] = [], kinds = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const q = makeQuestion(language, i, seen, () => .23);
      assert.ok(promptText(q.card, language).split(/\s+/).length < 10, promptText(q.card, language));
      assert.equal(choices(q).length, 3); assert.equal(new Set(choices(q)).size, 3);
      assert.ok(correctChoice(q) >= 0 && correctChoice(q) < 3); assert.ok(!seen.includes(q.key));
      seen.push(q.key);
      kinds.add(q.card.kind);
      if (q.card.kind === 'venn') assert.equal(choices(q)[correctChoice(q)], String(answerForCard(q.card)));
      assert.equal(gradeQuestion(q, correctChoice(q)), true);
      assert.equal('correct' in publicQuestion(q), false);
      assert.equal('key' in publicQuestion(q), false);
    }
    assert.equal(kinds.size, 4);
  }
});

test('kind rotation is compare, arithmetic, picture, Venn before an exhausted pool falls back', () => {
  for (let sequence = 0; sequence < 24; sequence += 1) {
    const question = makeQuestion('en', sequence, [], () => .23);
    const expected = sequence % 4 === 0 ? 'compare' : sequence % 4 === 1 ? 'equation' : sequence % 4 === 2 ? 'picture' : 'venn';
    assert.equal(question.card.kind, expected);
  }
});

test('Road Racing question IDs depend on sequence, not the selected card', () => {
  const first = makeQuestion('en', 0, [], () => 0);
  const second = makeQuestion('en', 0, [], () => .999999);
  assert.notEqual(first.key, second.key);
  assert.equal(first.id, 'road-question-0');
  assert.equal(second.id, 'road-question-0');
  assert.equal(first.id.includes(first.key), false);
  assert.equal(second.id.includes(second.key), false);
});

test('arithmetic alternates missing add/sub cards with visible result-only multiplication', () => {
  const arithmetic = [1, 5, 9, 13, 17, 21, 25].map((sequence) => makeQuestion('en', sequence, [], () => 0));
  assert.ok(arithmetic.filter((question) => question.card.kind === 'equation' && question.card.operators[0] === '×').length >= 3);
  for (const question of arithmetic) {
    assert.equal(question.card.kind, 'equation');
    assert.equal(question.response.mode, 'choice');
    assert.equal(question.card.operators.length, 1);
    if (question.card.operators[0] === '×') {
      assert.equal(question.card.blank, 'result');
      assert.ok(question.card.operands.every((operand) => operand >= 1 && operand <= 9));
      assert.ok(Number(answerForCard(question.card)) <= 81);
    } else {
      assert.ok(question.card.blank === 'result' || typeof question.card.blank === 'number');
      assert.ok(question.card.operators[0] === '+' || question.card.operators[0] === '−');
    }
  }
  const missing = arithmetic.filter((question) => question.card.kind === 'equation' && question.card.blank !== 'result');
  assert.ok(missing.length > 0);
  assert.ok(missing.some((question) => question.card.kind === 'equation' && question.card.operands.some((operand) => operand >= 10)));
  const high = makeQuestion('en', 5, [], () => .999999);
  assert.equal(high.card.kind, 'equation');
  assert.equal(answerForCard(high.card), 81);
  assert.ok(choices(high).some((choice) => Number(choice) > 50));
});

test('Road Racing multiplication uses only the shared mul-2to5 and mul-1d pools, up to 81', () => {
  const products = new Set<number>();
  for (const level of ['mul-2to5', 'mul-1d'] as const) {
    for (const card of enumerateLevelCards(level)) {
      if (card.kind === 'equation' && card.operands.every((operand) => operand >= 1 && operand <= 9)) {
        products.add(Number(answerForCard(card)));
      }
    }
  }
  assert.equal(Math.max(...products), 81, '9 × 9 is the new upper bound; the retired <50 cap no longer applies');
  for (const seed of Array.from({ length: 81 }, (_, index) => index)) {
    const question = makeQuestion('en', 5, [], () => (seed + .25) / 100000);
    assert.equal(question.card.kind, 'equation');
    assert.equal(question.card.operators[0], '×');
    assert.ok(products.has(Number(answerForCard(question.card))));
    assert.ok(Number(answerForCard(question.card)) <= 81);
  }
});

test('choice positions vary while every answer is present and picture exhaustion falls back', () => {
  const positions = new Set<number>();
  for (let seed = 0; seed < 40; seed += 1) {
    const q = makeQuestion('en', 1, [], () => (seed + 1) / 100);
    positions.add(correctChoice(q));
    assert.ok(choices(q).includes(String(answerForCard(q.card))));
  }
  assert.ok(positions.size > 1);
  const seen = Array.from({ length: 27 }, (_, index) => `picture:${['capybara', 'crocodile', 'duck', 'goose', 'cow', 'highland', 'chicken', 'rabbit', 'cat', 'dog', 'pig', 'sheep', 'goat', 'horse', 'donkey', 'deer', 'fox', 'bear', 'panda', 'lion', 'tiger', 'giraffe', 'zebra', 'elephant', 'monkey', 'turtle', 'penguin'][index]}`);
  assert.equal(makeQuestion('en', 2, seen, () => 0).card.kind, 'compare');
});

test('legacy Road Racing questions, seen keys and feedback round-trip through shared data', () => {
  const legacy: Progress = {
    ...emptyProgress(),
    race: {
      id: 'legacy-race', animal: 'capybara', language: 'vi', difficulty: 'hard', status: 'racing',
      racers: [], startedAt: 1000, updatedAt: 1000, lastSeen: 1000, stacks: [], peakStacks: 0, correct: 0,
      question: { id: 'old-picture', kind: 'picture', animal: 'rabbit', language: 'vi', choices: ['Thỏ', 'Mèo', 'Chó'], correct: 0 },
      seen: ['c:3:8', 'a:13:3:true:0', 'm:4:6', 'p:rabbit', 'v:1:2:0:union'], sequence: 2, questionAt: 1000, place: null,
      feedback: { question: { id: 'old-venn', kind: 'venn', venn: { leftOnly: 1, shared: 2, rightOnly: 0 }, target: 'shared', choices: ['1', '2', '3'], correct: 1 }, answer: '2', correct: true, at: 900 },
    } as unknown as Progress['race'],
  };
  const loaded = normalizeProgress(legacy, () => 0);
  assert.equal(loaded.race?.question.card.kind, 'picture');
  assert.equal(loaded.race?.question.card.kind === 'picture' ? loaded.race.question.card.subject : null, 'rabbit');
  assert.deepEqual(loaded.race?.seen, ['compare:3,8', '−:13,3', '×:4,6', 'picture:rabbit', 'venn:union:1,2,0']);
  assert.equal(loaded.race?.feedback?.question.card.kind, 'venn');
  assert.equal(loaded.race?.feedback?.question.response.mode, 'choice');
  const saved = JSON.parse(JSON.stringify(loaded)) as Progress;
  const reloaded = normalizeProgress(saved, () => .99);
  assert.deepEqual(reloaded, loaded);
});

test('current-format saved Road Racing questions load without rewriting their IDs or response data', () => {
  for (const sequence of [0, 1, 2, 3]) {
    const progress = fresh();
    progress.race!.sequence = sequence;
    progress.race!.question = makeQuestion('en', sequence, [], () => .37);
    progress.race!.seen = [progress.race!.question.key];
    const saved = JSON.parse(JSON.stringify(progress)) as Progress;
    const loaded = normalizeProgress(saved, () => .99);
    assert.deepEqual(loaded.race?.question, saved.race?.question);
    assert.equal(loaded.revision, saved.revision);
  }
});

test('unconvertible saved current questions receive the same hash-seeded repair without changing race progress', () => {
  const broken = { ...emptyProgress(), race: { ...fresh().race!, question: { id: 'broken', kind: 'unknown' }, sequence: 7, correct: 4, stacks: [2000] } } as unknown as Progress;
  const first = normalizeProgress(broken, stableRepairRandom(broken));
  const second = normalizeProgress(broken, stableRepairRandom(broken));
  assert.deepEqual(first.race?.question, second.race?.question);
  assert.equal(first.race?.sequence, 7);
  assert.equal(first.race?.correct, 4);
  assert.deepEqual(first.race?.stacks, [2000]);
});

test('a steady accurate racer can win while idle play finishes last on the same balanced course', () => {
  for (const animal of ['capybara', 'crocodile', 'duck', 'goose', 'cow', 'highland', 'chicken'] as const) {
    for (const active of [true, false]) {
      let p = startRace(emptyProgress(), { ...setup, animal }, 1000, () => .4, `${animal}-${active}`);
      for (let now = 1500; now < 200000 && p.race!.status === 'racing'; now += 500) {
        const q = p.race!.question;
        p = act(p, active && now % 2000 === 1500 ? { type: 'answer', questionId: q.id, choice: correctChoice(q) } : { type: 'tick' }, now, () => .4);
      }
      assert.equal(p.race!.status, 'finished');
      assert.equal(p.race!.place, active ? 1 : 6, `${animal}: ${active ? 'steady' : 'idle'}`);
      assert.ok(p.race!.updatedAt - p.race!.startedAt > 80000);
      assert.ok(p.race!.updatedAt - p.race!.startedAt < 180000);
    }
  }
});

test('Egg and Hatched lower opponent pace while Chicken preserves the original balance', () => {
  assert.deepEqual(OPPONENT_PACE.hard, { base: 9.35, step: .17 });
  const paces = (difficulty: 'easy' | 'medium' | 'hard') => startRace(emptyProgress(), { ...setup, difficulty }, 1000, () => .4, difficulty).race!.racers.filter((racer) => !racer.player).map((racer) => racer.pace);
  const egg = paces('easy'), hatched = paces('medium'), chicken = paces('hard');
  assert.ok(egg.every((pace, index) => pace < hatched[index]!));
  assert.ok(hatched.every((pace, index) => pace < chicken[index]!));
  assert.deepEqual(chicken, [9.35, 9.52, 9.69, 9.86, 10.03]);
});

test('report projection allowlists friends and badges and rejects malformed progress', () => {
  const report = summarizeChild({ id: 'kid', name: 'Racer', emoji: 'cow', color: 'blue', road_racing: {
    stats: { finished: -1, wins: '100', friends: { unknownFriend: 99, capybara: -2 }, animalPodiums: { cow: 'not a number' } },
    earned: { 'road-racing-win': 'not a date', forged: '2026-10-21T00:00:00Z' }, race: { question: 'PRIVATE_QUESTION' },
  }});
  const group = report.games.find((game) => game.id === 'road-racing')!;
  assert.equal(group.achievements.length, 18); assert.ok(group.achievements.every((achievement) => !achievement.earned && achievement.current === 0));
  assert.ok(group.metrics.every((metric) => metric.value === 0));
  assert.equal(JSON.stringify(report).includes('PRIVATE_QUESTION'), false);
  assert.equal(JSON.stringify(report).includes('forged'), false);
});
