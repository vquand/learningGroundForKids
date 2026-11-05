import type { CabbageRollCommand, CabbageRollSession } from '../../../../../server/src/town-building/cabbage-rolls';
import type { CabbageAction, CabbageGame } from './cabbageGame.ts';
import { createCabbageGame, chopTargets, CHOP_CROSSING_MS, MIX_TURNS, steamDuration } from './cabbageGame.ts';

/** Resume the last saved recipe, discarding local actions whose delivery is unknown. */
export function restoreCabbageGame(saved: CabbageRollSession, now = Date.now()): CabbageGame {
  const initial = createCabbageGame();
  const nextTarget = chopTargets(initial.chopPattern)[saved.cuts];
  return {
    ...initial,
    phase: saved.phase,
    ingredient: saved.ingredient,
    cuts: saved.cuts,
    // Give a partial chop attempt time to reach its next remaining stripe.
    chopClockMs: nextTarget ? Math.max(0, nextTarget[0] - 8) / 100 * CHOP_CROSSING_MS : 0,
    onionPeeled: saved.onionPeeled,
    added: [...saved.added],
    seasoning: [...saved.seasoning],
    turns: ['setup', 'chop', 'add', 'season', 'mix'].includes(saved.phase) ? 0 : MIX_TURNS,
    covered: saved.covered,
    resting: saved.restStartedAt !== null,
    restMs: saved.restStartedAt === null ? 0 : Math.min(8_000, Math.max(0, now - saved.restStartedAt)),
    leaves: saved.cabbagePlaced ? 1 : 0,
    steamCovered: saved.steamCovered,
    steamHeat: saved.steamHeat,
    steaming: saved.phase === 'steam' && saved.steamStartedAt !== null,
    steamMs: saved.steamStartedAt === null ? 0 : Math.min(steamDuration(saved.steamHeat), Math.max(0, now - saved.steamStartedAt)),
    rolls: saved.rolls,
    portion: saved.portion,
    folds: [...saved.folds],
    torn: saved.torn,
    arranged: saved.arranged,
    sauce: saved.sauce,
    potCovered: saved.potCovered,
    heat: saved.heat,
    cooking: saved.phase === 'simmer' && saved.cookingStartedAt !== null,
    cookMs: saved.cookingStartedAt === null ? 0 : Math.max(0, now - saved.cookingStartedAt),
    outcome: saved.outcome,
  };
}

/** Apply the saved outcome without rewinding replay or clearing a pause/dialog. */
export function applyCabbageServedResult(game: CabbageGame, saved: CabbageRollSession): CabbageGame {
  return game.phase === 'served' && saved.phase === 'served' && saved.outcome
    ? {...game, outcome: saved.outcome} : game;
}

/** Converts accepted local gestures into the smaller authoritative recipe command stream. */
export function cabbageServerCommand(before: CabbageGame, action: CabbageAction, after: CabbageGame): CabbageRollCommand | null {
  switch (action.type) {
    case 'tick':
    case 'pause':
    case 'retry-chop':
    case 'turn':
      return null;
    case 'start':
      return after.phase === 'chop' && before.phase === 'setup' ? { type: 'start' } : null;
    case 'chop':
      return after.cuts > before.cuts ? { type: 'chop' } : null;
    case 'peel':
      return !before.onionPeeled && after.onionPeeled ? { type: 'peel' } : null;
    case 'next':
      if (before.phase === 'mix' && after.phase === 'rest') return { type: 'mix' };
      return after.phase !== before.phase || after.ingredient !== before.ingredient ? { type: 'next' } : null;
    case 'add':
      return !before.added.includes(action.index) && after.added.includes(action.index) ? { type: 'add', index: action.index } : null;
    case 'season':
      return !before.seasoning.includes(action.value) && after.seasoning.includes(action.value)
        ? { type: 'season', value: action.value as 'Salt' | 'Pepper' | 'Soy sauce' }
        : null;
    case 'heat':
      return after.steamHeat !== before.steamHeat || after.heat !== before.heat ? action : null;
    case 'portion':
      return after.portion !== before.portion || after.torn !== before.torn ? action : null;
    case 'fold':
      return after.rolls !== before.rolls || after.torn !== before.torn || after.folds.length !== before.folds.length ? action : null;
    case 'cover-bowl':
    case 'refrigerate':
    case 'leaf':
    case 'cover-steamer':
    case 'steam-start':
    case 'lift':
    case 'retrieve-filling':
    case 'fresh-leaf':
    case 'arrange':
    case 'sauce':
    case 'cover-pot':
    case 'cook':
    case 'stop':
    case 'retry':
    case 'serve':
    case 'replay':
      return after !== before ? { type: action.type } as CabbageRollCommand : null;
  }
}
