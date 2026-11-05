import test from 'node:test';
import assert from 'node:assert/strict';
import { BAIT_IDS, BAITS, CATCH_TABLES, FISH } from '../src/fishing/catalog.js';
import { applyCommand, emptyProgress, publicState, sampleCatch } from '../src/fishing/game.js';
import { FISHING_ACHIEVEMENTS } from '../src/fishing/achievements.js';
import { withBlank } from '../src/questions/equation.js';
import { makeQuestion } from '../src/questions/identity.js';

function generated(baitId: (typeof BAIT_IDS)[number], random: (maximumExclusive: number) => number, id = 'question') {
  let state = emptyProgress();
  state.points.pond = 60;
  state = applyCommand(state, { type: 'question', baitId }, 0, random, () => id);
  if (!state.question) throw new Error('Fishing question was not issued');
  return state.question;
}
function seeded(seed: number) {
  let value = (seed + 1) >>> 0;
  return (maximumExclusive: number) => {
    value = Math.imul(value ^ (value >>> 13), 0x5bd1e995) >>> 0;
    return maximumExclusive <= 0 ? 0 : Math.floor((value / 0x100000000) * maximumExclusive);
  };
}

test('approved probability boundaries, no hidden rolls and stable shared species rewards', () => {
  for (const location of ['pond', 'river'] as const) for (const bait of BAIT_IDS) {
    const row = CATCH_TABLES[location][bait];
    assert.equal(row.reduce((sum, entry) => sum + entry.percent, 0), 100);
    let start = 0;
    for (const entry of row) {
      assert.equal(sampleCatch(location, bait, () => start), entry.fishId);
      assert.equal(sampleCatch(location, bait, () => start + entry.percent - 1), entry.fishId);
      start += entry.percent;
    }
  }
  assert.deepEqual(CATCH_TABLES.pond.baby, [{ fishId: 'P1', percent: 60 }, { fishId: 'P2', percent: 20 }, { fishId: null, percent: 20 }]);
  assert.equal(FISH.P1.stamina, 1); assert.equal(FISH.T1.points, 2);
  assert.deepEqual(Object.fromEntries(Object.entries(FISH).map(([id,fish]) => [id,fish.points])), { P1:1,P2:2,P3:2,P4:3,P5:4,T1:2,R1:2,R2:3,R3:3,R4:4,R5:4 });
  const approved = {
    pond: ['P1:60 P2:20 -:20', 'P1:20 P2:50 P3:20 -:10', 'T1:80 -:20', 'P3:45 P4:35 P5:10 -:10', 'P2:15 P4:60 P5:15 -:10', 'P3:15 P4:30 P5:45 -:10', 'P3:10 P4:30 P5:50 -:10'],
    river: ['P1:50 R1:30 -:20', 'R1:60 R2:20 -:20', 'T1:80 -:20', 'R1:20 R2:50 R3:20 -:10', 'R2:20 R3:55 R4:15 -:10', 'R3:25 R4:40 R5:25 -:10', 'R3:15 R4:30 R5:45 -:10'],
  };
  for (const location of ['pond', 'river'] as const) assert.deepEqual(BAIT_IDS.map(bait => CATCH_TABLES[location][bait].map(({fishId,percent}) => `${fishId ?? '-'}:${percent}`).join(' ')), approved[location]);
});

