import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown,type Entity,type TownAnimal} from '../src/town-building/game.ts';
import {createAnimalResidents} from '../src/town-building/animalWorld.ts';
import {applyGardenCommand,freshPatch} from '../src/town-building/garden.ts';
import {applyAnimalHabits,settleBushes,droppingChance,clearOccupiedHabits} from '../src/town-building/animalHabits.ts';
import {withoutAnimalPositions,GardenSessions} from '../src/town-building/gardenSessions.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {tickMap} from '../src/town-building/mapTick.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {landView,mergeLand} from '../src/town-building/maps/view.ts';
const now=Date.parse('2026-10-27T03:00:00Z'),env={season:'autumn' as const,timeOfDay:'morning',timeZone:'Asia/Ho_Chi_Minh',precipitation:'none' as const};
function fixture(species:TownAnimal='pig'){
 const state=emptyTown();state.entities=[{id:'barn',blueprintId:'farmhouse',animal:species,x:4,y:4,paidCost:{}},{id:'patch',blueprintId:'vegetable-patch',x:8,y:6,paidCost:{},garden:freshPatch('autumn')}];
 const animals=createAnimalResidents(state.entities,[],{mapId:'town'});animals.splice(1);
 Object.assign(animals[0]!,{x:8.5,y:6.5,path:[],sleeping:false,flying:false,mode:'roaming',inactive:false});
 return {state,animals,patch:state.entities[1]!};
}
const run=(f:ReturnType<typeof fixture>,seconds=0)=>applyAnimalHabits(f.state,f.animals,mapDefinition('town'),env,seconds,now);
const eligible=(f:ReturnType<typeof fixture>,from=0)=>{let seconds=from;while(droppingChance(f.animals[0]!.id,Math.floor(seconds/5))>=.12)seconds+=5;return seconds;};
test('seeded contacts add thirty seconds once per cycle, skip withered/ripe, and share the animal cooldown',()=>{
 const f=fixture(),g=f.patch.garden!;g.slots[0]!.growth=290;g.slots[1]!.growth=10;g.slots[2]!.withered=true;g.slots[3]!.growth=300;
 const at=eligible(f);run(f,at);
 assert.deepEqual(g.slots.map(s=>s.growth),[300,40,0,300]);assert.deepEqual(g.poop,{slot:0,at:now});
 run(f,eligible(f,at+180));assert.equal(g.slots[1]!.growth,40,'cycle cannot stack');
 delete g.poop;run(f,at+5);assert.equal(g.poop,undefined,'cooldown does not reroll');
 run(f,eligible(f,at+360));assert.ok(g.poop);
 const harvested=applyGardenCommand(f.state,'town',{type:'harvest',entityId:f.patch.id,generation:g.generation},'h',now,'autumn');assert.equal(harvested.entities[1]!.garden!.poop,undefined);
 g.poop={slot:0,at:now};const replanted=applyGardenCommand(f.state,'town',{type:'plant',entityId:f.patch.id,crop:'pumpkin',generation:g.generation},'p',now,'autumn');assert.equal(replanted.entities[1]!.garden!.poop,undefined);
});
test('only pig and Highland cow standing contacts produce droppings; replaying a check never rerolls',()=>{
 for(const species of ['dairy-cow','sheep','capybara'] as const){const f=fixture(species);run(f,eligible(f));assert.equal(f.patch.garden!.poop,undefined);}
 const f=fixture();const at=eligible(f);f.animals[0]!.path=[{x:9.5,y:6.5}];run(f,at);assert.equal(f.patch.garden!.poop,undefined);
 f.animals[0]!.path=[];run(f,at);assert.ok(f.patch.garden!.poop);delete f.patch.garden!.poop;run(f,at);assert.equal(f.patch.garden!.poop,undefined);
});
test('only Highland cows poop on free grass; total droppings and bushes cap at eight',()=>{
 const pig=fixture();Object.assign(pig.animals[0]!,{x:10.5,y:10.5});run(pig,eligible(pig));assert.equal(pig.state.droppings?.length??0,0);
 const f=fixture('highland-cow');Object.assign(f.animals[0]!,{x:10.5,y:10.5});run(f,eligible(f));assert.equal(f.state.droppings?.length,1);
 f.state.bushes=Array.from({length:7},(_,i)=>({x:11,y:10+i,since:now}));Object.assign(f.animals[0]!,{x:10.5,y:11.5});run(f,eligible(f,300));assert.equal(f.state.droppings?.length,1);
 f.state.bushes=[];f.state.entities.push({id:'road',blueprintId:'dirt-road',x:10,y:11,paidCost:{}});run(f,eligible(f,600));assert.equal(f.state.droppings?.length,1);
});
test('droppings become bushes at the next home 05:00, including DST and a skipped night',()=>{
 for(const [zone,at,before,sunrise] of [['Asia/Ho_Chi_Minh','2026-10-26T21:59:00Z','2026-10-26T21:59:59Z','2026-10-26T22:00:00Z'],['America/New_York','2026-11-01T03:00:00Z','2026-11-01T09:59:59Z','2026-11-01T10:00:00Z']] as const){
  const state=emptyTown();state.droppings=[{x:10,y:10,at:Date.parse(at)}];
  settleBushes(state,mapDefinition('town'),zone,Date.parse(before));assert.equal(state.bushes?.length??0,0);
  settleBushes(state,mapDefinition('town'),zone,Date.parse(sunrise));assert.equal(state.bushes?.length,1);assert.equal(state.droppings!.length,0);
  settleBushes(state,mapDefinition('town'),zone,Date.parse(sunrise)+86400000);assert.equal(state.bushes!.length,1);
 }
});
test('grazers eat bushes; construction clears occupied props; map views preserve isolation',()=>{
 for(const species of ['dairy-cow','highland-cow','sheep'] as const){const f=fixture(species);f.state.bushes=[{x:8,y:6,since:now}];run(f);assert.equal(f.state.bushes.length,0);}
 const f=fixture('pig');f.state.bushes=[{x:10,y:10,since:now}];f.state.droppings=[{x:11,y:10,at:now}];
 f.state.entities.push({id:'store',blueprintId:'town-storage',x:10,y:10,paidCost:{}});clearOccupiedHabits(f.state);assert.equal(f.state.bushes.length,0);assert.equal(f.state.droppings.length,0);
 f.state.bushes=[{x:12,y:10,since:now}];f.state.maps={lake:emptyLake(now)};const view=landView(f.state,'lake');assert.equal(view.bushes,undefined);view.bushes=[{x:1,y:1,since:now}];const merged=mergeLand(f.state,view,'lake');assert.equal(merged.bushes![0]!.x,12);assert.equal(merged.maps!.lake!.land.bushes![0]!.x,1);
});

