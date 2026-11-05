import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { nextKitchen,kitchenOutcome } from '../src/kitchen/repository.js';
import { createCookingGame } from '../src/kitchen/cookingGame.js';
import { GRILLED_PORK_RECIPE } from '../src/kitchen/cookingConfig.js';
import { initialTown } from '../src/town-building/game.js';
import { townAdventures,blueprintAdventures } from '../src/adventures/town-events.js';
function fixture(){
  const calls:unknown[][]=[];
  const db={auth:{async findFamilyBySessionHash(){return {id:'family-a',email:'test@test.local',displayName:'Family',role:'family',passwordHash:'stored'};}},profiles:{async get(family:string,id:string){assert.equal(family,'family-a');return id==='kid-a'?{id,name:'Mina'}:null;}},adventures:{async list(...args:unknown[]){calls.push(args);return {entries:[],next_cursor:null};}},kitchen:{async get(){return {revision:0,sessionId:'issued',game:{}};},async mutate(...args:unknown[]){calls.push(args);return {revision:1};}}} as unknown as AppDatabase;
  db.kitchen!.completions=async id=>{calls.push([id]);return {counts:{burger:100}};};
  const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://unused:unused@localhost/unused',ALLOWED_ORIGINS:'https://journal.test',ALLOWED_FORWARDED_HOSTS:'journal.test'});
  const app=createApp({config,db,logger:{info(){},warn(){},error(){}}});
  const request=(path:string,body?:unknown,auth=true)=>app.request(`https://journal.test/api/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{origin:'https://journal.test',...(auth?{cookie:'plg_session=opaque'}:{}),'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {request,calls};
}
test('journal requires an owned viewer and accepts only bounded read queries',async()=>{
  const {request,calls}=fixture();
  assert.equal((await request('profiles/kid-a/adventures',undefined,false)).status,401);
  assert.equal((await request('profiles/foreign/adventures')).status,404);
  for(const query of ['family_id=foreign','scope=everyone','limit=100000','cursor=not-a-cursor','lang=invalid','tz=Invalid/Zone','tz=%2B05:45'])assert.equal((await request(`profiles/kid-a/adventures?${query}`)).status,422);
  const result=await request('profiles/kid-a/adventures?scope=friends&limit=10&lang=vi');assert.equal(result.status,200);assert.match(result.headers.get('cache-control')??'',/no-store/);
  assert.deepEqual(calls,[['family-a','kid-a','friends',10,null,'vi','UTC']]);
  assert.equal((await request('profiles/kid-a/adventures?tz=Asia%2FKathmandu')).status,200);
  assert.equal(calls[1]![6],'Asia/Kathmandu');
  assert.equal((await request('profiles/kid-a/adventures',{completed:true})).status,404);
});
test('Kitchen accepts actions and revisions, never claimed completion/outcomes',async()=>{
  const {request,calls}=fixture();
  assert.equal((await request('profiles/foreign/kitchen/burger')).status,404);
  for(const body of [{revision:0,action:{type:'next'},completed:true},{revision:0,action:{type:'completed'}},{revision:0,action:{type:'next',score:100}},{revision:-1,action:{type:'next'}}])assert.equal((await request('profiles/kid-a/kitchen/burger/action',body)).status,422);
  assert.equal((await request('profiles/kid-a/kitchen/burger/action',{revision:0,action:{type:'next'}})).status,200);
  assert.deepEqual(calls,[['kid-a','burger',0,{type:'next'}]]);
});
test('kitchen completion counts require the owned child and only support reads',async()=>{
  const {request,calls}=fixture();
  assert.equal((await request('profiles/kid-a/kitchen-completions',undefined,false)).status,401);
  assert.equal((await request('profiles/foreign/kitchen-completions')).status,404);
  assert.equal((await request('profiles/kid-a/kitchen-completions',{count:100})).status,405);
  const response=await request('profiles/kid-a/kitchen-completions');
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control')??'',/no-store/);
  assert.deepEqual(await response.json(),{counts:{burger:100}});
  assert.deepEqual(calls,[['kid-a']]);
});
test('shared cooking rules grade burns and completion while preserving recipe prerequisites',()=>{
  let session={revision:0,sessionId:'issued',game:createCookingGame(GRILLED_PORK_RECIPE,{rawRoundLimit:10,safeRoundLimit:20})};
  assert.equal(kitchenOutcome(nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'flip'})),null);
  for(const action of [{type:'selectHeat',level:'medium'},{type:'confirmHeat'}] as const)session=nextKitchen(session,GRILLED_PORK_RECIPE.id,action) as typeof session;
  const burnt=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'rotate',turns:21});assert.equal(kitchenOutcome(burnt),'burnt');
  session=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'rotate',turns:11}) as typeof session;
  session=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'lockRotation'}) as typeof session;
  const phase=GRILLED_PORK_RECIPE.phases[session.game.phaseIndex];assert.equal(phase?.kind,'seasoning');
  if(phase?.kind!=='seasoning')throw new Error('Expected seasoning');
  session=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'season',seasoningId:phase.seasoningOptions[0]!.id}) as typeof session;
  session=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'confirmSeasoning'}) as typeof session;
  session=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'flip'}) as typeof session;
  assert.equal(kitchenOutcome(session),'finished');
  const replay=nextKitchen(session,GRILLED_PORK_RECIPE.id,{type:'restart'});assert.notEqual(replay.sessionId,session.sessionId);assert.equal(kitchenOutcome(replay),null);
});
test('Town journal reports new unlocks/builds/milestones, excluding moves and free starter grants',()=>{
  const before=initialTown(),after=structuredClone(before);after.learnedIds=['a','b','c','d'];after.entities.push({id:'built',blueprintId:'house',x:5,y:8,paidCost:{}});after.earned['town-first-home']='2026-10-17T00:00:00Z';
  const events=[...townAdventures(before,after),...blueprintAdventures(0,4)];assert.ok(events.some(event=>event.kind==='blueprint_unlocked'&&event.data.subject==='Apple tree'));assert.ok(events.some(event=>event.kind==='town_built'&&event.data.subject==='Normal house'));assert.ok(events.some(event=>event.kind==='town_milestone'));
  const moved=structuredClone(after);moved.entities[0]!.x=10;assert.deepEqual(townAdventures(after,moved),[]);
  const starter=initialTown();starter.entities.push({id:'starter-home',blueprintId:'house',x:5,y:8,paidCost:{}});assert.equal(townAdventures(before,starter).filter(event=>event.kind==='town_built').length,0);
});
