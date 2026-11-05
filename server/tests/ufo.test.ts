import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { startSession, applyAction, publicState, emptyProgress, achievements } from '../src/ufo/game.js';
const words = [{ id: 'meme', word: 'MEME', clue: 'A funny picture shared online.', definition: 'A shared internet joke.', difficulty: 'easy' as const }];
const settings = { difficulty: 'easy' as const, animal: 'cow' as const, background: 'farm' as const };
function fresh() {
  return startSession(emptyProgress(), settings, words, 1000, () => 0);
}
test('guesses reveal repeated letters and duplicates cost nothing', () => {

  let s = fresh();
  s = applyAction(s, { type: 'guess', letter: 'E' }, words, 1001, () => 0);

  assert.deepEqual(publicState(s).session?.letters, ['_', 'E', '_', 'E']);

  s = applyAction(s, { type: 'guess', letter: 'X' }, words, 1002, () => 0);

  s = applyAction(s, { type: 'guess', letter: 'X' }, words, 1003, () => 0);

  assert.equal(s.session?.danger, 1);

  assert.equal(JSON.stringify(publicState(s)).includes('MEME'), false);

});
test('hint completes word once, rewards charge, next keeps danger and refreshes hints', () => {

  let s = fresh();
  s = applyAction(s, { type: 'guess', letter: 'X' }, words, 1001, () => 0);

  s = applyAction(s, { type: 'guess', letter: 'E' }, words, 1002, () => 0);

  s = applyAction(s, { type: 'hint' }, words, 1003, () => 0);

  assert.equal(s.session?.status, 'solved');
  assert.equal(s.stats.solved, 1);
  assert.equal(s.session?.charges, 1);

  assert.throws(() => applyAction(s, { type: 'next' }, words, 2000, () => 0));

  s = applyAction(s, { type: 'next' }, words, 6003, () => 0);

  assert.equal(s.session?.danger, 1);
  assert.equal(s.session?.hints, 2);

});
test('capture at ten, shoo restores allowance with cooldown and original-position limit', () => {

  let s = fresh();
  s.session!.charges = 3;

  for (const [i, letter] of [...'ABCDFGHIJ'].entries())
    s = applyAction(s, { type: 'guess', letter }, words, 1100 + i, () => 0);

  assert.equal(s.session?.danger, 9);

  s = applyAction(s, { type: 'shoo' }, words, 2000, () => 0);
  assert.equal(s.session?.danger, 8);

  assert.throws(() => applyAction(s, { type: 'shoo' }, words, 2100, () => 0));

  s = applyAction(s, { type: 'guess', letter: 'K' }, words, 2600, () => 0);

  s = applyAction(s, { type: 'guess', letter: 'L' }, words, 2601, () => 0);

  assert.equal(s.session?.status, 'captured');
  assert.equal(s.stats.captures.cow, 1);

  assert.equal(publicState(s).session?.answer, 'MEME');

  assert.throws(() => applyAction(s, { type: 'guess', letter: 'N' }, words, 3000, () => 0));

});
test('new session preserves lifetime achievements and seen words; immutable word snapshot', () => {

  let s = fresh();
  const updated = [{ ...words[0]!, word: 'CAT', clue: 'A pet.' }];

  s = applyAction(s, { type: 'guess', letter: 'M' }, updated, 1001, () => 0);

  s = applyAction(s, { type: 'guess', letter: 'E' }, updated, 1002, () => 0);

  assert.equal(s.session?.word.word, 'MEME');
  assert.equal(achievements(s.stats).find(a => a.id === 'first')?.earned, true);

  s = startSession(s, settings, updated, 7000, () => 0);
  assert.equal(s.stats.solved, 1);
  assert.equal(s.session?.word.word, 'CAT');
  assert.equal(s.session?.charges, 0);

});
test('charge cap, per-difficulty hints, non-repeating selection and safe origin shoo', () => {

  const pool = [...words, { ...words[0]!, id: 'cat', word: 'CAT' }];
  let s = startSession(emptyProgress(), settings, pool, 1000, () => 0);

  assert.throws(() => applyAction(s, { type: 'shoo' }, pool, 2000, () => 0));
  s.session!.charges = 3;

  for (const letter of 'ME')
    s = applyAction(s, { type: 'guess', letter }, pool, 2000, () => 0);

  assert.equal(s.session?.charges, 3);
  s = applyAction(s, { type: 'next' }, pool, 7000, () => 0);
  assert.equal(s.session?.word.word, 'CAT');

  for (const difficulty of ['medium', 'hard'] as const) {
    const p = pool.map(w => ({ ...w, difficulty }));
    assert.equal(startSession(s, { ...settings, difficulty }, p, 9000, () => 0).session?.hints, 1);
  }

});

