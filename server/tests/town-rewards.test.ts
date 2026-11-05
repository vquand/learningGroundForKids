import assert from 'node:assert/strict';
import test from 'node:test';
import { nextDrink, type DrinkSession } from '../src/town-building/drinks.js';
import { createFoodDrinkGame } from '../src/town-building/drink-game.js';
import { FOOD_AND_DRINK_RECIPES } from '../src/town-building/drink-recipes.js';
import { minedTownMaterials,wordReward,wallReward } from '../src/town-building/rewards.js';
import { createInfinidrillGame } from '../src/infinidrill/game.ts';
import { previewAllowed,townCommandSchema,previewSchema } from '../src/town-building/routes.js';
import { loadConfig } from '../src/config.js';
import { createEnvironmentService } from '../src/town-building/environment.js';
import { metWeatherFixture } from './met-weather-fixture.js';

test('wrong ingredient cannot advance or earn; mandatory steps cannot be skipped; completion awards once',()=>{
  const recipe=FOOD_AND_DRINK_RECIPES[0]!;
  let state:DrinkSession={revision:0,sessionId:'server-issued',game:createFoodDrinkGame(recipe),optionalCompleted:0};
  let result=nextDrink(state,{type:'selectIngredient',ingredientId:'wood'});assert.equal(result.session.game.stepIndex,0);assert.equal(result.stamina,0);
  result=nextDrink(state,{type:'skipOptionalStep'});assert.equal(result.session.game.stepIndex,0);
  for(const step of recipe.steps) {result=nextDrink(state,{type:'selectIngredient',ingredientId:step.expectedIngredientId});state=result.session;}
  assert.equal(state.game.status,'completed');assert.equal(result.stamina,6);
  assert.equal(nextDrink(state,{type:'selectIngredient',ingredientId:'mint-leaf'}).stamina,0);
  const restart=nextDrink(state,{type:'restart'});assert.notEqual(restart.session.sessionId,state.sessionId);assert.equal(restart.stamina,0);
});
test('source mining deduplicates head/laser overlap and leaves valuable loot unchanged',()=>{
  const before=createInfinidrillGame({random:()=>.5});
  const after={...before,mainQuestionsCompleted:1,excavations:[{from:0,to:1,left:-1,right:1}],laserCuts:[{from:.5,to:1,left:1,right:2}]};
  const loot=minedTownMaterials(before,after);assert.equal(loot.reward.sand,7);assert.equal(new Set(loot.deposits.map(d=>`${d.row}:${d.column}`)).size,7);
  assert.deepEqual(after.resources,before.resources);
  assert.deepEqual(minedTownMaterials(after,after).reward,{});
});
test('UFO solved words grant baseline resources on easy, triple on medium, and sevenfold on hard', () => {
  assert.deepEqual(wordReward('easy'), { wood: 2, wool: 1 });
  assert.deepEqual(wordReward('medium'), { wood: 6, wool: 3 });
  assert.deepEqual(wordReward('hard'), { wood: 14, wool: 7 });
});
test('Waddle Wall passes grant 1, 3, or 5 of both wood and wool by difficulty', () => {
  assert.deepEqual(wallReward('easy'), { wood: 1, wool: 1 });
  assert.deepEqual(wallReward('medium'), { wood: 3, wool: 3 });
  assert.deepEqual(wallReward('hard'), { wood: 5, wool: 5 });
});
test('preview capability requires test environment plus enabled flag and admin; payloads reject forged progress',()=>{
  for(const nodeEnv of ['test','development','production']) {
    const config=loadConfig({NODE_ENV:nodeEnv,DATABASE_URL:'postgresql://unused@localhost/plg_test',ALLOWED_ORIGINS:'https://example.test',ALLOWED_FORWARDED_HOSTS:'example.test',TOWN_ENVIRONMENT_PREVIEW_ENABLED:'true'});
    assert.equal(previewAllowed(config,'admin'),nodeEnv==='test');assert.equal(previewAllowed(config,'family'),false);
  }
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://unused@localhost/plg_test'});assert.equal(previewAllowed(config,'admin'),false);
  assert.equal(townCommandSchema.safeParse({type:'build',blueprintId:'house',x:5,y:10,cost:0,learned:100}).success,false);
  assert.equal(previewSchema.safeParse({season:'summer',precipitation:'sunny',snowCover:false}).success,false);
});
test('weather validates provider data, caches, follows southern timezone, and scopes previews',async()=>{
  let now=Date.parse('2026-06-15T12:00:00Z');let calls=0;let failing=false;
  const fetcher=(async(input:URL|string|Request)=>{calls++;if(failing) throw new Error('offline');return new Response(JSON.stringify(String(input).includes('geocoding')?{results:[{name:'Sydney',country_code:'AU',latitude:-33.8,longitude:151.2,timezone:'Australia/Sydney'}]}:metWeatherFixture(now,{rain:1})),{headers:{'Content-Type':'application/json'}});}) as typeof fetch;
  const service=createEnvironmentService(fetcher,()=>now);
  const a=await service.get('kid','Sydney','AU','session-a',true);assert.equal(a.season,'winter');assert.equal(a.precipitation,'rain');assert.equal(a.weatherSource,'live');
  await service.get('kid','Sydney','AU','session-a',true);assert.equal(calls,2);
  service.preview('session-a',{season:'summer',precipitation:'snow',snowCover:true});
  assert.equal((await service.get('kid','Sydney','AU','session-a',true)).weatherSource,'preview');
  assert.equal((await service.get('kid','Sydney','AU','session-b',true)).weatherSource,'live');
  assert.equal((await service.get('kid','Sydney','AU','session-a',false)).weatherSource,'live');
  now+=31*60000;failing=true;assert.equal((await service.get('kid','Sydney','AU','session-a',true)).weatherSource,'stale');
  now+=60*60000;const unavailable=await service.get('kid','Sydney','AU','session-a',true);assert.equal(unavailable.weatherSource,'unavailable');assert.equal(unavailable.season,'winter');assert.equal(unavailable.timeZone,'Australia/Sydney');
  service.preview('session-a',null);
});

