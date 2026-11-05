export const INGREDIENTS = ['Beef', 'Carrot', 'Mushroom', 'Onion'] as const;
export const SEASONINGS = ['Salt', 'Pepper', 'Soy sauce'] as const;
export const STEPS = ['Chop', 'Mix', 'Rest', 'Steam', 'Roll', 'Simmer'] as const;
export type Outcome = 'undercooked' | 'okay' | 'perfect' | 'burnt';
export type Fold = 'bottom' | 'left' | 'right' | 'close';
export type Heat = 'low' | 'medium' | 'high';
export type Phase = 'setup' | 'chop' | 'add' | 'season' | 'mix' | 'rest' | 'steam' | 'retrieve' | 'fold' | 'simmer' | 'plating' | 'result' | 'served';
export type MotionKind = 'drop' | 'season' | 'cover-bowl' | 'fridge' | 'cabbage' | 'cover-steamer' | 'retrieve' | 'arrange' | 'sauce' | 'cover-pot' | 'plating';
export interface KitchenMotion { kind: MotionKind; elapsed: number; duration: number; index: number }
export function kitchenMotion(kind: MotionKind, duration: number, index = 0): KitchenMotion { return { kind, elapsed: 0, duration, index }; }
export function motionProgress(s: CabbageGame, kind: MotionKind) { return s.motion?.kind === kind ? Math.min(1, s.motion.elapsed / s.motion.duration) : 1; }
export interface CabbageGame {
  motion: KitchenMotion | null;
  phase: Phase; paused: boolean; ingredient: number; cuts: number; chopMs: number; chopClockMs: number; chopMissed: boolean; chopPattern: number; onionPeeled: boolean; peelMs: number;
  added: number[]; seasoning: string[]; turns: number; angle: number;
  covered: boolean; resting: boolean; restMs: number; leaves: number;
  steamCovered: boolean; steamHeat: Heat | null; steamMs: number; steaming: boolean;
  rolls: number; portion: 'small' | 'medium' | null; folds: Fold[]; torn: boolean;
  arranged: number; sauce: boolean; sauceMs: number; potCovered: boolean; heat: Heat | null;
  cooking: boolean; cookMs: number; outcome: Outcome | null; feedback: string;
}
export type CabbageAction =
  | { type: 'start' | 'chop' | 'retry-chop' | 'peel' | 'next' | 'cover-bowl' | 'refrigerate' | 'leaf' | 'cover-steamer' | 'steam-start' | 'lift' | 'retrieve-filling' | 'fresh-leaf' | 'arrange' | 'sauce' | 'cover-pot' | 'cook' | 'stop' | 'retry' | 'serve' | 'replay' }
  | { type: 'pause'; value: boolean }
  | { type: 'tick'; ms: number }
  | { type: 'add'; index: number }
  | { type: 'season'; value: string }
  | { type: 'turn'; radians: number }
  | { type: 'heat'; value: Heat }
  | { type: 'portion'; value: 'small' | 'medium' | 'large' }
  | { type: 'fold'; edge: Fold; overshot?: boolean };
