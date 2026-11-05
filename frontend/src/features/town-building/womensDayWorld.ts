import {WOMENS_DAY_2026_POLICY as POLICY} from '../../../../server/src/town-building/events/womensDay2026Model.ts';
export {isWomensDay} from '../../../../server/src/town-building/events/womensDay2026Model.ts';
import {BLUEPRINTS,entityFootprint,terrainAt,type Entity} from '../../../../server/src/town-building/game.ts';
import {FOREST_TREES} from './forestWorld.ts';
type Point={x:number;y:number};
const key=(p:Point)=>`${Math.floor(p.x)}:${Math.floor(p.y)}`;
const hash=(s:string)=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const byId=new Map(BLUEPRINTS.map(b=>[b.id,b]));
function occupiedCells(entities:readonly Entity[],includeRoads=false){
 const occupied=new Set<string>();
 for(const e of entities){const b=byId.get(e.blueprintId);if(!b||(!includeRoads&&b.kind==='road'))continue;
  const f=entityFootprint(e);
  for(let x=f.x-(includeRoads?0:1);x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++)occupied.add(`${x}:${y}`);
 }
 return occupied;
}
/** Cosmetic placement: the Halloween three-tile spacing, with separate rules
 * and no crop/reservation/reward dependencies on that event's edition. */
export function celebrationPlan(entities:readonly Entity[]){
 const occupied=occupiedCells(entities,true),candidates=new Map<string,Point>();
 for(const e of [...entities].sort((a,b)=>a.id.localeCompare(b.id))){const b=byId.get(e.blueprintId);if(!b||!['building','road'].includes(b.kind))continue;
  const f=entityFootprint(e);
  for(let x=f.x-1;x<=f.x+f.width;x++)for(let y=f.y-1;y<=f.y+f.length;y++){
   const p={x,y};if(x>=0&&x<20&&y>=0&&y<40&&terrainAt(x,y)==='grass'&&!occupied.has(key(p)))candidates.set(key(p),p);
  }
 }
 const flowers:Point[]=[];
 for(const p of [...candidates.values()].sort((a,b)=>hash(`flower:${key(a)}`)-hash(`flower:${key(b)}`)))
  if(flowers.length<POLICY.maxFlowers&&flowers.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=POLICY.flowerSpacing))flowers.push(p);
 const trees=entities.filter(e=>byId.get(e.blueprintId)?.kind==='tree').sort((a,b)=>a.id.localeCompare(b.id));
 const hanging:{x:number;y:number;ambient:boolean}[]=[];
 for(const tree of trees.length?trees:FOREST_TREES.filter(e=>e.x>-3&&e.x<22&&e.y>-2&&e.y<41)){
  const b=byId.get(tree.blueprintId),p={x:tree.x+(b?.width??2)-.5,y:tree.y+(b?.length??2)/2,ambient:!trees.length};
  if(hanging.length<POLICY.maxHanging&&hanging.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=POLICY.treeSpacing))hanging.push(p);
 }
 return {flowers,hanging};
}
export interface FlowerBlob extends Point {id:number;path:Point[];wait:number;target:number|null;trip:number;facing:number;greeting:number}
export function createFlowerWorld(entities:readonly Entity[]){
 const blocked=occupiedCells(entities),walkable=new Set<string>(),cells:Point[]=[];
 for(let x=0;x<20;x++)for(let y=0;y<40;y++)if(terrainAt(x,y)==='grass'&&!blocked.has(`${x}:${y}`)){walkable.add(`${x}:${y}`);cells.push({x:x+.5,y:y+.5});}
 const plan=celebrationPlan(entities),blobs:FlowerBlob[]=[];
 plan.flowers=plan.flowers.filter(p=>walkable.has(key(p)));
 // Start near the settlement, never inside a house or over water.
 const nearHomes=plan.flowers.map(p=>({x:p.x+.5,y:p.y+.5})).filter(p=>walkable.has(key(p)));
 const homes=nearHomes.length?nearHomes:cells;
 for(let id=0;id<Math.min(POLICY.maxBlobs,cells.length);id++){
  const home=homes[id%homes.length]!;
  const p=[...cells].sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y)).find(p=>blobs.every(b=>Math.hypot(p.x-b.x,p.y-b.y)>=2.5));
  if(p)blobs.push({...p,id,path:[],wait:id*.6,target:null,trip:0,facing:1,greeting:0});
 }
 return {plan,blobs,walkable,cells,planted:new Set<number>(),seconds:0};
}
export type FlowerWorld=ReturnType<typeof createFlowerWorld>;
function route(world:FlowerWorld,from:Point,to:Point):Point[]{
 const start=key(from),end=key(to),queue=[start],parents=new Map<string,string|null>([[start,null]]);
 for(let i=0;i<queue.length&&!parents.has(end);i++){const current=queue[i]!,[x,y]=current.split(':').map(Number);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const next=`${x!+dx!}:${y!+dy!}`;if(world.walkable.has(next)&&!parents.has(next)){parents.set(next,current);queue.push(next);}}
 }
 if(!parents.has(end))return [];
 const path:Point[]=[];let current=end;
 while(current!==start){const [x,y]=current.split(':').map(Number);path.unshift({x:x!+.5,y:y!+.5});current=parents.get(current)!;}
 return path;
}
export function stepFlowerWorld(world:FlowerWorld,elapsed:number,reduced=false){
 if(reduced)return;const dt=Math.max(0,Math.min(.1,elapsed));world.seconds+=dt;
 for(const b of world.blobs){if(b.greeting>0){b.greeting=Math.max(0,b.greeting-dt);continue;}
  if(b.wait>0){b.wait-=dt;continue;}
  if(b.path.length){const p=b.path[0]!,dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*POLICY.walkSpeed);if(Math.abs(dy)>.001)b.facing=dy<0?-1:1;
   if(d<=step+.00001){b.x=p.x;b.y=p.y;b.path.shift();if(!b.path.length)b.wait=2;}
   else{b.x+=dx/d*step;b.y+=dy/d*step;}continue;
  }
  if(b.target!==null){world.planted.add(b.target);b.target=null;b.wait=2;continue;}
  const reserved=new Set(world.blobs.map(other=>other.target));let destination:Point|undefined,nextPath:Point[]|undefined;
  if(b.id%3===0)for(const [index,p]of world.plan.flowers.entries()){
   if(world.planted.has(index)||reserved.has(index))continue;
   const candidate={x:p.x+.5,y:p.y+.5},path=route(world,b,candidate);
   if(path.length||key(candidate)===key(b)){destination=candidate;nextPath=path;b.target=index;break;}
  }
  destination??=world.cells[hash(`${b.id}:${b.trip++}`)%world.cells.length];
  b.path=nextPath??(destination?route(world,b,destination):[]);
  if(!b.path.length&&destination&&key(destination)!==key(b)){b.target=null;b.wait=3;}else if(!b.path.length)b.wait=2;
 }
}
