import { awardCabbageRollServe, cabbageRollAchievements, type CabbageRollAchievements } from './cabbage-roll-achievements.js';
import { recordAdventure } from '../adventures/events.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { creditTown } from './repository.js';

const heatSchema = z.enum(['low', 'medium', 'high']);
const portionSchema = z.enum(['small', 'medium', 'large']);
const foldSchema = z.enum(['bottom', 'left', 'right', 'close']);
const seasoningSchema = z.enum(['Salt', 'Pepper', 'Soy sauce']);

export const cabbageRollCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum([
    'start', 'peel', 'chop', 'next', 'mix', 'cover-bowl', 'refrigerate', 'leaf',
    'cover-steamer', 'steam-start', 'lift', 'retrieve-filling', 'fresh-leaf',
    'arrange', 'sauce', 'cover-pot', 'cook', 'stop', 'retry', 'serve', 'replay',
  ]) }).strict(),
  z.object({ type: z.literal('add'), index: z.number().int().min(0).max(3) }).strict(),
  z.object({ type: z.literal('season'), value: seasoningSchema }).strict(),
  z.object({ type: z.literal('heat'), value: heatSchema }).strict(),
  z.object({ type: z.literal('portion'), value: portionSchema }).strict(),
  z.object({ type: z.literal('fold'), edge: foldSchema, overshot: z.boolean().optional() }).strict(),
]);

export type CabbageRollCommand = z.infer<typeof cabbageRollCommandSchema>;
export type CabbageRollPhase = 'setup' | 'chop' | 'add' | 'season' | 'mix' | 'rest' | 'steam' | 'retrieve' | 'fold' | 'simmer' | 'result' | 'served';
export type CabbageRollOutcome = 'undercooked' | 'okay' | 'perfect' | 'burnt';
type Heat = z.infer<typeof heatSchema>;
type Portion = Exclude<z.infer<typeof portionSchema>, 'large'>;
type Fold = z.infer<typeof foldSchema>;

export interface CabbageRollSession {
  /** Optional for sessions saved before achievement tracking was introduced. */
  achievements?: CabbageRollAchievements;
  revision: number;
  sessionId: string;
  phase: CabbageRollPhase;
  ingredient: number;
  cuts: number;
  onionPeeled: boolean;
  added: number[];
  seasoning: Array<z.infer<typeof seasoningSchema>>;
  covered: boolean;
  restStartedAt: number | null;
  cabbagePlaced: boolean;
  steamCovered: boolean;
  steamHeat: Heat | null;
  steamStartedAt: number | null;
  rolls: number;
  portion: Portion | null;
  folds: Fold[];
  torn: boolean;
  arranged: number;
  sauce: boolean;
  potCovered: boolean;
  heat: Heat | null;
  cookingStartedAt: number | null;
  outcome: CabbageRollOutcome | null;
}

export function createCabbageRollSession(sessionId: string = randomUUID(), revision = 0): CabbageRollSession {
  return {
    revision,
    sessionId,
    achievements: cabbageRollAchievements(undefined),
    phase: 'setup',
    ingredient: 0,
    cuts: 0,
    onionPeeled: false,
    added: [],
    seasoning: [],
    covered: false,
    restStartedAt: null,
    cabbagePlaced: false,
    steamCovered: false,
    steamHeat: null,
    steamStartedAt: null,
    rolls: 0,
    portion: null,
    folds: [],
    torn: false,
    arranged: 0,
    sauce: false,
    potCovered: false,
    heat: null,
    cookingStartedAt: null,
    outcome: null,
  };
}

const steamDuration = (heat: Heat | null) => heat === 'low' ? 10_000 : heat === 'high' ? 6_000 : 8_000;
const pointerPosition = (elapsed: number) => {
  const cycle = Math.max(0, elapsed) % 24_000;
  return (cycle <= 12_000 ? cycle : 24_000 - cycle) / 12_000 * 100;
};
const grade = (position: number): CabbageRollOutcome => position < 50 ? 'undercooked' : position < 60 ? 'okay' : position < 80 ? 'perfect' : position < 90 ? 'okay' : 'burnt';

