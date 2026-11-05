import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cabbageReducer as reduce, createCabbageGame, gradePosition, pointerPosition, chopPosition, chopTargets, CHOP_CROSSING_MS, CHOP_PATTERNS, type CabbageGame } from '../src/features/cooking/cabbage-rolls/cabbageGame.ts';
const tick = (s: CabbageGame, ms: number) => { for (let i = 0; i < ms; i += 100) s = reduce(s, { type: 'tick', ms: Math.min(100, ms - i) }); return s; };
test('three sequential chops keep moving during animation and require onion peeling', () => {
  let s = reduce(createCabbageGame(), { type: 'start' });
  assert.equal(chopPosition(3600), 50);
  assert.equal(chopPosition(7200), 100);
  assert.equal(chopPosition(9000), 100, 'chopping never reverses');
  for (let ingredient = 0; ingredient < 4; ingredient++) {
    if (ingredient === 3) {
      s = tick(s, 2000);
      assert.equal(s.chopClockMs, 0, 'onion timer waits for peeling');
      assert.equal(reduce(s, { type: 'chop' }).cuts, 0);
      s = reduce(s, { type: 'peel' });
      assert.equal(reduce(s, { type: 'chop' }).cuts, 0, 'peel animation finishes first');
      s = tick(s, 650);
    }
    for (let index = 0; index < 3; index++) {
      const [from, to] = chopTargets(s.chopPattern)[index]!;
      s = tick(s, (from + to) / 200 * CHOP_CROSSING_MS - s.chopClockMs);
      const before = s.chopClockMs;
      s = reduce(s, { type: 'chop' });
      assert.equal(s.cuts, index + 1);
      assert.equal(s.chopClockMs, before, 'successful chops never reset the pointer');
      assert.deepEqual(reduce(s, { type: 'chop' }), s, 'double tap cannot skip stages');
      s = tick(s, 350);
      assert.equal(s.chopClockMs, before + (index < 2 ? 350 : 0), 'pointer continues during knife animation until finished');
    }
    assert.equal(s.ingredient, ingredient);
    s = reduce(s, { type: 'next' });
  }
  assert.equal(s.phase, 'add');
});
test('only the next stripe counts, missed stripes require a fresh three-chop sequence', () => {
  for (let cuts = 0; cuts < 3; cuts++) {
    const pattern = cuts;
    const [from, to] = chopTargets(pattern)[cuts]!;
    for (const p of [from, to]) {
      const s: CabbageGame = { ...createCabbageGame(), phase: 'chop', cuts, chopPattern: pattern, chopClockMs: p / 100 * CHOP_CROSSING_MS };
      assert.equal(reduce(s, { type: 'chop' }).cuts, cuts + 1, `inclusive stripe ${cuts} boundary ${p}`);
      const paused = reduce(s, { type: 'pause', value: true });
      assert.deepEqual(reduce(paused, { type: 'tick', ms: 100 }), paused);
      assert.deepEqual(reduce(paused, { type: 'chop' }), paused);
    }
    const s: CabbageGame = { ...createCabbageGame(), phase: 'chop', cuts, chopPattern: pattern, chopClockMs: to / 100 * CHOP_CROSSING_MS };
    const missed = tick(s, 100);
    assert.equal(missed.chopMissed, true, 'passing any unhit stripe ends attempt');
    assert.equal(reduce(missed, { type: 'chop' }).cuts, cuts);
    assert.deepEqual(tick(missed, 1000), missed, 'missed pointer waits for retry');
    const retry = reduce(missed, { type: 'retry-chop' });
    assert.equal(retry.cuts, 0); assert.equal(retry.chopClockMs, 0); assert.equal(retry.chopMissed, false);
    assert.notDeepEqual(chopTargets(retry.chopPattern), chopTargets(pattern), 'retry changes stripe placement');
  }
  const start = reduce(createCabbageGame(), { type: 'start' });
  assert.equal(reduce(start, { type: 'chop' }).chopMissed, true, 'pressing outside a target ends the attempt');
  const [firstFrom, firstTo] = chopTargets(start.chopPattern)[0]!;
  const first = reduce(tick(start, (firstFrom + firstTo) / 200 * CHOP_CROSSING_MS), { type: 'chop' });
  const repeated = reduce(tick(first, 350), { type: 'chop' });
  assert.equal(repeated.cuts, 1, 'cannot earn another cut in the first stripe');
  assert.equal(repeated.chopMissed, true);
  assert.equal(reduce(start, { type: 'tick', ms: 60000 }).chopClockMs, 100, 'stalls are bounded');
});
test('chop layouts vary position and width while preserving three ordered targets', () => {
  assert.ok(CHOP_PATTERNS.length >= 4);
  assert.ok(new Set(CHOP_PATTERNS.map(pattern => pattern.map(([from, to]) => `${from}-${to}`).join('|'))).size === CHOP_PATTERNS.length);
  assert.ok(new Set(CHOP_PATTERNS.flatMap(pattern => pattern.map(([from, to]) => to - from))).size > 1, 'target widths vary');
  for (const pattern of CHOP_PATTERNS) {
    assert.equal(pattern.length, 3);
    for (let i = 0; i < pattern.length; i++) {
      const [from, to] = pattern[i]!;
      assert.ok(from >= 0 && to <= 100 && to > from);
      if (i) assert.ok(from > pattern[i - 1]![1], 'targets remain ordered and separated');
    }
  }
});
test('ingredients cannot duplicate, seasoning must be correct, mixing accepts both directions', () => {
  let s = { ...createCabbageGame(), phase: 'add' } as CabbageGame;
  for (let index = 0; index < 4; index++) { s = reduce(s, { type: 'add', index }); s = reduce(s, { type: 'add', index }); s = tick(s, 850); }
  assert.equal(s.added.length, 4);
  s = reduce(s, { type: 'next' });
  assert.equal(reduce(s, { type: 'season', value: 'Sugar' }).seasoning.length, 0);
  for (const value of ['Salt', 'Pepper', 'Soy sauce']) s = tick(reduce(s, { type: 'season', value }), 1100);
  s = reduce(s, { type: 'next' });
  assert.equal(reduce(s, { type: 'next' }).phase, 'mix');
  for (let i = 0; i < 16; i++) s = reduce(s, { type: 'turn', radians: i % 2 ? -Math.PI / 4 : Math.PI / 4 });
  assert.equal(s.turns, 2); assert.equal(s.angle, 0);
  assert.equal(reduce(s, { type: 'next' }).phase, 'rest');
});
test('rest overlaps steam and both readiness gates must finish', () => {
  let s: CabbageGame = { ...createCabbageGame(), phase: 'rest' };
  assert.equal(reduce(s, { type: 'refrigerate' }).phase, 'rest');
  s = tick(reduce(tick(reduce(s, { type: 'cover-bowl' }), 900), { type: 'refrigerate' }), 1600);
  s = tick(reduce(s, { type: 'leaf' }), 1000);
  s = reduce(tick(reduce(s, { type: 'cover-steamer' }), 900), { type: 'heat', value: 'high' });
  s = tick(reduce(s, { type: 'steam-start' }), 4000);
  assert.equal(s.steamMs, 4000); assert.equal(reduce(s, { type: 'lift' }).phase, 'steam');
  s = tick(s, 2000); s = reduce(s, { type: 'lift' }); assert.equal(s.phase, 'retrieve');
  s = reduce(s, { type: 'retrieve-filling' }); assert.equal(s.motion?.kind, 'retrieve');
  assert.equal(tick(s, 1500).phase, 'retrieve', 'the filling stays visible for the retrieval animation');
  assert.equal(tick(s, 1600).phase, 'fold');
});
for (const order of [['left', 'right'], ['right', 'left']] as const) test(`folds accept ${order.join(' then ')} and tears preserve completed rolls`, () => {
  let s: CabbageGame = { ...createCabbageGame(), phase: 'fold' };
  s = reduce(s, { type: 'portion', value: 'medium' });
  assert.deepEqual(reduce(s, { type: 'fold', edge: 'left' }).folds, []);
  s = reduce(s, { type: 'fold', edge: 'bottom' });
  assert.equal(reduce(s, { type: 'fold', edge: 'close' }).rolls, 0);
  for (const edge of order) s = reduce(s, { type: 'fold', edge });
  s = reduce(s, { type: 'fold', edge: 'close' }); assert.equal(s.rolls, 1);
  s = reduce(s, { type: 'portion', value: 'large' }); assert.equal(s.torn, true); assert.equal(s.rolls, 1);
  s = reduce(s, { type: 'fresh-leaf' });
  s = reduce(s, { type: 'portion', value: 'small' });
  s = reduce(s, { type: 'fold', edge: 'bottom', overshot: true }); assert.equal(s.torn, true); assert.equal(s.rolls, 1);
  s = reduce(s, { type: 'fresh-leaf' });
  for (let i = 0; i < 2; i++) {
    s = reduce(s, { type: 'portion', value: 'medium' });
    for (const edge of ['bottom', ...order, 'close'] as const) s = reduce(s, { type: 'fold', edge });
  }
  assert.equal(s.rolls, 3); assert.equal(reduce(s, { type: 'next' }).phase, 'simmer');
});
test('all exact timing boundaries and reversal preserve agreed proportions', () => {
  for (const [p, expected] of [[0,'undercooked'],[49.999,'undercooked'],[50,'okay'],[59.999,'okay'],[60,'perfect'],[79.999,'perfect'],[80,'okay'],[89.999,'okay'],[90,'burnt'],[100,'burnt']] as const) assert.equal(gradePosition(p), expected);
  assert.equal(pointerPosition(12000), 100); assert.equal(pointerPosition(18000), 50); assert.equal(pointerPosition(24000), 0);
});
test('pause and stalls do not skip zones; retry does not serve and preserves rolls', () => {
  let s: CabbageGame = { ...createCabbageGame(), phase: 'simmer', rolls: 3, arranged: 3, sauce: true, potCovered: true, heat: 'medium' };
  s = reduce(s, { type: 'cook' }); s = tick(s, 8000);
  const paused = reduce(s, { type: 'pause', value: true });
  assert.deepEqual(reduce(paused, { type: 'tick', ms: 60000 }), paused);
  assert.deepEqual(reduce(paused, { type: 'stop' }), paused);
  assert.equal(reduce(s, { type: 'tick', ms: 60000 }).cookMs, 8100);
  s = reduce(s, { type: 'stop' }); assert.equal(s.outcome, 'perfect'); assert.equal(s.phase, 'plating');
  assert.equal(reduce(s, { type: 'serve' }).phase, 'plating');
  s = tick(s, 7600); assert.equal(s.phase, 'result');
  s = reduce(s, { type: 'retry' }); assert.equal(s.rolls, 3); assert.equal(s.outcome, null); assert.equal(s.cooking, false);
  s = reduce(tick(reduce(reduce(s, { type: 'cook' }), { type: 'stop' }), 7600), { type: 'serve' });
  assert.equal(s.phase, 'served'); assert.equal(s.outcome, 'undercooked'); assert.deepEqual(reduce(s, { type: 'serve' }), s);
});

