import test from 'node:test';
import assert from 'node:assert/strict';
import { animalWalkable,createAnimalResidents,stepAnimal,animalPoseFrame,ANIMAL_SPEED,shelterOpacity } from '../src/features/town-building/animalWorld.ts';
import { terrainAt,type Entity } from '../../server/src/town-building/game.ts';
import { ANIMAL_ATLAS,HABITAT_ART,CAPYBARA_WALK,ANIMAL_SIGN,COOP_ART } from '../src/features/town-building/animalAtlas.ts';
const home:Entity={id:'coop',blueprintId:'coop',x:12,y:16,paidCost:{},animal:'duck'};
test('only ducks and geese can navigate connected river tiles',()=>{
  const chicken=animalWalkable([home],home,'chicken',{mapId:'town'});const duck=animalWalkable([home],home,'duck',{mapId:'town'});
  assert.ok([...duck].some(k=>{const [x,y]=k.split(':').map(Number);return terrainAt(x!,y!)==='river';}));
  assert.ok([...chicken].every(k=>{const [x,y]=k.split(':').map(Number);return terrainAt(x!,y!)==='grass';}));
  const animals=createAnimalResidents([home],[],{mapId:'town'});assert.equal(animals.length,4);
  for(let frame=0;frame<10000;frame++)for(const animal of animals){stepAnimal(animal,.05);assert.ok(animal.allowed.has(`${Math.floor(animal.x)}:${Math.floor(animal.y)}`));}
  assert.ok(ANIMAL_SPEED.capybara<ANIMAL_SPEED.duck);assert.ok(ANIMAL_SPEED.goose>ANIMAL_SPEED.chicken);
});
test('populations follow host species changes, movement and demolition',()=>{
  const farm:Entity={id:'farm',blueprintId:'farmhouse',x:7,y:12,paidCost:{}};
  let residents=createAnimalResidents([farm],[],{mapId:'town'});assert.equal(residents.length,2);assert.equal(residents[0]!.species,'dairy-cow');
  residents=createAnimalResidents([{...farm,animal:'highland-cow'}],residents,{mapId:'town'});assert.equal(residents.length,2);assert.ok(residents.every(a=>a.species==='highland-cow'));
  assert.equal(createAnimalResidents([],residents,{mapId:'town'}).length,0);
  const capys=createAnimalResidents([{...farm,blueprintId:'animal-habitat'}],[],{mapId:'town'});assert.equal(capys.length,2);
  let slept=false;for(let i=0;i<10000;i++){stepAnimal(capys[0]!,.05);slept ||= capys[0]!.sleeping;}assert.ok(slept);
  assert.equal(createAnimalResidents([{...farm,blueprintId:'animal-habitat',animal:'rabbit'}],[],{mapId:'town'}).length,4);
});
test('geese occasionally make short flights and stay near their coop',()=>{
  const geese=createAnimalResidents([{...home,animal:'goose'}],[],{mapId:'town'});let flew=false;
  for(let frame=0;frame<10000;frame++)for(const goose of geese){stepAnimal(goose,.05);if(goose.flying){flew=true;assert.ok(goose.path.length<=5);}assert.ok(goose.allowed.has(`${Math.floor(goose.x)}:${Math.floor(goose.y)}`));}
  assert.ok(flew);
});
test('measured animal crops stay within the sheet and retain artwork proportions',()=>{
  assert.equal(ANIMAL_ATLAS.rects.length,8*2);
  for(const [x,y,w,h] of ANIMAL_ATLAS.rects){assert.ok(w!>0&&h!>0&&x!>=0&&y!>=0);assert.ok(x!+w!<=ANIMAL_ATLAS.width&&y!+h!<=ANIMAL_ATLAS.height);}
  const [x,y,w,h]=HABITAT_ART.rect;assert.ok(x!+w!<=HABITAT_ART.width&&y!+h!<=HABITAT_ART.height);
});

