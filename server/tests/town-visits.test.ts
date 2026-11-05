import assert from 'node:assert/strict';
import test from 'node:test';
import {initialTown} from '../src/town-building/game.js';
import {visitScene} from '../src/town-building/visits.js';

test('visitors receive scenery without private progression or writable recipes',()=>{
  const town=initialTown();town.learnedIds=['private-lesson'];town.earned.secret='today';town.materials.wood=999;
  const before=structuredClone(town),scene=visitScene(town);
  assert.ok(scene.entities.length>0);
  assert.deepEqual(Object.keys(scene).sort(),['civActiveMs','entities','rafts']);
  assert.deepEqual(scene.entities[0]!.paidCost,{});
  assert.equal(JSON.stringify(scene).includes('private-lesson'),false);
  assert.equal(JSON.stringify(scene).includes('999'),false);
  assert.deepEqual(town,before,'projection never normalizes or writes the owner state');
});
test('visitors see the owner’s Town river structures as scenery, without their paid recipe',()=>{
  const town=initialTown();
  town.rafts=[{id:'garden',blueprintId:'floating-garden',x:15,y:16,paidCost:{wood:12},generation:0,fish:[],plant:'water-spinach',plantGrowth:40,feeder:false}];
  const scene=visitScene(town);
  assert.deepEqual(scene.rafts.map(r=>({id:r.id,blueprintId:r.blueprintId,x:r.x,y:r.y,plant:r.plant,paidCost:r.paidCost})),[{id:'garden',blueprintId:'floating-garden',x:15,y:16,plant:'water-spinach',paidCost:{}}]);
  assert.deepEqual(town.rafts[0]!.paidCost,{wood:12},'projection never writes the owner state');
});
