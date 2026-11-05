import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimalWorld} from '../src/features/town-building/sharedAnimalWorld.ts';
import type {Entity} from '../../server/src/town-building/game.ts';
const weather={precipitation:'none',timeOfDay:'morning'} as const;
const host:Entity={id:'coop',blueprintId:'coop',animal:'chicken',x:6,y:3,paidCost:{}};
test('both maps use the same fixed-step animal clock independent of frame rate',()=>{
 for(const mapId of ['town','lake'] as const){
  const fast=new AnimalWorld(),slow=new AnimalWorld();fast.sync([host],{mapId});slow.sync([host],{mapId});
  for(let i=0;i<100;i++)fast.advance(.025,weather);
  for(let i=0;i<25;i++)slow.advance(.1,weather);
  assert.deepEqual(fast.residents,slow.residents);
  assert.ok(fast.sample().every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)));
 }
});
test('server updates preserve resident clocks and a changed species replaces only that flock',()=>{
 const world=new AnimalWorld();world.sync([host],{mapId:'town'});world.advance(.2,weather);
 const clocks=world.residents.map(a=>a.clock);world.sync([{...host,civ:undefined}],{mapId:'town'});
 assert.deepEqual(world.residents.map(a=>a.clock),clocks);
 world.sync([{...host,animal:'goose'}],{mapId:'town'});assert.ok(world.residents.every(a=>a.species==='goose'));
 world.sync([],{mapId:'town'});assert.deepEqual(world.sample(),[]);
});
test('environment steering extends shared residents without advancing them twice',()=>{
 const world=new AnimalWorld();world.sync([{...host,animal:'duck'}],{mapId:'lake'});
 const birds=world.residents.map(a=>[a.x,a.y,a.clock]);world.advance(.2,weather,false,()=>true);
 assert.deepEqual(world.sample(false,()=>true).map(a=>[a.x,a.y,a.clock]),birds);
});