test('one start arms an empty session and a math answer immediately starts fishing alongside the next question', () => {
  let state = applyCommand(emptyProgress(), { type: 'cast' }, 0);
  assert.equal(state.running, true); assert.equal(state.cast, null);
  state = applyCommand(state, { type: 'question', baitId: 'baby' }, 1000, () => 0, () => 'q1');
  state = applyCommand(state, { type: 'answer', questionId: 'q1', answer: state.question!.question.answer as number }, 2000, () => 0, () => 'cast1');
  assert.equal(state.cast?.id, 'cast1'); assert.equal(state.bait.baby, 0);
  state = applyCommand(state, { type: 'question', baitId: 'baby' }, 2500, () => 0, () => 'q2');
  assert.equal(state.cast?.paused, false);
  state = applyCommand(state, { type: 'tick' }, 3000);
  assert.equal(state.cast?.remainingMs, 7000); assert.equal(state.question?.id, 'q2');
  state = applyCommand(state, { type: 'answer', questionId: 'q2', answer: state.question!.question.answer as number }, 3500);
  assert.equal(state.cast?.id, 'cast1'); assert.equal(state.bait.baby, 1);
  for (let now = 4000; now <= 10000; now += 1000) state = applyCommand(state, { type: 'tick' }, now);
  assert.equal(state.cast?.phase, 'result'); assert.equal(state.inventory.P1, 1);
  assert.equal(state.stats.casts, 1); assert.equal(state.nextCastAt, 12000);
  state = applyCommand(state, { type: 'tick' }, 11000);
  assert.equal(state.cast?.phase, 'result');
  state = applyCommand(state, { type: 'tick' }, 12000, () => 0, () => 'cast2');
  assert.equal(state.cast?.id, 'cast2'); assert.equal(state.cast?.remainingMs, 8000);
  assert.equal(state.stats.casts, 2); assert.equal(state.bait.baby, 0);
});

test('automatic fallback uses the easiest stocked compatible bait without changing the selected preference', () => {
  let state = emptyProgress(); state.selectedBait = 'chewy'; state.bait.beginner = 1; state.bait.leafy = 1;
  state = applyCommand(state, { type: 'cast' }, 0, () => 0, () => 'fallback');
  assert.equal(state.cast?.baitId, 'beginner'); assert.equal(state.selectedBait, 'chewy');
  state = applyCommand(state, { type: 'select-bait', baitId: 'baby' }, 500);
  assert.equal(state.cast?.baitId, 'beginner'); assert.equal(state.selectedBait, 'baby');
  state = applyCommand(state, { type: 'select-bait', baitId: 'leafy' }, 600);
  for (let now = 1000; now <= 8000; now += 1000) state = applyCommand(state, { type: 'tick' }, now);
  state = applyCommand(state, { type: 'tick' }, 9000);
  state = applyCommand(state, { type: 'tick' }, 10000, () => 0, () => 'turtle');
  assert.equal(state.cast?.baitId, 'leafy'); assert.equal(state.cast?.outcome, 'T1');
});

test('starvation and results respect session pause, heartbeat expiry and legacy normalization', () => {
  let state = applyCommand(emptyProgress(), { type: 'cast' }, 0);
  assert.equal(publicState(state, 3000).running, false);
  state = applyCommand(state, { type: 'question', baitId: 'baby' }, 3000, () => 0, () => 'q');
  assert.equal(state.running, false);
  state = applyCommand(state, { type: 'answer', questionId: 'q', answer: state.question!.question.answer as number }, 3500);
  assert.equal(state.cast, null); assert.equal(state.bait.baby, 1);
  state = applyCommand(state, { type: 'resume' }, 4000, () => 0, () => 'c');
  assert.equal(state.running, true);
  state = applyCommand(state, { type: 'pause' }, 4500);
  assert.equal(state.running, false); assert.equal(state.cast?.paused, true);
  state = applyCommand(state, { type: 'question', baitId: 'baby' }, 5000, () => 0, () => 'q2');
  state = applyCommand(state, { type: 'answer', questionId: 'q2', answer: state.question!.question.answer as number }, 5500);
  assert.equal(state.running, false); assert.equal(state.cast?.id, 'c');
  const legacy = structuredClone(state) as unknown as Record<string, unknown>;
  delete legacy.running; delete legacy.lastActivityAt; delete legacy.nextCastAt;
  const projected = publicState(legacy as unknown as typeof state, 6000);
  assert.equal(projected.running, false); assert.equal(projected.cast?.paused, true);
  assert.equal('lastActivityAt' in projected, false); assert.equal('nextCastAt' in projected, false);
});

