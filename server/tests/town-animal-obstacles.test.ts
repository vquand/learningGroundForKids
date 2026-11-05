import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimalResidents,stepAnimalResidents} from '../src/town-building/animalWorld.ts';
import {BLUEPRINTS,type Entity,type TownAnimal} from '../src/town-building/game.ts';
test('enclosed ground animals never spawn or walk inside a building footprint',()=>{
 for(const [blueprintId,animal]of [['coop','chicken'],['farmhouse','dairy-cow'],['farmhouse','sheep'],['farmhouse','pig'],['animal-habitat','capybara'],['animal-habitat','rabbit']] as [string,TownAnimal][]){
  const host:Entity={id:'host',blueprintId,animal,x:6,y:2,mapId:'lake',paidCost:{}};
  const walls:Entity[]=Array.from({length:20},(_,x)=>Array.from({length:6},(_,y)=>({id:`wall-${x}-${y}`,blueprintId:'lemon',x,y,mapId:'lake' as const,paidCost:{}}))).flat();
  const residents=createAnimalResidents([host,...walls],[],{mapId:'town'});assert.ok(residents.length);
  for(let i=0;i<20;i++){stepAnimalResidents(residents,.05,{precipitation:'none',timeOfDay:'morning'});assert.ok(residents.every(a=>a.inactive||a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`)),`${animal} must stay hidden when no legal ground exists`);}
  const reopened=createAnimalResidents([host],residents,{mapId:'town'});assert.ok(reopened.every(a=>!a.inactive&&a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`)),'reopening ground restores residents at legal positions');
 }
});
test('walking residents route around all occupied buildings and recover safely after a new obstruction',()=>{
 const entities:Entity[]=[{id:'coop',blueprintId:'coop',animal:'chicken',x:6,y:4,paidCost:{}},{id:'home',blueprintId:'house',x:9,y:5,paidCost:{}}];
 let residents=createAnimalResidents(entities,[],{mapId:'town'});
 const clear=()=>residents.every(a=>a.inactive||entities.every(e=>{const b=BLUEPRINTS.find(b=>b.id===e.blueprintId)!;return a.x<e.x||a.x>=e.x+b.width||a.y<e.y||a.y>=e.y+b.length;}));
 for(let i=0;i<1200;i++){stepAnimalResidents(residents,.05,{precipitation:'none',timeOfDay:'morning'});assert.ok(clear());}
 const a=residents[0]!;entities.push({id:'new-home',blueprintId:'house',x:Math.floor(a.x),y:Math.floor(a.y),paidCost:{}});
 residents=createAnimalResidents(entities,residents,{mapId:'town'});assert.ok(clear(),'layout recovery never retains a resident inside the new footprint');
});
test('a hen walled off from its coop door settles in its pocket at night instead of looping walk-sleep-walk, and a resync brings it home',()=>{
  // A Lake layout from a real account: the coop, the duck coop and a shore insect raiser box in a pocket right of the coop.
  const entities:Entity[]=[{id:'coop',blueprintId:'coop',animal:'chicken',x:1,y:3,paidCost:{}},{id:'ducks',blueprintId:'coop',animal:'duck',x:4,y:5,paidCost:{}},
    ...[4,5,6].map(x=>({id:`fence-${x}`,blueprintId:'wooden-fence',x,y:2,paidCost:{}}))];
  const world={mapId:'lake' as const,rafts:[{id:'nest',blueprintId:'insect-raiser' as const,x:2,y:6,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}]};
  const animals=createAnimalResidents(entities,[],world),hen=animals.find(a=>a.id==='coop:chicken:1')!;
  Object.assign(hen,{x:1.5,y:5.5,path:[]});
  const night={precipitation:'none' as const,timeOfDay:'night',isDay:false,season:'autumn' as const};
  let walks=0,walking=false;
  for(let t=0;t<60;t+=.05){stepAnimalResidents(animals,.05,night);const now=hen.path.length>0;if(now&&!walking)walks++;walking=now;}
  assert.ok(walks<=1,`the stranded hen settles once (walked ${walks} times)`);
  assert.equal(hen.mode,'resting');assert.ok(hen.x<3&&hen.y>=5,'it stays in its own pocket rather than crossing the coop');
  const synced=createAnimalResidents(entities,animals,world).find(a=>a.id===hen.id)!;
  assert.ok(!(synced.x<3&&synced.y>=5),'a resync starts the walled-off hen again at its own door');
});