test('durable snapshots retain cooldowns and sunrise conversion; resumed leases cannot poop early',()=>{
 const f=fixture('highland-cow'),at=eligible(f);run(f,at);f.state.gardening!.activeSeconds=at;
 const saved=withoutAnimalPositions(f.state,true);assert.equal(saved.gardening!.animals.length,0);assert.equal(saved.gardening!.animalPoop![f.animals[0]!.id]!.at,at);
 delete saved.entities[1]!.garden!.poop;
 applyAnimalHabits(saved,createAnimalResidents(saved.entities,[],{mapId:'town'}),mapDefinition('town'),env,at+5,now);assert.equal(saved.entities[1]!.garden!.poop,undefined);
 saved.droppings=[{x:10,y:10,at:now-86400000}];const revision=saved.revision;
 const converted=tickMap(saved,'town',now,env,true);assert.ok(converted.revision>revision,'sunrise crosses durable revision boundary');assert.equal(converted.bushes!.length,1);
 const sessions=new GardenSessions(()=>now);sessions.put('kid',converted);assert.equal(sessions.read('kid',converted)!.bushes!.length,1);
});
test('building and moving onto bushes clears them on either map without blocking construction',()=>{
 for(const mapId of ['town','lake'] as const){
  const state=emptyTown();state.maps={lake:emptyLake(now)};
  // Find free grass on this terrain, independent of map fixtures.
  const map=mapDefinition(mapId);let tile:{x:number;y:number}|undefined;
  for(let x=2;x<map.rows-2&&!tile;x++)for(let y=2;y<map.columns-2;y++)if(map.terrainAt(x,y)==='grass'&&!map.reserved?.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.length)){tile={x,y};break;}
  assert.ok(tile);const view=landView(state,mapId);view.bushes=[{...tile,since:now}];const populated=mergeLand(state,view,mapId);
  const built=applyMapLandCommand(populated,{type:'land-action',mapId,command:{type:'build',blueprintId:'dirt-road',...tile}},now,'road',env);
  assert.equal(landView(built,mapId).bushes!.length,0);assert.equal(landView(built,mapId).entities.some(e=>e.id==='road'),true);
 }
});
test('moving a farmhouse across maps translates its remaining cooldown and clears destination props',()=>{
 const f=fixture('highland-cow'),at=eligible(f);run(f,at);f.state.gardening!.activeSeconds=at+60;
 f.state.maps={lake:emptyLake(now)};f.state.maps.lake!.land.bushes=[{x:4,y:1,since:now}];
 const moved=applyMapLandCommand(f.state,{type:'transfer-building',entityId:'barn',sourceMap:'town',destinationMap:'lake',x:4,y:1},now,'t',env),view=landView(moved,'lake'),id=f.animals[0]!.id;
 assert.equal(moved.gardening!.animalPoop![id],undefined);assert.equal(view.gardening!.animalPoop![id]!.at,-60);assert.equal(view.bushes!.length,0);
 const animals=createAnimalResidents(view.entities,[],{mapId:'lake'});animals.splice(1);Object.assign(animals[0]!,{x:8.5,y:3.5,path:[],mode:'roaming',sleeping:false,inactive:false});
 view.entities.push({id:'dest-patch',blueprintId:'vegetable-patch',x:8,y:3,paidCost:{},garden:freshPatch('autumn')});
 for(let seconds=5;seconds<120;seconds+=5)applyAnimalHabits(view,animals,mapDefinition('lake'),env,seconds,now);
 assert.equal(view.entities.at(-1)!.garden!.poop,undefined,'cannot reset the cooldown by transferring');
});
test('Town and Lake friend scenery includes cloned props and crop poop with activity timestamps/history redacted',async()=>{
 const {visitScene}=await import('../src/town-building/visits.ts');
 const {createLakeVisitService}=await import('../src/town-building/maps/lake/visits.ts');
 const f=fixture();f.patch.garden!.poop={slot:2,at:now};f.state.droppings=[{x:10,y:10,at:now}];f.state.bushes=[{x:12,y:10,since:now}];
 f.state.gardening={lastTick:now,activeSeconds:0,harvests:0,season:'autumn',animals:[],animalPoop:{private:{at:99,check:0}}};
 const publicTown=visitScene(f.state);assert.deepEqual(publicTown.droppings,[{x:10,y:10,at:0}]);assert.deepEqual(publicTown.bushes,[{x:12,y:10,since:0}]);assert.deepEqual(publicTown.entities[1]!.garden!.poop,{slot:2,at:0});assert.ok(!JSON.stringify(publicTown).includes('animalPoop'));
 publicTown.bushes![0]!.x=999;assert.equal(f.state.bushes![0]!.x,12);
 f.state.maps={lake:emptyLake(now)};f.state.maps.lake!.land={entities:f.state.entities,droppings:f.state.droppings,bushes:f.state.bushes,gardening:f.state.gardening};
 const viewer=emptyTown(),pool={async query(sql:string){return {rows:sql.includes('JOIN profiles p ON p.id')?[{id:'host',name:'Friend',emoji:'',color:''}]:[{profile_id:'host',state:f.state},{profile_id:'viewer',state:viewer}]};}};
 const lake=(await createLakeVisitService(pool as any,()=>now).readLakeVisit('family','viewer','host')).state.maps!.lake!.land;
 assert.deepEqual(lake.droppings,[{x:10,y:10,at:0}]);assert.deepEqual(lake.bushes,[{x:12,y:10,since:0}]);assert.equal(lake.entities[1]!.garden!.poop!.at,0);assert.equal(lake.gardening!.animalPoop,undefined);
});
test('an ineligible stand does not consume the bucket before a later real crop contact',()=>{
 const f=fixture(),at=eligible(f);Object.assign(f.animals[0]!,{x:10.5,y:10.5});run(f,at);
 Object.assign(f.animals[0]!,{x:8.5,y:6.5});run(f,at+.5);assert.ok(f.patch.garden!.poop,'only eligible contacts consume a check');
});
