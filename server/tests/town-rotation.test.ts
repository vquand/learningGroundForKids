import assert from 'node:assert/strict';
import test from 'node:test';
import {BLUEPRINTS,applyTownCommand,emptyTown,entityDoor,entityFootprint,placementError,type Entity} from '../src/town-building/game.js';
import {allowedDirections,canRotate,nextDirection} from '../src/town-building/direction.js';
import {applyMapLandCommand} from '../src/town-building/maps/land.js';
import {civEntrance,planMoveIn} from '../src/town-building/civ.js';
import {createAnimalResidents} from '../src/town-building/animalWorld.js';
import {mapDefinition} from '../src/town-building/maps/registry.ts';

const rich=()=>{const state=emptyTown();state.materials={...state.materials,stamina:99,wood:99,rock:99,sand:99,metal:99};state.storage={built:false,crops:{},milk:[],fish:{},wool:99};state.learnedIds=Array.from({length:99},(_,i)=>`item-${i}`);return state;};
const blueprint=(id:string)=>BLUEPRINTS.find(b=>b.id===id)!;

test('four-way, two-way and fixed blueprints rotate as designed',()=>{
  assert.deepEqual(allowedDirections('grocery'),['front','left','back','right']);
  assert.deepEqual(allowedDirections('library'),['front','back']);
  for(const id of ['lemon','dirt-road','wooden-fence','vegetable-patch'])assert.equal(canRotate(id),false);
  // Clockwise on screen: the south door turns west, north, east, then south again.
  assert.deepEqual(['front','left','back','right'].map((_,i,all)=>nextDirection('house',all[i] as 'front')),['left','back','right','front']);
  assert.equal(nextDirection('town-hall','front'),'back');assert.equal(nextDirection('town-hall','back'),'front');
  assert.equal(nextDirection('lemon','front'),'front');
});
test('quarter turns swap the footprint and move the door to the facing edge',()=>{
  const at=(direction?:Entity['direction']):Entity=>({id:'s',blueprintId:'grocery',x:5,y:12,paidCost:{},...(direction?{direction}:{})});
  assert.deepEqual(entityFootprint(at()),{x:5,y:12,width:2,length:3});
  assert.deepEqual(entityFootprint(at('left')),{x:5,y:12,width:3,length:2});
  assert.deepEqual(entityFootprint(at('back')),{x:5,y:12,width:2,length:3});
  assert.deepEqual(entityDoor(at()),{x:7,y:13});
  assert.deepEqual(entityDoor(at('left')),{x:6,y:11});
  assert.deepEqual(entityDoor(at('back')),{x:4,y:13});
  assert.deepEqual(entityDoor(at('right')),{x:6,y:14});
});
test('building stores a facing, charges the same cost and rejects impossible facings',()=>{
  const state=rich();
  const built=applyTownCommand(state,'town',{type:'build',blueprintId:'grocery',x:5,y:12,direction:'left'},'shop',100);
  assert.equal(built.entities[0]!.direction,'left');assert.deepEqual(built.materials.wood,state.materials.wood-blueprint('grocery').cost.wood!);
  const front=applyTownCommand(state,'town',{type:'build',blueprintId:'grocery',x:5,y:12},'shop',100);
  assert.equal('direction' in front.entities[0]!,false);
  assert.throws(()=>applyTownCommand(state,'town',{type:'build',blueprintId:'library',x:5,y:12,direction:'left'},'lib',100),/cannot face/);
  assert.throws(()=>applyTownCommand(state,'town',{type:'build',blueprintId:'lemon',x:5,y:12,direction:'back'},'tree',100),/cannot face/);
  assert.throws(()=>applyTownCommand(state,'town',{type:'build',blueprintId:'grocery',x:5,y:12,direction:'up' as never},'shop',100),/cannot face/);
});
test('the turned footprint decides overlap and bounds',()=>{
  const state=rich();
  const built=applyTownCommand(state,'town',{type:'build',blueprintId:'grocery',x:5,y:12,direction:'left'},'shop',100);
  // The turned shop covers rows 5-7, columns 12-13; a front-facing house would reach row 7 only when it overlaps.
  const house=blueprint('house');
  assert.ok(placementError(built.entities,'town',house,7,12));
  assert.equal(placementError(built.entities,'town',house,5,14),null);
  const front=applyTownCommand(state,'town',{type:'build',blueprintId:'grocery',x:5,y:12},'shop',100);
  assert.equal(placementError(front.entities,'town',house,7,12),null);
  // Turning it near the south edge must fit the swapped rows.
  const column=Array.from({length:38},(_,y)=>y).find(y=>placementError([],'town',blueprint('grocery'),18,y)===null)!;
  assert.ok(placementError([],'town',blueprint('grocery'),18,column,undefined,[],'left'));
});
test('rotating in place costs a normal move; the same facing and place is free',()=>{
  const built=applyTownCommand(rich(),'town',{type:'build',blueprintId:'house',x:5,y:8},'h',100);
  const same=applyTownCommand(built,'town',{type:'move',entityId:'h',x:5,y:8},'x',200);
  assert.equal(same,built);
  const turned=applyTownCommand(built,'town',{type:'move',entityId:'h',x:5,y:8,direction:'right'},'x',200);
  assert.equal(turned.entities[0]!.direction,'right');
  assert.equal(turned.materials.wood,built.materials.wood-Math.ceil(9/2));
  const back=applyTownCommand(turned,'town',{type:'move',entityId:'h',x:5,y:8,direction:'front'},'x',300);
  assert.equal('direction' in back.entities[0]!,false);
  // A move without a facing keeps the one it has.
  assert.equal(applyTownCommand(turned,'town',{type:'move',entityId:'h',x:9,y:8},'x',300).entities[0]!.direction,'right');
  assert.throws(()=>applyTownCommand(built,'town',{type:'move',entityId:'h',x:19,y:8,direction:'left'},'x',200),/./);
});
test('a bottom-row front house can rotate in place toward the river',()=>{
  const built=applyTownCommand(rich(),'town',{type:'build',blueprintId:'house',x:18,y:0},'h',100);
  const turned=applyTownCommand(built,'town',{type:'move',entityId:'h',x:18,y:0,direction:'back'},'x',200);
  assert.equal(turned.entities[0]!.direction,'back');
});
test('land commands validate the facing against the map and keep it across maps',()=>{
  const state=rich();
  const built=applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'grocery',x:5,y:12,direction:'left'}},100,'shop',{});
  assert.equal(built.entities[0]!.direction,'left');
  assert.throws(()=>applyMapLandCommand(built,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'house',x:7,y:12}},100,'h',{}),/occupied/);
  assert.equal(applyMapLandCommand(built,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'house',x:5,y:14}},100,'h',{}).entities.length,2);
});
test('shops let owners in through the door they face',()=>{
  const shop:Entity={id:'shop',blueprintId:'grocery',x:5,y:12,paidCost:{},direction:'left'};
  assert.deepEqual(civEntrance(shop),{x:6,y:11});
  const road=Array.from({length:12},(_,y)=>({id:`r${y}`,blueprintId:'dirt-road',x:7,y,paidCost:{}}));
  assert.equal(planMoveIn([shop,...road],{...shop,direction:'front'},mapDefinition('town')).reachable,false);
  // The road at row 7 reaches the west door at (6,11) within two clear steps only when the shop faces west.
  assert.equal(planMoveIn([shop,...road],shop,mapDefinition('town')).reachable,true);
});
test('residents gather at the door of a turned home',()=>{
  const coop:Entity={id:'c',blueprintId:'coop',x:8,y:10,paidCost:{},animal:'chicken',direction:'back'};
  const world={mapId:'town' as const,rafts:[]};
  const [chicken]=createAnimalResidents([coop],[],world);
  assert.ok(chicken);
  assert.ok(Math.abs(chicken.shelter.x-7.5)<1,`shelter row ${chicken.shelter.x}`);
  assert.ok(chicken.allowed.has('7:10')||chicken.allowed.has('7:11'),'the north door tile is walkable');
});
