import { AppError } from '../errors.ts';
import { publicQuestion } from '../questions/projection.ts';
import { fromMathWallQuestion, questionKeyFromMathWall } from '../questions/legacy.ts';
import { questionKey } from '../questions/identity.ts';
import { difficultyOf, generateQuestion, selectQuestion, type Difficulty, type Question } from './questions.ts';
export { generateQuestion } from './questions.ts';
export type { Difficulty, Question } from './questions.ts';

export interface Settings { animal: 'capybara' | 'cow' | 'highland'; language: 'en' | 'vi'; wall: 'brick' | 'blocks' | 'stone' | 'garden' }
export interface Session extends Settings {
  question: Question; phase: 'playing' | 'resolved' | 'paused' | 'finished';
  pausedFrom: 'playing' | 'resolved'; remaining: number; deadline: number;
  lane: number; wave: number; score: number; streak: number;
  difficulty: Difficulty; result: 'pass' | 'splash' | null; cooldown: boolean;
  earnedBadges?: string[];
  seenQuestions?: string[];
  recentCorrectLanes?: number[];
}
export interface Progress { revision: number; best: number; stats: { passed: number; medium: number; hard: number; streak: number }; session: Session | null }
export type Action = { type: 'lane'; lane: number } | { type: 'settle' | 'next' | 'pause' | 'resume' | 'finish' };
export const duration = { easy: 10000, medium: 15000, hard: 20000 };
const points = { easy: 1, medium: 2, hard: 3 };
export function emptyProgress(): Progress { return { revision: 0, best: 0, stats: { passed: 0, medium: 0, hard: 0, streak: 0 }, session: null }; }
export function difficultyWeights(passed: number, cooldown: boolean) {
  const growth = Math.min(passed / 40, 1);
  const hard = (0.04 + growth * 0.26) * (cooldown ? 0.25 : 1);
  const medium = (0.16 + growth * 0.24) * (cooldown ? 0.5 : 1);
  return { easy: 1 - medium - hard, medium, hard };
}
function chooseDifficulty(p: Session, pick: (n: number) => number): Difficulty {
  const weights = difficultyWeights(p.wave - 1, p.cooldown);
  const roll = pick(10000) / 10000;
  return roll < weights.hard ? 'hard' : roll < weights.hard + weights.medium ? 'medium' : 'easy';
}
function correctLane(question: Question): number {
  if (question.response.mode !== 'choice') throw new AppError(500, 'MATH_WALL_INVALID_QUESTION', 'Waddle Wall question is not multiple choice.');
  return question.response.correct;
}
function replaceCorrectLane(question: Question, lane: number): Question {
  if (question.response.mode !== 'choice') return question;
  const choices = [...question.response.choices];
  const original = question.response.correct;
  [choices[lane], choices[original]] = [choices[original]!, choices[lane]!];
  return { ...question, response: { mode: 'choice', choices, correct: lane } };
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function savedDifficulty(session: Session & { question?: unknown }): Difficulty {
  if (isDifficulty(session.difficulty)) return session.difficulty;
  const question = session.question as { difficulty?: unknown } | null;
  return isDifficulty(question?.difficulty) ? question.difficulty : 'easy';
}

/** Convert persisted Math Wall data without changing the game position. */
export function normalizeProgress(progress: Progress, pick: (n: number) => number = (n) => Math.floor(n / 2)): Progress {
  const session = progress.session as (Session & { question?: unknown }) | null;
  if (!session) return progress;
  const seen = new Set((session.seenQuestions ?? []).flatMap((value) => {
    const key = questionKeyFromMathWall(value);
    return key ? [key] : [];
  }));
  const converted = fromMathWallQuestion(session.question);
  if (converted) {
    seen.add(converted.key);
    return { ...progress, session: { ...session, difficulty: difficultyOf(converted), question: converted, seenQuestions: [...seen] } };
  }
  let replacement: Question | null = null;
  try {
    replacement = generateQuestion(savedDifficulty(session), pick, seen, `waddle-question-${session.wave}`);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    /* Keep an exhausted repaired save finished. */
  }
  if (!replacement) return { ...progress, session: { ...session, phase: 'finished', seenQuestions: [...seen] } };
  seen.add(replacement.key);
  return { ...progress, session: { ...session, difficulty: difficultyOf(replacement), question: replacement, seenQuestions: [...seen] } };
}

export function startSession(progress: Progress, settings: Settings, now: number, pick: (n: number) => number): Progress {
  if (progress.session && progress.session.phase !== 'finished') unavailable('Finish your current game before starting another.');
  const p = structuredClone(progress);
  const question = generateQuestion('easy', pick, new Set(), 'waddle-question-1');
  p.session = { ...settings, question, difficulty: 'easy', phase: 'playing', pausedFrom: 'playing', remaining: 0, deadline: now + duration.easy,
    lane: 1, wave: 1, score: 0, streak: 0, result: null, cooldown: false, earnedBadges: [], seenQuestions: [question.key], recentCorrectLanes: [correctLane(question)] };
  return p;
}
function unavailable(message: string): never { throw new AppError(409, 'MATH_WALL_ACTION_UNAVAILABLE', message); }
function settle(p: Progress, now: number) {
  const s = p.session!;
  s.result = s.lane === correctLane(s.question) ? 'pass' : 'splash';
  s.phase = 'resolved'; s.deadline = now + 2200;
  if (s.result === 'pass') {
    const alreadyEarned = new Set(achievements(p).filter(a => a.earned).map(a => a.id));
    s.score += points[s.difficulty]; s.streak++; p.stats.passed++;
    if (s.difficulty !== 'easy') p.stats[s.difficulty]++;
    p.stats.streak = Math.max(p.stats.streak, s.streak); p.best = Math.max(p.best, s.score);
    s.earnedBadges = [...(s.earnedBadges ?? []), ...achievements(p).filter(a => a.earned && !alreadyEarned.has(a.id)).map(a => a.id)];
  } else s.streak = 0;
  s.cooldown = s.result === 'pass' && s.difficulty !== 'easy';
}
export function applyAction(progress: Progress, action: Action, now: number, pick: (n: number) => number): Progress {
  const p = structuredClone(progress), s = p.session;
  if (!s || s.phase === 'finished') unavailable('Start a game first.');
  if (action.type === 'finish') {
    if (s.phase === 'playing' && now >= s.deadline) settle(p, now);
    s.phase = 'finished'; return p;
  }
  if (action.type === 'pause') {
    if (s.phase === 'paused') unavailable('Already paused.');
    if (s.phase === 'playing' && now >= s.deadline) settle(p, now);
    if (s.result === 'splash') { s.phase = 'finished'; return p; }
    s.pausedFrom = s.phase; s.remaining = Math.max(0, s.deadline - now); s.phase = 'paused'; return p;
  }
  if (action.type === 'resume') {
    if (s.phase !== 'paused') unavailable('Pause first.');
    if (s.result === 'splash') { s.phase = 'finished'; return p; }
    s.phase = s.pausedFrom; s.deadline = now + s.remaining; return p;
  }
  if (action.type === 'lane') {
    if (s.phase !== 'playing' || now >= s.deadline) unavailable('The wall has arrived.');
    if (!Number.isInteger(action.lane) || action.lane < 0 || action.lane > 2) unavailable('Choose lane 1, 2, or 3.');
    s.lane = action.lane; return p;
  }
  if (action.type === 'settle') {
    if (s.phase !== 'playing' || now < s.deadline) unavailable('Wait for the wall.');
    settle(p, now); return p;
  }
  if (s.phase !== 'resolved' || now < s.deadline) unavailable('Enjoy the splash or celebration first.');
  if (s.result === 'splash') { s.phase = 'finished'; return p; }
  const seen = new Set([...(s.seenQuestions ?? []), questionKey(s.question)]);
  const nextDifficulty = chooseDifficulty({ ...s, wave: s.wave + 1 }, pick);
  const question = selectQuestion(nextDifficulty, pick, seen, `waddle-question-${s.wave + 1}`);
  if (!question) { s.phase = 'finished'; return p; }
  const recentLanes = s.recentCorrectLanes ?? [correctLane(s.question)];
  let arranged = question;
  if (recentLanes.length >= 2 && recentLanes.slice(-2).every(lane => lane === correctLane(question))) {
    const allowed = [0, 1, 2].filter(lane => lane !== correctLane(question));
    arranged = replaceCorrectLane(question, allowed[pick(allowed.length)]!);
  }
  s.recentCorrectLanes = [...recentLanes, correctLane(arranged)].slice(-2);
  seen.add(arranged.key); s.seenQuestions = [...seen]; s.wave++; s.question = arranged; s.difficulty = difficultyOf(arranged);
  s.phase = 'playing'; s.deadline = now + duration[s.difficulty]; s.result = null;
  return p;
}
export function achievements(p: Progress) {
  const defs = [
    ['first', 'First Waddle', 'Bước đầu tiên', 'Pass your first wall.', 'Vượt qua bức tường đầu tiên.', p.stats.passed, 1],
    ['ten', 'Wall Wanderer', 'Bạn vượt tường', 'Pass 10 walls.', 'Vượt qua 10 bức tường.', p.stats.passed, 10],
    ['fifty', 'Poolside Pro', 'Cao thủ bên hồ', 'Pass 50 walls.', 'Vượt qua 50 bức tường.', p.stats.passed, 50],
    ['streak', 'Heart Parade', 'Diễu hành trái tim', 'Pass 5 walls in a row.', 'Vượt qua 5 bức tường liên tiếp.', p.stats.streak, 5],
    ['medium', 'Sunny Thinker', 'Nhà toán học nhỏ', 'Pass 10 medium walls.', 'Vượt qua 10 tường mức vừa.', p.stats.medium, 10],
    ['hard', 'Orange Explorer', 'Nhà thám hiểm cam', 'Pass 5 hard walls.', 'Vượt qua 5 tường mức khó.', p.stats.hard, 5],
    ['scientist', 'Math Scientist', 'Nhà khoa học toán', 'Pass 10 hard walls.', 'Vượt qua 10 tường mức khó.', p.stats.hard, 10],
  ] as const;
  return defs.map(([id, name, nameVi, description, descriptionVi, current, target], logo) => ({ id, name, nameVi, description, descriptionVi, current, target, earned: current >= target, logo }));
}
export function publicState(p: Progress, now: number) {
  const s = p.session;
  const collection = achievements(p);
  return { revision: p.revision, serverNow: now, best: p.best, achievements: collection, session: s ? {
    animal: s.animal, language: s.language, wall: s.wall, phase: s.phase, pausedFrom: s.pausedFrom,
    remaining: s.remaining, deadline: s.deadline, lane: s.lane, wave: s.wave, score: s.score,
    difficulty: s.difficulty, question: publicQuestion(s.question), result: s.result,
    correctLane: s.result === null ? null : correctLane(s.question),
    earnedBadges: collection.filter(a => a.earned && s.earnedBadges?.includes(a.id)),
  } : null };
}
export type PublicState = ReturnType<typeof publicState>;