test('questions stay within one approved skill, answers are private and bait earns exactly once', () => {
  for (const baitId of BAIT_IDS) for (let seed = 0; seed < 100; seed++) {
    const q = generated(baitId, (max: number) => seed % max);
    const card = q.question.card;
    assert.ok(typeof q.question.answer === 'number' && Number.isSafeInteger(q.question.answer) && q.question.answer >= 0);
    if (card.kind !== 'equation') throw new Error('Expected an equation');
    const [a,b] = card.operands as [number, number];
    if (baitId === 'baby') assert.ok(a >= 10 && a <= 98 && b >= 0 && b <= 9 && a % 10 + b < 10);
    if (baitId === 'beginner') assert.ok(a >= 10 && b >= 10 && a + b <= 99);
    if (baitId === 'leafy') assert.ok(a <= 20 && b <= 20 && a >= b);
    if (baitId === 'chewy') assert.ok(a >= 10 && b >= 10 && a <= 99 && b <= a);
    if (baitId === 'bouncy') assert.ok(a >= 2 && a <= 5 && b >= 2 && b <= 5);
    if (baitId === 'crunchy') assert.ok(a >= 0 && a <= 9 && b >= 0 && b <= 9 && (a !== 0 || b !== 0));
    if (baitId === 'master') assert.equal(a % b, 0);
  }
  let state = applyCommand(emptyProgress(), { type: 'question', baitId: 'baby' }, 0, () => 0, () => 'q');
  assert.equal('answer' in publicState(state, 0).question!, false);
  assert.equal('operands' in publicState(state, 0).question!, false);
  state = applyCommand(state, { type: 'answer', questionId: 'q', answer: 999 }, 0);
  assert.equal(state.question?.attempts, 1); assert.equal(state.bait.baby, 0);
  state = applyCommand(state, { type: 'answer', questionId: 'q', answer: state.question!.question.answer as number }, 0);
  assert.equal(state.bait.baby, 1); assert.equal(state.stats.questions, 1);
  assert.throws(() => applyCommand(state, { type: 'answer', questionId: 'q', answer: 2 }, 0), /question/i);
  assert.throws(() => applyCommand(emptyProgress(), { type: 'question', baitId: 'master' }, 0), /locked/i);
});

test('active heartbeats resolve once; hidden gaps pause without catchup, preserve outcome and inventory', () => {
  let state = emptyProgress(); state.bait.baby = 2;
  state = applyCommand(state, { type: 'cast' }, 1000, () => 0, () => 'cast');
  assert.equal(state.bait.baby, 1); assert.equal(state.stats.casts, 1);
  assert.equal('fishId' in publicState(state, 1000).cast!, false);
  state = applyCommand(state, { type: 'tick' }, 2000);
  assert.equal(state.cast?.remainingMs, 7000);
  state = applyCommand(state, { type: 'tick' }, 20000);
  assert.equal(state.cast?.remainingMs, 7000); assert.equal(state.cast?.paused, true);
  state = applyCommand(state, { type: 'resume' }, 30000);
  for (let now = 31000; now <= 37000; now += 1000) state = applyCommand(state, { type: 'tick' }, now);
  assert.equal(state.cast?.phase, 'result'); assert.equal(state.inventory.P1, 1);
  assert.equal(state.points.pond, 1); assert.equal(state.stats.caught, 1);
  assert.equal(publicState(state, 37000).cast?.stamina, 1);
  const previous = structuredClone(state);
  state = applyCommand(state, { type: 'tick' }, 38000);
  assert.equal(state.cast?.id, previous.cast?.id); assert.equal(state.inventory.P1, previous.inventory.P1); assert.equal(state.points.pond, previous.points.pond);
  assert.throws(() => applyCommand(previous, { type: 'select-location', location: 'river' }, 38000), /locked/i);
});