test('every runtime atlas uses the reviewed cartoon files and valid measured pixel bounds', async () => {
  const { CABBAGE_ATLASES } = await import('../src/features/cooking/cabbage-rolls/cabbageAtlas.ts');
  const { readFileSync } = await import('node:fs');
  for (const atlas of Object.values(CABBAGE_ATLASES)) {
    assert.ok(atlas.file.startsWith('cartoon-'), 'realistic sheets are no longer used');
    const data = readFileSync(new URL(`../public/minigames/cooking/cabbage-rolls/${atlas.file}`, import.meta.url));
    assert.equal(data.readUInt32BE(16), atlas.width, atlas.file);
    assert.equal(data.readUInt32BE(20), atlas.height, atlas.file);
    for (const [x, y, width, height] of atlas.rects) {
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= atlas.width && y + height <= atlas.height, `crop stays inside ${atlas.file}`);
    }
  }
});

test('cooking motions finish in order, freeze on pause, and block premature actions', () => {
  let s: CabbageGame = { ...createCabbageGame(), phase: 'rest' };
  s = reduce(s, { type: 'cover-bowl' });
  assert.equal(s.motion?.kind, 'cover-bowl');
  assert.deepEqual(reduce(s, { type: 'refrigerate' }), s);
  s = tick(s, 900); s = reduce(s, { type: 'refrigerate' });
  assert.equal(s.phase, 'rest', 'show the bowl going into the fridge before changing scenes');
  const paused = reduce(s, { type: 'pause', value: true });
  assert.deepEqual(tick(paused, 2000), paused);
  s = tick(s, 1600); assert.equal(s.phase, 'steam');
  s = reduce(s, { type: 'leaf' }); assert.equal(s.leaves, 1);
  assert.equal(s.motion?.kind, 'cabbage');
  assert.deepEqual(reduce(s, { type: 'cover-steamer' }), s);
  s = tick(s, 1000); s = reduce(s, { type: 'cover-steamer' });
  assert.equal(s.motion?.kind, 'cover-steamer');
});
