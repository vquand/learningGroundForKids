import test from 'node:test';
import { GardenSessions, withoutAnimalPositions } from '../src/town-building/gardenSessions.js';
import { GardenWorkerPool } from '../src/town-building/gardenSimulation.js';
import assert from 'node:assert/strict';
import { emptyTown, type TownState } from '../src/town-building/game.js';
import { freshPatch, applyGardenCommand, cropMayGrow } from '../src/town-building/garden.js';
import { isHalloweenNight, isHalloweenPreparation, halloweenWorkAllowed } from '../src/town-building/halloweenCalendar.js';
import { lanternSites, chooseLanternSite, MAX_HALLOWEEN_LANTERNS } from '../src/town-building/halloween.js';
import {tickMap} from '../src/town-building/mapTick.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
const night = { season: 'autumn' as const, localDate: '2026-10-30', timeOfDay: 'night', isDay: false, precipitation: 'none' as const, weatherSource: 'live' };
function town(ready = 4): TownState {
  const garden = freshPatch('autumn'); garden.crop = 'pumpkin'; garden.slots.forEach((slot, index) => { slot.crop = 'pumpkin'; slot.growth = index < ready ? 300 : 0; });
  return { ...emptyTown(), entities: [
    { id: 'home', blueprintId: 'house', x: 8, y: 10, paidCost: {} },
    { id: 'pumpkins', blueprintId: 'vegetable-patch', x: 10, y: 14, paidCost: {}, garden },
  ] };
}
function advance(state: TownState, start: number, seconds: number, weather = night) {
  let next = state;
  for (let elapsed = 5; elapsed <= seconds; elapsed += 5) next = tickMap(next,'town', start + elapsed * 1000, weather);
  return next;
}
test('home-calendar dates, dry darkness, fresh weather and seasonal pumpkin eligibility', () => {
  assert.equal(isHalloweenPreparation('2026-10-27'), true);
  assert.equal(isHalloweenPreparation('2026-10-29'), true);
  assert.equal(isHalloweenPreparation('2026-10-30'), false);
  assert.equal(isHalloweenNight('2026-10-30'), true);
  assert.equal(isHalloweenNight('2026-10-31'), true);
  for (const date of ['2026-11-01', '2026-10-29', '2026-10-31T00:00:00Z', '10-31']) assert.equal(isHalloweenNight(date), false);
  assert.equal(halloweenWorkAllowed(night), true);
  for (const change of [{ isDay: true }, { precipitation: 'rain' }, { precipitation: 'snow' }, { weatherSource: 'stale' }, { weatherSource: 'unavailable' }, { weatherSource: 'preview' }, { timeOfDay: null }]) assert.equal(halloweenWorkAllowed({ ...night, ...change }), false);
  assert.equal(cropMayGrow('pumpkin', 'spring', '2026-10-27'), true);
  assert.equal(cropMayGrow('pumpkin', 'spring', '2026-11-01'), false);
  assert.equal(cropMayGrow('pumpkin', null, '2026-10-27'), false);
  assert.equal(cropMayGrow('cabbage', 'spring', '2026-10-27'), false);
  assert.doesNotThrow(() => applyGardenCommand(town(),'town', { type: 'plant', entityId: 'pumpkins', generation: 0, crop: 'pumpkin' }, '', 0, 'spring', '2026-10-28'));
});
test('one real ripe pumpkin makes one lantern and two stamina; more pumpkins make more lights', () => {
  for (const ready of [1, 4]) {
    let state = tickMap(town(ready),'town', 1000, night, true);
    assert.equal(state.materials.stamina, 0);
    state = advance(state, 1000, 120);
    assert.equal(state.halloween!.lanterns.length, ready);
    assert.equal(state.materials.stamina, ready * 2);
    assert.equal(state.gardening!.harvests, 0);
    assert.equal(state.earned['town-first-harvest'], undefined);
    assert.equal(state.earned['town-garden-basket'], undefined);
    assert.equal(new Set(state.halloween!.lanterns.map(site => `${site.x}:${site.y}`)).size, ready);
    assert.ok(state.entities[1]!.garden!.slots.slice(0, ready).every(slot => slot.generation === 1 && slot.crop === 'pumpkin' && slot.growth < 300));
    assert.equal(tickMap(state,'town', 121000, night).materials.stamina, ready * 2);
  }
});
test('manual harvest invalidates reservations without duplicating rewards', () => {
  let state = tickMap(town(),'town', 1000, night, true);
  state = applyGardenCommand(state,'town', { type: 'harvest', entityId: 'pumpkins', generation: 0 }, '', 2000, 'autumn');
  state = advance(state, 1000, 30);
  assert.equal(state.materials.stamina, 8);
  assert.equal(state.halloween!.lanterns.length, 0);
  assert.equal(state.halloween!.jobs.length, 0);
  assert.equal(state.gardening!.harvests, 4);
});
test('a bite invalidates only its plant; unripe pumpkins and other crops remain untouched', () => {
  let state = tickMap(town(),'town', 1000, night, true);
  const slot = state.entities[1]!.garden!.slots[0]!; slot.growth = 0; slot.generation++;
  state = advance(state, 1000, 60);
  assert.equal(state.materials.stamina, 6);
  assert.equal(state.halloween!.lanterns.length, 3);
  const other = town(); other.entities[1]!.garden!.slots.forEach(slot => slot.crop = 'potato'); other.entities[1]!.garden!.crop = 'potato';
  assert.equal(advance(tickMap(other,'town', 1000, night, true), 1000, 30).materials.stamina, 0);
});
test('rain pauses jobs, resume never catches up offline, and November removes only decorations', () => {
  let state = advance(tickMap(town(1),'town', 1000, night, true), 1000, 5);
  const active = state.halloween!.activeSeconds;
  for (const timestamp of [11000, 16000, 21000]) state = tickMap(state,'town', timestamp, { ...night, precipitation: 'rain' });
  assert.equal(state.halloween!.activeSeconds, active);
  state = tickMap(state,'town', 10000000, night, true);
  assert.equal(state.halloween!.activeSeconds, active);
  state = advance(state, 10000000, 30);
  assert.equal(state.halloween!.lanterns.length, 1);
  const stamina = state.materials.stamina;
  state = tickMap(state,'town', 10035000, { ...night, localDate: '2026-11-01' });
  assert.equal(state.halloween, undefined); assert.equal(state.materials.stamina, stamina);
});
test('hooks use clear grass; no hanging site means no pumpkin consumption', () => {
  const sites = lanternSites(town().entities,mapDefinition('town')); assert.ok(sites.length >= 4);
  assert.ok(sites.every(site => !(site.x >= 8 && site.x < 10 && site.y >= 10 && site.y < 12)));
  const noHome = town(); noHome.entities = noHome.entities.filter(entity => entity.blueprintId === 'vegetable-patch');
  const next = advance(tickMap(noHome,'town', 1000, night, true), 1000, 60);
  assert.equal(next.materials.stamina, 0);
  assert.ok(next.entities[0]!.garden!.slots.every(slot => slot.growth === 300));
  assert.equal(next.halloween!.lanterns.length, 0);
});

