import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyTown} from '../src/town-building/game.js';
import {tickTownEvents} from '../src/town-building/events/index.js';
import {WOMENS_DAY_EVENT_ID,WOMENS_DAY_EDITION,womensDayRecord} from '../src/town-building/events/womensDay2026Model.js';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
const clock=(localDate:string)=>({localDate,timeOfDay:'noon',isDay:true,precipitation:'none'});
test('2026 achievements deduplicate visits and seven distinct server-issued visitor greetings',async()=>{
 const {interactWomensDay}=await import('../src/town-building/events/index.js');
 const {WOMENS_DAY_ACHIEVEMENTS}=await import('../src/town-building/events/womensDayAchievements.js');
 const {womensDayProgress}=await import('../src/town-building/events/womensDayProgress.js');
 const town=emptyTown(),day=clock('2026-10-20');
 interactWomensDay(town,day,{type:'visit'},1000);interactWomensDay(town,day,{type:'visit'},2000);
 assert.equal(womensDayProgress(town).visits,1);assert.ok(town.earned[WOMENS_DAY_ACHIEVEMENTS[0]!.id]);
 for(let i=0;i<7;i++){for(let retry=0;retry<2;retry++)interactWomensDay(town,day,{type:'greet',visitorId:`flower-${i+1}`},3000+i*1000);assert.equal(womensDayProgress(town).greeted,i+1);for(const badge of WOMENS_DAY_ACHIEVEMENTS.slice(1))assert.equal(!!town.earned[badge.id],i+1>=badge.target);}
 const before=structuredClone(town),timestamp=town.earned[WOMENS_DAY_ACHIEVEMENTS[3]!.id];
 interactWomensDay(town,day,{type:'greet',visitorId:'flower-7'},999999);assert.equal(town.earned[WOMENS_DAY_ACHIEVEMENTS[3]!.id],timestamp);assert.equal(town.revision,before.revision);assert.deepEqual(town.materials,before.materials);
 assert.throws(()=>interactWomensDay(town,day,{type:'greet',visitorId:'forged'},999999));assert.deepEqual(town,before);
 assert.throws(()=>interactWomensDay(town,clock('2026-10-22'),{type:'visit'},999999));
 tickTownEvents(town,mapDefinition('town'),clock('2026-10-22'),0,300);assert.equal(womensDayProgress(town).greeted,7);assert.ok(town.earned[WOMENS_DAY_ACHIEVEMENTS[3]!.id]);
 const next=emptyTown();interactWomensDay(next,clock('2027-10-20'),{type:'visit'},999999);for(let i=0;i<7;i++)interactWomensDay(next,clock('2027-10-20'),{type:'greet',visitorId:`flower-${i+1}`},999999);assert.deepEqual(next.earned,{});assert.equal(womensDayProgress(next).greeted,0);
});
test('registered Women’s Day event starts only October 19–21 and retains its edition across reloads',()=>{
 const town=emptyTown(),before=structuredClone(town);
 tickTownEvents(town,mapDefinition('town'),clock('2026-10-18'),0,300);assert.equal(town.events?.[WOMENS_DAY_EVENT_ID],undefined);
 tickTownEvents(town,mapDefinition('town'),clock('2026-10-19'),0,300);
 assert.deepEqual(town.events?.[WOMENS_DAY_EVENT_ID],{edition:WOMENS_DAY_EDITION,occurrence:'2026',data:{year:'2026'}});
 const revision=town.revision,record=structuredClone(town.events![WOMENS_DAY_EVENT_ID]);
 const restored=JSON.parse(JSON.stringify(town));tickTownEvents(restored,mapDefinition('town'),clock('2026-10-20'),15,300);tickTownEvents(restored,mapDefinition('town'),clock('2026-10-21'),15,300);
 assert.deepEqual(restored.events[WOMENS_DAY_EVENT_ID],record);assert.equal(restored.revision,revision,'cosmetic ticks do not create durable progress writes');
 assert.deepEqual(restored.materials,before.materials);assert.deepEqual(restored.entities,before.entities);assert.deepEqual(restored.earned,before.earned);assert.equal(restored.eventHistory,undefined);
});
test('event cleanup and later years preserve Halloween, other events and earned badges',()=>{
 const town=emptyTown();tickTownEvents(town,mapDefinition('town'),clock('2026-10-20'),0,300);
 town.events!.other={edition:'v7',occurrence:'2026',data:{keep:true}};town.earned.keep='2026-01-01T00:00:00.000Z';
 tickTownEvents(town,mapDefinition('town'),clock('2026-10-22'),0,300);assert.equal(town.events![WOMENS_DAY_EVENT_ID],undefined);assert.deepEqual(town.events!.other.data,{keep:true});assert.ok(town.earned.keep);
 tickTownEvents(town,mapDefinition('town'),{...clock('2026-10-30'),timeOfDay:'night',isDay:false},0,300);assert.ok(town.events!['halloween-pumpkins']);assert.equal(town.events![WOMENS_DAY_EVENT_ID],undefined);
 tickTownEvents(town,mapDefinition('town'),clock('2027-10-19'),0,300);assert.equal(town.events![WOMENS_DAY_EVENT_ID]!.occurrence,'2027');assert.equal(town.events!['halloween-pumpkins'],undefined);assert.deepEqual(town.events!.other.data,{keep:true});
});
test('unknown editions freeze without falling back; frontend projection rejects stale/unsupported records',()=>{
 const town=emptyTown();tickTownEvents(town,mapDefinition('town'),clock('2026-10-20'),0,300);
 assert.ok(womensDayRecord(town.events,'2026-10-20'));assert.equal(womensDayRecord(town.events,'2026-10-22'),undefined);assert.equal(womensDayRecord(town.events,'2027-10-20'),undefined);assert.equal(womensDayRecord(undefined,'2026-10-20'),undefined);
 town.events![WOMENS_DAY_EVENT_ID]!.edition='2028-v2';const record=structuredClone(town.events![WOMENS_DAY_EVENT_ID]);
 tickTownEvents(town,mapDefinition('town'),clock('2026-10-21'),15,300);assert.deepEqual(town.events![WOMENS_DAY_EVENT_ID],record);assert.equal(womensDayRecord(town.events,'2026-10-21'),undefined);
 const fresh=emptyTown();tickTownEvents(fresh,mapDefinition('town'),{localDate:'2026-10-20'},0,300);assert.equal(fresh.events,undefined,'unknown home clock cannot start an event');
});
test('the existing garden worker dispatches the registered event and cleans it up on the home clock',async()=>{
 const {GardenWorkerPool}=await import('../src/town-building/gardenSimulation.js');
 const workers=new GardenWorkerPool();
 try{
  const active=await workers.run(emptyTown(),'town',1000,{...clock('2026-10-20'),season:'autumn',precipitation:'none'},true);
  assert.equal(active.events?.[WOMENS_DAY_EVENT_ID]?.edition,WOMENS_DAY_EDITION);
  const ended=await workers.run(active,'town',6000,{...clock('2026-10-22'),season:'autumn',precipitation:'none'},false);
  assert.equal(ended.events?.[WOMENS_DAY_EVENT_ID],undefined);assert.deepEqual(ended.materials,active.materials);
 }finally{await workers.close();}
});
test('celebration cards are remembered separately for each home-calendar day',async()=>{
 const {interactWomensDay}=await import('../src/town-building/events/index.js');
 const town=emptyTown();
 for(const day of [19,20,21]){
  const date=`2026-10-${day}`;interactWomensDay(town,clock(date),{type:'dismiss-intro'},1000);
  const data=town.events!['womens-day']!.data as {introSeenDates:string[]};assert.ok(data.introSeenDates.includes(date));
  const revision=town.revision;interactWomensDay(town,clock(date),{type:'dismiss-intro'},2000);assert.equal(town.revision,revision);
 }
 assert.deepEqual((town.events!['womens-day']!.data as {introSeenDates:string[]}).introSeenDates,['2026-10-19','2026-10-20','2026-10-21']);
 assert.deepEqual(town.earned,{},'dismissing a card never claims an achievement');
});
