import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown,type TownState,type Entity} from '../src/town-building/game.ts';
import {ensurePoultry,settlePoultry,poultryProjection,harvestCoopEggs,EGG_CAPACITY} from '../src/town-building/poultry.ts';
import {advanceCropGrowth,freshPatch,applyGardenCommand} from '../src/town-building/garden.ts';
import {emptyLake,applyLakeCommand} from '../src/town-building/maps/lake/game.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {duckDoorstep,duckWaterRange} from '../src/town-building/water/ducks.ts';
import {tickMap} from '../src/town-building/mapTick.ts';
const hour=3600000,start=1000,env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-25'};
const coop=(id='coop',mapId:'town'|'lake'='town'):Entity=>({id,blueprintId:'coop',animal:'chicken',x:6,y:3,paidCost:{},mapId});
function lakeTown(){const state=emptyTown();state.maps={lake:emptyLake(start)};state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};return state;}
test('new coops have no historical eggs; real-time projection produces 4/day and caps stored eggs at 24',()=>{
 const original=emptyTown();original.entities=[coop()];const state=ensurePoultry(original,start),before=structuredClone(state);
 assert.equal(state.entities[0]!.poultry!.eggs,0);
 assert.equal(poultryProjection(state,start+5*hour).entities[0]!.poultry!.eggs,0);
 assert.equal(poultryProjection(state,start+6*hour).entities[0]!.poultry!.eggs,1);
 assert.equal(poultryProjection(state,start+24*hour).entities[0]!.poultry!.eggs,4);
 assert.equal(poultryProjection(state,start+1000*hour).entities[0]!.poultry!.eggs,EGG_CAPACITY);
 assert.deepEqual(state,before,'reads project progress without mutating persisted state');
});
test('only nearby land insect raisers double production; changing rate settles old time first',()=>{
 let state=lakeTown();state.maps!.lake!.land.entities=[coop('lake-coop','lake')];state=ensurePoultry(state,start);
 state=settlePoultry(state,start+3*hour);
 state.maps!.lake!.rafts.push({id:'insects',blueprintId:'insect-raiser',x:8,y:6,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false});
 settlePoultry(state,start+3*hour);assert.equal(state.maps!.lake!.land.entities[0]!.poultry!.rate,2);
 const projected=poultryProjection(state,start+6*hour);assert.equal(projected.maps!.lake!.land.entities[0]!.poultry!.eggs,1,'first three hours do not receive a retroactive insect bonus');
 assert.equal(poultryProjection(state,start+27*hour).maps!.lake!.land.entities[0]!.poultry!.eggs,8);
 state=settlePoultry(state,start+6*hour);state.maps!.lake!.rafts[0]!.blueprintId='floating-insect-raiser';settlePoultry(state,start+6*hour);
 assert.equal(state.maps!.lake!.land.entities[0]!.poultry!.rate,1,'floating raisers do not feed shore chickens');
});
test('one egg is harvestable for exactly two stamina and one egg counted for the river raft, with generation replay protection',()=>{
 let state=emptyTown();state.entities=[coop()];state=ensurePoultry(state,start);const before=structuredClone(state);
 const harvested=harvestCoopEggs(state,'coop',0,start+6*hour);
 assert.equal(harvested.materials.stamina,2);assert.equal(harvested.poultry!.harvested,1);assert.equal(harvested.entities[0]!.poultry!.eggs,0);
 assert.throws(()=>harvestCoopEggs(harvested,'coop',0,start+6*hour),/changed/);assert.deepEqual(state,before);
 assert.throws(()=>harvestCoopEggs(state,'coop',0,start+hour),/No eggs/);
});
test('egg storage at capacity discards excess time, and changing birds preserves collected eggs but pauses laying',()=>{
 let state=emptyTown();state.entities=[coop()];state=settlePoultry(ensurePoultry(state,start),start+200*hour);
 state=harvestCoopEggs(state,'coop',0,start+200*hour);assert.equal(state.poultry!.harvested,24);
 assert.equal(poultryProjection(state,start+201*hour).entities[0]!.poultry!.eggs,0);
 // The repository transaction settles every coop at the command's instant.
 state=settlePoultry(applyGardenCommand(state,'town',{type:'set-animal',entityId:'coop',animal:'duck'},'unused',start+201*hour,'spring'),start+201*hour);
 assert.equal(poultryProjection(state,start+500*hour).entities[0]!.poultry!.eggs,0);assert.equal(state.poultry!.harvested,24);
});
test('chicken crop bonus applies once per slot cycle, respects seasons, and resets only harvested slots',()=>{
 const patch:Entity={id:'patch',blueprintId:'vegetable-patch',x:6,y:6,paidCost:{},garden:freshPatch('spring')};
 advanceCropGrowth(patch,10,'spring',env.localDate,true);assert.equal(patch.garden!.slots[0]!.growth,70);
 advanceCropGrowth(patch,10,'spring',env.localDate,true);assert.equal(patch.garden!.slots[0]!.growth,80);
 advanceCropGrowth(patch,10,'summer',env.localDate,true);assert.equal(patch.garden!.slots[0]!.growth,80);
 patch.garden!.slots[0]!.growth=300;const state=emptyTown();state.entities=[patch];
 const harvested=applyGardenCommand(state,'town',{type:'harvest',entityId:'patch',generation:0},'unused',start,'spring');
 assert.equal(harvested.entities[0]!.garden!.slots[0]!.coopBoosted,false);assert.equal(harvested.entities[0]!.garden!.slots[1]!.coopBoosted,true);
});
function duckFixture():TownState{
 let state=lakeTown();state.maps!.lake!.land.entities=[{...coop('ducks','lake'),animal:'duck',y:5}];
 state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:6,y:9},start,'raft',{});
 return applyLakeCommand(state,{type:'stock',raftId:'raft',species:'P3'},start,'fish',{P3:10});
}
test('a raft in a duck coop area grows 30 seconds sooner, once per cycle, by day only',()=>{
 let state=duckFixture();
 state=tickMap(state,'lake',start,{...env,timeOfDay:'night'},true);
 assert.equal(state.maps!.lake!.rafts[0]!.fish[0]!.growth,0,'resting ducks do not help at night');
 state=tickMap(state,'lake',start+1000,env,true);
 assert.equal(state.maps!.lake!.rafts[0]!.fish[0]!.growth,30);assert.ok(state.maps!.lake!.rafts[0]!.fish.every(f=>f.duckBoosted));
 state=tickMap(state,'lake',start+16000,env,false);
 assert.equal(state.maps!.lake!.rafts[0]!.fish[0]!.growth,45,'later ticks add only normal growth, never a second boost');
});
test('a changed layout or species changes the help: moved away, or no longer a duck coop',()=>{
 let state=duckFixture();state=applyLakeCommand(state,{type:'move-raft',raftId:'raft',x:10,y:12},start,'move',{});
 state=tickMap(state,'lake',start,env,true);assert.equal(state.maps!.lake!.rafts[0]!.fish[0]!.growth,0,'far from the coop area');
 state=duckFixture();state=applyMapLandCommand(state,{type:'land-action',command:{type:'set-animal',entityId:'ducks',animal:'chicken'}},start,'switch',env);
 state=tickMap(state,'lake',start,env,true);assert.equal(state.maps!.lake!.rafts[0]!.fish[0]!.growth,0,'chickens do not help rafts');
});
test('rafts block swimming inside the duck water range',()=>{
 const lake=duckFixture().maps!.lake!,world={mapId:'lake' as const,entities:lake.land.entities,rafts:lake.rafts},coop=lake.land.entities[0]!;
 const allowed=duckWaterRange(world,coop),door=duckDoorstep(coop,allowed)!;
 assert.ok(door);assert.equal(allowed.has('6:9'),false,'rafts block swimming');
});