export const CHOP_CROSSING_MS = 7200;
export const CHOP_PATTERNS = [
  [[8, 25], [37, 55], [69, 88]],
  [[11, 30], [43, 57], [72, 91]],
  [[6, 20], [33, 52], [66, 84]],
  [[13, 28], [40, 61], [75, 90]],
  [[9, 24], [35, 49], [63, 83]],
  [[14, 32], [46, 64], [77, 92]],
] as const;
export function chopTargets(pattern: number) {
  return CHOP_PATTERNS[Math.abs(Math.trunc(pattern)) % CHOP_PATTERNS.length]!;
}
export function chopPosition(ms: number) {
  return Math.min(100, Math.max(0, ms) / CHOP_CROSSING_MS * 100);
}
export function chopRunning(s: CabbageGame) {
  return s.phase === 'chop' && s.cuts < chopTargets(s.chopPattern).length && !s.chopMissed && s.peelMs === 0 && (s.ingredient !== 3 || s.onionPeeled);
}
export function canChop(s: CabbageGame) {
  return chopRunning(s) && s.chopMs === 0;
}
export const CROSSING_MS = 12000;
export const MIX_TURNS = 2;
export function pointerPosition(ms: number) {
  const cycle = Math.max(0, ms) % (CROSSING_MS * 2);
  return (cycle <= CROSSING_MS ? cycle : CROSSING_MS * 2 - cycle) / CROSSING_MS * 100;
}
export function gradePosition(p: number): Outcome {
  return p < 50 ? 'undercooked' : p < 60 ? 'okay' : p < 80 ? 'perfect' : p < 90 ? 'okay' : 'burnt';
}
export function createCabbageGame(): CabbageGame {
  return { motion: null, phase: 'setup', paused: false, ingredient: 0, cuts: 0, chopMs: 0, chopClockMs: 0, chopMissed: false, chopPattern: Math.floor(Math.random() * CHOP_PATTERNS.length), onionPeeled: false, peelMs: 0, added: [], seasoning: [], turns: 0, angle: 0,
    covered: false, resting: false, restMs: 0, leaves: 0, steamCovered: false, steamHeat: null, steamMs: 0, steaming: false,
    rolls: 0, portion: null, folds: [], torn: false, arranged: 0, sauce: false, sauceMs: 0, potCovered: false, heat: null,
    cooking: false, cookMs: 0, outcome: null, feedback: '' };
}
export function stepIndex(phase: Phase) {
  return phase === 'setup' || phase === 'chop' ? 0 : ['add', 'season', 'mix'].includes(phase) ? 1 : phase === 'rest' ? 2 : phase === 'steam' ? 3 : ['retrieve', 'fold'].includes(phase) ? 4 : 5;
}
export function steamDuration(heat: Heat | null) { return heat === 'low' ? 10000 : heat === 'high' ? 6000 : 8000; }
export function cabbageReducer(s: CabbageGame, a: CabbageAction): CabbageGame {
  if (a.type === 'replay') return createCabbageGame();
  if (a.type === 'pause') return { ...s, paused: a.value };
  if (s.paused) return s;
  if (s.motion && a.type !== 'tick') return s;
  const update = (patch: Partial<CabbageGame>) => ({ ...s, feedback: '', ...patch });
  if (a.type === 'tick') {
    if (!Number.isFinite(a.ms) || a.ms <= 0) return s;
    // Bound a stalled frame to 100 ms. No unseen jumps across scoring bands.
    const ms = Math.min(a.ms, 100);
    // The pointer keeps advancing while the knife animates. Passing an unhit
    // stripe ends this attempt, so later stripes cannot substitute for it.
    const chopClockMs = chopRunning(s) ? s.chopClockMs + ms : s.chopClockMs;
    const missed = chopRunning(s) && chopPosition(chopClockMs) > chopTargets(s.chopPattern)[s.cuts]![1];
    const finishedMotion = s.motion && s.motion.elapsed + ms >= s.motion.duration;
    const motion = s.motion && !finishedMotion ? { ...s.motion, elapsed: s.motion.elapsed + ms } : null;
    const phase = finishedMotion && s.motion?.kind === 'fridge' ? 'steam' : finishedMotion && s.motion?.kind === 'retrieve' ? 'fold' : finishedMotion && s.motion?.kind === 'plating' ? 'result' : s.phase;
    return { ...s, motion, phase, chopClockMs, chopMissed: s.chopMissed || missed,
      feedback: missed ? 'Missed a stripe. Try all three again!' : s.feedback, peelMs: Math.max(0, s.peelMs - ms), chopMs: Math.max(0, s.chopMs - ms), sauceMs: Math.max(0, s.sauceMs - ms), restMs: s.resting ? Math.min(8000, s.restMs + ms) : s.restMs,
      steamMs: s.steaming ? Math.min(steamDuration(s.steamHeat), s.steamMs + ms) : s.steamMs,
      cookMs: s.cooking ? s.cookMs + ms : s.cookMs };
  }
  switch (a.type) {
    case 'start': return s.phase === 'setup' ? update({ phase: 'chop' }) : s;
    case 'peel':
      return s.phase === 'chop' && s.ingredient === 3 && !s.onionPeeled ? update({ onionPeeled: true, peelMs: 650 }) : s;
    case 'retry-chop':
      return s.phase === 'chop' && s.chopMissed ? update({ cuts: 0, chopClockMs: 0, chopMs: 0, chopMissed: false, chopPattern: s.chopPattern + 1 }) : s;
    case 'chop': {
      if (!canChop(s)) return s;
      const position = chopPosition(s.chopClockMs);
      const [from, to] = chopTargets(s.chopPattern)[s.cuts]!;
      const hit = position >= from && position <= to;
      return hit ? update({ cuts: s.cuts + 1, chopMs: 350, feedback: s.cuts === 2 ? 'Three in a row! Nicely chopped.' : 'Nice chop! Keep going to the next stripe.' }) : update({ chopMissed: true, feedback: 'Missed a stripe. Try all three again!' });
    }
    case 'next':
      if (s.phase === 'chop' && s.cuts === chopTargets(s.chopPattern).length && s.chopMs === 0) return s.ingredient < 3 ? update({ ingredient: s.ingredient + 1, cuts: 0, chopClockMs: 0, chopPattern: s.chopPattern + 1 }) : update({ phase: 'add' });
      if (s.phase === 'add' && s.added.length === 4) return update({ phase: 'season' });
      if (s.phase === 'season' && s.seasoning.length === 3) return update({ phase: 'mix' });
      if (s.phase === 'mix' && s.turns >= MIX_TURNS) return update({ phase: 'rest' });
      if (s.phase === 'fold' && s.rolls === 3) return update({ phase: 'simmer' });
      return s;
    case 'add': return s.phase === 'add' && Number.isInteger(a.index) && a.index >= 0 && a.index < 4 && !s.added.includes(a.index) ? update({ added: [...s.added, a.index], motion: kitchenMotion('drop', 850, a.index) }) : s;
    case 'season':
      if (s.phase !== 'season') return s;
      if (!SEASONINGS.some(x => x === a.value)) return update({ feedback: 'Choose salt, pepper, and soy sauce.' });
      return s.seasoning.includes(a.value) ? s : update({ seasoning: [...s.seasoning, a.value], motion: kitchenMotion('season', 1100, SEASONINGS.indexOf(a.value as typeof SEASONINGS[number])) });
    case 'turn': return s.phase === 'mix' && Number.isFinite(a.radians) ? update({ turns: Math.min(MIX_TURNS, s.turns + Math.min(Math.abs(a.radians), Math.PI / 2) / (Math.PI * 2)), angle: s.angle + a.radians }) : s;
    case 'cover-bowl': return s.phase === 'rest' ? update({ covered: true, motion: kitchenMotion('cover-bowl', 900) }) : s;
    case 'refrigerate': return s.phase === 'rest' && s.covered ? update({ resting: true, motion: kitchenMotion('fridge', 1600) }) : s;
    case 'leaf': return s.phase === 'steam' && s.leaves === 0 ? update({ leaves: 1, motion: kitchenMotion('cabbage', 1000) }) : s;
    case 'cover-steamer': return s.phase === 'steam' && s.leaves === 1 ? update({ steamCovered: true, motion: kitchenMotion('cover-steamer', 900) }) : s;
    case 'heat':
      if (s.phase === 'steam' && s.steamCovered && !s.steaming) return update({ steamHeat: a.value });
      if (s.phase === 'simmer' && s.potCovered && !s.cooking) return update({ heat: a.value });
      return s;
    case 'steam-start': return s.phase === 'steam' && s.steamHeat && !s.steaming ? update({ steaming: true }) : s;
    case 'lift': return s.phase === 'steam' && s.steaming && s.steamMs >= steamDuration(s.steamHeat) && s.restMs >= 8000 ? update({ phase: 'retrieve', steaming: false }) : s;
    case 'retrieve-filling': return s.phase === 'retrieve' ? update({ motion: kitchenMotion('retrieve', 1600) }) : s;
    case 'portion':
      if (s.phase !== 'fold' || s.rolls >= 3 || s.torn || s.portion) return s;
      return a.value === 'large' ? update({ torn: true, feedback: 'Too much filling! Try a fresh leaf.' }) : update({ portion: a.value, feedback: a.value === 'small' ? 'A little roll! Fold gently around the filling.' : '' });
    case 'fold': {
      if (s.phase !== 'fold' || !s.portion || s.torn || s.rolls >= 3 || s.folds.includes(a.edge)) return s;
      if (a.edge !== 'bottom' && !s.folds.includes('bottom')) return update({ feedback: 'Fold the bottom up first.' });
      if (a.edge === 'close' && (!s.folds.includes('left') || !s.folds.includes('right'))) return update({ feedback: 'Tuck both sides before rolling.' });
      if (a.overshot) return update({ torn: true, feedback: 'A little tear! Only this roll needs a fresh leaf.' });
      if (a.edge === 'close') return update({ rolls: s.rolls + 1, portion: null, folds: [] });
      return update({ folds: [...s.folds, a.edge] });
    }
    case 'fresh-leaf': return s.phase === 'fold' && s.torn ? update({ torn: false, portion: null, folds: [] }) : s;
    case 'arrange': return s.phase === 'simmer' && s.arranged < 3 ? update({ arranged: s.arranged + 1, motion: kitchenMotion('arrange', 1200, s.arranged) }) : s;
    case 'sauce': return s.phase === 'simmer' && s.arranged === 3 ? update({ sauce: true, sauceMs: 1200, motion: kitchenMotion('sauce', 1200) }) : s;
    case 'cover-pot': return s.phase === 'simmer' && s.sauce && s.sauceMs === 0 ? update({ potCovered: true, motion: kitchenMotion('cover-pot', 900) }) : s;
    case 'cook': return s.phase === 'simmer' && s.heat && !s.cooking ? update({ cooking: true, cookMs: 0 }) : s;
    case 'stop': return s.phase === 'simmer' && s.cooking ? update({ cooking: false, outcome: gradePosition(pointerPosition(s.cookMs)), phase: 'plating', motion: kitchenMotion('plating', 7600) }) : s;
    case 'retry': return s.phase === 'result' ? update({ phase: 'simmer', cookMs: 0, outcome: null, cooking: false }) : s;
    case 'serve': return s.phase === 'result' ? update({ phase: 'served' }) : s;
    default: return s;
  }
}
