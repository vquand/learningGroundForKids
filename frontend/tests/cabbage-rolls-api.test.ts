import assert from 'node:assert/strict';
import test from 'node:test';
import { actCabbageRoll, fetchCabbageRoll } from '../src/api/cabbageRolls.ts';
import { cabbageServerCommand, restoreCabbageGame, applyCabbageServedResult } from '../src/features/cooking/cabbage-rolls/cabbageSync.ts';
import type { CabbageRollSession } from '../../server/src/town-building/cabbage-rolls';
import { cabbageReducer, createCabbageGame, chopTargets, CHOP_CROSSING_MS } from '../src/features/cooking/cabbage-rolls/cabbageGame.ts';

test('cabbage-roll client uses the owned same-origin action route without completion or reward claims', async () => {
  const original = globalThis.fetch;
  const requests: Array<{ path: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ path: String(input), init: init! });
    return Response.json({ revision: 5, phase: 'setup', townReward: {} });
  }) as typeof fetch;
  try {
    await fetchCabbageRoll('profile/one');
    await actCabbageRoll('profile/one', 4, { type: 'serve' });
    assert.equal(requests[0]!.path, '/api/v1/profiles/profile%2Fone/cabbage-rolls');
    assert.equal(requests[1]!.path, '/api/v1/profiles/profile%2Fone/cabbage-rolls/action');
    assert.deepEqual(JSON.parse(requests[1]!.init.body as string), { revision: 4, command: { type: 'serve' } });
    assert.equal(requests[1]!.init.credentials, 'same-origin');
    assert.equal(new Headers(requests[1]!.init.headers).has('Authorization'), false);
  } finally {
    globalThis.fetch = original;
  }
});

test('only locally accepted cabbage actions become server commands', () => {
  const setup = { ...createCabbageGame(), chopPattern: 0 }; // The fixed hit time below belongs to this preset.
  const started = cabbageReducer(setup, { type: 'start' });
  assert.deepEqual(cabbageServerCommand(setup, { type: 'start' }, started), { type: 'start' });

  const missedBefore = { ...started, chopClockMs: 7_000 };
  const missedAfter = cabbageReducer(missedBefore, { type: 'chop' });
  assert.equal(cabbageServerCommand(missedBefore, { type: 'chop' }, missedAfter), null);

  const hitBefore = { ...started, chopClockMs: 1_000 };
  const hitAfter = cabbageReducer(hitBefore, { type: 'chop' });
  assert.deepEqual(cabbageServerCommand(hitBefore, { type: 'chop' }, hitAfter), { type: 'chop' });

  const mixed = { ...started, phase: 'mix' as const, turns: 2 };
  const resting = cabbageReducer(mixed, { type: 'next' });
  assert.deepEqual(cabbageServerCommand(mixed, { type: 'next' }, resting), { type: 'mix' });
  assert.equal(cabbageServerCommand(resting, { type: 'tick', ms: 50 }, cabbageReducer(resting, { type: 'tick', ms: 50 })), null);
});

function savedRecipe(patch: Partial<CabbageRollSession>): CabbageRollSession {
  return { revision: 20, sessionId: 'saved-recipe', phase: 'add', ingredient: 3, cuts: 3,
    onionPeeled: true, added: [0, 1, 2], seasoning: [], covered: false, restStartedAt: null,
    cabbagePlaced: false, steamCovered: false, steamHeat: null, steamStartedAt: null,
    rolls: 0, portion: null, folds: [], torn: false, arranged: 0, sauce: false,
    potCovered: false, heat: null, cookingStartedAt: null, outcome: null, ...patch };
}

test('sync restores the missing ingredient action instead of retaining an advanced local phase', () => {
  const saved = savedRecipe({});
  const restored = restoreCabbageGame(saved, 10_000);
  assert.equal(restored.phase, 'add');
  assert.deepEqual(restored.added, [0, 1, 2]);
  assert.equal(restored.motion, null);
  const corrected = cabbageReducer(restored, { type: 'add', index: 3 });
  assert.deepEqual(corrected.added, [0, 1, 2, 3]);
  assert.deepEqual(cabbageServerCommand(restored, { type: 'add', index: 3 }, corrected), { type: 'add', index: 3 });
  assert.equal(cabbageReducer(restored, { type: 'next' }).phase, 'add');
});

test('sync distinguishes failed serve from a committed serve whose response was lost', () => {
  const saved = savedRecipe({ phase: 'result', rolls: 3, outcome: 'perfect' });
  const retryable = restoreCabbageGame(saved, 10_000);
  assert.equal(retryable.phase, 'result');
  assert.equal(retryable.outcome, 'perfect');
  assert.equal(cabbageReducer(retryable, { type: 'serve' }).phase, 'served');
  const committed = restoreCabbageGame({ ...saved, phase: 'served' }, 10_000);
  assert.equal(committed.phase, 'served');
  assert.equal(cabbageServerCommand(committed, { type: 'serve' }, cabbageReducer(committed, { type: 'serve' })), null);
});

test('sync restores partially completed chops, folded rolls and server timer progress', () => {
  const chopped = restoreCabbageGame(savedRecipe({ phase: 'chop', cuts: 2 }), 10_000);
  assert.equal(chopped.cuts, 2);
  assert.equal(chopped.chopMissed, false);
  assert.ok(chopped.chopClockMs < chopTargets(chopped.chopPattern)[2]![0] / 100 * CHOP_CROSSING_MS);
  const folded = restoreCabbageGame(savedRecipe({ phase: 'fold', rolls: 2, portion: 'medium', folds: ['bottom', 'right'] }), 10_000);
  assert.equal(folded.rolls, 2);
  assert.equal(folded.turns, 2, 'completed mixing remains visible after resuming later steps');
  assert.deepEqual(folded.folds, ['bottom', 'right']);
  const steaming = restoreCabbageGame(savedRecipe({ phase: 'steam', covered: true, restStartedAt: 1_000,
    cabbagePlaced: true, steamCovered: true, steamHeat: 'low', steamStartedAt: 3_000 }), 10_000);
  assert.equal(steaming.restMs, 8_000);
  assert.equal(steaming.steamMs, 7_000);
  assert.equal(steaming.steaming, true);
  const simmering = restoreCabbageGame(savedRecipe({ phase: 'simmer', cookingStartedAt: 6_000 }), 10_000);
  assert.equal(simmering.cooking, true);
  assert.equal(simmering.cookMs, 4_000);
});

test('verified served outcome preserves pause state and cannot rewind a new batch',()=>{
  const game={...createCabbageGame(),phase:'served' as const,outcome:'perfect' as const,paused:true};
  const saved={phase:'served',outcome:'burnt'} as CabbageRollSession;
  const verified=applyCabbageServedResult(game,saved);
  assert.equal(verified.outcome,'burnt');assert.equal(verified.paused,true);
  const replay=createCabbageGame();assert.equal(applyCabbageServedResult(replay,saved),replay);
});