test('capybaras use both dedicated walking poses and keep sleep separate',()=>{
 const animal=createAnimalResidents([{id:'haven',blueprintId:'animal-habitat',x:7,y:12,paidCost:{}}],[],{mapId:'town'})[0]!;
 animal.path=[{x:animal.x+1,y:animal.y}];animal.pause=0;
 const frames=new Set<number>();for(let clock=0;clock<10;clock+=.1){animal.clock=clock;const pose=animalPoseFrame(animal);assert.ok(pose===2||pose===3);frames.add(pose);}
 assert.deepEqual([...frames].sort(),[2,3]);
 animal.sleeping=true;assert.equal(animalPoseFrame(animal),1);
 animal.sleeping=false;animal.path=[];assert.equal(animalPoseFrame(animal),0);
 animal.species='chicken';animal.path=[{x:animal.x+1,y:animal.y}];
 animal.clock=0;assert.equal(animalPoseFrame(animal),0);animal.clock=.25;assert.equal(animalPoseFrame(animal),1);
});

test('new capybara walking sprites have a stable torso height and all prop crops are isolated',()=>{
 assert.equal(CAPYBARA_WALK.rects.length,2);assert.equal(CAPYBARA_WALK.rects[0]![3],CAPYBARA_WALK.rects[1]![3]);
 for(const [x,y,w,h] of CAPYBARA_WALK.rects) assert.ok(x!>=0&&y!>=0&&x!+w!<=CAPYBARA_WALK.width&&y!+h!<=CAPYBARA_WALK.height);
 for(const source of [ANIMAL_SIGN,COOP_ART]){const [x,y,w,h]=source.rect;assert.ok(x!>=0&&y!>=0&&x!+w!<=source.width&&y!+h!<=source.height);}
});