test('CPU worker and checkpoint preserve seasonal jobs without offline or repeated harvest rewards', async () => {
  const workers=new GardenWorkerPool();
  try {
    let state=await workers.run(town(1),'town',1000,night,true);
    state=await workers.run(state,'town',6000,night,false);
    const lease=new GardenSessions(()=>6000);lease.put('kid',state);
    const stored=JSON.parse(JSON.stringify(withoutAnimalPositions(state,true)));
    assert.equal(stored.gardening.lastTick,0);
    assert.equal(lease.read('kid',stored)!.halloween!.activeSeconds,5);
    state=await workers.run(stored,'town',1000000,night,true);
    assert.equal(state.halloween!.activeSeconds,5);
    state=await workers.run(state,'town',1005000,night,false);
    assert.equal(state.materials.stamina,2);
    const picked=JSON.parse(JSON.stringify(withoutAnimalPositions(state,true)));
    state=await workers.run(picked,'town',2000000,night,true);
    state=await workers.run(state,'town',2010000,night,false);
    assert.equal(state.halloween!.lanterns.length,1);
    assert.equal(state.materials.stamina,2);
    assert.equal(lease.read('kid',state),undefined,'revision changes invalidate the old lease');
  } finally {await workers.close();}
});

test('100-lantern cap includes reserved pickups and leaves further ripe pumpkins untouched',()=>{
 const state=town(4);state.halloween={year:'2026',activeSeconds:0,nextId:100,working:true,lanterns:Array.from({length:100},(_,id)=>({id,x:0,y:id,variant:id%6,post:id%3})),jobs:[]};
 const next=tickMap(state,'town',1000,night,true);assert.equal(next.halloween!.lanterns.length,MAX_HALLOWEEN_LANTERNS);assert.equal(next.halloween!.jobs.length,0);assert.equal(next.materials.stamina,0);assert.ok(next.entities[1]!.garden!.slots.every(s=>s.growth===300));
 state.halloween.lanterns.length=99;const reserved=tickMap(state,'town',1000,night,true);assert.ok(reserved.halloween!.lanterns.length+reserved.halloween!.jobs.length<=100);
});
test('lantern sites prefer landmarks, spread across town, and randomize reproducibly by town/job',()=>{
 const entities=town().entities;entities.push({id:'tree',blueprintId:'apple',x:5,y:24,paidCost:{}});
 for(const [x,y]of [[11,20],[10,20],[12,20],[11,19],[11,21]])entities.push({id:`road-${x}-${y}`,blueprintId:'dirt-road',x:x!,y:y!,paidCost:{}});
 const sites=lanternSites(entities,mapDefinition('town'));for(const priority of [0,1,2,3])assert.ok(sites.some(s=>s.priority===priority),`landmark ${priority}`);
 const picked:{x:number;y:number}[]=[];for(let i=0;i<16;i++){const next=chooseLanternSite(sites,picked,`town-a:${i}`);if(!next)break;assert.ok(picked.every(p=>Math.hypot(p.x-next.x,p.y-next.y)>=3));picked.push(next);}
 assert.ok(picked.length>=8);assert.ok(Math.max(...picked.map(p=>p.y))-Math.min(...picked.map(p=>p.y))>20);
 assert.deepEqual(chooseLanternSite(sites,[],'town-a'),chooseLanternSite(sites,[],'town-a'));assert.notDeepEqual(chooseLanternSite(sites,[],'town-a'),chooseLanternSite(sites,[],'town-b'));
});