test('garbage awards nothing; turtles are released but journaled; graduation unlocks bait', () => {
  let state = emptyProgress(); state.bait.baby = 1;
  state = applyCommand(state, { type: 'cast' }, 0, () => 99, () => 'garbage');
  for (let now = 1000; now <= 8000; now += 1000) state = applyCommand(state, { type: 'tick' }, now);
  assert.equal(state.stats.garbage, 1); assert.equal(state.points.pond, 0); assert.equal(state.cast?.fishId, null);
  state.selectedBait = 'leafy'; state.bait.leafy = 1; state.points.pond = 59;
  state = applyCommand(state, { type: 'cast' }, 10000, () => 0, () => 'turtle');
  for (let now = 11000; now <= 18000; now += 1000) state = applyCommand(state, { type: 'tick' }, now);
  assert.equal(state.points.pond, 61); assert.ok(state.discovered.pond.includes('T1'));
  assert.equal('T1' in state.inventory, false); assert.equal(state.stats.caught, 0);
  assert.ok(state.earned['fishing-pond-graduate']);
  state = applyCommand(state, { type: 'question', baitId: 'master' }, 19000, () => 0, () => 'master');
  assert.ok(typeof state.question?.question.answer === 'number');
});

test('all seven reviewed achievements grade authoritative progress and preserve earned timestamps', () => {
  let state = emptyProgress();
  state.stats.caught = 1; state.points = { pond: 60, river: 180 };
  state.discovered = { pond: ['P1','P2','P3','P4','P5','T1'], river: ['P1','T1','R1','R2','R3','R4','R5'] };
  state.earnedBaits = [...BAIT_IDS]; state.friendCatches = ['highland','capybara','cow'];
  state.earned['fishing-first-nibble'] = '2020-01-01T00:00:00.000Z';
  state = applyCommand(state, { type: 'question', baitId: 'baby' }, 1000, () => 0, () => 'q');
  state = applyCommand(state, { type: 'answer', questionId: 'q', answer: state.question!.question.answer as number }, 2000);
  assert.deepEqual(Object.keys(state.earned).sort(), FISHING_ACHIEVEMENTS.map(row => row.id).sort());
  assert.equal(state.earned['fishing-first-nibble'], '2020-01-01T00:00:00.000Z');
  assert.equal(state.earned['fishing-river-graduate'], '1970-01-01T00:00:02.000Z');
});

test('math runs in parallel, while changing a friend pauses and preserves the paid cast', () => {
  let state = emptyProgress(); state.bait.baby = 1;
  state = applyCommand(state, { type: 'cast' }, 1000, () => 0, () => 'c');
  state = applyCommand(state, { type: 'question', baitId: 'leafy' }, 1500, () => 0, () => 'q');
  assert.equal(state.cast?.paused, false);
  state = applyCommand(state, { type: 'select-bait', baitId: 'leafy' }, 1600);
  assert.equal(state.cast?.baitId, 'baby');
  const committed = state.cast!.outcome;
  state = applyCommand(state, { type: 'select-companion', companion: 'cow' }, 1700);
  assert.equal(state.companion, 'cow'); assert.equal(state.cast?.companion, 'cow');
  assert.equal(state.cast?.paused, true); assert.equal(state.running, false);
  assert.equal(state.cast?.outcome, committed); assert.equal(state.cast?.id, 'c');
  assert.equal(state.bait.baby, 0); assert.equal(state.stats.casts, 1);
  assert.throws(() => applyCommand(state, { type: 'select-location', location: 'pond' }, 1750), /current cast/i);
  state = applyCommand(state, { type: 'resume' }, 2000);
  state = applyCommand(state, { type: 'tick' }, 1900);
  assert.equal(state.cast?.remainingMs, 8000); assert.equal(state.cast?.lastTickAt, 2000);
  state = applyCommand(state, { type: 'tick' }, 3000);
  assert.equal(state.cast?.remainingMs, 7000); assert.equal(state.question?.id, 'q');
});