test('rain brings chickens and rabbits home to a calm huddle; capybaras curl up',()=>{
 for(const [blueprintId,species] of [['coop','chicken'],['animal-habitat','rabbit'],['animal-habitat','capybara']] as const){
  const animals=createAnimalResidents([{id:'host',blueprintId,animal:species,x:7,y:12,paidCost:{}}],[],{mapId:'town'});
  for(let i=0;i<3000;i++)for(const a of animals)stepAnimal(a,.05);
  for(let i=0;i<4000;i++)for(const a of animals){const before={x:a.x,y:a.y};stepAnimal(a,.05,{precipitation:'rain'});assert.ok(Math.hypot(a.x-before.x,a.y-before.y)<=ANIMAL_SPEED[species]*.05+.001);}
  assert.ok(animals.every(a=>a.mode==='resting'&&a.path.length===0));
  assert.ok(animals.every(a=>a.direction==='back'));
  assert.ok(animals.every(a=>a.sleeping===(species==='capybara')));
  assert.ok(animals.every(a=>Math.hypot(a.x-a.shelter.x,a.y-a.shelter.y)<.01));
  for(const a of animals)stepAnimal(a,.05,{precipitation:'none'});
  assert.ok(animals.every(a=>a.mode==='roaming'&&!a.sleeping&&a.pause>0));
  assert.ok(new Set(animals.map(a=>a.pause)).size>1);
 }
});
test('ducks and geese stay active in rain, while no new goose flights begin',()=>{
 for(const species of ['duck','goose'] as const){const birds=createAnimalResidents([{...home,animal:species}],[],{mapId:'town'});let moved=false;
  for(let i=0;i<3000;i++)for(const bird of birds){const old={x:bird.x,y:bird.y};stepAnimal(bird,.05,{precipitation:'rain'});moved ||= bird.x!==old.x||bird.y!==old.y;assert.equal(bird.flying,false);assert.equal(bird.mode,'roaming');}
  assert.ok(moved);
 }
});
test('ducks swim as widely in rain as in dry weather instead of huddling near the coop',()=>{
 for(const species of ['duck','goose'] as const){
  const reach=(precipitation:'rain'|'none')=>{const birds=createAnimalResidents([{...home,animal:species}],[],{mapId:'town'});let far=0;
   for(let i=0;i<20000;i++)for(const bird of birds){stepAnimal(bird,.05,{precipitation});far=Math.max(far,Math.hypot(bird.x-bird.home.x,bird.y-bird.home.y));}
   return far;};
  assert.ok(reach('rain')>4.6,`${species} keeps roaming past the old rain radius`);
 }
});
test('a resident stranded in the open by a stale rest walks home again, and a rest that no longer fits the weather ends',()=>{
 const chicken=createAnimalResidents([{id:'coop',blueprintId:'coop',x:6,y:3,paidCost:{},animal:'chicken'}],[],{mapId:'town'})[0]!;
 // What an older save could hold: resting far from the shelter while it rains.
 chicken.mode='resting';chicken.raining=true;chicken.x=chicken.shelter.x+2.5;chicken.y=chicken.shelter.y-1.5;
 for(let i=0;i<1200;i++)stepAnimal(chicken,.05,{precipitation:'rain',timeOfDay:'morning'});
 assert.equal(chicken.mode,'resting');assert.ok(Math.hypot(chicken.x-chicken.shelter.x,chicken.y-chicken.shelter.y)<.1,'back at the door');
 for(let i=0;i<200;i++)stepAnimal(chicken,.05,{precipitation:'none',timeOfDay:'morning'});
 assert.equal(chicken.mode,'roaming');
 const stale=createAnimalResidents([{id:'coop2',blueprintId:'coop',x:6,y:3,paidCost:{},animal:'chicken'}],[],{mapId:'town'})[0]!;
 stale.mode='resting';stale.raining=false;stale.inactive=false;
 for(let i=0;i<100;i++)stepAnimal(stale,.05,{precipitation:'none',timeOfDay:'morning'});
 assert.equal(stale.mode,'roaming','a dry-weather rest from an old save is not permanent');
});
test('coop birds and rabbits go inside their home to shelter and come back out; other residents stay visible',()=>{
 const [chicken]=createAnimalResidents([{id:'coop',blueprintId:'coop',x:6,y:3,paidCost:{},animal:'chicken'}],[],{mapId:'town'});
 const [cow]=createAnimalResidents([{id:'haven',blueprintId:'animal-habitat',x:7,y:12,paidCost:{}}],[],{mapId:'town'});
 const [rabbit]=createAnimalResidents([{id:'warren',blueprintId:'animal-habitat',x:12,y:12,paidCost:{},animal:'rabbit'}],[],{mapId:'town'});
 assert.equal(chicken!.housing,'inside');assert.equal(cow!.housing,'open');
 assert.equal(shelterOpacity(chicken!),1);
 for(let i=0;i<1200;i++){stepAnimal(chicken!,.05,{precipitation:'rain',timeOfDay:'morning'});stepAnimal(cow!,.05,{precipitation:'rain',timeOfDay:'morning'});stepAnimal(rabbit!,.05,{precipitation:'rain',timeOfDay:'morning'});}
 assert.equal(rabbit!.species,'rabbit');assert.equal(shelterOpacity(rabbit!),0,'rabbits go into their haven');assert.equal(shelterOpacity(chicken!),0,'inside the coop');assert.equal(shelterOpacity(cow!),1,'open-air residents rest in sight');
 for(let i=0;i<300;i++)stepAnimal(chicken!,.05,{precipitation:'none',timeOfDay:'morning'});
 for(let i=0;i<1200&&shelterOpacity(chicken!)<1;i++)stepAnimal(chicken!,.05,{precipitation:'none',timeOfDay:'morning'});
 assert.equal(shelterOpacity(chicken!),1,'out again when the rain stops');
});
test('cows and sheep graze on in the rain while capybaras, rabbits and dogs go home',()=>{
 const roam=(species:'dairy-cow'|'highland-cow'|'sheep'|'capybara')=>{
  const host={id:'h',blueprintId:species==='capybara'?'animal-habitat':'farmhouse',x:7,y:12,paidCost:{},animal:species} as Entity;
  const animals=createAnimalResidents([host],[],{mapId:'town'});
  for(let i=0;i<2400;i++)for(const a of animals)stepAnimal(a,.05,{precipitation:'rain',timeOfDay:'morning'});
  return animals;
 };
 for(const species of ['dairy-cow','highland-cow','sheep'] as const)assert.ok(roam(species).some(a=>a.mode==='roaming'),`${species} stays in the field`);
 assert.ok(roam('capybara').every(a=>a.mode==='resting'),'capybaras still shelter');
});
test('reduced motion immediately presents calm shelter poses without moving loops',()=>{
 const capy=createAnimalResidents([{id:'haven',blueprintId:'animal-habitat',x:7,y:12,paidCost:{}}],[],{mapId:'town'})[0]!;
 stepAnimal(capy,0,{precipitation:'rain'},true);assert.equal(capy.mode,'resting');assert.equal(capy.sleeping,true);assert.equal(capy.path.length,0);
});
