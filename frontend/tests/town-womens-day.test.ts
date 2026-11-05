import assert from 'node:assert/strict';
import test from 'node:test';
import {BLUEPRINTS,initialTown,terrainAt,type Entity} from '../../server/src/town-building/game.ts';
import {isWomensDay,celebrationPlan,createFlowerWorld,stepFlowerWorld} from '../src/features/town-building/womensDayWorld.ts';
test('home-calendar celebration is October 19–21, every year, independent of season',()=>{
 for(const year of [2026,2027,2032])for(const day of [19,20,21])assert.ok(isWomensDay(`${year}-10-${day}`));
 for(const date of ['2026-10-18','2026-10-22','2026-03-20','','2026-10-200','junk-10-20'])assert.equal(isWomensDay(date),false,date);
});
test('flowers remain sparse beside homes/roads, clear of construction and terrain',()=>{
 const entities=initialTown().entities;
 for(let y=4;y<33;y++)entities.push({id:`road-${y}`,blueprintId:'dirt-road',x:8,y,paidCost:{}});
 const before=JSON.stringify(entities),plan=celebrationPlan(entities);
 assert.ok(plan.flowers.length>3);assert.ok(plan.flowers.length<=16);
 for(const [i,p]of plan.flowers.entries()){
  assert.equal(terrainAt(p.x,p.y),'grass');
  assert.ok(!entities.some(e=>{const b=BLUEPRINTS.find(b=>b.id===e.blueprintId)!;return p.x>=e.x&&p.x<e.x+b.width&&p.y>=e.y&&p.y<e.y+b.length;}));
  for(const q of plan.flowers.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=3);
 }
 assert.deepEqual(celebrationPlan([...entities].reverse()),plan);assert.equal(JSON.stringify(entities),before);
 assert.ok(celebrationPlan([]).hanging.every(p=>p.ambient),'treeless towns use ambient trees');
 const trees:Entity[]=[{id:'tree',blueprintId:'lemon',x:4,y:12,paidCost:{}}];
 assert.ok(celebrationPlan(trees).hanging.every(p=>!p.ambient),'placed trees are preferred');
});
test('blobs plant by reaching clear sites; stepping never changes town data',()=>{
 const entities=initialTown().entities;const before=JSON.stringify(entities),world=createFlowerWorld(entities);
 assert.ok(world.blobs.length>0);let moved=false;const start=world.blobs.map(b=>({...b}));
 for(let i=0;i<3000;i++){stepFlowerWorld(world,.05);world.blobs.forEach((b,j)=>{if(Math.hypot(b.x-start[j]!.x,b.y-start[j]!.y)>.2)moved=true;assert.ok(world.walkable.has(`${Math.floor(b.x)}:${Math.floor(b.y)}`));});}
 assert.ok(moved);assert.ok(world.planted.size>0);assert.ok(world.planted.size<=world.plan.flowers.length);assert.equal(JSON.stringify(entities),before);
 const snapshot=JSON.stringify(world);stepFlowerWorld(world,100,true);assert.equal(JSON.stringify(world),snapshot,'reduced motion does not simulate planting or movement');
});
test('a fully blocked town stays safe, and isolated flower sites are never planted remotely',()=>{
 const occupied:Entity[]=[];for(let x=0;x<20;x++)for(let y=0;y<40;y++)occupied.push({id:`fence-${x}-${y}`,blueprintId:'wooden-fence',x,y,paidCost:{}});
 const full=createFlowerWorld(occupied);assert.equal(full.blobs.length,0);stepFlowerWorld(full,.1);assert.equal(full.planted.size,0);
 const entities=initialTown().entities;
 for(let x=0;x<15;x++)entities.push({id:`wall-${x}`,blueprintId:'wooden-fence',x,y:13,paidCost:{}});
 const world=createFlowerWorld(entities);const previously=new Set<number>();
 for(let i=0;i<6000;i++){
  stepFlowerWorld(world,.05);
  for(const site of world.planted)if(!previously.has(site)){const p=world.plan.flowers[site]!;assert.ok(world.blobs.some(b=>Math.hypot(b.x-(p.x+.5),b.y-(p.y+.5))<.01),'planting requires an actual arrival');previously.add(site);}
 }
 assert.ok(world.planted.size>0);
});
test('a planter skips an unreachable site and continues with a reachable flower',()=>{
 const wall:Entity[]=[];for(let x=0;x<20;x++)wall.push({id:`wall-${x}`,blueprintId:'wooden-fence',x,y:13,paidCost:{}});
 const world=createFlowerWorld(wall);world.plan.flowers=[{x:8,y:15},{x:8,y:12}];
 world.blobs=[{id:0,x:8.5,y:11.5,path:[],wait:0,target:null,trip:0,facing:1,greeting:0}];
 for(let i=0;i<500;i++)stepFlowerWorld(world,.05);
 assert.equal(world.planted.has(0),false);assert.equal(world.planted.has(1),true);
});