test('higher bait tiers use the expected uniquely solvable blank forms with private answers and replay-safe grading', () => {
  const expectedBlanks = {
    beginner: [0, 1, 'result'], leafy: [0, 1, 'result'], chewy: [0, 1, 'result'],
    bouncy: [0, 1, 'result'], crunchy: [0, 'result'], master: [0, 'result'],
  } as const;
  for (const baitId of BAIT_IDS.filter(id => id !== 'baby')) {
    const base = generated(baitId, () => 0, `${baitId}-base`);
    if (base.question.card.kind !== 'equation') throw new Error('Expected an equation');
    const solvable: Array<number | 'result'> = [];
    for (const blank of [0, 1, 'result'] as const) {
      const card = withBlank(base.question.card, blank);
      if (!card) continue;
      solvable.push(blank);
      const question = makeQuestion(card, `${baitId}-${blank}`, { mode: 'typed' });
      const q = { id: question.id, baitId, question, attempts: 0 };
      const progress = emptyProgress(); progress.points.pond = 60; progress.question = q;
      const projected = publicState(progress, 0).question!;
      assert.equal('answer' in projected, false); assert.equal('key' in projected, false);
      const wrong = applyCommand(progress, { type: 'answer', questionId: q.id, answer: question.answer as number + 1 }, 0);
      assert.equal(wrong.bait[baitId], 0); assert.equal(wrong.question?.id, q.id); assert.equal(wrong.question?.attempts, 1);
      const correct = applyCommand(wrong, { type: 'answer', questionId: q.id, answer: question.answer as number }, 0);
      assert.equal(correct.bait[baitId], 1); assert.equal(correct.question, null);
    }
    assert.deepEqual(solvable, expectedBlanks[baitId]);
  }
});

test('Baby Bait only asks for an addition result, without carrying across a ten', () => {
  const pairs = new Set<string>(), operands = new Set<number>();
  for (let seed = 0; seed < 300; seed++) {
    const q = generated('baby', seeded(seed), `baby-${seed}`);
    if (q.question.card.kind !== 'equation') throw new Error('Expected an equation');
    const [a,b] = q.question.card.operands as [number, number];
    assert.ok(a >= 10 && a <= 98 && b >= 0 && b <= 9);
    assert.ok(a % 10 + b < 10, `${a} + ${b} would require carrying`);
    assert.equal(q.question.card.operators[0], '+');
    assert.equal(q.question.card.blank, 'result');
    assert.equal(q.question.answer, a+b);
    pairs.add(`${a}+${b}`); operands.add(a); operands.add(b);
  }
  assert.ok(operands.size > 20, 'sample the full two-digit plus one-digit range');
  assert.ok([...pairs].every(pair => Number(pair.split('+')[0]) >= 10));
});

test('bait display names describe corn and worms without changing saved identifiers', () => {
  assert.equal(BAITS.baby.name, 'Baby Bait');
  assert.equal(BAITS.beginner.name, 'Corn Bait');
  assert.equal(BAITS.chewy.name, 'Worm Bait');
  assert.equal(BAITS.beginner.id, 'beginner');
  assert.equal(BAITS.chewy.id, 'chewy');
});

test('fishing multiplication stays within the reviewed shared single-digit levels', () => {
  for (const baitId of ['bouncy','crunchy'] as const) {
    const products = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const q = generated(baitId, seeded(seed), `${baitId}-${seed}`);
      if (q.question.card.kind !== 'equation') throw new Error('Expected an equation');
      const [a,b] = q.question.card.operands as [number, number];
      assert.ok(a >= 0 && a <= 9 && b >= 0 && b <= 9, `${a} × ${b}`);
      if (baitId === 'bouncy') assert.ok(a >= 2 && a <= 5 && b >= 2 && b <= 5);
      else assert.ok(a !== 0 || b !== 0);
      assert.ok(a * b <= 81);
      const complete = [a*b,a,b];
      const missing = q.question.card.blank === 'result' ? 0 : q.question.card.blank + 1;
      assert.equal(q.question.answer,complete[missing]);
      products.add(a*b);
    }
    assert.ok(products.size > 5);
    if (baitId === 'crunchy') assert.ok(products.size > 5);
  }
});

test('pending legacy questions keep their original grading without new layout metadata', () => {
  const state = emptyProgress();
  state.question = { id: 'legacy', baitId: 'baby', expression: '1 + 1 = ?', attempts: 0, answer: 2, operands: [1,1] } as never;
  const question = publicState(state, 0).question!;
  assert.equal(question.publicQuestion.card.kind, 'equation');
  assert.deepEqual(question.publicQuestion.card.values, [1, 1]);
  assert.equal(question.publicQuestion.card.result, null);
  assert.equal('operands' in question, false); assert.equal('answer' in question, false);
  const next = applyCommand(state, { type: 'answer', questionId: 'legacy', answer: 2 }, 0);
  assert.equal(next.bait.baby, 1); assert.equal(next.question, null);
});

