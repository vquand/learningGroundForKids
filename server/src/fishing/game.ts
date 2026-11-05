import { AppError } from '../errors.js';
import { fromFishingQuestion, fishingSeenKey } from '../questions/legacy.ts';
import { gradeQuestion, makeQuestion, questionKey } from '../questions/identity.ts';
import { publicQuestion } from '../questions/projection.ts';
import { fromBoundedRandom } from '../questions/random.ts';
import { selectQuestion } from '../questions/select.ts';
import { BAIT_IDS, BAITS, CAST_DURATION_MS, CATCH_TABLES, FISH, FISH_IDS, HEARTBEAT_LEASE_MS, LOCATIONS, RESULT_HOLD_MS, type BaitId, type FishId, type LocationId, type RetainedFishId } from './catalog.js';
import { FISHING_ACHIEVEMENTS, fishingAchievementMetrics } from './achievements.js';
import { BAIT_LEVELS } from './config.js';
import type { FishingCommand, FishingProgress, FishingPublicState, FishingQuestion } from './types.js';
export type { FishingCommand, FishingProgress, FishingPublicState } from './types.js';

type Random = (maximumExclusive: number) => number;

function fail(code: string, message: string): never { throw new AppError(409, code, message); }
export const riverUnlocked = (state: Pick<FishingProgress, 'points'>): boolean => state.points.pond >= LOCATIONS.pond.target;
export const baitUnlocked = (state: Pick<FishingProgress, 'points'>, bait: BaitId): boolean => BAITS[bait].unlock === 'pond' || riverUnlocked(state);
function isBaitId(value: unknown): value is BaitId { return typeof value === 'string' && BAIT_IDS.includes(value as BaitId); }
function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null; }
function attempts(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0; }

function issueQuestion(state: FishingProgress, bait: BaitId, random: Random, id: () => string): FishingQuestion {
  const config = BAIT_LEVELS[bait];
  const card = selectQuestion(config.level, fromBoundedRandom(random), new Set(state.recentFacts ?? []), { operators: config.operators, blank: bait === 'baby' ? 'result' : 'any' });
  if (!card) throw new RangeError(`No Fishing question remains for ${bait}`);
  const question = makeQuestion(card, id(), { mode: 'typed' });
  state.recentFacts = [...(state.recentFacts ?? []), questionKey(card)].slice(-6);
  return { id: question.id, baitId: bait, question, attempts: 0 };
}

function savedBait(value: unknown): BaitId | null {
  const source = record(value), nested = record(source?.question), valueFromSave = source?.baitId ?? nested?.baitId;
  return isBaitId(valueFromSave) ? valueFromSave : null;
}

/** Convert old Fishing saves before game logic or projections see them. */
export function normalizeProgress(previous: FishingProgress, random: Random = () => 0, id: () => string = () => 'fishing-repair-question'): FishingProgress {
  const state = structuredClone(previous) as FishingProgress;
  const history = Array.isArray(state.recentFacts) ? state.recentFacts.flatMap(value => { const key = fishingSeenKey(value); return key ? [key] : []; }).slice(-6) : [];
  state.recentFacts = history;
  const rawQuestion = state.question as unknown;
  if (rawQuestion === null || rawQuestion === undefined) state.question = null;
  else {
    const bait = savedBait(rawQuestion), converted = fromFishingQuestion(rawQuestion, BAIT_LEVELS);
    if (bait && converted) {
      state.question = { id: converted.id, baitId: bait, question: converted, attempts: attempts(record(rawQuestion)?.attempts) };
      state.recentFacts = [...new Set([...history, converted.key])].slice(-6);
    } else if (bait) state.question = issueQuestion(state, bait, random, id);
    else state.question = null;
  }
  const validClock = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  state.running = state.running === true && validClock(state.lastActivityAt);
  state.lastActivityAt = validClock(state.lastActivityAt) ? state.lastActivityAt : 0;
  state.nextCastAt = validClock(state.nextCastAt) ? state.nextCastAt : 0;
  if (state.cast?.phase === 'waiting' && !state.running) state.cast.paused = true;
  return state;
}

export function emptyProgress(): FishingProgress {
  return { revision: 0, running: false, lastActivityAt: 0, nextCastAt: 0, companion: 'highland', location: 'pond', selectedBait: 'baby',
    bait: Object.fromEntries(BAIT_IDS.map(id => [id, 0])) as Record<BaitId, number>, points: { pond: 0, river: 0 },
    inventory: Object.fromEntries(FISH_IDS.filter(id => id !== 'T1').map(id => [id, 0])) as Record<RetainedFishId, number>,
    discovered: { pond: [], river: [] }, stats: { casts: 0, caught: 0, garbage: 0, questions: 0 }, earnedBaits: [], friendCatches: [], earned: {}, question: null, cast: null };
}

export function sampleCatch(location: LocationId, bait: BaitId, random: Random): FishId | null {
  const roll = random(100); let cumulative = 0;
  for (const entry of CATCH_TABLES[location][bait]) { cumulative += entry.percent; if (roll < cumulative) return entry.fishId; }
  throw new Error('Invalid fishing probability table');
}

export function pauseExpired(state: FishingProgress, now: number): boolean {
  if (state.running && now - state.lastActivityAt > HEARTBEAT_LEASE_MS) { state.running = false; if (state.cast?.phase === 'waiting') state.cast.paused = true; return true; }
  return false;
}

