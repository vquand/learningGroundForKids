import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEPRINTS,emptyTown,expireEventBuildings,isPassable,nextDirection,placementError,type Entity,type TownCommand} from '../src/town-building/game.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {landView} from '../src/town-building/maps/view.ts';
import {civWalkable} from '../src/town-building/civ.ts';
import {animalWalkable} from '../src/town-building/animalWorld.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
import {tickMap} from '../src/town-building/mapTick.ts';
import {lanternSites} from '../src/town-building/halloween.ts';
import {raftPlacementError} from '../src/town-building/water/rules.ts';
import {createTownRepository} from '../src/town-building/repository.ts';
import type {Pool} from 'pg';

const weather={season:'autumn' as const,localDate:'2026-10-30',timeOfDay:'morning',isDay:true,precipitation:'none' as const};
function seed(){const s=emptyTown();s.materials.wood=10;s.storage={built:false,crops:{pumpkin:3},milk:[],fish:{}};s.maps={lake:emptyLake(1000)};return s;}
const blueprint=()=>BLUEPRINTS.find(b=>b.id==='halloween-lantern')!;
const build={type:'build' as const,blueprintId:'halloween-lantern',x:8,y:4};
const command=(s:ReturnType<typeof seed>,c:TownCommand=build,mapId:'town'|'lake'='town',date=weather.localDate)=>applyMapLandCommand(s,{type:'land-action',mapId,command:c},1000,'lantern',{...weather,localDate:date});

test('lantern is unlocked, 1x1, blocks walking and flips between two facings',()=>{
 const b=blueprint();assert.ok(b);assert.equal(b.learned,0);assert.equal(b.width,1);assert.equal(b.length,1);assert.deepEqual(b.cost,{wood:1});
 const s=command(seed()),lamp=s.entities[0]!;assert.equal(isPassable(lamp),false);
 assert.notEqual(nextDirection(b.id,'front'),'front');assert.equal(nextDirection(b.id,nextDirection(b.id,'front')),'front');
 assert.equal(civWalkable(s.entities,mapDefinition('town')).has('8:4'),false);
 const host:Entity={id:'coop',blueprintId:'coop',x:6,y:1,paidCost:{}};
 for(const species of ['chicken','duck','sheep'] as const)assert.equal(animalWalkable([...s.entities,host],host,species,{mapId:'town',rafts:[]}).has('8:4'),false);
});

test('both maps debit one harvested pumpkin and one wood atomically, preserve the recipe and reload',()=>{
 for(const mapId of ['town','lake'] as const){const initial=seed(),s=command(initial,build,mapId);assert.equal(s.materials.wood,9);assert.equal(s.storage!.crops.pumpkin,2);assert.equal(initial.storage!.crops.pumpkin,3);
  const lamp=landView(s,mapId).entities[0]!;assert.deepEqual(lamp.paidCost,{wood:1});assert.deepEqual(lamp.paidCropCost,{pumpkin:1});
  const reloaded=JSON.parse(JSON.stringify(s)) as typeof s;assert.deepEqual(landView(reloaded,mapId).entities[0],lamp);
  const moved=command(reloaded,{type:'move',entityId:'lantern',x:8,y:5,direction:'back'},mapId);assert.equal(moved.materials.wood,8);assert.equal(moved.storage!.crops.pumpkin,1);
 }
 const noPumpkin=seed();noPumpkin.storage!.crops={};assert.throws(()=>command(noPumpkin),/pumpkin/i);assert.equal(noPumpkin.materials.wood,10);
 const noWood=seed();noWood.materials.wood=0;assert.throws(()=>command(noWood),/materials/);assert.equal(noWood.storage!.crops.pumpkin,3);
});

test('the server rejects out-of-event, unknown-calendar and glided builds without spending',()=>{
 for(const date of ['2026-10-29','2026-11-01','']){const s=seed();assert.throws(()=>command(s,build,'town',date),/Halloween/);assert.equal(s.materials.wood,10);}
 assert.throws(()=>command(seed(),{type:'build-line',blueprintId:'halloween-lantern',tiles:[{x:8,y:12}]}),/road, fence or bridge/);
});

