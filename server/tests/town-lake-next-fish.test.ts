import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown} from '../src/town-building/game.ts';
import {emptyLake,applyLakeCommand} from '../src/town-building/maps/lake/game.ts';
const catches={P3:10,P5:10,P1:10};
function fixture(){let state=emptyTown();state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.maps={lake:emptyLake(1000)};state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:12},1000,'raft',catches);state=applyLakeCommand(state,{type:'stock',raftId:'raft',species:'P3'},1000,'old-fish',catches);return state;}
test('choosing a new type preserves the current batch, then automatically stocks it after the last fish is harvested',()=>{
 let state=fixture();const old=structuredClone(state.maps!.lake!.rafts[0]!.fish),materials={...state.materials};
 state=applyLakeCommand(state,{type:'set-next-fish',raftId:'raft',species:'P5'},1000,'choice',catches);
 assert.deepEqual(state.maps!.lake!.rafts[0]!.fish,old);assert.deepEqual(state.materials,materials);
 state.maps!.lake!.rafts[0]!.fish.forEach((f,i)=>f.growth=i?300:0);
 let raft=state.maps!.lake!.rafts[0]!;
 state=applyLakeCommand(state,{type:'harvest-fish',raftId:'raft',generation:raft.generation},1000,'partial',catches);
 raft=state.maps!.lake!.rafts[0]!;assert.equal(raft.fish.length,1);assert.equal(raft.fish[0]!.species,'P3');assert.equal(raft.nextFish,'P5');
 raft.fish[0]!.growth=300;const command={type:'harvest-fish' as const,raftId:'raft',generation:raft.generation};
 state=applyLakeCommand(state,command,1000,'final',catches);raft=state.maps!.lake!.rafts[0]!;
 assert.equal(raft.fish.length,4);assert.ok(raft.fish.every(f=>f.species==='P5'&&f.growth===0&&!old.some(o=>o.id===f.id)));
 assert.equal(raft.nextFish,undefined);assert.equal(state.maps!.lake!.harvested,4);assert.equal(state.maps!.lake!.reserve.P3,4);assert.equal(state.materials.stamina,materials.stamina+8);
 assert.throws(()=>applyLakeCommand(state,command,1000,'retry',catches),/changed/);
});
test('automatic stocking uses the new species capacity without counting the new batch as a harvest',()=>{
 let state=emptyTown();state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.maps={lake:emptyLake(1000)};
 state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:7},1000,'raft',catches);
 state=applyLakeCommand(state,{type:'stock',raftId:'raft',species:'P5'},1000,'big',catches);
 state=applyLakeCommand(state,{type:'set-next-fish',raftId:'raft',species:'P1'},1000,'choice',catches);state.maps!.lake!.rafts[0]!.fish.forEach(f=>f.growth=300);
 state=applyLakeCommand(state,{type:'harvest-fish',raftId:'raft',generation:state.maps!.lake!.rafts[0]!.generation},1000,'harvest',catches);
 assert.equal(state.maps!.lake!.rafts[0]!.fish.length,16);assert.ok(state.maps!.lake!.rafts[0]!.fish.every(f=>f.species==='P1'&&f.growth===0));assert.equal(state.maps!.lake!.harvested,4);assert.equal(state.maps!.lake!.reserve.P5,4);
});
test('queued fish must be unlocked and habitat-compatible; choosing the current type cancels the change',()=>{
 const before=fixture();assert.throws(()=>applyLakeCommand(before,{type:'set-next-fish',raftId:'raft',species:'P5'},1000,'locked',{P3:10}),/Catch 10/);
 assert.throws(()=>applyLakeCommand(before,{type:'set-next-fish',raftId:'raft',species:'P1'},1000,'habitat',catches),/shallow/);
 let state=applyLakeCommand(before,{type:'set-next-fish',raftId:'raft',species:'P5'},1000,'choice',catches);
 assert.throws(()=>applyLakeCommand(state,{type:'move-raft',raftId:'raft',x:8,y:7},1000,'move',catches),/deep/);
 state=applyLakeCommand(state,{type:'set-next-fish',raftId:'raft',species:'P3'},1000,'cancel',catches);assert.equal(state.maps!.lake!.rafts[0]!.nextFish,undefined);assert.deepEqual(state.maps!.lake!.rafts[0]!.fish,before.maps!.lake!.rafts[0]!.fish);
});
