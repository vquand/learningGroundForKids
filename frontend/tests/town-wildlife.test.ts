import test from 'node:test';
import assert from 'node:assert/strict';
import { wildlifePoses } from '../src/features/town-building/ambientWildlife.ts';
import { animalDisplayPosition } from '../src/features/town-building/animalPresentation.ts';
import { animalSprite } from '../src/features/town-building/animalSprite.ts';
import { PET_ATLASES, ANIMALS_SLEEP, PET_WALKS } from '../src/features/town-building/petAtlas.ts';
import { createAnimalResidents, stepAnimal } from '../src/features/town-building/animalWorld.ts';
import { TOWN_ANIMALS, terrainAt, type Entity } from '../../server/src/town-building/game.ts';
import { TOWN_PETS } from '../../server/src/town-building/game.ts';
import { PET_DIRECTIONS } from '../src/features/town-building/petDirectionalAtlas.ts';

test('fish face their travel direction and turn without teleporting across the river',()=>{
 const weather={season:'summer',precipitation:'none',timeOfDay:'noon'} as const;
 let left=false,right=false;
 for(let t=100;t<300000;t+=137){
  const a=wildlifePoses(weather,[],t,'town').filter(p=>p.frame===10||p.frame===11),b=wildlifePoses(weather,[],t+1,'town').filter(p=>p.frame===10||p.frame===11);
  for(let i=0;i<a.length;i++){
   const dy=b[i]!.y-a[i]!.y;
   assert.ok(Math.abs(dy)<.001,'swimming position must remain continuous');
   if(Math.abs(dy)>.000001)assert.equal(a[i]!.facing,Math.sign(dy),'fish cannot swim tail first');
   left||=dy<0;right||=dy>0;
  }
 }
 assert.ok(left&&right);
});

test('flying ambient birds face their horizontal travel direction',()=>{
 const weather={season:'autumn',precipitation:'none',timeOfDay:'noon'} as const;
 const before=wildlifePoses(weather,[],19000,'town').filter(p=>p.airborne&&p.frame===7);
 const after=wildlifePoses(weather,[],19001,'town').filter(p=>p.airborne&&p.frame===7);
 assert.ok(before.length>0,'fixture must include a bird in flight');
 for(const bird of before){
  const next=after.reduce((nearest,pose)=>Math.hypot(pose.x-bird.x,pose.y-bird.y)<Math.hypot(nearest.x-bird.x,nearest.y-bird.y)?pose:nearest);
  const dy=next.y-bird.y;
  assert.ok(Math.abs(dy)<.001,'bird flight must remain continuous');
  if(Math.abs(dy)>.000001)assert.equal(bird.facing,Math.sign(dy),'birds cannot fly tail first');
 }
});

test('resident birds ease onto and off a perch instead of teleporting',()=>{
 const tree:Entity={id:'tree',blueprintId:'lemon',x:7,y:17,paidCost:{}};
 const home:Entity={id:'home',blueprintId:'large-house',x:7,y:12,paidCost:{},pets:['parrot']};
 const bird=createAnimalResidents([home,tree],[],{mapId:'town'})[0]!;
 bird.x=6.5;bird.y=16.5;bird.path=[];bird.pause=0;bird.flying=true;bird.perch={x:bird.x,y:bird.y};bird.perchTree=tree;
 let previous=animalDisplayPosition(bird),transitioned=false;
 const assertSmoothAndForward=()=>{
  const current=animalDisplayPosition(bird),dx=current.x-previous.x,dy=current.y-previous.y,distance=Math.hypot(dx,dy);
  assert.ok(distance<.35,`perch transition jumped ${distance.toFixed(3)} tiles`);
  if(distance>.000001){
   if(Math.abs(dx)>=Math.abs(dy))assert.equal(bird.direction,dx>0?'front':'back','bird must face its vertical flight direction');
   else assert.equal(bird.facing,Math.sign(dy),'bird must face its horizontal flight direction');
  }
  previous=current;
 };
 for(let i=0;i<20&&!bird.perched;i++){
  stepAnimal(bird,.05,{season:'summer',precipitation:'none',timeOfDay:'noon'});
  assertSmoothAndForward();
  transitioned||=bird.perchProgress>0&&bird.perchProgress<1;
 }
 assert.ok(transitioned,'landing must include intermediate positions');
 assert.equal(bird.perched,true);
 assert.deepEqual(animalDisplayPosition(bird),{x:tree.x+.7,y:tree.y+1.25});
 const targetKey=[...bird.allowed].find(cell=>{const [x,y]=cell.split(':').map(Number);return Math.hypot(x!+.5-bird.x,y!+.5-bird.y)>1;})!;
 const [targetX,targetY]=targetKey.split(':').map(Number);
 bird.pause=0;let tookOff=false;
 for(let i=0;i<20&&!tookOff;i++){
  stepAnimal(bird,.05,{season:'summer',precipitation:'none',timeOfDay:'noon'},false,{target:{x:targetX!+.5,y:targetY!+.5}});
  assertSmoothAndForward();
  tookOff=bird.perchTree===null&&bird.perchProgress===0;
 }
 assert.ok(tookOff,'takeoff must include intermediate positions');
});

