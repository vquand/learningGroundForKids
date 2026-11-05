import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown,type Entity,type TownAnimal} from '../src/town-building/game.ts';
import {BARN_CAPACITY,collectBarn,farmProjection,feedBarnAnimals,settleFarm} from '../src/town-building/barn.ts';
import {ITEM_LIMIT,MATERIAL_LIMIT,SPOIL_MS,batchTotal,creditMaterials,storeCrop,storeMilk,storeYarn} from '../src/town-building/storage.ts';
import {applyGardenCommand,freshPatch} from '../src/town-building/garden.ts';
import {applyWaterCommand} from '../src/town-building/water/rules.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {LAKE_FISH,type LakeFishId} from '../src/town-building/water/catalog.ts';
const hour=3600000,start=1000;
const barn=(animal:TownAnimal,id='barn'):Entity=>({id,blueprintId:'farmhouse',animal,x:4,y:4,paidCost:{}});
function town(...entities:Entity[]){const state=emptyTown();state.entities=entities;state.materials={stamina:0,wood:0,rock:0,sand:0,metal:0};state.storage={built:false,crops:{},milk:[],fish:{},wool:0};return settleFarm(state,start);}

test('dairy cows make one milk every six hours up to twelve; Highland cows make yarn every twelve hours up to six',()=>{
 const state=town(barn('dairy-cow'),barn('highland-cow','highland'));
 assert.equal(farmProjection(state,start+5*hour).entities[0]!.barn!.stock,0);
 assert.equal(farmProjection(state,start+6*hour).entities[0]!.barn!.stock,1);
 assert.equal(farmProjection(state,start+1000*hour).entities[0]!.barn!.stock,BARN_CAPACITY);
 assert.equal(farmProjection(state,start+11*hour).entities[1]!.barn!.stock,0);
 assert.equal(farmProjection(state,start+12*hour).entities[1]!.barn!.stock,1);
 assert.equal(farmProjection(state,start+1000*hour).entities[1]!.barn!.stock,6);
});
test('feeding uses a stored favourite crop and doubles production for the banked hours only',()=>{
 let state=town(barn('dairy-cow'));
 assert.throws(()=>feedBarnAnimals(state,'barn',start),/favourite crops/);
 storeCrop(state,'corn',3);
 for(let i=0;i<3;i++)state=feedBarnAnimals(state,'barn',start);
 assert.equal(state.storage!.crops.corn??0,0,'three corn fed');
 assert.throws(()=>feedBarnAnimals(state,'barn',start),/favourite crops/);
 // Three fed hours count double: 6 + 3 = 9 production-hours at the 6-hour mark.
 assert.equal(farmProjection(state,start+5*hour).entities[0]!.barn!.stock,1,'fed hours make milk sooner');
 storeCrop(state,'cabbage',2);state=feedBarnAnimals(state,'barn',start);
 assert.throws(()=>feedBarnAnimals(state,'barn',start),/full/,'at most four hours are banked');
});
test('collected milk is stored and spoils after three days; wool is a stored animal product',()=>{
 let state=town(barn('dairy-cow'),barn('sheep','sheep'));
 state=settleFarm(state,start+12*hour);
 state=collectBarn(state,'barn',state.entities[0]!.barn!.generation,start+12*hour);
 assert.equal(batchTotal(state.storage!.milk),2);
 state=collectBarn(state,'sheep',state.entities[1]!.barn!.generation,start+12*hour);
 assert.equal(state.storage!.wool,2);
 assert.throws(()=>collectBarn(state,'sheep',state.entities[1]!.barn!.generation,start+12*hour),/Nothing to collect/);
 assert.equal(batchTotal(settleFarm(structuredClone(state),start+12*hour+SPOIL_MS-1).storage!.milk),2);
 assert.equal(batchTotal(settleFarm(structuredClone(state),start+12*hour+SPOIL_MS).storage!.milk),0,'milk spoils after three days');
});
test('storage limits: 10 of each item and 2000 materials without a Town Storage, 1000 and 5000 with one',()=>{
 const state=town();
 assert.equal(storeCrop(state,'carrot',25),ITEM_LIMIT.basic);assert.equal(storeMilk(state,25,start),ITEM_LIMIT.basic);
 state.materials.wood=1990;assert.deepEqual(creditMaterials(state,{wood:50,stamina:50}),{wood:10,stamina:50},'stamina is never limited');
 state.materials.rock=2500;assert.deepEqual(creditMaterials(state,{rock:5}),{},'stock above a limit is kept but not grown');assert.equal(state.materials.rock,2500);
 state.entities.push({id:'store',blueprintId:'town-storage',x:2,y:2,paidCost:{}});settleFarm(state,start);
 assert.equal(storeCrop(state,'carrot',2000),ITEM_LIMIT.storage-ITEM_LIMIT.basic);
 assert.deepEqual(creditMaterials(state,{wood:9000}),{wood:MATERIAL_LIMIT.storage-2000});
});
test('a Town Storage on the Lake counts too, and barn stock blocks removal',()=>{
 const state=town(barn('sheep'));state.maps={lake:emptyLake(start)};
 state.maps.lake!.land.entities.push({id:'store',blueprintId:'town-storage',x:2,y:2,paidCost:{}});
 settleFarm(state,start+6*hour);assert.equal(state.storage!.built,true);
 assert.throws(()=>applyGardenCommand(state,'town',{type:'remove',entityId:'barn'},'r',start+6*hour,null),/Collect the milk, wool or yarn/);
});
test('harvested crops are stored, and harvested fish are dated and spoil after three days',()=>{
 const state=town({id:'patch',blueprintId:'vegetable-patch',x:2,y:2,paidCost:{},garden:freshPatch('summer')});
 const garden=state.entities[0]!.garden!;garden.crop='corn';for(const slot of garden.slots){slot.crop='corn';slot.growth=10000;}
 const harvested=applyGardenCommand(state,'town',{type:'harvest',entityId:'patch',generation:state.entities[0]!.garden!.generation},'h',start,'summer');
 assert.equal(harvested.storage!.crops.corn,4);
 harvested.maps={lake:emptyLake(start)};
 const species=Object.keys(LAKE_FISH)[0] as LakeFishId;
 harvested.maps.lake!.rafts.push({id:'nursery',blueprintId:'nursery',x:8,y:7,paidCost:{},generation:0,fish:[{id:'f',species,growth:1e9}],plant:null,plantGrowth:0,feeder:false});
 applyWaterCommand(harvested,{type:'harvest-fish',raftId:'nursery',generation:0,mapId:'lake'},start,'w',{});
 assert.equal(harvested.maps.lake!.reserve[species],1);
 assert.equal(settleFarm(structuredClone(harvested),start+SPOIL_MS-1).maps!.lake!.reserve[species],1);
 assert.equal(settleFarm(structuredClone(harvested),start+SPOIL_MS).maps!.lake!.reserve[species],0,'fish spoil after three days');
});

