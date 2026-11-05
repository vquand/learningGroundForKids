import assert from 'node:assert/strict';
import {artSource,assertRuntimeCataloged,ART_SOURCES_MISSING} from './town-art-helpers.ts';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {CIV_BUSINESSES} from '../../server/src/town-building/civCatalog.ts';
import {CIV_INTERIORS,interiorActivity} from '../src/features/town-building/civInteriorLayout.ts';

test('all seven tiled interiors put every role beside its own fixture with staggered actions',()=>{
 for(const business of CIV_BUSINESSES){
  const room=CIV_INTERIORS[business.id]!;assert.ok(room,business.id);
  assert.deepEqual(room.stations.map(s=>s.art),business.workers.map(w=>w.art));
  for(const station of room.stations){
   const target=room.fixtures[station.fixture]!;assert.ok(target);
   assert.ok(Math.abs(target.x-station.x)<1.1,'hands must reach the fixture beside the worker');
   assert.equal(station.x+1,target.x);
   assert.ok(station.y>=target.y&&station.y<target.y+target.height);
   assert.ok(Number.isInteger(station.x)&&Number.isInteger(station.y));
   assert.equal(interiorActivity(station,0,true),'idle');
   const modes=new Set(Array.from({length:station.period*10},(_,i)=>interiorActivity(station,i/10)));
   assert.ok(modes.has('idle')&&modes.has('work'));
  }
  if(room.stations.length>1)assert.notEqual(room.stations[0]!.phase,room.stations[1]!.phase);
  for(const item of room.fixtures){
   assert.ok([item.x,item.y,item.width,item.height].every(Number.isInteger),'furniture must snap to whole tiles');
   assert.ok(item.x>=0&&item.y>=0&&item.x+item.width<=room.columns&&item.y+item.height<=room.rows);
  }
  const occupied=new Set<string>();
  for(const item of room.fixtures)for(let y=item.y;y<item.y+item.height;y++)for(let x=item.x;x<item.x+item.width;x++){
   const key=`${x}:${y}`;assert.ok(!occupied.has(key),'furniture footprints cannot overlap');occupied.add(key);
  }
  for(const station of room.stations)assert.ok(!occupied.has(`${station.x}:${station.y}`),'a worker occupies its own clear tile');
  const reachable=new Set<string>(),queue=[{x:Math.floor(room.columns/2),y:room.rows-1}];
  for(let i=0;i<queue.length;i++){
   const point=queue[i]!,key=`${point.x}:${point.y}`;if(reachable.has(key)||occupied.has(key)||point.x<0||point.y<0||point.x>=room.columns||point.y>=room.rows)continue;
   reachable.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:point.x+dx!,y:point.y+dy!});
  }
  for(const station of room.stations)assert.ok(reachable.has(`${station.x}:${station.y}`),'each station is reachable from the door');
 }
});

test('small shops use four-by-five rooms and floors match their purpose',()=>{
 for(const id of ['grocery','meat-shop','vegetable-shop'])assert.deepEqual([CIV_INTERIORS[id]!.columns,CIV_INTERIORS[id]!.rows],[4,5]);
 assert.equal(CIV_INTERIORS['tools-smith']!.floor,'stone');assert.equal(CIV_INTERIORS.school!.floor,'hardwood');
 assert.equal(CIV_INTERIORS.bakery!.floor,'terracotta');assert.equal(CIV_INTERIORS.infirmary!.floor,'ceramic');
 for(const room of Object.values(CIV_INTERIORS))for(const item of room.fixtures)assert.ok(item.width*item.height<=2,'furniture uses one or two whole tiles');
});
test('walking foot anchors follow each silhouette rather than drifting across source cells',async()=>{
 const people=JSON.parse(await readFile(new URL('../src/features/town-building/civPeopleAtlas.json',import.meta.url),'utf8')).people;
 const right=people.grocer.frames.slice(0,4);
 assert.ok(Math.max(...right.map((f:any)=>f.anchor[0]))-Math.min(...right.map((f:any)=>f.anchor[0]))<6);
 for(const person of Object.values(people) as any[])for(const frame of person.frames.slice(0,16)){
  assert.ok(frame.anchor[0]>0&&frame.anchor[0]<frame.crop[2]);
  assert.ok(frame.anchor[1]>=frame.crop[3]-3&&frame.anchor[1]<=frame.crop[3]);
 }
});
test('the generated tile atlas and original sources use the private artwork catalog',{skip:ART_SOURCES_MISSING&&'local /art sources not present'},async()=>{
 const atlas=JSON.parse(await readFile(new URL('../src/features/town-building/civInteriorSpecializedAtlas.json',import.meta.url),'utf8'));
 const png=await readFile(artSource(`${atlas.file}.png`));
 assert.equal(png.readUInt32BE(16),atlas.width);assert.equal(png.readUInt32BE(20),atlas.height);assert.equal(atlas.rects.length,20);
 for(const [x,y,w,h] of atlas.rects)assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=atlas.width&&y+h<=atlas.height);
 const catalog=JSON.parse(await readFile(new URL('../server/artwork/catalog.json',import.meta.url),'utf8'));
 assertRuntimeCataloged(assert,catalog,atlas.file);
});