test('lanterns stand on any bridge deck, block it and protect their support; nests cannot overlap',()=>{
 const lake=seed();lake.maps!.lake!.land.entities=[{id:'lake-deck',blueprintId:'stone-bridge',x:8,y:7,paidCost:{rock:2}}];
 const lakeBuilt=command(lake,{...build,x:8,y:7},'lake');assert.equal(lakeBuilt.maps!.lake!.land.entities.length,2);assert.equal(civWalkable(lakeBuilt.maps!.lake!.land.entities,mapDefinition('lake')).has('8:7'),false);
 assert.throws(()=>command(lakeBuilt,{type:'remove',entityId:'lake-deck'},'lake'),/lantern/);
 let s=seed();s.entities=[{id:'bridge',blueprintId:'wood-bridge',x:16,y:12,paidCost:{wood:2}}];
 s=command(s,{...build,x:16,y:12});assert.equal(s.entities.length,2);assert.equal(civWalkable(s.entities,mapDefinition('town')).has('16:12'),false);
 for(const c of [{type:'remove',entityId:'bridge'},{type:'remove-line',entityId:'bridge'},{type:'move',entityId:'bridge',x:16,y:13}] as const)assert.throws(()=>command(s,c),/lantern/i);
 assert.match(placementError(s.entities,'town',blueprint(),16,12)??'',/occupied/);
 assert.ok(placementError([],'town',blueprint(),16,12),'bare water is invalid');
 assert.equal(lanternSites(s.entities,mapDefinition('town')).some(p=>p.x===16&&p.y===12),false,'ghosts do not decorate an occupied deck');
 s.entities.push({id:'near1',blueprintId:'wood-bridge',x:16,y:11,paidCost:{}},{id:'near2',blueprintId:'wood-bridge',x:16,y:13,paidCost:{}},{id:'near3',blueprintId:'wood-bridge',x:17,y:12,paidCost:{}});
 const nest={id:'nest',blueprintId:'insect-raiser' as const,fish:[],plant:null};
 assert.match(raftPlacementError(s,'town',nest,16,12)??'',/occupied/);
 const lamp=s.entities.find(e=>e.id==='lantern')!;s.entities=s.entities.filter(e=>e.id!==lamp.id);s.rafts=[{...nest,x:16,y:12,paidCost:{},generation:0,plantGrowth:0,feeder:false}];
 assert.match(placementError(s.entities,'town',blueprint(),16,12,undefined,s.rafts)??'',/occupied/);
});

test('moves, transfers and invalid placements preserve atomic crop recipes and no-op balances',()=>{
 const s=command(seed()),lamp=s.entities[0]!;
 assert.equal(command(s,{type:'move',entityId:lamp.id,x:lamp.x,y:lamp.y}),s);
 const moved=applyMapLandCommand(s,{type:'transfer-building',entityId:lamp.id,sourceMap:'town',destinationMap:'lake',x:8,y:4},1000,'unused',weather);
 assert.equal(moved.entities.length,0);assert.equal(moved.maps!.lake!.land.entities[0]!.id,lamp.id);assert.equal(moved.storage!.crops.pumpkin,1);
 const snapshot=structuredClone(s);assert.throws(()=>command(s,{...build,x:16,y:12}),/protected|water/);assert.deepEqual(s,snapshot);
 assert.throws(()=>command(s,{...build,direction:'left'}),/cannot face/);assert.deepEqual(s,snapshot);
});

test('November cleanup removes kid lanterns on each map while preserving buildings, storage and badges',()=>{
 let s=command(seed());s=command(s,build,'lake');s.entities.push({id:'fence',blueprintId:'wooden-fence',x:9,y:12,paidCost:{wood:1}});s.earned.keep='2026-10-30';
 assert.ok(tickMap(s,'town',2000,{season:'autumn',localDate:'2026-11-01',precipitation:'none'},true).entities.some(e=>e.blueprintId==='halloween-lantern'),'an unknown home clock never expires constructions');
 for(const mapId of ['town','lake'] as const)s=tickMap(s,mapId,2000,{...weather,localDate:'2026-11-01'},true);
 assert.equal(s.entities.some(e=>e.blueprintId==='halloween-lantern'),false);assert.equal(s.maps!.lake!.land.entities.length,0);assert.ok(s.entities.some(e=>e.id==='fence'));assert.equal(s.storage!.crops.pumpkin,1);assert.equal(s.earned.keep,'2026-10-30');
});

test('lantern expiry accepts only valid dates after its own event window',()=>{
 const original=command(seed());
 for(const date of ['', 'odd', '2026-11-31', '2026-13-01', '2026-02-30', '2025-11-01', '2026-01-01', '2026-10-29', '2026-10-30', '2026-10-31']){
  const s=structuredClone(original);expireEventBuildings(s,date);assert.deepEqual(s,original,date);
 }
 for(const date of ['2026-11-01','2026-12-31','2027-01-01','2027-10-30']){
  const s=structuredClone(original);expireEventBuildings(s,date);assert.equal(s.entities.length,0,date);assert.equal(s.revision,original.revision+1);
  expireEventBuildings(s,date);assert.equal(s.revision,original.revision+1,'cleanup is idempotent');assert.deepEqual(s.storage,original.storage);assert.deepEqual(s.materials,original.materials);
 }
 const later=command(seed(),build,'town','2027-10-30');
 assert.equal(later.entities[0]!.eventYear,2027);
 expireEventBuildings(later,'2026-11-01');assert.equal(later.entities.length,1,'an earlier trusted date cannot remove a later occurrence');
 expireEventBuildings(later,'2027-11-01');assert.equal(later.entities.length,0);
});

