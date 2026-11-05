import assert from 'node:assert/strict';
import test from 'node:test';
import {applyTownCommand,emptyTown,type Entity,type TownState} from '../src/town-building/game.ts';
import {collectBarn,settleFarm} from '../src/town-building/barn.ts';
import {creditMaterials,discardStorageLoss,itemLimit,settleStorage,storageOf,storageRemoval} from '../src/town-building/storage.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {applyHarvestAll} from '../src/town-building/harvestAll.ts';

const now=1000;
const wool=(state:TownState)=>state.storage?.wool??0;
const setWool=(state:TownState,count:number)=>Object.assign(storageOf(state),{wool:count});
const legacyWool=(state:TownState,count:number)=>Object.assign(state.materials,{wool:count});
const marker=(state:TownState)=>state.woolMigrated;
const store=(id:string):Entity=>({id,blueprintId:'town-storage',x:2,y:2,paidCost:{}});
function readySheep():Entity{return {id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:4,y:4,paidCost:{},barn:{stock:12,progress:0,lastTick:now,fedUntil:0,generation:0,species:'sheep'}};}
function funded():TownState {
 const state=settleStorage(emptyTown(),now);
 state.materials={...state.materials,stamina:100,wood:100,rock:100,sand:100,metal:100};
 state.learnedIds=Array.from({length:80},(_,i)=>`learned-${i}`);
 setWool(state,10);return state;
}

