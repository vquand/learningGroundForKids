import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimalResidents, stepAnimal } from '../src/features/town-building/animalWorld.ts';
import { TOWN_ANIMALS, type Entity } from '../../server/src/town-building/game.ts';

test('all day animals settle at evening/night and wake in the morning; owls reverse the schedule',()=>{
 for(const species of TOWN_ANIMALS){
  const pet=['parrot','white-owl','golden-retriever','shiba-inu','border-collie','samoyed','vietnamese-dog','british-shorthair','ragdoll','persian','scottish-straight','munchkin'].includes(species);
  const host:Entity={id:'host',blueprintId:pet?'house':['dairy-cow','highland-cow','sheep','pig'].includes(species)?'farmhouse':['capybara','rabbit'].includes(species)?'animal-habitat':'coop',animal:species,x:7,y:12,paidCost:{},...(pet?{pets:[species] as never}:{})};
  const animals=createAnimalResidents([host],[],{mapId:'town'});assert.ok(animals.length);
  for(let i=0;i<6000;i++)for(const a of animals)stepAnimal(a,.05,{precipitation:'none',timeOfDay:species==='white-owl'?'noon':'evening'});
  assert.ok(animals.every(a=>a.sleeping&&a.mode==='resting'&&!a.flying&&!a.path.length),species);
  for(const a of animals)stepAnimal(a,.05,{precipitation:'none',timeOfDay:species==='white-owl'?'night':'morning'});
  assert.ok(animals.every(a=>a.mode==='roaming'&&!a.sleeping),species);
 }
});
test('multi-pet residents are one per slot, preserve duplicate identities, and removal clears them',()=>{
 const home:Entity={id:'home',blueprintId:'town-hall',x:6,y:20,paidCost:{},pets:['shiba-inu','shiba-inu','white-owl']};
 const residents=createAnimalResidents([home],[],{mapId:'town'});assert.equal(residents.length,3);assert.equal(new Set(residents.map(a=>a.id)).size,3);
 residents[1]!.clock=99;assert.equal(createAnimalResidents([home],residents,{mapId:'town'})[1]!.clock,99);
 assert.equal(createAnimalResidents([{...home,pets:['shiba-inu']}],residents,{mapId:'town'}).length,1);
 assert.equal(createAnimalResidents([],residents,{mapId:'town'}).length,0);
});
test('capybaras visit lemon, apple and cherry trees and carry that tree’s fruit',()=>{
 for(const blueprintId of ['lemon','apple','cherry'] as const){
  const entities:Entity[]=[{id:'haven',blueprintId:'animal-habitat',x:7,y:12,paidCost:{}},{id:'fruit',blueprintId,x:7,y:17,paidCost:{}}];
  const residents=createAnimalResidents(entities,[],{mapId:'town'});let caught=false;
  for(let i=0;i<14000&&!caught;i++)for(const a of residents){stepAnimal(a,.05,{precipitation:'none',timeOfDay:'noon',season:'autumn'});if(a.fruitTime>0){caught=true;assert.equal(a.fruit,blueprintId);assert.equal(a.bumpTree!.blueprintId,blueprintId);}}
  assert.ok(caught,blueprintId);
 }
});
test('birds perch/fly and capybaras catch fruit only beside real fruit trees',()=>{
 const tree:Entity={id:'tree',blueprintId:'lemon',x:7,y:17,paidCost:{}};
 const home:Entity={id:'home',blueprintId:'large-house',x:7,y:12,paidCost:{},pets:['parrot','white-owl']};
 const birds=createAnimalResidents([home,tree],[],{mapId:'town'});let flew=false,perched=false;
 for(let i=0;i<30000;i++)for(const a of birds){stepAnimal(a,.05,{precipitation:'none',timeOfDay:a.species==='white-owl'?'night':'noon',season:'summer'});flew||=a.flying;perched||=a.perched;assert.ok(a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`));}
 assert.ok(flew);assert.ok(perched);
 const haven={...home,blueprintId:'animal-habitat',pets:undefined} as unknown as Entity;
 const capys=createAnimalResidents([haven,tree],[],{mapId:'town'});let bumped=false,fruit=false;
 for(let i=0;i<40000;i++)for(const a of capys){stepAnimal(a,.05,{precipitation:'none',timeOfDay:'noon',season:'summer'});bumped||=a.bumpAge>0;fruit||=a.fruitTime>0;}
 assert.ok(bumped);assert.ok(fruit);
 const alone=createAnimalResidents([haven],[],{mapId:'town'});for(let i=0;i<10000;i++)for(const a of alone){stepAnimal(a,.05);assert.equal(a.bumpAge,0);assert.equal(a.fruitTime,0);}
 const still=birds[0]!;const before={x:still.x,y:still.y};stepAnimal(still,.05,{precipitation:'none',timeOfDay:'noon'},true);assert.deepEqual({x:still.x,y:still.y},before);assert.equal(still.flying,false);
});