export function nextCabbageRoll(
  state: CabbageRollSession,
  command: CabbageRollCommand,
  now = Date.now(),
  id: () => string = randomUUID,
): { session: CabbageRollSession; stamina: number } {
  const revision = state.revision + 1;
  if (command.type === 'start') {
    return { session: { ...createCabbageRollSession(id(), revision), phase: 'chop', achievements: cabbageRollAchievements(state.achievements) }, stamina: 0 };
  }
  if (command.type === 'replay') {
    return { session: { ...createCabbageRollSession(id(), revision), achievements: cabbageRollAchievements(state.achievements) }, stamina: 0 };
  }
  let next: CabbageRollSession = { ...state, revision };
  let stamina = 0;
  const update = (patch: Partial<CabbageRollSession>) => { next = { ...next, ...patch }; };

  switch (command.type) {
    case 'peel':
      if (state.phase === 'chop' && state.ingredient === 3 && !state.onionPeeled) update({ onionPeeled: true });
      break;
    case 'chop':
      if (state.phase === 'chop' && state.cuts < 3 && (state.ingredient !== 3 || state.onionPeeled)) update({ cuts: state.cuts + 1 });
      break;
    case 'next':
      if (state.phase === 'chop' && state.cuts === 3) {
        if (state.ingredient < 3) update({ ingredient: state.ingredient + 1, cuts: 0 });
        else update({ phase: 'add' });
      } else if (state.phase === 'add' && state.added.length === 4) update({ phase: 'season' });
      else if (state.phase === 'season' && state.seasoning.length === 3) update({ phase: 'mix' });
      else if (state.phase === 'fold' && state.rolls === 3) update({ phase: 'simmer' });
      break;
    case 'add':
      if (state.phase === 'add' && !state.added.includes(command.index)) update({ added: [...state.added, command.index] });
      break;
    case 'season':
      if (state.phase === 'season' && !state.seasoning.includes(command.value)) update({ seasoning: [...state.seasoning, command.value] });
      break;
    case 'mix':
      if (state.phase === 'mix') update({ phase: 'rest' });
      break;
    case 'cover-bowl':
      if (state.phase === 'rest') update({ covered: true });
      break;
    case 'refrigerate':
      if (state.phase === 'rest' && state.covered) update({ phase: 'steam', restStartedAt: now });
      break;
    case 'leaf':
      if (state.phase === 'steam' && !state.cabbagePlaced) update({ cabbagePlaced: true });
      break;
    case 'cover-steamer':
      if (state.phase === 'steam' && state.cabbagePlaced) update({ steamCovered: true });
      break;
    case 'heat':
      if (state.phase === 'steam' && state.steamCovered && state.steamStartedAt === null) update({ steamHeat: command.value });
      else if (state.phase === 'simmer' && state.potCovered && state.cookingStartedAt === null) update({ heat: command.value });
      break;
    case 'steam-start':
      if (state.phase === 'steam' && state.steamHeat && state.steamStartedAt === null) update({ steamStartedAt: now });
      break;
    case 'lift':
      if (state.phase === 'steam' && state.restStartedAt !== null && state.steamStartedAt !== null
        && now - state.restStartedAt >= 8_000 && now - state.steamStartedAt >= steamDuration(state.steamHeat)) update({ phase: 'retrieve' });
      break;
    case 'retrieve-filling':
      if (state.phase === 'retrieve') update({ phase: 'fold' });
      break;
    case 'portion':
      if (state.phase === 'fold' && state.rolls < 3 && !state.portion && !state.torn) {
        if (command.value === 'large') update({ torn: true });
        else update({ portion: command.value });
      }
      break;
    case 'fold':
      if (state.phase !== 'fold' || !state.portion || state.torn || state.rolls >= 3 || state.folds.includes(command.edge)) break;
      if (command.edge !== 'bottom' && !state.folds.includes('bottom')) break;
      if (command.edge === 'close' && (!state.folds.includes('left') || !state.folds.includes('right'))) break;
      if (command.overshot) update({ torn: true });
      else if (command.edge === 'close') update({ rolls: state.rolls + 1, portion: null, folds: [] });
      else update({ folds: [...state.folds, command.edge] });
      break;
    case 'fresh-leaf':
      if (state.phase === 'fold' && state.torn) update({ torn: false, portion: null, folds: [] });
      break;
    case 'arrange':
      if (state.phase === 'simmer' && state.arranged < 3) update({ arranged: state.arranged + 1 });
      break;
    case 'sauce':
      if (state.phase === 'simmer' && state.arranged === 3) update({ sauce: true });
      break;
    case 'cover-pot':
      if (state.phase === 'simmer' && state.sauce) update({ potCovered: true });
      break;
    case 'cook':
      if (state.phase === 'simmer' && state.potCovered && state.heat && state.cookingStartedAt === null) update({ cookingStartedAt: now });
      break;
    case 'stop':
      if (state.phase === 'simmer' && state.cookingStartedAt !== null) update({
        phase: 'result',
        outcome: grade(pointerPosition(now - state.cookingStartedAt)),
        cookingStartedAt: null,
      });
      break;
    case 'retry':
      if (state.phase === 'result') update({ phase: 'simmer', outcome: null, cookingStartedAt: null });
      break;
    case 'serve':
      if (state.phase === 'result' && state.outcome && state.rolls === 3 && state.arranged === 3) {
        update({ phase: 'served', achievements: awardCabbageRollServe(state.achievements, state.outcome, now) });
        stamina = 8;
      }
      break;
  }
  return { session: next, stamina };
}