for(const count of [0,1,2])test(`legacy wool normalizes once at the ${count}-storage item limit`,()=>{
 const state=emptyTown();state.entities=Array.from({length:count},(_,i)=>store(`store-${i}`));
 legacyWool(state,4100);setWool(state,3);
 settleStorage(state,now);
 assert.equal(wool(state),itemLimit(state));assert.equal(marker(state),true);
 assert.equal((state.materials as unknown as {wool?:number}).wool??0,0);
 const saved=JSON.parse(JSON.stringify(state)) as TownState;
 settleStorage(saved,now+1);assert.deepEqual(saved,state,'serialized marker prevents a second grant');
 legacyWool(saved,7);settleStorage(saved,now+2);
 assert.equal(wool(saved),itemLimit(state),'a marked save never grants reintroduced legacy stock');
 assert.equal((saved.materials as unknown as {wool?:number}).wool??0,0);
});
test('legacy wool initializes absent storage and marks zero-balance saves',()=>{
 const state=emptyTown();delete state.storage;legacyWool(state,1100);
 settleFarm(state,now);assert.equal(wool(state),10);assert.equal(marker(state),true);
 const zero=emptyTown();settleStorage(zero,now);assert.equal(marker(zero),true);
});
test('Town and Lake use one wool store and count storages on both maps during migration',()=>{
 const state=emptyTown();state.entities=[store('town-store')];state.maps={lake:emptyLake(now)};
 state.maps.lake!.land.entities=[store('lake-store')];legacyWool(state,1100);
 settleFarm(state,now);assert.equal(itemLimit(state),3000);assert.equal(wool(state),1100);
 assert.equal(state.maps.lake!.land.entities.length,1);
});
test('large-house construction debits stored wool with all other costs and preserves the original recipe',()=>{
 const state=funded();const next=applyTownCommand(state,'town',{type:'build',blueprintId:'large-house',x:5,y:8},'home',now);
 assert.equal(wool(next),6);assert.equal(next.materials.wood,82);assert.equal(next.materials.stamina,86);
 assert.equal(next.entities[0]!.paidCost.wool,4);assert.equal(wool(state),10,'input remains unchanged');
});
test('insufficient stored wool rejects construction without spending any resource',()=>{
 const state=funded();setWool(state,3);const before=structuredClone(state);
 assert.throws(()=>applyTownCommand(state,'town',{type:'build',blueprintId:'large-house',x:5,y:8},'home',now));
 assert.deepEqual(state,before);
});
test('insufficient material rejects a wool recipe without debiting stored wool',()=>{
 const state=funded();state.materials.rock=0;const before=structuredClone(state);
 assert.throws(()=>applyTownCommand(state,'town',{type:'build',blueprintId:'large-house',x:5,y:8},'home',now));
 assert.deepEqual(state,before);
});
test('moves round up each original payment independently, including stored wool',()=>{
 const state=funded();state.entities=[{id:'home',blueprintId:'large-house',x:5,y:8,paidCost:{stamina:3,wood:5,rock:1,wool:5}}];
 const next=applyTownCommand(state,'town',{type:'move',entityId:'home',x:9,y:8},'ignored',now);
 assert.equal(wool(next),7);assert.equal(next.materials.stamina,98);assert.equal(next.materials.wood,97);assert.equal(next.materials.rock,99);
 assert.deepEqual(next.entities[0]!.paidCost,state.entities[0]!.paidCost);
 const poor=structuredClone(state);setWool(poor,2);const before=structuredClone(poor);
 assert.throws(()=>applyTownCommand(poor,'town',{type:'move',entityId:'home',x:9,y:8},'ignored',now));assert.deepEqual(poor,before);
});
test('sheep collection stores wool as a non-spoiling item and leaves overflow in the barn',()=>{
 let state=funded();state.entities=[readySheep()];setWool(state,9);
 state=collectBarn(state,'sheep',0,now);assert.equal(wool(state),10);assert.equal(state.entities[0]!.barn!.stock,11);
 assert.equal(wool(settleFarm(structuredClone(state),now+10*24*3600000)),10);
 assert.throws(()=>collectBarn(state,'sheep',1,now),/room/);
});
test('animals harvest-all reports actual stored wool and full-storage notCollected',()=>{
 const state=funded();state.entities=[readySheep()];setWool(state,9);
 const environment={season:'spring' as const,timeOfDay:'morning' as const,localDate:'2026-11-02',localTime:'09:00'};
 const {state:next,receipt}=applyHarvestAll(state,state.revision,{type:'harvest-all',mapId:'town',category:'animals'},now,environment);
 assert.equal(wool(next),10);assert.deepEqual(receipt.products,[{item:'wool',amount:1}]);assert.deepEqual(receipt.notCollected,[{item:'wool',amount:11}]);
 const beforeFull=structuredClone(next);
 assert.throws(()=>applyHarvestAll(next,next.revision,{type:'harvest-all',mapId:'town',category:'animals'},now,environment),/storage is full/);
 assert.deepEqual(next,beforeFull);
 next.entities.push({...readySheep(),id:'cow',animal:'dairy-cow',barn:{...readySheep().barn!,species:'dairy-cow',stock:1}});
 const full=applyHarvestAll(next,next.revision,{type:'harvest-all',mapId:'town',category:'animals'},now,environment);
 assert.deepEqual(full.receipt.products,[{item:'milk',amount:1}]);assert.deepEqual(full.receipt.notCollected,[{item:'wool',amount:11}]);assert.equal(wool(full.state),10);
});
test('confirmed storage removal includes wool item overflow and discards only that overflow',()=>{
 const state=funded();state.entities=[store('store')];setWool(state,1100);
 const receipt=storageRemoval(state);assert.ok(receipt.losses.some(loss=>loss.kind==='item'&&loss.id==='wool'&&loss.amount===1090));
 discardStorageLoss(state,receipt);assert.equal(wool(state),10);
});

test('shared reward credits route wool into item storage and report the actual clamp',()=>{
 const state=funded();setWool(state,9);
 assert.deepEqual(creditMaterials(state,{wood:5,wool:4}),{wood:5,wool:1});
 assert.equal(wool(state),10);assert.equal(state.materials.wood,105);
 assert.equal((state.materials as unknown as {wool?:number}).wool,undefined);
 setWool(state,1100);assert.deepEqual(creditMaterials(state,{wool:3}),{});assert.equal(wool(state),1100,'ordinary gains never confiscate over-limit stock');
});
for(const [blueprintId,count] of [['large-house',4],['infirmary',6],['library',8]] as const)test(`${blueprintId} keeps its ${count} stored-wool recipe`,()=>{
 const state=funded();const next=applyTownCommand(state,'town',{type:'build',blueprintId,x:5,y:8},'building',now);
 assert.equal(wool(next),10-count);assert.equal(next.entities[0]!.paidCost.wool,count);
});