test('continuous bait practice grades once and replaces only a correct answer with the same bait type',()=>{
 let state=emptyProgress();
 state=applyCommand(state,{type:'question',baitId:'baby'},0,()=>0,()=> 'first');
 const question=state.question!;
 const wrong=applyCommand(state,{type:'answer',questionId:question.id,answer:question.question.answer as number+1,continuePractice:true},1);
 assert.equal(wrong.question!.id,question.id);assert.equal(wrong.stats.questions,0);
 const correct=applyCommand(wrong,{type:'answer',questionId:question.id,answer:question.question.answer as number,continuePractice:true},2,()=>0,()=> 'next');
 assert.equal(correct.question!.id,'next');assert.equal(correct.question!.baitId,question.baitId);assert.equal(correct.question!.attempts,0);
 assert.equal(correct.stats.questions,1);assert.equal(correct.bait.baby,1);
 assert.throws(()=>applyCommand(correct,{type:'answer',questionId:question.id,answer:question.question.answer as number,continuePractice:true},3),/question/i);
 assert.equal('answer' in publicState(correct,3).question!,false);
});

test('recent fishing facts exclude swapped operands and every missing-number form across saved sessions',()=>{
 for(const bait of BAIT_IDS){
  let state=emptyProgress();state.points.pond=60;
  const recent:string[]=[];
  for(let i=0;i<24;i++){
   state=applyCommand(JSON.parse(JSON.stringify(state)),{type:'question',baitId:bait},i,()=>0,()=>`q-${i}`);
   const q=state.question!, card=q.question.card;
   if (card.kind !== 'equation') throw new Error('Expected an equation');
   if (card.kind !== 'equation') throw new Error('Expected an equation');
   const pair=['+','×'].includes(card.operators[0] ?? '')?[...card.operands].sort((a,b)=>a-b):card.operands;
   const fact=(card.operators[0] ?? '')+':'+pair.join(',');assert.ok(!recent.slice(-6).includes(fact),`${bait} repeated ${fact}`);recent.push(fact);
   assert.equal('recentFacts' in publicState(state,i),false);
   state=applyCommand(state,{type:'dismiss-question'},i);
  }
 }
});

test('seeded Fishing draws stay on each bait ladder level, vary solvable blanks and preserve the last-six rule', () => {
  const levels = { baby: 'addsub-2d1d', beginner: 'add-2d', leafy: 'addsub-20', chewy: 'sub-2d', bouncy: 'mul-2to5', crunchy: 'mul-1d', master: 'div-1d' } as const;
  for (const bait of BAIT_IDS) {
    let state = emptyProgress(); state.points.pond = 60;
    const recent: string[] = [], blanks = [0, 0, 0]; const random = seeded(bait.length * 97);
    for (let index = 0; index < 120; index += 1) {
      state = applyCommand(state, { type: 'question', baitId: bait }, index, random, () => `${bait}-${index}`);
      const question = state.question;
      if (!question || question.question.card.kind !== 'equation') throw new Error('Expected an equation');
      const card = question.question.card;
      assert.equal(card.level, levels[bait]);
      const blankIndex = card.blank === 'result' ? 0 : card.blank + 1;
      blanks[blankIndex] = (blanks[blankIndex] ?? 0) + 1;
      assert.equal(recent.slice(-6).includes(question.question.key), false, `${bait} repeated ${question.question.key}`);
      recent.push(question.question.key);
      state = applyCommand(state, { type: 'dismiss-question' }, index, random, () => `${bait}-dismiss-${index}`);
    }
    if (bait === 'baby') assert.equal(blanks[0], 120);
    else { assert.ok(blanks.every(count => count > 20), `${bait} blank distribution ${blanks.join(',')}`); assert.ok(Math.max(...blanks) - Math.min(...blanks) < 35, `${bait} blank distribution ${blanks.join(',')}`); }
  }
});