export interface CabbageRollRepository {
  get(profileId: string): Promise<CabbageRollSession>;
  mutate(profileId: string, revision: number, command: CabbageRollCommand): Promise<CabbageRollSession & { townReward: { stamina: number } }>;
}

export function createCabbageRollRepository(pool: Pool, now = Date.now, id: () => string = randomUUID): CabbageRollRepository {
  const initial = () => createCabbageRollSession(id());
  const ensure = (profileId: string) => pool.query(
    'INSERT INTO cabbage_roll_sessions(profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [profileId, JSON.stringify(initial())],
  );
  return {
    async get(profileId) {
      await ensure(profileId);
      return (await pool.query<{ state: CabbageRollSession }>('SELECT state FROM cabbage_roll_sessions WHERE profile_id=$1', [profileId])).rows[0]!.state;
    },
    async mutate(profileId, revision, command) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO cabbage_roll_sessions(profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profileId, JSON.stringify(initial())]);
        const state = (await client.query<{ state: CabbageRollSession }>('SELECT state FROM cabbage_roll_sessions WHERE profile_id=$1 FOR UPDATE', [profileId])).rows[0]!.state;
        if (state.revision !== revision) throw new AppError(409, 'CABBAGE_ROLL_STALE', 'Your cabbage-roll recipe changed. Sync and try again.');
        const result = nextCabbageRoll(state, command, now(), id);
        if(result.session.phase==='result'&&result.session.outcome&&state.phase!=='result')await recordAdventure(client,profileId,{key:`cabbage:${state.sessionId}:${result.session.revision}`,game:'kitchen',kind:result.session.outcome==='burnt'?'meal_burnt':result.session.outcome==='undercooked'?'meal_undercooked':'meal_finished',data:{subject:'Cabbage rolls',recipeId:'cabbage-rolls'}});
        if (result.stamina) await creditTown(client, profileId, `cabbage-roll:${state.sessionId}`, { stamina: result.stamina });
        await client.query('UPDATE cabbage_roll_sessions SET state=$2 WHERE profile_id=$1', [profileId, JSON.stringify(result.session)]);
        await client.query('COMMIT');
        return { ...result.session, townReward: { stamina: result.stamina } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
