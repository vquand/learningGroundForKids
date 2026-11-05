import assert from 'node:assert/strict';
import test from 'node:test';
import {applyTownCommand,emptyTown,type Entity} from '../src/town-building/game.js';
import {applyMapLandCommand} from '../src/town-building/maps/land.js';
import {townCommandSchema} from '../src/town-building/routes.js';
const tile=(id:string,x:number,y:number,blueprintId='wooden-fence'):Entity=>({id,x,y,blueprintId,paidCost:{}});
const clock={season:'spring' as const,timeOfDay:'day' as const,localDate:'2040-01-01'} as never;
test('whole-line removal follows corners, loops and branches of the selected type only, in one revision',()=>{
 for(const [blueprintId,other] of [['wooden-fence','dirt-road'],['dirt-road','rocky-road']] as const){
  const state=emptyTown();state.materials.wood=4;state.earned['town-first-home']='earned';
  state.entities=[tile('a',5,10,blueprintId),tile('b',5,11,blueprintId),tile('c',6,11,blueprintId),tile('d',6,10,blueprintId),tile('branch',7,10,blueprintId),tile('diagonal',8,11,blueprintId),tile('gap',9,10,blueprintId),tile('other',5,12,other),tile('past-other',5,13,blueprintId),tile('home',10,20,'house')];
  const saved=structuredClone(state),next=applyTownCommand(state,'town',{type:'remove-line',entityId:'b'},'',1000);
  assert.deepEqual(next.entities.map(e=>e.id),['diagonal','gap','other','past-other','home']);
  assert.equal(next.revision,state.revision+1);assert.deepEqual(next.materials,state.materials);assert.deepEqual(next.earned,state.earned);assert.deepEqual(state,saved);
 }
});
test('whole-line removal handles an isolated tile and rejects missing or non-line targets',()=>{
 const state=emptyTown();state.entities=[tile('isolated',5,8,'rocky-road'),tile('one',6,10),tile('home',10,20,'house')];
 assert.deepEqual(applyTownCommand(state,'town',{type:'remove-line',entityId:'isolated'},'',100).entities.map(e=>e.id),['one','home']);
 for(const id of ['missing','home'])assert.throws(()=>applyTownCommand(state,'town',{type:'remove-line',entityId:id},'',100),/road, fence or bridge/i);
});
test('line commands accept only the target or tiles, never a browser-supplied removal list or type',()=>{
 assert.ok(townCommandSchema.safeParse({type:'remove-line',entityId:'a'}).success);
 for(const extra of [{entityIds:['a']},{blueprintId:'house'},{materials:{wood:100}},{familyId:'foreign'}])assert.equal(townCommandSchema.safeParse({type:'remove-line',entityId:'a',...extra}).success,false);
 const tiles=Array.from({length:200},(_,i)=>({x:i%20,y:Math.floor(i/20)}));
 assert.ok(townCommandSchema.safeParse({type:'build-line',blueprintId:'wooden-fence',tiles}).success);
 for(const bad of [[],[...tiles,{x:0,y:11}],[{x:1,y:1,extra:1}]])assert.equal(townCommandSchema.safeParse({type:'build-line',blueprintId:'wooden-fence',tiles:bad}).success,false);
});
test('a built line is one request: every tile is charged, existing tiles are skipped and one bad tile builds nothing',()=>{
 const state=emptyTown();state.materials.wood=10;state.entities=[tile('existing',6,10)];state.learnedIds=[];
 const line=(tiles:{x:number;y:number}[],blueprintId='wooden-fence')=>applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'build-line',blueprintId,tiles}},1000,'line',clock);
 const next=line([{x:5,y:10},{x:6,y:10},{x:7,y:10}]);
 assert.equal(next.entities.length,3);assert.equal(next.materials.wood,8,'the existing tile is free');assert.equal(next.revision,state.revision+1);assert.equal(new Set(next.entities.map(e=>e.id)).size,3);
 assert.equal(line([{x:6,y:10}]),state,'a line that is already there changes nothing');
 assert.throws(()=>line(Array.from({length:11},(_,i)=>({x:5,y:12+i}))),/materials/i);
 assert.throws(()=>line([{x:5,y:10},{x:6,y:10},{x:0,y:0}].map((t,i)=>i===2?{x:16,y:5}:t)),/./);
 assert.throws(()=>line([{x:5,y:10}],'house'),/road, fence or bridge/i);
 assert.equal(state.entities.length,1,'the original state is never mutated');
});