test('delivering ghosts rest for random active seconds, keep their last position and reserve crops exclusively',()=>{
 let state=tickMap(town(4),'town',1000,night,true),lastJob=state.halloween!.jobs[0]!;
 for(let i=1;i<=80;i++){
  state=tickMap(state,'town',1000+i*1000,night);
  const holiday=state.halloween!,pending=holiday.jobs.filter(j=>!j.harvested);
  assert.equal(new Set(pending.map(j=>`${j.entityId}:${j.slot}:${j.generation}`)).size,pending.length);
  assert.ok(pending.filter(j=>j.entityId==='pumpkins').length<=1,'one approaching ghost per patch avoids crowding');
  if(holiday.lanterns.some(l=>l.id===lastJob.id)){
   const rest=holiday.workers!.find(w=>w.worker===lastJob.worker)!;
   assert.ok(rest.readyAt-holiday.activeSeconds>=3&&rest.readyAt-holiday.activeSeconds<=7);
   assert.equal(holiday.jobs.some(j=>j.worker===lastJob.worker),false,'delivery cannot immediately reassign the ghost');
   assert.deepEqual(rest.position,{x:lastJob.to.x+.65,y:lastJob.to.y+.5});
   const copy=JSON.parse(JSON.stringify(state)),active=holiday.activeSeconds;
   const resumed=tickMap(copy,'town',1000000,night,true);
   assert.equal(resumed.halloween!.activeSeconds,active);assert.deepEqual(resumed.halloween!.workers,holiday.workers,'idle cooldown survives reload without offline time');
   return;
  }
 }
 assert.fail('first delivery never completed');
});