test('seasonal creatures follow season/daylight and rain; fish stay inside the river',()=>{
 for(const season of ['spring','summer','autumn','winter'] as const){
  const weather={season,precipitation:'none',timeOfDay:'noon'} as const;
  const daytime=wildlifePoses(weather,[],5000,'town');
  assert.ok(daytime.some(p=>season==='spring'?p.frame<=1:season==='summer'?p.frame>=2&&p.frame<=5:season==='autumn'?p.frame===6:p.frame===8));
  for(let t=0;t<200000;t+=100){
   for(const fish of wildlifePoses(weather,[],t,'town').filter(p=>p.frame===10||p.frame===11))assert.equal(terrainAt(Math.floor(fish.x),Math.floor(fish.y)),'river');
  }
  const night=wildlifePoses({...weather,timeOfDay:'night'},[],5000,'town');assert.ok(night.some(p=>p.frame>=16));assert.ok(night.every(p=>p.frame>=10));
  assert.ok(wildlifePoses({...weather,timeOfDay:'night'},[],20000,'town').every(p=>p.frame<16));
  assert.ok(wildlifePoses({...weather,precipitation:'rain'},[],5000,'town').every(p=>p.frame===10||p.frame===11));
  assert.deepEqual(wildlifePoses(weather,[],5000,'town',true),wildlifePoses(weather,[],999999,'town',true));
 }
});
test('all animal sprites resolve to valid measured crops for activity and rest',()=>{
 const dummy=createAnimalResidents([{id:'farm',blueprintId:'farmhouse',x:7,y:12,paidCost:{}}],[],{mapId:'town'})[0]!;
 for(const species of TOWN_ANIMALS){
  for(const activity of [{},{sleeping:true},{running:true,path:[{x:1,y:1}],pause:0},{flying:true},{perched:true}]){
   const sprite=animalSprite(species,{...dummy,...activity});const [x,y,w,h]=sprite.crop;
   assert.ok(x!>=0&&y!>=0&&w!>0&&h!>0&&x!+w!<=sprite.width&&y!+h!<=sprite.height,`${species} ${sprite.file}`);
  }
 }
 for(const atlas of [...Object.values(PET_ATLASES),ANIMALS_SLEEP])for(const [x,y,w,h] of atlas.rects)assert.ok(x!+w!<=atlas.width&&y!+h!<=atlas.height);
});
test('every house pet and pig has distinct front/back steps; parrots and owls have directional flight',()=>{
 const dummy=createAnimalResidents([{id:'home',blueprintId:'house',x:7,y:12,paidCost:{},pets:['border-collie']}],[],{mapId:'town'})[0]!;
 for(const species of [...TOWN_PETS,'pig'] as const){
  const crops=new Set<string>();
  for(const direction of ['front','back'] as const)for(const clock of [0,.25]){
   const sprite=animalSprite(species,{...dummy,path:[{x:1,y:1}],pause:0,direction,clock});assert.ok(sprite.file.endsWith('-directions')||species==='australian-cattle-dog'&&sprite.file==='cattle-dog');crops.add(sprite.crop.join(','));
   const [x,y,w,h]=sprite.crop;assert.ok(x!+w!<=sprite.width&&y!+h!<=sprite.height);
  }
  assert.equal(crops.size,4,species);
 }
 for(const species of ['parrot','white-owl'] as const){const walk=animalSprite(species,{...dummy,direction:'back'}),fly=animalSprite(species,{...dummy,direction:'back',flying:true});assert.notDeepEqual(walk.crop,fly.crop);}
 for(const atlas of Object.values(PET_DIRECTIONS)){assert.equal(atlas.rects.length,20);for(const [x,y,w,h] of atlas.rects)assert.ok(x!>=0&&y!>=0&&x!+w!<=atlas.width&&y!+h!<=atlas.height);}
});
test('cats and dogs walk sideways through an eight-frame cycle with a stable crop size',()=>{
 const dummy=createAnimalResidents([{id:'home',blueprintId:'house',x:7,y:12,paidCost:{},pets:['border-collie']}],[],{mapId:'town'})[0]!;
 for(const species of TOWN_PETS.filter(pet=>pet!=='parrot'&&pet!=='white-owl')){
  const frames=Array.from({length:8},(_,frame)=>animalSprite(species,{...dummy,path:[{x:1,y:1}],pause:0,direction:'side',clock:(frame+.5)/7}));
  assert.equal(new Set(frames.map(sprite=>sprite.crop.join(','))).size,8,species);
  assert.ok(frames.every(sprite=>sprite.file.endsWith('-walk')&&sprite.crop[2]===frames[0]!.crop[2]&&sprite.crop[3]===frames[0]!.crop[3]),species);
  assert.deepEqual(animalSprite(species,{...dummy,path:[{x:1,y:1}],pause:0,direction:'side',clock:8/7+.01}).crop,frames[0]!.crop,species);
  for(const state of [{running:true},{sleeping:true},{path:[]}])assert.ok(!animalSprite(species,{...dummy,path:[{x:1,y:1}],pause:0,direction:'side',clock:0,...state}).file.endsWith('-walk'),species);
 }
 for(const atlas of Object.values(PET_WALKS))for(const [x,y,w,h] of atlas.rects)assert.ok(x!>=0&&y!>=0&&x!+w!<=atlas.width&&y!+h!<=atlas.height);
});
