import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyTown, initialTown, ensureStarterHome, applyTownCommand, petCapacity, residentSpecies, type Entity } from '../src/town-building/game.ts';
import { townCommandSchema } from '../src/town-building/routes.ts';

test('a free starter home is granted once without earning a construction badge',()=>{
 const town=initialTown();assert.equal(town.entities.length,1);assert.equal(town.entities[0]!.blueprintId,'house');
 assert.deepEqual(town.materials,emptyTown().materials);assert.deepEqual(town.earned,{});
 const removed=applyTownCommand(town,'town',{type:'remove',entityId:town.entities[0]!.id},'unused',0);
 assert.equal(ensureStarterHome(removed),removed);assert.equal(removed.entities.length,0);
 const legacy=emptyTown();legacy.entities=[{id:'old',blueprintId:'large-house',x:7,y:12,paidCost:{wood:9}}];
 const upgraded=ensureStarterHome(legacy);assert.equal(upgraded.entities.length,1);assert.equal(upgraded.entities[0]!.id,'old');
});
test('server validates capacities, breeds and atomic multi-pet selection',()=>{
 for(const [blueprintId,capacity] of [['house',1],['large-house',2],['town-hall',3]] as const){
  const town=emptyTown();town.entities=[{id:'home',blueprintId,x:7,y:12,paidCost:{}}];
  assert.equal(petCapacity(blueprintId),capacity);
  const pets=Array.from({length:capacity},()=> 'shiba-inu' as const);
  const saved=applyTownCommand(town,'town',{type:'set-pets',entityId:'home',pets},'unused',0);
  assert.deepEqual(residentSpecies(saved.entities[0]!),pets);assert.deepEqual(saved.materials,town.materials);assert.deepEqual(saved.earned,{});
  assert.equal(applyTownCommand(saved,'town',{type:'set-pets',entityId:'home',pets},'unused',0),saved);
  assert.throws(()=>applyTownCommand(town,'town',{type:'set-pets',entityId:'home',pets:[...pets,'parrot']},'unused',0),/pet/);
  assert.throws(()=>applyTownCommand(town,'town',{type:'set-pets',entityId:'home',pets:['pig'] as never},'unused',0),/pet/);
  assert.deepEqual(town.entities[0]!.pets,undefined);
  assert.deepEqual(residentSpecies(applyTownCommand(saved,'town',{type:'set-pets',entityId:'home',pets:[]},'unused',0).entities[0]!),[]);
 }
 const farm:Entity={id:'farm',blueprintId:'farmhouse',x:7,y:12,paidCost:{},animal:'pig'};
 assert.deepEqual(residentSpecies(farm),['pig','pig']);
 const town=emptyTown();town.entities=[farm];assert.throws(()=>applyTownCommand(town,'town',{type:'set-pets',entityId:'farm',pets:['parrot']},'unused',0),/pet/);
 assert.throws(()=>applyTownCommand(town,'town',{type:'set-pets',entityId:'missing',pets:[]},'unused',0),/here/);
});
test('pet HTTP commands reject forged fields, unknown breeds and excessive arrays',()=>{
 assert.ok(townCommandSchema.safeParse({type:'set-pets',entityId:'home',pets:['white-owl','munchkin']}).success);
 for(const input of [{pets:['dragon']},{pets:['parrot','parrot','parrot','parrot']},{pets:['parrot'],count:50},{pets:['parrot'],earned:true}])
  assert.equal(townCommandSchema.safeParse({type:'set-pets',entityId:'home',...input}).success,false);
});