test('acting on a bridge expires lanterns on both maps without ticking, but never from preview dates',()=>{
 let s=seed();s.entities=[{id:'bridge',blueprintId:'wood-bridge',x:16,y:12,paidCost:{wood:2}}];
 s=command(s,{...build,x:16,y:12});s=command(s,build,'lake');
 const before=structuredClone(s),action={type:'land-action' as const,mapId:'town' as const,command:{type:'remove' as const,entityId:'bridge'}};
 assert.throws(()=>applyMapLandCommand(s,action,2000,'unused',{...weather,localDate:'2026-11-01',weatherSource:'preview'}),/lantern/);
 const next=applyMapLandCommand(s,action,2000,'unused',{...weather,localDate:'2026-11-01'});
 assert.equal(next.entities.length,0);assert.equal(next.maps!.lake!.land.entities.length,0);assert.deepEqual(next.storage,before.storage);assert.deepEqual(next.materials,before.materials);assert.deepEqual(s,before,'the input remains unchanged');
});

test('owned state reads durably expire unopened maps, without ticks, refunds or repeated writes',async()=>{
 let saved=command(command(seed()),build,'lake');saved.starterHomeGranted=true;
 saved.woolMigrated=true;const before=structuredClone(saved);let writes=0;
 // In-memory SQL boundary: exercise the real repository's read/lock/save path without a database.
 const query=async(sql:string,params?:unknown[])=>{
  if(sql.startsWith('UPDATE town_state')){saved=JSON.parse(String(params?.[1]));writes++;return {rows:[],rowCount:1};}
  if(sql.includes('SELECT state,'))return {rows:[{state:structuredClone(saved),learned_ids:[]}],rowCount:1};
  if(sql.startsWith('SELECT state FROM town_state'))return {rows:[{state:structuredClone(saved)}],rowCount:1};
  if(sql.includes('SELECT item_id FROM town_learned_items')||sql.includes('FROM fishing_cast_results'))return {rows:[],rowCount:0};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('INSERT INTO town_'))return {rows:[],rowCount:0};
  throw new Error(`Unexpected test query: ${sql}`);
 };
 const pool={query,connect:async()=>({query,release(){}})} as unknown as Pool;
 const repository=createTownRepository(pool,()=>2000);
 await repository.get('kid',{localDate:'2026-11-01'});assert.equal(writes,0,'an unresolved clock does not expire anything');
 const cleaned=await repository.get('kid',{...weather,localDate:'2026-11-01'});
 assert.equal(writes,1);assert.equal(cleaned.entities.length,0);assert.equal(cleaned.maps!.lake!.land.entities.length,0);
 assert.deepEqual(cleaned.materials,before.materials);assert.deepEqual(cleaned.storage,before.storage);assert.deepEqual(cleaned.earned,before.earned);
 const restarted=createTownRepository(pool,()=>2000);
 await restarted.getLake!('kid',{...weather,localDate:'2026-11-02'});assert.equal(writes,1,'a reload or another map read cannot repeat cleanup');
});

test('owned load durably normalizes legacy wool once and reload does not grant again',async()=>{
 let saved=seed();saved.starterHomeGranted=true;
 Object.assign(saved.materials,{wool:1100});delete saved.woolMigrated;
 let writes=0;
 const query=async(sql:string,params?:unknown[])=>{
  if(sql.startsWith('UPDATE town_state')){saved=JSON.parse(String(params?.[1]));writes++;return {rows:[],rowCount:1};}
  if(sql.includes('SELECT state,'))return {rows:[{state:structuredClone(saved),learned_ids:[]}],rowCount:1};
  if(sql.startsWith('SELECT state FROM town_state'))return {rows:[{state:structuredClone(saved)}],rowCount:1};
  if(sql.includes('SELECT item_id FROM town_learned_items')||sql.includes('FROM fishing_cast_results'))return {rows:[],rowCount:0};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('INSERT INTO town_'))return {rows:[],rowCount:0};
  throw new Error(`Unexpected test query: ${sql}`);
 };
 const pool={query,connect:async()=>({query,release(){}})} as unknown as Pool;
 await createTownRepository(pool,()=>2000).get('kid');
 assert.equal(saved.woolMigrated,true);assert.equal(saved.storage!.wool,10);assert.equal(Object.hasOwn(saved.materials,'wool'),false);assert.equal(writes,1);
 await createTownRepository(pool,()=>2000).get('kid');assert.equal(writes,1);assert.equal(saved.storage!.wool,10);
});
