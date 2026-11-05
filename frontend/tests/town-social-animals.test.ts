import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_BEHAVIOR } from '../src/features/town-building/animalBehavior.ts';
import { animalWalkable, createAnimalResidents, stepAnimal, stepAnimalResidents } from '../src/features/town-building/animalWorld.ts';
import { TOWN_ANIMALS, entityDoor, type Entity } from '../../server/src/town-building/game.ts';
const day={precipitation:'none',timeOfDay:'noon',season:'summer'} as const;
test('each species has a deliberate habit; sheep flock and ducks follow a line',()=>{
 for(const species of TOWN_ANIMALS)assert.ok(ANIMAL_BEHAVIOR[species]);
 for(const [species,group] of [['sheep','flock'],['duck','line'],['goose','line']] as const){
  assert.equal(ANIMAL_BEHAVIOR[species].group,group);
  const animals=createAnimalResidents([{id:'host',blueprintId:species==='sheep'?'farmhouse':'coop',animal:species,x:7,y:12,paidCost:{}}],[],{mapId:'town'});
  let close=0,observed=0;
  for(let i=0;i<12000;i++){stepAnimalResidents(animals,.05,day);for(const a of animals)assert.ok(a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`));
   if(i>1000){observed++;if(Math.hypot(animals[1]!.x-animals[0]!.x,animals[1]!.y-animals[0]!.y)<(group==='flock'?2.5:4))close++;}
  }
  assert.ok(close/observed>.75,`${species} should stay with companions`);
  if(group==='line')assert.ok(animals[0]!.trail.length>4);
 }
});
test('a Border Collie meets flocks one by one, leads them to merge, and sends everyone home at night',()=>{
 const entities:Entity[]=[{id:'home',blueprintId:'house',x:8,y:24,paidCost:{},pets:['border-collie']},
 {id:'first',blueprintId:'farmhouse',x:8,y:19,paidCost:{},animal:'sheep'},
 {id:'second',blueprintId:'farmhouse',x:3,y:24,paidCost:{},animal:'sheep'},
 {id:'third',blueprintId:'farmhouse',x:8,y:30,paidCost:{},animal:'sheep'}];
 const animals=createAnimalResidents(entities,[],{mapId:'town'}),dog=animals.find(a=>a.species==='border-collie')!;let hearts=false;
 let lastCount=0;const order:string[]=[];
 for(let i=0;i<50000;i++){
  stepAnimalResidents(animals,.05,day);for(const a of animals)assert.ok(a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`));
  const hosts=dog.herding?.hosts??[];
  if(hosts.length>lastCount){assert.equal(hosts.length,lastCount+1);order.push(hosts.at(-1)!);lastCount=hosts.length;}
  hearts||=animals.some(a=>a.heart>0);
  if(hosts.length===3&&hearts&&animals.filter(a=>a.species==='sheep').every(a=>a.herderId===dog.id))break;
 }
 assert.equal(new Set(order).size,3);assert.ok(hearts);assert.equal(animals.filter(a=>a.herderId===dog.id).length,6);
 assert.ok(dog.herding!.hosts.includes('first'));assert.ok(dog.herding!.hosts.includes('second'));assert.ok(dog.herding!.hosts.includes('third'));
 for(let i=0;i<6000;i++)stepAnimalResidents(animals,.05,{...day,timeOfDay:'night'});
 assert.equal(dog.herding,null);assert.ok(animals.every(a=>a.herderId===null&&a.heart===0&&a.sleeping&&a.mode==='resting'));
 assert.ok(animals.every(a=>Math.hypot(a.x-a.shelter.x,a.y-a.shelter.y)<.01));
 const sheepOnly=createAnimalResidents(entities.filter(e=>e.id!=='home'),animals,{mapId:'town'});stepAnimalResidents(sheepOnly,.05,day);assert.ok(sheepOnly.every(a=>a.herderId===null&&a.heart===0));
});
test('crowded towns never strand a pet on a door island or freeze a large herd',()=>{
 // Reported layout: the large house's door opens onto the farmhouse's reserved art row,
 // and one collie gathers three flocks whose formation trails past the old waiting radius.
 const building=(id:string,blueprintId:string,x:number,y:number,extra:Partial<Entity>={}):Entity=>({id,blueprintId,x,y,paidCost:{},...extra});
 const entities:Entity[]=[building('collie-home','house',0,13,{pets:['border-collie']}),building('mansion','large-house',7,16,{pets:['golden-retriever','border-collie']}),
  building('north-flock','farmhouse',0,17,{animal:'sheep'}),building('middle-flock','farmhouse',4,15,{animal:'sheep'}),building('south-flock','farmhouse',11,16,{animal:'sheep'}),
  building('cows','farmhouse',10,5,{animal:'highland-cow'}),building('ducks','coop',8,22,{animal:'duck'}),building('geese','coop',13,29,{animal:'goose'}),
  building('capybaras','animal-habitat',1,29,{animal:'capybara'}),building('rabbits','animal-habitat',6,30,{animal:'rabbit'}),
  building('lemon','lemon',3,27),building('school','school',5,4),building('meat','meat-shop',11,21),building('veg','vegetable-shop',9,26),
  building('tools','tools-smith',3,20),building('bakery','bakery',9,31),building('apple','apple',0,22),building('cherry','cherry',0,25)];
 const animals=createAnimalResidents(entities,[],{mapId:'town'});
 const still=new Map<string,{x:number;y:number;since:number}>(),longest=new Map<string,number>();
 for(let i=0;i<18000;i++){
  stepAnimalResidents(animals,.05,day);
  for(const a of animals){
   const s=still.get(a.id),t=i*.05;
   if(!s||a.sleeping||a.mode!=='roaming'||Math.hypot(a.x-s.x,a.y-s.y)>.3){still.set(a.id,{x:a.x,y:a.y,since:t});continue;}
   longest.set(a.id,Math.max(longest.get(a.id)??0,t-s.since));
  }
 }
 // Capybara followers deliberately stand beside a napping leader.
 const stuck=animals.filter(a=>a.species!=='capybara'&&(longest.get(a.id)??0)>60).map(a=>`${a.id} ${(longest.get(a.id)!).toFixed(0)}s`);
 assert.deepEqual(stuck,[]);
 const retriever=animals.find(a=>a.species==='golden-retriever')!;
 assert.notEqual(`${Math.floor(retriever.x)}:${Math.floor(retriever.y)}`,'10:18','the retriever must leave the mansion door');
});
test('a door only opens onto a reserved art row when it leads to open ground',()=>{
 const mansion:Entity={id:'mansion',blueprintId:'large-house',x:7,y:16,paidCost:{},pets:['golden-retriever']};
 const barn:Entity={id:'barn',blueprintId:'farmhouse',x:11,y:16,paidCost:{},animal:'sheep'};
 // The mansion's south door (10,18) sits in the barn's reserved row, walled in on every side.
 assert.equal(animalWalkable([mansion,barn],mansion,'golden-retriever',{mapId:'town'}).has('10:18'),false);
 const facingNorth:Entity={...mansion,direction:'back'};
 const north=animalWalkable([facingNorth],facingNorth,'golden-retriever',{mapId:'town'}),door=entityDoor(facingNorth);
 assert.equal(door.x,6,'the turned door faces north into its own art row');assert.ok(north.has(`${door.x}:${door.y}`),'a north door still opens onto its own clear art row');
});
test('a pet whose home ring is unreachable roams the nearest reachable cells instead of freezing',()=>{
 const home:Entity={id:'home',blueprintId:'house',x:8,y:20,paidCost:{},pets:['golden-retriever']};
 const [pet]=createAnimalResidents([home],[],{mapId:'town'});
 pet!.home={x:-60,y:-60};pet!.pause=0;const start={x:pet!.x,y:pet!.y};let moved=0;
 for(let i=0;i<1200;i++){stepAnimal(pet!,.05,day);moved=Math.max(moved,Math.hypot(pet!.x-start.x,pet!.y-start.y));}
 assert.ok(moved>.5,'the pet keeps walking');
});
test('a collie excuses one stuck straggler after ten seconds but still waits for the rest of its flock',()=>{
 const entities:Entity[]=[{id:'home',blueprintId:'house',x:8,y:24,paidCost:{},pets:['border-collie']},{id:'first',blueprintId:'farmhouse',x:8,y:19,paidCost:{},animal:'sheep'}];
 const animals=createAnimalResidents(entities,[],{mapId:'town'}),dog=animals.find(a=>a.species==='border-collie')!;
 for(let i=0;i<20000&&!dog.herding?.hosts.length;i++)stepAnimalResidents(animals,.05,day);
 assert.equal(dog.herding?.hosts.length,1);
 const [stuck,other]=animals.filter(a=>a.species==='sheep') as [typeof dog,typeof dog];
 const cell=`${Math.floor(stuck.x)}:${Math.floor(stuck.y)}`;stuck.allowed=new Set([cell]);stuck.path=[];
 let excusedAt=-1;
 for(let i=0;i<6000&&excusedAt<0;i++){stepAnimalResidents(animals,.05,day);if(dog.herding?.excused?.includes(stuck.id))excusedAt=i*.05;}
 assert.ok(excusedAt>=0,'the stuck sheep is excused');
 assert.ok(!dog.herding!.excused!.includes(other.id),'the free sheep is never excused');
 // Pull the free sheep far behind: the dog must wait for it again.
 other.x=stuck.x;other.y=stuck.y;other.path=[];
 for(let i=0;i<400&&!dog.herding?.waiting;i++)stepAnimalResidents(animals,.05,day);
 assert.equal(dog.herding?.waiting?.id,other.id);
});