function startNext(state: FishingProgress, now: number, random: Random, id: () => string) {
  if (!state.running || state.cast?.phase === 'waiting' || now < state.nextCastAt) return;
  const compatible = (bait: BaitId) => baitUnlocked(state, bait) && state.bait[bait] > 0 && CATCH_TABLES[state.location][bait].some(entry => entry.fishId !== null);
  const bait = compatible(state.selectedBait) ? state.selectedBait : BAIT_IDS.find(compatible);
  if (!bait) return;
  state.bait[bait]--; state.stats.casts++; state.nextCastAt = 0;
  state.cast = { id: id(), baitId: bait, location: state.location, companion: state.companion, remainingMs: CAST_DURATION_MS, paused: false, phase: 'waiting', outcome: sampleCatch(state.location, bait, random), garbageVariant: random(3), lastTickAt: now };
}

function award(state: FishingProgress, now: number) {
  const metrics = fishingAchievementMetrics(state);
  for (const achievement of FISHING_ACHIEVEMENTS) if (!state.earned[achievement.id] && metrics[achievement.metric] >= achievement.target) state.earned[achievement.id] = new Date(now).toISOString();
}

function complete(state: FishingProgress, now: number) {
  const cast = state.cast; if (!cast) return;
  cast.phase = 'result'; cast.remainingMs = 0; cast.paused = false; state.nextCastAt = now + RESULT_HOLD_MS; cast.fishId = cast.outcome;
  if (cast.outcome === null) { state.stats.garbage++; cast.garbageIndex = cast.garbageVariant; cast.stamina = 0; cast.points = 0; }
  else {
    const fish = FISH[cast.outcome]; cast.stamina = fish.stamina; cast.points = fish.points; state.points[cast.location] += fish.points;
    if (!state.discovered[cast.location].includes(fish.id)) state.discovered[cast.location].push(fish.id);
    if (fish.id !== 'T1') { state.inventory[fish.id]++; state.stats.caught++; }
    if (!state.friendCatches.includes(cast.companion)) state.friendCatches.push(cast.companion);
  }
  award(state, now);
}

export function applyCommand(previous: FishingProgress, command: FishingCommand, now: number, random: Random = () => { throw new Error('Random source required'); }, id: () => string = () => { throw new Error('Identity source required'); }): FishingProgress {
  const state = normalizeProgress(previous, random, id); pauseExpired(state, now); state.lastActivityAt = Math.max(now, state.lastActivityAt);
  const active = () => state.cast?.phase === 'waiting';
  const requireIdle = () => { if (active()) fail('FISHING_CAST_ACTIVE', 'Finish the current cast before changing this choice.'); };
  const unlocked = (bait: BaitId) => { if (!baitUnlocked(state, bait)) fail('FISHING_BAIT_LOCKED', 'This bait is locked until pond graduation.'); };
  switch (command.type) {
    case 'select-companion': state.running = false; state.companion = command.companion; if (active() && state.cast) { state.cast.paused = true; state.cast.companion = command.companion; } break;
    case 'select-location': requireIdle(); if (command.location === 'river' && !riverUnlocked(state)) fail('FISHING_LOCATION_LOCKED', 'Village River is locked until pond graduation.'); state.location = command.location; break;
    case 'select-bait': unlocked(command.baitId); state.selectedBait = command.baitId; break;
    case 'question': unlocked(command.baitId); if (state.question?.baitId !== command.baitId) state.question = issueQuestion(state, command.baitId, random, id); break;
    case 'answer': {
      const question = state.question;
      if (!question || question.id !== command.questionId) fail('FISHING_QUESTION_MISSING', 'This question is no longer active.');
      question.attempts++;
      if (gradeQuestion(question.question, command.answer)) {
        state.bait[question.baitId]++; state.stats.questions++; if (!state.earnedBaits.includes(question.baitId)) state.earnedBaits.push(question.baitId);
        state.question = null; award(state, now); startNext(state, now, random, id); if (command.continuePractice) state.question = issueQuestion(state, question.baitId, random, id);
      }
      break;
    }
    case 'dismiss-question': state.question = null; break;
    case 'cast': case 'resume': state.running = true; if (active() && state.cast?.paused) { state.cast.paused = false; state.cast.lastTickAt = now; } startNext(state, now, random, id); break;
    case 'pause': state.running = false; if (active() && state.cast) state.cast.paused = true; break;
    case 'tick': {
      const cast = state.cast;
      if (state.running && cast?.phase === 'waiting' && !cast.paused) { cast.remainingMs -= Math.max(0, now - cast.lastTickAt); cast.lastTickAt = Math.max(now, cast.lastTickAt); if (cast.remainingMs <= 0) complete(state, now); }
      else startNext(state, now, random, id);
      break;
    }
  }
  return state;
}

export function publicState(state: FishingProgress, now = Date.now()): FishingPublicState {
  const normalized = normalizeProgress(state, () => 0, () => 'fishing-repair-question'); pauseExpired(normalized, now);
  const { question, cast, recentFacts: _recentFacts, lastActivityAt: _lastActivityAt, nextCastAt: _nextCastAt, ...progress } = normalized;
  return { ...progress, serverNow: now,
    question: question ? { id: question.id, baitId: question.baitId, publicQuestion: publicQuestion(question.question), attempts: question.attempts } : null,
    cast: cast ? { id: cast.id, baitId: cast.baitId, location: cast.location, remainingMs: cast.remainingMs, paused: cast.paused, phase: cast.phase,
      ...(cast.phase === 'result' ? { revealRemainingMs: Math.max(0, normalized.nextCastAt - now), fishId: cast.fishId ?? null, ...(cast.garbageIndex !== undefined ? { garbageIndex: cast.garbageIndex } : {}), stamina: cast.stamina ?? 0, points: cast.points ?? 0 } : {}) } : null };
}