test('a later pickup starts from the last lantern after its rest, and different patches reserve different plants',()=>{
 let state=town(4),last=new Map<number,{x:number;y:number;readyAt:number}>(),seen=new Set<number>(),repeat=false;
 for(let elapsed=0;elapsed<=160;elapsed++){
  state=tickMap(state,'town',1000+elapsed*1000,night,elapsed===0);
  const h=state.halloween!;
  for(const job of h.jobs)if(!seen.has(job.id)){seen.add(job.id);const rest=last.get(job.worker);if(rest){assert.ok(job.startedAt>=rest.readyAt);assert.deepEqual(job.origin,{x:rest.x,y:rest.y});repeat=true;}}
  for(const worker of h.workers!)if(!h.jobs.some(j=>j.worker===worker.worker)&&worker.readyAt>h.activeSeconds)last.set(worker.worker,{...worker.position,readyAt:worker.readyAt});
 }
 assert.ok(repeat,'at least one ghost must deliver a second lantern');assert.equal(state.materials.stamina,8);
 const several=town(4);for(let index=0;index<2;index++)several.entities.push({id:`other-${index}`,blueprintId:'vegetable-patch',x:12,y:22+index*3,paidCost:{},garden:structuredClone(several.entities[1]!.garden!)});
 const h=tickMap(several,'town',1000,night,true).halloween!;assert.equal(h.jobs.length,3);assert.equal(new Set(h.jobs.map(j=>j.entityId)).size,3);
});

test('Ghostly Sky unlocks on the 21st completed lantern, survives November, and starts a new yearly record',()=>{
 let state=town(1);
 state.eventHistory={'halloween-pumpkins':{'2026':{edition:'2026-v1',counters:{'lanterns-created':{count:20,receipts:Array.from({length:20},(_,i)=>`prior-${i}`)}}}}};
 state=tickMap(state,'town',1000,night,true);
 assert.equal(state.earned['halloween-ghostly-sky'],undefined);
 state=advance(state,1000,10);
 assert.equal(state.materials.stamina,2);assert.equal(state.eventHistory!['halloween-pumpkins']!['2026']!.counters['lanterns-created']!.count,20,'a carried lantern is not installed yet');
 state=advance(state,11000,60);
 assert.equal(state.eventHistory!['halloween-pumpkins']!['2026']!.counters['lanterns-created']!.count,21);
 const earned=state.earned['halloween-ghostly-sky'];assert.ok(earned);
 state=tickMap(JSON.parse(JSON.stringify(withoutAnimalPositions(state,true))),'town',1000000,night,true);
 assert.equal(state.eventHistory!['halloween-pumpkins']!['2026']!.counters['lanterns-created']!.count,21,'reload cannot recount receipts');
 state=tickMap(state,'town',1005000,{...night,localDate:'2026-11-01'});
 assert.equal(state.halloween,undefined);assert.equal(state.earned['halloween-ghostly-sky'],earned);
 assert.equal(state.eventHistory!['halloween-pumpkins']!['2026']!.counters['lanterns-created']!.count,21);
 state=tickMap(state,'town',1010000,{...night,localDate:'2027-10-30'},true);
 assert.equal(state.halloween!.lanterns.length,0);assert.equal(state.eventHistory!['halloween-pumpkins']!['2027'],undefined);assert.equal(state.earned['halloween-ghostly-sky'],earned);
});
test('ghosts may hang lanterns on bridge decks, but never on a deck carrying an insect nest',()=>{
 const entities=town().entities;for(const x of [16,17,18])entities.push({id:`bridge-${x}`,blueprintId:'wood-bridge',x,y:12,paidCost:{}});
 const decks=(rafts:Parameters<typeof lanternSites>[2]=[])=>lanternSites(entities,mapDefinition('town'),rafts).filter(s=>s.y===12&&s.x>=16&&s.x<=18).map(s=>[s.x,s.priority]);
 assert.deepEqual(decks(),[[16,1],[17,1],[18,1]]);
 assert.deepEqual(decks([{x:17,y:12,blueprintId:'insect-raiser'}]),[[16,1],[18,1]]);
});
