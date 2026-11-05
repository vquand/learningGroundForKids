import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCabbageRollSession,
  nextCabbageRoll,
  type CabbageRollCommand,
  type CabbageRollSession,
} from '../src/town-building/cabbage-rolls.js';

function completeRecipe(stopAfter = 8_000, previous?: CabbageRollSession) {
  let now = 1_000;
  let run = 0;
  let state = previous ?? createCabbageRollSession('initial-run');
  const act = (command: CabbageRollCommand, advance = 0) => {
    now += advance;
    const result = nextCabbageRoll(state, command, now, () => `completed-run-${++run}`);
    state = result.session;
    return result;
  };

  act({ type: 'start' });
  for (let ingredient = 0; ingredient < 4; ingredient++) {
    if (ingredient === 3) act({ type: 'peel' });
    for (let cut = 0; cut < 3; cut++) act({ type: 'chop' });
    act({ type: 'next' });
  }
  for (const index of [0, 1, 2, 3]) act({ type: 'add', index });
  act({ type: 'next' });
  for (const value of ['Salt', 'Pepper', 'Soy sauce'] as const) act({ type: 'season', value });
  act({ type: 'next' });
  act({ type: 'mix' });
  act({ type: 'cover-bowl' });
  act({ type: 'refrigerate' });
  act({ type: 'leaf' });
  act({ type: 'cover-steamer' });
  act({ type: 'heat', value: 'medium' });
  act({ type: 'steam-start' });

  const tooEarly = act({ type: 'lift' }, 7_999);
  assert.equal(tooEarly.session.phase, 'steam', 'resting and steaming cannot be skipped');
  act({ type: 'lift' }, 1);
  act({ type: 'retrieve-filling' });

  for (let roll = 0; roll < 3; roll++) {
    act({ type: 'portion', value: 'medium' });
    for (const edge of ['bottom', 'left', 'right', 'close'] as const) act({ type: 'fold', edge });
  }
  act({ type: 'next' });
  for (let roll = 0; roll < 3; roll++) act({ type: 'arrange' });
  act({ type: 'sauce' });
  act({ type: 'cover-pot' });
  act({ type: 'heat', value: 'low' });
  act({ type: 'cook' });
  act({ type: 'stop' }, stopAfter);
  return { act, get state() { return state; } };
}

test('cabbage-roll completion is server verified and awards Town stamina once', () => {
  const forged = nextCabbageRoll(
    createCabbageRollSession('forged-run'),
    { type: 'serve' },
    1_000,
    () => 'unused',
  );
  assert.equal(forged.session.phase, 'setup');
  assert.equal(forged.stamina, 0);

  const recipe = completeRecipe();
  const served = recipe.act({ type: 'serve' });
  assert.equal(served.session.phase, 'served');
  assert.equal(served.stamina, 8);

  const duplicate = recipe.act({ type: 'serve' });
  assert.equal(duplicate.stamina, 0);
  assert.equal(duplicate.session.sessionId, served.session.sessionId);
});

test('starting another batch creates a distinct reward identity without trusting a completion flag', () => {
  const recipe = completeRecipe();
  const served = recipe.act({ type: 'serve' });
  const replayed = recipe.act({ type: 'replay' });
  assert.notEqual(replayed.session.sessionId, served.session.sessionId);
  assert.equal(replayed.session.phase, 'setup');
  assert.equal(replayed.stamina, 0);
  assert.equal('completed' in replayed.session, false);
});

test('cabbage-roll command payloads do not accept browser-supplied rewards or completion', async () => {
  const { cabbageRollCommandSchema } = await import('../src/town-building/cabbage-rolls.js');
  assert.equal(cabbageRollCommandSchema.safeParse({ type: 'serve', stamina: 999 }).success, false);
  assert.equal(cabbageRollCommandSchema.safeParse({ type: 'serve', completed: true }).success, false);
  assert.equal(cabbageRollCommandSchema.safeParse({ type: 'serve', achievements: { completed: 99 } }).success, false);
  assert.equal(cabbageRollCommandSchema.safeParse({ type: 'fold', edge: 'close', score: 100 }).success, false);
});

void (null as unknown as CabbageRollSession);

test('only serving a verified batch unlocks completion and its final outcome badge', () => {
  for(const [delay,outcome,badge] of [[1000,'undercooked','undercooked'],[6500,'okay',null],[8000,'perfect','perfect'],[11500,'burnt','burnt']] as const) {
    const recipe=completeRecipe(delay);
    assert.equal(recipe.state.outcome,outcome);
    assert.equal(recipe.state.achievements?.completed??0,0,'stopping alone never unlocks');
    const served=recipe.act({type:'serve'}).session;
    assert.equal(served.achievements?.completed,1);
    assert.equal(served.achievements?.[outcome],1);
    assert.deepEqual(Object.keys(served.achievements!.earned).sort(),['cabbage-rolls-completed',...(badge?[`cabbage-rolls-${badge}`]:[])].sort());
    assert.deepEqual(recipe.act({type:'serve'}).session.achievements,served.achievements);
    assert.deepEqual(recipe.act({type:'retry'}).session.achievements,served.achievements);
    assert.deepEqual(recipe.act({type:'replay'}).session.achievements,served.achievements);
    assert.deepEqual(recipe.act({type:'start'}).session.achievements,served.achievements);
  }
});
test('retry grades only the served result; awards and counts survive new batches',()=>{
  const recipe=completeRecipe(1000);
  recipe.act({type:'retry'});recipe.act({type:'cook'});recipe.act({type:'stop'},8000);
  const perfect=recipe.act({type:'serve'}).session;
  assert.equal(perfect.achievements?.undercooked,0);
  const burnt=completeRecipe(11500,perfect).act({type:'serve'}).session;
  assert.equal(burnt.achievements?.completed,2);
  assert.equal(burnt.achievements?.perfect,1);
  assert.equal(burnt.achievements?.burnt,1);
  assert.equal(burnt.achievements?.earned['cabbage-rolls-completed'],perfect.achievements?.earned['cabbage-rolls-completed']);
});

test('legacy sessions start tracking at a new serve without inventing historical awards',()=>{
  const recipe=completeRecipe();
  const legacy={...recipe.state};delete legacy.achievements;
  const served=nextCabbageRoll(legacy,{type:'serve'},20000).session;
  assert.equal(served.achievements!.completed,1);
  const alreadyServed={...served};delete alreadyServed.achievements;
  assert.equal(nextCabbageRoll(alreadyServed,{type:'serve'},20001).session.achievements,undefined);
});
