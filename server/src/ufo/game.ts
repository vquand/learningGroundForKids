import { ENGLISH_LETTERS, VIETNAMESE_LETTERS, guessKey } from './letters.ts';
import { AppError } from '../errors.ts';
export type Language = 'en' | 'vi';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Animal = 'cow' | 'highland' | 'sheep' | 'capybara';
export interface Settings { language?: Language; difficulty: Difficulty; animal: Animal; background: 'farm' | 'forest' | 'lake' }
export interface Word { language?: Language; id: string; word: string; difficulty: Difficulty; clue: string; definition: string }
export interface Stats { solved: number; medium: number; hard: number; shoo: number; friends: Record<Animal, number>; captures: Record<Animal, number> }
export interface Session extends Settings { word: Word; guessed: string[]; hints: number; danger: number; charges: number; solved: number; status: 'playing' | 'solved' | 'captured'; solvedAt: number; lastShoo: number }
export interface Progress { revision: number; session: Session | null; stats: Stats; seen: Record<Difficulty, string[]>; last: Record<Difficulty, string> }
export type Action = { type: 'guess'; letter: string } | { type: 'hint' | 'shoo' | 'next' };
const counts = (): Record<Animal, number> => ({ cow: 0, highland: 0, sheep: 0, capybara: 0 });
export function emptyProgress(): Progress {
  return { revision: 0, session: null, stats: { solved: 0, medium: 0, hard: 0, shoo: 0, friends: counts(), captures: counts() }, seen: { easy: [], medium: [], hard: [] }, last: { easy: '', medium: '', hard: '' } };
}
function unavailable(message: string): never {
  throw new AppError(409, 'UFO_ACTION_UNAVAILABLE', message);
}
function choose(p: Progress, difficulty: Difficulty, words: Word[], pick: (n: number) => number, language: Language = 'en'): Word {

  const pool = words.filter(w => w.difficulty === difficulty && (w.language ?? 'en') === language);

  if (!pool.length)
    throw new AppError(422, 'UFO_DICTIONARY_EMPTY', 'No words are available for this difficulty. Ask an adult to load the master dictionary.');

  const ids = new Set(pool.map(w => w.id));

  let available = pool.filter(w => !p.seen[difficulty].includes(w.id));

  if (!available.length) {
    p.seen[difficulty] = p.seen[difficulty].filter(id => !ids.has(id));
    available = pool.filter(w => pool.length === 1 || w.id !== p.last[difficulty]);
  }

  const word = available[pick(available.length)]!;
  p.seen[difficulty].push(word.id);
  p.last[difficulty] = word.id;
  return { ...word };

}
export function startSession(progress: Progress, settings: Settings, words: Word[], _now: number, pick: (n: number) => number): Progress {

  const p = structuredClone(progress);
  const word = choose(p, settings.difficulty, words, pick, settings.language ?? 'en');

  p.session = { ...settings, language: settings.language ?? 'en', word, guessed: [], hints: settings.difficulty === 'easy' ? 2 : 1, danger: 0, charges: 0, solved: 0, status: 'playing', solvedAt: 0, lastShoo: 0 };
  return p;

}
export function applyAction(progress: Progress, action: Action, words: Word[], now: number, pick: (n: number) => number): Progress {

  const p = structuredClone(progress);
  const s = p.session;
  if (!s)
    unavailable('Start a game first.');

  if (action.type === 'next') {

    if (s.status !== 'solved' || now - s.solvedAt < 5000)
      unavailable('Enjoy your celebration first.');

    s.word = choose(p, s.difficulty, words, pick, s.language ?? 'en');
    s.guessed = [];
    s.hints = s.difficulty === 'easy' ? 2 : 1;
    s.status = 'playing';
    s.solvedAt = 0;
    return p;

  }

  if (s.status !== 'playing')
    unavailable('This word has finished.');

  if (action.type === 'shoo') {

    if (!s.charges || !s.danger || now - s.lastShoo < 500)
      unavailable('Shoo is not ready yet.');

    s.charges--;
    s.danger--;
    s.lastShoo = now;
    p.stats.shoo++;
    return p;

  }

  if (action.type === 'hint') {

    if (s.hints <= 0)
      unavailable('No hints remain for this word.');

    const letters = [...new Set([...s.word.word].map(guessKey))].filter(l => l !== ' ' && !s.guessed.includes(l));
    s.guessed.push(letters[pick(letters.length)]!);
    s.hints--;

  }
  else
    if (action.type === 'guess') {

      if (action.letter.length !== 1 || !(s.language === 'vi' ? VIETNAMESE_LETTERS : ENGLISH_LETTERS).includes(action.letter))
        throw new AppError(422, 'VALIDATION_ERROR', 'Choose one letter from A to Z.');

      if (s.guessed.includes(action.letter))
        return p;
      s.guessed.push(action.letter);
      if (![...s.word.word].some(l => guessKey(l) === action.letter))
        s.danger++;

    }

  if (s.danger >= 10) {
    s.status = 'captured';
    p.stats.captures[s.animal]++;
  }
  else
    if ([...s.word.word].every(l => l === ' ' || s.guessed.includes(guessKey(l)))) {

      s.status = 'solved';
      s.solvedAt = now;
      s.charges = Math.min(3, s.charges + 1);
      s.solved++;
      p.stats.solved++;
      p.stats.friends[s.animal]++;

      if (s.difficulty !== 'easy')
        p.stats[s.difficulty]++;

    }

  return p;

}
export function achievements(stats: Stats, language: Language = 'en') {

  const defs: [string, string, string, number, number][] = [
    ['first', 'First Word!', 'Solve 1 word.', stats.solved, 1], ['gardener', 'Word Gardener', 'Solve 25 words.', stats.solved, 25], ['wizard', 'Word Wizard', 'Solve 100 words.', stats.solved, 100],
    ['curious', 'Curious Mind', 'Solve 10 medium words.', stats.medium, 10], ['hero', 'Hard Word Hero', 'Solve 3 hard words.', stats.hard, 3], ['shoo', 'Shoo Shoo!', 'Use 10 UFO charges.', stats.shoo, 10],
    ['moo', 'MOO MOO NO NO', 'Take 5 space trips with the dairy cow.', stats.captures.cow, 5], ['fluffy', 'Fluffy Flight', 'Take 5 space trips with the Highland cow.', stats.captures.highland, 5],
    ['space-sheep', 'Sheep in Space', 'Take 5 space trips with the sheep.', stats.captures.sheep, 5], ['cosmic', 'Capy Cosmic Trip', 'Take 5 space trips with the capybara.', stats.captures.capybara, 5],
    ['milk', 'Milk & Letters', 'Solve 10 words with the dairy cow.', stats.friends.cow, 10], ['highland', 'Highland Scholar', 'Solve 10 words with the Highland cow.', stats.friends.highland, 10],
    ['woolly', 'Woolly Wordsmith', 'Solve 10 words with the sheep.', stats.friends.sheep, 10], ['capy', 'Capy Clever', 'Solve 10 words with the capybara.', stats.friends.capybara, 10],
    ['friends', 'Farm Friends', 'Solve 5 words with each animal.', Math.min(...Object.values(stats.friends)), 5],
  ];
  const vi: Record<string, [string, string]> = {
    first: ['Từ đầu tiên!', 'Đoán đúng 1 từ.'], gardener: ['Vườn từ vựng', 'Đoán đúng 25 từ.'], wizard: ['Phù thủy chữ', 'Đoán đúng 100 từ.'],
    curious: ['Trí tò mò', 'Đoán đúng 10 từ mức vừa.'], hero: ['Người hùng từ khó', 'Đoán đúng 3 từ khó.'], shoo: ['UFO ơi, đi đi!', 'Dùng 10 lượt xua UFO.'],
    moo: ['Bò sữa du hành', 'Cùng bò sữa đi vũ trụ 5 lần.'], fluffy: ['Chuyến bay bông xù', 'Cùng bò lông dài đi vũ trụ 5 lần.'],
    'space-sheep': ['Cừu ngoài vũ trụ', 'Cùng cừu đi vũ trụ 5 lần.'], cosmic: ['Du hành cùng chuột lang', 'Cùng chuột lang nước đi vũ trụ 5 lần.'],
    milk: ['Sữa và chữ cái', 'Cùng bò sữa đoán đúng 10 từ.'], highland: ['Bò lông dài thông thái', 'Cùng bò lông dài đoán đúng 10 từ.'],
    woolly: ['Cừu giỏi chữ', 'Cùng cừu đoán đúng 10 từ.'], capy: ['Chuột lang thông minh', 'Cùng chuột lang nước đoán đúng 10 từ.'],
    friends: ['Bạn bè nông trại', 'Đoán đúng 5 từ cùng mỗi bạn động vật.'],
  };
  return defs.map(([id, name, description, current, target], index) => ({ id, name: language === 'vi' ? vi[id]?.[0] ?? name : name, description: language === 'vi' ? vi[id]?.[1] ?? description : description, current, target, earned: current >= target, logo: index }));

}
export function publicState(p: Progress) {

  const s = p.session;
  return {
revision: p.revision, stats: p.stats, achievements: achievements(p.stats), session: s ? {
      language: s.language ?? 'en', difficulty: s.difficulty, animal: s.animal, background: s.background, guessed: s.guessed, hints: s.hints, danger: s.danger, charges: s.charges, solved: s.solved, status: s.status,
      clue: s.word.clue, letters: [...s.word.word].map(l => l === ' ' || s.guessed.includes(guessKey(l)) ? l : '_'), answer: s.status === 'playing' ? null : s.word.word, definition: s.status === 'playing' ? null : s.word.definition,
      celebrationEndsAt: s.status === 'solved' ? s.solvedAt + 5000 : null, shooReadyAt: s.lastShoo + 500,
    } : null
};

}
export type PublicState = ReturnType<typeof publicState>;