test('English master dictionary has 290 unique bounded entries and matches the review copy',async()=>{
 const {default:words}=await import('../src/ufo/dictionary.js');
 assert.equal(words.length,290);assert.equal(new Set(words.map(w=>w.word)).size,290);
 for(const [difficulty,count] of [['easy',200],['medium',60],['hard',30]] as const)assert.equal(words.filter(w=>w.difficulty===difficulty).length,count);
 const review = JSON.parse(await readFile(new URL('../../docs/game-design/ufo-word-dictionary.json', import.meta.url), 'utf8'));
 assert.deepEqual(words, review.entries);
 for(const w of words){assert.match(w.word,/^[A-Z]{2,18}$/);assert.ok(w.clue.length>=3&&w.clue.length<=180);assert.ok(w.definition.length>=3&&w.definition.length<=220);assert.equal(new RegExp(`\\b${w.word}\\b`,'i').test(w.clue),false);}
});

test('Vietnamese selection is separate, tones reveal with base letters, spaces are free', async () => {
  const { guessKey } = await import('../src/ufo/letters.js');
  const pool = [...words, { id: 'vi-tet', language: 'vi' as const, word: 'TẾT ĐẾN', clue: 'Ngày đầu năm âm lịch.', definition: 'Dịp đón năm mới.', difficulty: 'easy' as const }];
  let p = startSession(emptyProgress(), { ...settings, language: 'vi' }, pool, 1000, () => 0);
  assert.equal(p.session!.word.id, 'vi-tet');
  assert.deepEqual(publicState(p).session!.letters, ['_', '_', '_', ' ', '_', '_', '_']);
  assert.throws(() => applyAction(p, { type: 'guess', letter: 'F' }, pool, 1001, () => 0));
  p = applyAction(p, { type: 'guess', letter: 'Ê' }, pool, 1002, () => 0);
  assert.deepEqual(publicState(p).session!.letters, ['_', 'Ế', '_', ' ', '_', 'Ế', '_']);
  for (const letter of ['T', 'Đ', 'N']) p = applyAction(p, { type: 'guess', letter }, pool, 1003, () => 0);
  assert.equal(p.session!.status, 'solved');
  assert.equal(p.session!.danger, 0);
  assert.equal(guessKey('Ợ'), 'Ơ'); assert.equal(guessKey('Ắ'), 'Ă'); assert.equal(guessKey('Ấ'), 'Â');
  const legacy = startSession(emptyProgress(), settings, pool, 1000, () => 0);
  assert.equal(legacy.session!.word.id, 'meme');
});

test('Vietnamese hints reveal base letters with tones without guessing spaces', () => {
  const pool = [{ id: 'vi', language: 'vi' as const, word: 'BÒ BÓ', clue: 'Gợi ý cho thử nghiệm.', definition: 'Nghĩa cho thử nghiệm.', difficulty: 'easy' as const }];
  let p = startSession(emptyProgress(), { ...settings, language: 'vi' }, pool, 1000, () => 0);
  p = applyAction(p, { type: 'hint' }, pool, 1001, () => 0);
  p = applyAction(p, { type: 'hint' }, pool, 1002, () => 0);
  assert.equal(p.session!.status, 'solved'); assert.equal(p.session!.guessed.includes(' '), false);
  assert.deepEqual(publicState(p).session!.letters, ['B', 'Ò', ' ', 'B', 'Ó']);
});

test('public UFO achievements stay in the English UI language for Vietnamese sessions', () => {
  const progress = startSession(emptyProgress(), { ...settings, language: 'vi' }, [{ id: 'vi', language: 'vi', word: 'BÒ', clue: 'Gợi ý.', definition: 'Nghĩa.', difficulty: 'easy' }], 1000, () => 0);
  const first = publicState(progress).achievements.find((achievement) => achievement.id === 'first');
  assert.equal(first?.name, 'First Word!');
  assert.equal(first?.description, 'Solve 1 word.');
});

test('Vietnamese starter has 190 independent valid entries with matching difficulty counts', async () => {
  const { default: vietnamese } = await import('../src/ufo/dictionary.vi.js');
  const { wordSchema } = await import('../src/ufo/routes.js');
  assert.equal(vietnamese.length, 190); assert.equal(new Set(vietnamese.map(word => word.id)).size, 190);
  assert.equal(new Set(vietnamese.map(word => word.word)).size, 190);
  for (const [difficulty, count] of [['easy', 100], ['medium', 60], ['hard', 30]] as const) assert.equal(vietnamese.filter(word => word.difficulty === difficulty).length, count);
  for (const { id, ...word } of vietnamese) { assert.ok(id.startsWith('master-vi-')); assert.equal(wordSchema.safeParse(word).success, true, word.word); }
  assert.equal(wordSchema.safeParse({ language: 'vi', word: 'ЯЯ', difficulty: 'easy', clue: 'Gợi ý.', definition: 'Nghĩa.' }).success, false);
});