test('yarn is distinct from wool, doubles while fed, persists without spoiling and respects item limits',()=>{
 let state=town(barn('highland-cow'));storeCrop(state,'broccoli',4);
 for(let i=0;i<4;i++)state=feedBarnAnimals(state,'barn',start);
 assert.equal(farmProjection(state,start+7*hour).entities[0]!.barn!.stock,0);
 state=settleFarm(state,start+8*hour);assert.equal(state.entities[0]!.barn!.stock,1);
 state=collectBarn(state,'barn',state.entities[0]!.barn!.generation,start+8*hour);
 assert.equal(state.storage!.yarn,1);assert.equal(state.storage!.wool??0,0);
 assert.throws(()=>collectBarn(state,'barn',0,start+8*hour),/changed/);
 assert.equal(settleFarm(state,start+8*hour+SPOIL_MS*10).storage!.yarn,1);
 assert.equal(storeYarn(state,20),9);assert.equal(state.storage!.yarn,10);
 assert.throws(()=>collectBarn(state,'barn',state.entities[0]!.barn!.generation,start+8*hour+SPOIL_MS*10),/room for more yarn/);
 state.entities.push({id:'store',blueprintId:'town-storage',x:2,y:2,paidCost:{}});settleFarm(state,start+8*hour+SPOIL_MS*10);
 assert.equal(storeYarn(state,2000),990);assert.equal(state.storage!.yarn,1000);
});
test('waiting yarn must be collected before changing farmhouse species',()=>{
 const state=settleFarm(town(barn('highland-cow')),start+12*hour);
 assert.throws(()=>applyGardenCommand(state,'town',{type:'set-animal',entityId:'barn',animal:'pig'},'switch',start+12*hour,null),/Collect their products/);
 const collected=collectBarn(state,'barn',state.entities[0]!.barn!.generation,start+12*hour);
 assert.equal(applyGardenCommand(collected,'town',{type:'set-animal',entityId:'barn',animal:'pig'},'switch',start+12*hour,null).entities[0]!.animal,'pig');
});