test('home lighting follows local clock zones and daylight-saving time',async()=>{
 const {homeClock}=await import('../src/town-building/environment.js');
 const date=new Date('2026-07-15T11:30:00Z');
 assert.deepEqual(homeClock(date,'Asia/Ho_Chi_Minh'),{localTime:'18:30',timeOfDay:'evening'});
 assert.deepEqual(homeClock(date,'America/New_York'),{localTime:'07:30',timeOfDay:'morning'});
 assert.deepEqual(homeClock(date,'Australia/Sydney'),{localTime:'21:30',timeOfDay:'night'});
 for(const [hour,period] of [[0,'night'],[5,'morning'],[10,'morning'],[11,'noon'],[13,'noon'],[14,'afternoon'],[16,'afternoon'],[17,'evening'],[19,'evening'],[20,'night']] as const) assert.equal(homeClock(new Date(`2026-10-12T${String(hour).padStart(2,'0')}:00:00Z`),'UTC').timeOfDay,period);
});
test('cloud cover is bounded provider data and is not fabricated when unavailable',async()=>{
 let now=Date.parse('2026-10-12T11:00:00Z'),cover=90;
 const fetcher=(async(input:URL|string|Request)=>Response.json(String(input).includes('geocoding')?{results:[{name:'Hanoi',country_code:'VN',latitude:21,longitude:105,timezone:'Asia/Ho_Chi_Minh'}]}:metWeatherFixture(now,{cloudCover:cover}))) as typeof fetch;
 const service=createEnvironmentService(fetcher,()=>now);
 const first=await service.get('kid','Hanoi','VN','session',false);
 assert.equal(first.timeOfDay,'evening');assert.equal(first.localTime,'18:00');assert.equal(first.cloudCover,90);assert.equal(first.isDay,false);
 cover=200;now+=70*60000;
 const rejected=await service.get('kid','Hanoi','VN','session',false);
 assert.equal(rejected.cloudCover,null);assert.equal(rejected.weatherSource,'live');assert.equal(rejected.precipitation,'none');assert.equal(rejected.windSpeed,0);assert.equal(rejected.timeOfDay,'evening');
 const noCity=await service.get('kid',undefined,undefined,'session',false);assert.equal(noCity.timeOfDay,null);assert.equal(noCity.cloudCover,null);
});
