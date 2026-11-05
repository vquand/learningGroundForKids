import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown} from '../src/town-building/game.ts';
import {itemLimit,materialLimit} from '../src/town-building/storage.ts';
test('stacked storage limits N=0..4',()=>{
 const state=emptyTown();
 for(let n=0;n<=4;n++){
  state.entities=Array.from({length:n},(_,i)=>({id:`s${i}`,blueprintId:'town-storage',x:i*3,y:3,paidCost:{}}));
  assert.equal(itemLimit(state),n?1000+2000*(n-1):10);assert.equal(materialLimit(state),n?5000:2000);
 }
});

import {storageRemoval,storageOf} from '../src/town-building/storage.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {landView} from '../src/town-building/maps/view.ts';
import {AppError} from '../src/errors.ts';
import {freshPatch,GROW_SECONDS} from '../src/town-building/garden.ts';
import {applyHarvestAll} from '../src/town-building/harvestAll.ts';
const store=(id:string)=>({id,blueprintId:'town-storage',x:3,y:3,paidCost:{}});
test('removal previews exact losses without mutation; confirmation is recomputed and atomic',()=>{
 const state=emptyTown();state.entities=[store('s')];const storage=storageOf(state);
 storage.crops.corn=24;storage.yarn=15;storage.milk=[{at:20,count:9},{at:10,count:8}];state.materials.wood=2200;
 state.maps={lake:emptyLake(0)};state.maps.lake!.reserve.P1=20;storage.fish.P1=[{at:20,count:8},{at:10,count:12}];
 const before=structuredClone(state),receipt=storageRemoval(state);
 const action={type:'land-action' as const,mapId:'town' as const,command:{type:'remove' as const,entityId:'s'}};
 assert.throws(()=>applyMapLandCommand(state,action,30,'r',{}),(e:unknown)=>e instanceof AppError&&e.code==='STORAGE_LOSS_CONFIRM'&&JSON.stringify(e.details)===JSON.stringify(receipt));
 assert.deepEqual(state,before);assert.equal(receipt.lastStorage,true);
 assert.deepEqual(receipt.losses.map(l=>[l.id,l.amount]),[['corn',14],['P1',10],['wood',200],['milk',7],['yarn',5]]);
 assert.throws(()=>applyMapLandCommand(state,{...action,command:{...action.command,confirmLoss:true,lossConfirmation:'forged'}},30,'r',{}),/discard goods/);
 const next=applyMapLandCommand(state,{...action,command:{...action.command,confirmLoss:true,lossConfirmation:receipt.confirmation}},30,'r',{});
 assert.equal(next.revision,state.revision+1);assert.equal(next.entities.length,0);assert.equal(next.storage?.crops.corn,10);assert.equal(next.materials.wood,2000);
 assert.deepEqual(next.storage?.milk,[{at:10,count:1},{at:20,count:9}]);assert.deepEqual(next.storage?.fish.P1,[{at:10,count:2},{at:20,count:8}]);assert.equal(next.maps?.lake?.reserve.P1,10);assert.deepEqual(state,before);
 storage.yarn=16;assert.notEqual(storageRemoval(state).confirmation,receipt.confirmation);
});
test('no loss removal needs no confirmation; shared Lake storage count and view capacity',()=>{
 const state=emptyTown();state.entities=[store('town')];state.maps={lake:emptyLake(0)};state.maps.lake!.land.entities=[store('lake')];
 assert.equal(itemLimit(state),3000);assert.equal(itemLimit(landView(state,'lake')),3000);
 const next=applyMapLandCommand(state,{type:'land-action',mapId:'lake',command:{type:'remove',entityId:'lake'}},0,'r',{});
 assert.equal(itemLimit(next),1000);assert.equal(next.storageRemovalReceipt?.lastStorage,false);assert.deepEqual(next.storageRemovalReceipt?.losses,[]);
});
test('moving and rotating a storage preserve limits and stock',()=>{
 const state=emptyTown();state.learnedIds=Array.from({length:1000},(_,i)=>String(i));state.entities=[store('s')];storageOf(state).yarn=1500;
 for(const direction of ['front','left','back','right'] as const){
  const next=applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'move',entityId:'s',x:8,y:8,direction}},0,'r',{});
  assert.equal(itemLimit(next),1000);assert.equal(next.storage?.yarn,1500);assert.equal(next.storageRemovalReceipt,undefined);
 }
});
test('harvest-all collects above first-storage limit and stops at stacked capacity',()=>{
 const state=emptyTown();state.entities=[store('s1'),store('s2')];
 const garden=freshPatch('spring');for(const slot of garden.slots){slot.crop='corn';slot.growth=GROW_SECONDS;}
 state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:10,y:10,paidCost:{},garden});storageOf(state).crops.corn=2996;
 const command={type:'harvest-all' as const,mapId:'town' as const,category:'plants' as const};
 const outcome=applyHarvestAll(state,state.revision,command,1000,{season:'spring',timeOfDay:'morning',localDate:'2026-11-02'},{});
 assert.equal(outcome.state.storage?.crops.corn,3000);
 const full=outcome.state;for(const slot of full.entities.find(e=>e.id==='patch')!.garden!.slots){slot.crop='corn';slot.growth=GROW_SECONDS;}
 assert.throws(()=>applyHarvestAll(full,full.revision,command,1000,{season:'spring',timeOfDay:'morning',localDate:'2026-11-02'},{}),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_STORAGE_FULL');
});

test('building second and third storage increases item capacity by 2000 each',()=>{
 let state=emptyTown();for(const m of ['stamina','wood','rock','sand'] as const)state.materials[m]=1000;
 for(let n=1;n<=3;n++){
  state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'town-storage',x:8,y:4*n}},0,`s${n}`,{});
  assert.equal(itemLimit(state),1000+2000*(n-1));assert.equal(materialLimit(state),5000);
 }
});
import {townCommandSchema} from '../src/town-building/routes.ts';
test('strict removal schema rejects browser loss lists and other commands reject confirmation',()=>{
 assert.equal(townCommandSchema.safeParse({type:'remove',entityId:'s',losses:[]}).success,false);
 assert.equal(townCommandSchema.safeParse({type:'move',entityId:'s',x:3,y:3,confirmLoss:true}).success,false);
 const state=emptyTown();state.entities=[{...store('house'),blueprintId:'house'}];
 assert.throws(()=>applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'remove',entityId:'house',confirmLoss:true}},0,'r',{}),/Only Town Storage/);
});
