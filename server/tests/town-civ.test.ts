import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyTown, applyTownCommand, type Entity } from '../src/town-building/game.js';
import { CIV_BUSINESSES, businessFor } from '../src/town-building/civCatalog.js';
import { ensureCivTown, planMoveIn, tickCiv, prosperityStage, workStatus, helpNeighbor } from '../src/town-building/civ.js';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
import {tickMap} from '../src/town-building/mapTick.ts';

const host:Entity={id:'shop',blueprintId:'grocery',x:5,y:12,paidCost:{}};
const road=(y:number):Entity=>({id:`road-${y}`,blueprintId:'dirt-road',x:7,y,paidCost:{}});
const town=(end=11)=>ensureCivTown({...emptyTown(),entities:[host,...Array.from({length:end+1},(_,y)=>road(y))]});
const morning={localTime:'09:00',timeOfDay:'morning'};

test('seven businesses preserve school/clinic identities and have one or two fixed workers',()=>{
 assert.equal(CIV_BUSINESSES.length,7);assert.equal(businessFor('infirmary')!.workers.length,2);
 assert.ok(CIV_BUSINESSES.every(b=>b.workers.length>=1&&b.workers.length<=2));
 assert.equal(new Set(CIV_BUSINESSES.flatMap(b=>b.workers.map(w=>w.art))).size,10);
});
test('move-ins park on boundary-connected roads and allow exactly two clear walking steps',()=>{
 const blocked=planMoveIn(town(10).entities,host,mapDefinition('town'));assert.equal(blocked.reachable,false);assert.equal(blocked.parking.y,10);
 const ready=planMoveIn(town(11).entities,host,mapDefinition('town'));assert.equal(ready.reachable,true);assert.equal(ready.walk.length-1,2);
 assert.equal(ready.parking.y,11);assert.ok(ready.drive.every(p=>p.x===7&&p.y<=11));
});
test('a nearby disconnected road island and a fence cannot bypass moving-in access',()=>{
 const s=town(10);s.entities.push(road(13));assert.equal(planMoveIn(s.entities,host,mapDefinition('town')).reachable,false);
 const fenced=town(11);fenced.entities.push({id:'fence',blueprintId:'wooden-fence',x:7,y:12,paidCost:{}});
 assert.equal(planMoveIn(fenced.entities,host,mapDefinition('town')).reachable,false);
});
test('no road waits outside; linking a road automatically starts the arrival',()=>{
 let s=ensureCivTown({...emptyTown(),entities:[host]});assert.equal(planMoveIn(s.entities,host,mapDefinition('town')).reachable,false);
 s=tickCiv(s,mapDefinition('town'),1000,morning,true);s=tickCiv(s,mapDefinition('town'),6000,morning);assert.equal(s.entities[0]!.civ!.phase,'waiting');
 s.entities.push(...Array.from({length:12},(_,y)=>road(y)));s=tickCiv(s,mapDefinition('town'),11000,morning);
 assert.equal(s.entities[0]!.civ!.phase,'travelling');
});
test('server active time completes move-in once, with no offline/resume catch-up or resource reward',()=>{
 let s=town();const balance={...s.materials};s=tickCiv(s,mapDefinition('town'),1000,morning,true);
 s=tickCiv(s,mapDefinition('town'),1001000,morning);assert.notEqual(s.entities[0]!.civ!.phase,'ready');
 s=tickCiv(s,mapDefinition('town'),1006000,morning,true);assert.equal(s.entities[0]!.civ!.elapsedMs,0);
 for(let i=1;i<=8;i++)s=tickCiv(s,mapDefinition('town'),1006000+i*5000,morning);
 assert.equal(s.entities[0]!.civ!.phase,'ready');assert.ok(s.earned['town-new-neighbor']);
 const earned=s.earned['town-new-neighbor'];s=tickCiv(s,mapDefinition('town'),1051000,morning);
 assert.equal(s.earned['town-new-neighbor'],earned);assert.deepEqual(s.materials,balance);
});
test('business hours differ, while errands return in short cycles and unknown clocks stay unknown',()=>{
 assert.equal(workStatus(businessFor('bakery')!,0,{localTime:'06:00'}).kind,'working');
 assert.equal(workStatus(businessFor('grocery')!,0,{localTime:'06:00'}).kind,'closed');
 assert.equal(workStatus(businessFor('grocery')!,0,{localTime:'19:00'}).kind,'working');
 assert.equal(workStatus(businessFor('tools-smith')!,0,{localTime:'19:00'}).kind,'closed');
 assert.equal(workStatus(businessFor('grocery')!,0,{}).kind,'unknown');
 const statuses=Array.from({length:240},(_,i)=>workStatus(businessFor('grocery')!,i*1000,morning));
 assert.ok(statuses.some(s=>s.kind==='away'&&s.returnInMs!>0&&s.returnInMs!<=90000));
});
test('help validates server sequence and ready/open host, never caller completion or duplicate steps',()=>{
 let s=town();assert.throws(()=>helpNeighbor(s,'shop',0,morning),/moved in/);
 s.entities[0]!.civ!.phase='ready';
 assert.throws(()=>helpNeighbor(s,'shop',2,morning),/changed/);
 s=helpNeighbor(s,'shop',0,morning);assert.throws(()=>helpNeighbor(s,'shop',0,morning),/changed/);
 s=helpNeighbor(s,'shop',1,morning);s=helpNeighbor(s,'shop',2,morning);
 assert.deepEqual(s.civ!.helpedTypes,['grocery']);assert.throws(()=>helpNeighbor(s,'shop',0,morning),/rest/);
 assert.deepEqual(s.materials,emptyTown().materials);
});
test('prosperity depends on verified distinct businesses and helpers, never duplicates or wall time',()=>{
 let s=town();assert.equal(prosperityStage(s),0);s.entities[0]!.civ!.phase='ready';
 const first=prosperityStage(s);s.entities.push(...Array.from({length:30},(_,i)=>({...s.entities[0]!,id:`copy${i}`})));
 assert.equal(prosperityStage(s),first);
 const all=CIV_BUSINESSES.map((b,i)=>({...host,id:b.id,blueprintId:b.id,y:i*4,civ:{phase:'ready' as const,elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0}}));
 s.entities=all;assert.equal(prosperityStage(s),3);s.entities=[];assert.equal(prosperityStage(s),0);
});
test('building and moving preserves server-owned lifecycle, demolition cannot clone progress',()=>{
 let s=emptyTown();s.materials={stamina:100,wood:100,rock:100,sand:100,metal:100};s.storage={built:false,crops:{},milk:[],fish:{},wool:100};
 s=applyTownCommand(s,'town',{type:'build',blueprintId:'grocery',x:5,y:12},'shop',1000);
 assert.equal(s.entities[0]!.civ!.phase,'waiting');s.entities[0]!.civ!.phase='ready';
 s=applyTownCommand(s,'town',{type:'move',entityId:'shop',x:9,y:12},'ignored',2000);
 assert.equal(s.entities[0]!.id,'shop');assert.equal(s.entities[0]!.civ!.phase,'ready');
 s=applyTownCommand(s,'town',{type:'remove',entityId:'shop'},'ignored',3000);assert.equal(s.entities.length,0);
});

test('arrivals enter through the fixed west gate, not arbitrary map edges',()=>{
 const isolated=[host,...Array.from({length:26},(_,i)=>road(14+i))];
 assert.equal(planMoveIn(isolated,host,mapDefinition('town')).reachable,false);
 const plan=planMoveIn(town().entities,host,mapDefinition('town'));
 assert.deepEqual(plan.drive[0],{x:7,y:0});
});
test('shops still move in through the shared map tick when there is no home city',()=>{
 // No home city: no time of day, so crops and animals rest, but move-ins keep their own lease.
 const homeless={season:'summer',precipitation:'none',timeOfDay:null} as const;
 let s=tickMap(town(11),'town',1000,homeless,true);
 for(let now=6000;now<=120000;now+=5000)s=tickMap(s,'town',now,homeless);
 assert.equal(s.entities.find(e=>e.id==='shop')!.civ!.phase,'ready');
 assert.ok(s.civ!.activeMs>0);
});
