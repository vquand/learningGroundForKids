import assert from 'node:assert/strict';
import test from 'node:test';
import {route} from '../src/town-building/animalWorld.ts';

type Point={x:number;y:number};
const key=(x:number,y:number)=>`${x}:${y}`;
/** The original string-keyed search, kept as the reference the grid search must match exactly. */
function reference(animal:{x:number;y:number;allowed:Set<string>},target:string):Point[] {
  const start=key(Math.floor(animal.x),Math.floor(animal.y)),queue=[start],parents=new Map<string,string|null>([[start,null]]);
  for(let i=0;i<queue.length;i++) {
    const current=queue[i]!;if(current===target) break;
    const [x,y]=current.split(':').map(Number);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next=key(x!+dx!,y!+dy!);if(!animal.allowed.has(next)||parents.has(next)) continue;
      parents.set(next,current);queue.push(next);
    }
  }
  if(!parents.has(target)) return [];
  const path:Point[]=[];let current=target;
  while(current!==start) {const [x,y]=current.split(':').map(Number);path.unshift({x:x!+.5,y:y!+.5});current=parents.get(current)!;}
  const center={x:Math.floor(animal.x)+.5,y:Math.floor(animal.y)+.5};
  if(path.length&&Math.hypot(center.x-animal.x,center.y-animal.y)>.01) path.unshift(center);
  return path;
}
function random(seed:number){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};}
test('the grid route returns exactly the paths of the string-keyed search',()=>{
  const next=random(7);
  for(let round=0;round<300;round++) {
    const allowed=new Set<string>();
    for(let x=-2;x<24;x++)for(let y=-2;y<44;y++)if(next()<(round%3?.55:.85))allowed.add(key(x,y));
    for(let trial=0;trial<12;trial++) {
      // Starts include cells outside the set and off the map; targets include blocked cells.
      const animal={x:Math.floor(next()*30)-3+next()*.9,y:Math.floor(next()*50)-3+next()*.9,allowed};
      const target=key(Math.floor(next()*28)-3,Math.floor(next()*48)-3);
      assert.deepEqual(route(animal as never,target),reference(animal,target),`${round}:${trial} ${animal.x},${animal.y} -> ${target}`);
    }
  }
  assert.deepEqual(route({x:1.5,y:1.5,allowed:new Set()} as never,'3:3'),[]);
  assert.deepEqual(route({x:1.5,y:1.5,allowed:new Set()} as never,'1:1'),[]);
});
