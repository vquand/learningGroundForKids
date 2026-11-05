import { BLUEPRINTS, entityDoor, entityDoorPoint, entityFootprint, isPassable, residentSpecies, type Entity, type TownAnimal, type Season } from './game.ts';
import type { Precipitation } from './environment.js';
import {animalHabitat,isAnimalWater} from './maps/animalHabitat.ts';
import { ANIMAL_BEHAVIOR } from './animalBehavior.ts';
import type {MapId} from './maps/types.ts';
import type {LakeRaft} from './water/types.ts';
import {duckCoops,duckDuty,duckWaterRange} from './water/ducks.ts';
import {raftFootprint} from './water/behavior.ts';
/** The map an animal lives on, with its water structures; always passed explicitly. */
export interface AnimalWorldContext{mapId:MapId;rafts?:readonly LakeRaft[]}
export type AnimalDirection='side'|'front'|'back';
type Point={x:number;y:number};
export interface AnimalResident {
  mapId:MapId;
  /** Small residents (coop birds, rabbits) shelter inside their home and are not drawn there; the others rest in the open beside it. */
  housing:'inside'|'open';
  /** Ducks on water duty stay on their coop's water; others roam the land. */
  duty?:'water'|'land';
  id:string; hostId:string; species:TownAnimal; x:number; y:number; path:Point[];
  allowed:Set<string>; pause:number; sleeping:boolean; flying:boolean; facing:1|-1;
  seed:number; clock:number; flightAge:number; direction:AnimalDirection;
  home:Point; shelter:Point; mode:'roaming'|'returning'|'resting'; raining:boolean; ordinal:number;
  inactive:boolean; running:boolean; perched:boolean; perch:Point|null; perchTree:Entity|null; perchProgress:number; trees:Entity[]; treeLayout:string;
  bumpAge:number; bumpPending:boolean; bumpTree:Entity|null; fruit:'lemon'|'apple'|'cherry'|null; fruitTime:number; bumpCooldown:number;
  trail:Point[];herderId:string|null;heart:number;herding:{hosts:string[];target:string|null;center:Point;waiting?:{id:string;seconds:number;gap:number}|null;excused?:string[]}|null;
}
interface AnimalContext {target?:Point;roamCenter?:Point;wait?:boolean;follow?:boolean;escort?:boolean;formation?:boolean}
const blueprintById=new Map(BLUEPRINTS.map(b=>[b.id,b]));
const key=(x:number,y:number)=>`${x}:${y}`;
const STEPS=[[1,0],[-1,0],[0,1],[0,-1]] as const;
// Navigation sets live for a layout's lifetime. Parse their cell coordinates
// once, rather than splitting thousands of strings at every animal decision.
const cellCache=new WeakMap<Set<string>,{key:string;x:number;y:number}[]>();
function navigationCells(allowed:Set<string>) {
  let cells=cellCache.get(allowed);
  if(!cells){cells=[...allowed].map(k=>{const [x,y]=k.split(':').map(Number);return {key:k,x:x!+.5,y:y!+.5};});cellCache.set(allowed,cells);}
  return cells;
}
// Residents never spawn, gather or resume in a tiny walled-in pocket. The check is a flood
// fill bounded at POCKET cells, so restoring a large herd stays cheap on every heartbeat.
const POCKET=8;
const pocketCache=new WeakMap<Set<string>,Map<string,boolean>>();
function roomy(allowed:Set<string>,cell:string):boolean {
  let known=pocketCache.get(allowed);if(!known){known=new Map();pocketCache.set(allowed,known);}
  const cached=known.get(cell);if(cached!==undefined)return cached;
  const seen=new Set([cell]),queue=[cell];
  while(queue.length&&seen.size<POCKET){const [x,y]=queue.pop()!.split(':').map(Number);
    for(const [dx,dy] of STEPS){const next=key(x!+dx,y!+dy);if(allowed.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}}}
  const result=allowed.has(cell)&&seen.size>=POCKET;known.set(cell,result);return result;
}
function random(animal:AnimalResident):number { animal.seed=(Math.imul(animal.seed,1664525)+1013904223)>>>0; return animal.seed/4294967296; }
function hash(id:string):number { let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
const waterBird=(species:TownAnimal)=>species==='duck'||species==='goose';
/** Ducks and geese love the rain, and cows and sheep graze on in it; everyone else goes home when it rains. */
const shelterFromRain=(species:TownAnimal)=>!waterBird(species)&&!['dairy-cow','highland-cow','sheep'].includes(species);
export function animalWalkable(entities:Entity[],host:Entity,species:TownAnimal,world:AnimalWorldContext):Set<string> {
  const mapId=world.mapId,habitat=animalHabitat(mapId),rafts=world.rafts??[];
  if(species==='duck'&&duckCoops([host]).length&&duckDuty({mapId,entities,rafts},host)==='water')return duckWaterRange({mapId,entities,rafts},host);
  const blocked=new Set<string>();
  for(const raft of rafts){const f=raftFootprint(raft);for(let x=f.x;x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++)blocked.add(key(x,y));}
  const solid=new Set<string>();
  for(const entity of entities){const b=blueprintById.get(entity.blueprintId)!;
    if(isPassable(entity)||b.kind==='garden'||b.kind==='fence'&&(species==='chicken'||species==='duck'))continue;
    const f=entityFootprint(entity);
    for(let x=f.x-(b.kind==='fence'||b.kind==='decoration'?0:1);x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++){blocked.add(key(x,y));if(x>=f.x)solid.add(key(x,y));}
  }
  // The row north of a building is kept clear for its art, but a door may open onto it,
  // only when it leads to open ground: otherwise it would be a one-cell island.
  const door=entityDoor(host),doorKey=key(door.x,door.y);
  const ground=(x:number,y:number)=>{const terrain=habitat.terrainAt(x,y);return !blocked.has(key(x,y))&&terrain!=='outside'&&terrain!=='mountain'&&!habitat.blockedAt(x,y)&&(!isAnimalWater(terrain)||waterBird(species));};
  if(!solid.has(doorKey)&&STEPS.some(([dx,dy])=>ground(door.x+dx,door.y+dy)))blocked.delete(doorKey);
  // Land animals cross the water on bridges.
  const bridges=new Set(entities.filter(e=>blueprintById.get(e.blueprintId)?.kind==='bridge').map(e=>key(e.x,e.y)));
  const allowed=new Set<string>();const radius=species==='border-collie'||species==='australian-cattle-dog'||species==='sheep'||species==='dairy-cow'||species==='highland-cow'?40:waterBird(species)?6:4;
  const hostFootprint=entityFootprint(host);
  for(let x=Math.max(habitat.minX,host.x-radius);x<Math.min(habitat.maxX,host.x+hostFootprint.width+radius);x++) for(let y=Math.max(habitat.minY,host.y-radius);y<Math.min(habitat.maxY,host.y+hostFootprint.length+radius);y++) {
    const terrain=habitat.terrainAt(x,y);
    if(terrain==='outside'||terrain==='mountain'||habitat.blockedAt(x,y)||(isAnimalWater(terrain)&&!waterBird(species)&&!bridges.has(key(x,y))))continue;
    if(blocked.has(key(x,y)))continue;
    allowed.add(key(x,y));
  }
  return allowed;
}
export type SavedAnimal=Omit<AnimalResident,'allowed'|'trees'>&Partial<Pick<AnimalResident,'allowed'|'trees'>>;
export function createAnimalResidents(entities:Entity[],previous:SavedAnimal[],world:AnimalWorldContext):AnimalResident[] {
  const residents:AnimalResident[]=[];
  const navigation=new Map<string,Set<string>>();
  for(const host of entities) {
    const speciesList=residentSpecies(host);if(!speciesList.length) continue;
    const mapId=world.mapId,habitat=animalHabitat(mapId),neighbors=entities;
    const duty=duckCoops([host]).length?duckDuty({mapId,entities,rafts:world.rafts??[]},host):undefined;
    const blueprint=BLUEPRINTS.find(b=>b.id===host.blueprintId)!;
    const footprint=entityFootprint(host),home={x:host.x+footprint.width/2,y:host.y+footprint.length/2},doorPoint=entityDoorPoint(host);
    for(let i=0;i<speciesList.length;i++) {
    const species=speciesList[i]!,navigationKey=`${host.id}:${species}`;
    const allowed=navigation.get(navigationKey)??animalWalkable(entities,host,species,world);navigation.set(navigationKey,allowed);
    const sorted=[...allowed].map(k=>{const [x,y]=k.split(':').map(Number);return {x:x!,y:y!};}).filter(p=>p.x>=0&&p.x<habitat.map.rows&&habitat.terrainAt(p.x,p.y)==='grass')
      .sort((a,b)=>Math.abs(a.x-doorPoint.x)+Math.abs(a.y-doorPoint.y)-Math.abs(b.x-doorPoint.x)-Math.abs(b.y-doorPoint.y));
    const cells:{x:number;y:number}[]=[];
    for(const cell of sorted){if(roomy(allowed,key(cell.x,cell.y)))cells.push(cell);if(cells.length>=speciesList.length)break;}
    // Only when every cell is a pocket (a tiny habitat) do residents use the pockets.
    const open=cells.length>0;if(!open)cells.push(...sorted);
    if(!cells.length) cells.push(host.direction&&host.direction!=='front'?{x:Math.floor(doorPoint.x),y:Math.floor(doorPoint.y)}:{x:host.x+blueprint.width-.6,y:home.y-.5});
    const gathering=cells[0]!;
      const id=`${host.id}:${species}:${i}`,old=previous.find(a=>a.id===id&&(a.mapId??'town')===mapId),base=cells[i%cells.length]!;
      const count=speciesList.length;
      const shelter={x:gathering.x+.5+(count===4?(i<2?-.17:.17):0),y:gathering.y+.5+(i%2===0?-.23:.23)};
      const trees=[...neighbors.filter(e=>BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind==='tree'),...habitat.trees].filter(e=>Math.hypot(e.x-host.x,e.y-host.y)<9);
      const initial:AnimalResident={mapId,housing:host.blueprintId==='coop'||species==='rabbit'?'inside':'open',...(duty&&species==='duck'?{duty}:{}),id,hostId:host.id,species,x:base.x+.5,y:base.y+.5,path:[],allowed,pause:i*.7,sleeping:false,flying:false,facing:1,seed:hash(id),clock:i*.5,flightAge:0,direction:'side',home,shelter,mode:'roaming',raining:false,ordinal:i,inactive:!allowed.size,running:false,perched:false,perch:null,perchTree:null,perchProgress:0,trees,treeLayout:trees.map(t=>`${t.id}:${t.x}:${t.y}`).join('|'),bumpAge:0,bumpPending:false,bumpTree:null,fruit:null,fruitTime:0,bumpCooldown:20+i*9,trail:[{x:base.x+.5,y:base.y+.5}],herderId:null,heart:0,herding:null};
      // A resident walled off from its own door (a fence, a new building or raft) starts again at the door instead of stranding there.
      const oldArea=old?areaAt(allowed,Math.floor(old.x),Math.floor(old.y)):-1,shelterArea=areaAt(allowed,Math.floor(shelter.x),Math.floor(shelter.y));
      const enclosed=oldArea>=0&&shelterArea>=0&&oldArea!==shelterArea;
      if(old&&!enclosed&&(allowed.has(key(Math.floor(old.x),Math.floor(old.y)))&&(!open||roomy(allowed,key(Math.floor(old.x),Math.floor(old.y))))||!allowed.size)) {
        const changed=old.home?.x!==home.x||old.home?.y!==home.y||old.shelter?.x!==shelter.x||old.shelter?.y!==shelter.y||old.path.some(p=>!allowed.has(key(Math.floor(p.x),Math.floor(p.y))));
        const treeRemoved=old.bumpTree&&!trees.some(tree=>tree.id===old.bumpTree!.id&&tree.x===old.bumpTree!.x&&tree.y===old.bumpTree!.y);
        const treesChanged=old.treeLayout!==initial.treeLayout;
        residents.push({...initial,...old,mapId,...(initial.duty?{duty:initial.duty}:{}),allowed,home,shelter,trees,treeLayout:initial.treeLayout,...(changed||treesChanged?{path:[],mode:'roaming' as const,raining:false,inactive:false,sleeping:false,flying:false,perched:false,perch:null,perchTree:null,perchProgress:0,bumpPending:false,trail:initial.trail}:{}),...(treeRemoved?{bumpAge:0,bumpTree:null}:{}),...(!allowed.size?{inactive:true,path:[]}:{})});
      } else residents.push(initial);
    }
  }
  return residents;
}
/** A walkable set as a padded grid, built once per set: the search then needs no string keys. */
interface WalkGrid{minX:number;minY:number;height:number;width:number;open:Uint8Array;parents:Int32Array;queue:Int32Array;areas?:Int32Array}
const gridCache=new WeakMap<Set<string>,WalkGrid>();
function walkGrid(allowed:Set<string>):WalkGrid {
  let grid=gridCache.get(allowed);
  if(grid)return grid;
  const cells=[...allowed].map(k=>{const [x,y]=k.split(':').map(Number);return [x!,y!] as const;});
  let minX=0,minY=0,maxX=0,maxY=0;
  if(cells.length){minX=maxX=cells[0]![0];minY=maxY=cells[0]![1];}
  for(const [x,y] of cells){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  // One cell of padding lets a start just outside the set still step in.
  minX--;minY--;const width=maxX-minX+2,height=maxY-minY+2,open=new Uint8Array(width*height);
  for(const [x,y] of cells)open[(x-minX)*height+(y-minY)]=1;
  grid={minX,minY,height,width,open,parents:new Int32Array(width*height),queue:new Int32Array(width*height)};gridCache.set(allowed,grid);return grid;
}
/** Connected-area label of a cell (-1 outside the set), labelled once per grid on the integer cells. */
function areaAt(allowed:Set<string>,x:number,y:number):number {
  const grid=walkGrid(allowed),{minX,minY,height,width,open,queue}=grid;
  if(x<minX||y<minY||x>=minX+width||y>=minY+height)return -1;
  if(!grid.areas){
    const areas=new Int32Array(width*height).fill(-1);let label=0;
    for(let start=0;start<open.length;start++){
      if(!open[start]||areas[start]!==-1)continue;
      areas[start]=label;queue[0]=start;let head=0,tail=1;
      while(head<tail){const current=queue[head++]!,cx=Math.floor(current/height),cy=current%height;
        for(const [dx,dy] of STEPS){const nx=cx+dx,ny=cy+dy,next=nx*height+ny;
          if(nx<0||ny<0||nx>=width||ny>=height||!open[next]||areas[next]!==-1)continue;areas[next]=label;queue[tail++]=next;}}
      label++;
    }
    grid.areas=areas;
  }
  return grid.areas[(x-minX)*height+(y-minY)]!;
}
/** Cardinal BFS keeps legs on connected, unoccupied terrain. */
export function route(animal:AnimalResident,target:string):Point[] {
  const sx=Math.floor(animal.x),sy=Math.floor(animal.y),[tx,ty]=target.split(':').map(Number) as [number,number];
  if(sx===tx&&sy===ty)return [];
  const {minX,minY,height,width,open,parents,queue}=walkGrid(animal.allowed),at=(x:number,y:number)=>x>=minX&&y>=minY&&x<minX+width&&y<minY+height?(x-minX)*height+(y-minY):-1;
  const start=at(sx,sy),goal=at(tx,ty);
  if(start<0||goal<0||!open[goal])return [];
  // The search is synchronous, so the grid's scratch buffers are safe to reuse.
  parents.fill(-2);parents[start]=-1;queue[0]=start;let head=0,tail=1;
  while(head<tail){
    const current=queue[head++]!;if(current===goal)break;
    const x=minX+Math.floor(current/height),y=minY+current%height;
    for(const [dx,dy] of STEPS){
      const next=at(x+dx,y+dy);
      if(next<0||!open[next]||parents[next]!==-2)continue;
      parents[next]=current;queue[tail++]=next;
    }
  }
  if(parents[goal]===-2)return [];
  const path:Point[]=[];
  for(let current=goal;current!==start;current=parents[current]!)path.push({x:minX+Math.floor(current/height)+.5,y:minY+current%height+.5});
  path.reverse();
  const center={x:sx+.5,y:sy+.5};
  if(path.length&&Math.hypot(center.x-animal.x,center.y-animal.y)>.01) path.unshift(center);
  return path;
}
function faceDelta(animal:AnimalResident,dx:number,dy:number) {
  if(Math.abs(dx)>.01&&Math.abs(dx)>=Math.abs(dy)) animal.direction=dx>0?'front':'back';
  else if(Math.abs(dy)>.01) {animal.direction='side';animal.facing=dy>0?1:-1;}
}
function face(animal:AnimalResident,point:Point) {faceDelta(animal,point.x-animal.x,point.y-animal.y);}
function perchAnchor(tree:Entity):Point {return {x:tree.x+.7,y:tree.y+1.25};}
function rest(animal:AnimalResident) {
  animal.mode='resting';animal.path=[];animal.pause=0;animal.flying=false;animal.perched=false;animal.perch=null;animal.perchTree=null;animal.perchProgress=0;animal.running=false;
  animal.sleeping=animal.inactive||animal.species==='capybara';face(animal,animal.home);
}
function returnHome(animal:AnimalResident) {
  animal.mode='returning';animal.sleeping=false;animal.pause=0;animal.perched=false;animal.perch=null;animal.perchTree=null;animal.perchProgress=0;animal.running=false;animal.flying=false;animal.bumpAge=0;animal.bumpPending=false;
  const targetKey=key(Math.floor(animal.shelter.x),Math.floor(animal.shelter.y));
  const sameCell=targetKey===key(Math.floor(animal.x),Math.floor(animal.y));
  animal.path=route(animal,targetKey);
  if(animal.path.length||sameCell) animal.path.push({...animal.shelter});
  else {
    // A newly placed building may disconnect the door. Settle on the cell of this
    // connected area nearest home, rather than teleporting through it or looping
    // forever between two cells (an animal already there simply rests).
    const habitat=animalHabitat(animal.mapId),here=areaAt(animal.allowed,Math.floor(animal.x),Math.floor(animal.y));
    const nearest=[...animal.allowed].filter(k=>{const [x,y]=k.split(':').map(Number);return x!>=0&&x!<habitat.map.rows&&habitat.terrainAt(x!,y!)==='grass'&&(here<0||areaAt(animal.allowed,x!,y!)===here);})
      .sort((a,b)=>{const [ax,ay]=a.split(':').map(Number),[bx,by]=b.split(':').map(Number);return Math.hypot(ax!-animal.home.x,ay!-animal.home.y)-Math.hypot(bx!-animal.home.x,by!-animal.home.y)||(a<b?-1:1);});
    const best=nearest[0];
    if(best&&best!==key(Math.floor(animal.x),Math.floor(animal.y)))animal.path=route(animal,best);
    if(!animal.path.length) rest(animal);
  }
}
/** 0 when a resident is inside its home, fading in and out over the last steps to the door. */
export function shelterOpacity(animal:Pick<AnimalResident,'housing'|'mode'|'x'|'y'|'shelter'>):number {
  if(animal.housing!=='inside'||animal.mode==='roaming')return 1;
  const distance=Math.hypot(animal.x-animal.shelter.x,animal.y-animal.shelter.y);
  return Math.min(1,Math.max(0,(distance-.1)/.5));
}
export const ANIMAL_SPEED:Record<TownAnimal,number>={'dairy-cow':.42,'highland-cow':.38,sheep:.48,chicken:.65,duck:.55,goose:1.65,capybara:.18,rabbit:1.8,pig:.55,'golden-retriever':.8,'shiba-inu':.85,'border-collie':.95,samoyed:.7,'vietnamese-dog':.85,'british-shorthair':.55,ragdoll:.5,persian:.45,'scottish-straight':.55,munchkin:.48,parrot:.6,'white-owl':.55,'australian-cattle-dog':.9};
export type AnimalWeather={precipitation:Precipitation|null;timeOfDay?:string|null;isDay?:boolean|null;season?:Season};
export function animalInactive(species:TownAnimal,weather:AnimalWeather):boolean {
  const night=weather.timeOfDay==='evening'||weather.timeOfDay==='night'||weather.isDay===false;
  return species==='white-owl'?!night:night;
}
const flyingPet=(species:TownAnimal)=>species==='parrot'||species==='white-owl';
function treeDoor(animal:AnimalResident,tree:Entity):Point|null {
  const b=BLUEPRINTS.find(b=>b.id===tree.blueprintId)??{width:2,length:2};
  const cells=navigationCells(animal.allowed)
    .filter(p=>p.x>=tree.x-1&&p.x<=tree.x+b.width+1&&p.y>=tree.y-1&&p.y<=tree.y+b.length+1)
    .sort((a,b)=>Math.hypot(a.x-animal.x,a.y-animal.y)-Math.hypot(b.x-animal.x,b.y-animal.y));
  for(const p of cells) if(route(animal,key(Math.floor(p.x),Math.floor(p.y))).length||Math.hypot(p.x-animal.x,p.y-animal.y)<.1)return p;
  return null;
}
export function stepAnimal(animal:AnimalResident,delta:number,weather:AnimalWeather={precipitation:'none'},reducedMotion=false,context:AnimalContext={}):void {
  if(!animal.allowed.size){animal.inactive=true;animal.path=[];animal.flying=false;return;}
  const dt=Math.min(.05,Math.max(0,delta));animal.clock+=dt;
  const behavior=ANIMAL_BEHAVIOR[animal.species];
  const raining=weather.precipitation==='rain';
  const inactive=animalInactive(animal.species,weather);
  if(raining!==animal.raining||inactive!==animal.inactive) {
    const landing=animal.flying&&raining&&waterBird(animal.species);
    animal.raining=raining;animal.inactive=inactive;animal.path=landing?animal.path:[];animal.sleeping=false;animal.pause=0;animal.perched=false;animal.perch=null;animal.perchTree=null;animal.perchProgress=0;
    animal.flying=landing;animal.mode='roaming';
    if(inactive||(raining&&shelterFromRain(animal.species))) returnHome(animal);
    else {animal.pause=.7+random(animal)*3+animal.ordinal*.2;animal.flying=false;}
  }
  if(reducedMotion) {
    animal.flying=false;animal.perched=false;animal.perch=null;animal.perchTree=null;animal.perchProgress=0;animal.bumpAge=0;
    if(inactive||(raining&&shelterFromRain(animal.species))) {
      const destination=animal.path.at(-1);
      if(destination){animal.x=destination.x;animal.y=destination.y;}rest(animal);
    }
    return;
  }
  // Image loads and canvas resizes repaint without advancing decisions or RNG.
  if(dt===0)return;
  animal.bumpCooldown=Math.max(0,animal.bumpCooldown-dt);
  animal.fruitTime=Math.max(0,animal.fruitTime-dt);
  if(animal.bumpAge>0) {
    animal.bumpAge+=dt;
    if(animal.bumpAge>=2.2){animal.bumpAge=0;animal.fruitTime=30;animal.bumpCooldown=90;animal.pause=3;}
    return;
  }
  if(animal.flying) animal.flightAge+=dt;
  if(animal.mode==='resting') {
    // A resident must never stay stranded in the open: a saved or blocked rest in place is retried every few seconds,
    // and a rest that no longer matches the weather ends.
    const needsShelter=inactive||raining&&shelterFromRain(animal.species);
    if(!needsShelter){animal.mode='roaming';animal.sleeping=false;animal.pause=.3+random(animal)*2;return;}
    if(Math.hypot(animal.x-animal.shelter.x,animal.y-animal.shelter.y)>.75) {
      if(animal.pause>0){animal.pause=Math.max(0,animal.pause-dt);return;}
      returnHome(animal);if(animal.mode==='resting')animal.pause=5;
    }
    return;
  }
  if(context.wait&&animal.mode==='roaming'){animal.path=[];animal.pause=.15;animal.running=false;return;}
  if(animal.perch&&!animal.path.length&&animal.perchTree){
    const anchor=perchAnchor(animal.perchTree);faceDelta(animal,anchor.x-animal.x,anchor.y-animal.y);
    animal.flying=true;animal.perchProgress=Math.min(1,animal.perchProgress+dt/.5);
    if(animal.perchProgress>=1){animal.perched=true;animal.perch=null;animal.flying=false;animal.pause=6+random(animal)*8;}
    return;
  }
  if(!animal.perched&&!animal.perch&&animal.perchTree&&animal.perchProgress>0){
    const anchor=perchAnchor(animal.perchTree);faceDelta(animal,animal.x-anchor.x,animal.y-anchor.y);
    animal.flying=true;animal.perchProgress=Math.max(0,animal.perchProgress-dt/.5);
    if(animal.perchProgress<=0)animal.perchTree=null;
    return;
  }
  if(animal.pause>0){animal.pause=Math.max(0,animal.pause-dt);return;}
  if(!animal.path.length) {
    if(animal.mode==='returning'){rest(animal);return;}
    if(animal.bumpPending&&animal.bumpTree){animal.bumpPending=false;animal.bumpAge=.001;animal.direction='side';animal.facing=animal.bumpTree.y+1>animal.y?1:-1;return;}
    if(animal.perch){animal.perched=true;animal.perch=null;animal.perchProgress=1;animal.flying=false;animal.pause=6+random(animal)*8;return;}
    const departingPerch=animal.perched&&!!animal.perchTree;
    animal.flying=false;animal.sleeping=false;animal.perched=false;animal.running=false;
    if(!departingPerch&&!raining&&animal.trees.length) {
      const tree=animal.trees[Math.floor(random(animal)*animal.trees.length)]!;
      // Most residents cannot interact with trees. Keep their RNG sequence,
      // but skip the candidate sort/BFS they previously paid on every decision.
      const door=flyingPet(animal.species)||animal.species==='capybara'&&!animal.fruitTime&&!animal.bumpCooldown?treeDoor(animal,tree):null;
      if(door&&flyingPet(animal.species)&&random(animal)<.3){animal.path=route(animal,key(Math.floor(door.x),Math.floor(door.y)));animal.perch=door;animal.perchTree=tree;animal.perchProgress=0;animal.flying=animal.path.length>0;animal.flightAge=0;return;}
      const fruit=tree.blueprintId as 'lemon'|'apple'|'cherry';
      const fruitSeason=fruit==='lemon'||(fruit==='apple'||fruit==='cherry')&&(weather.season==='summer'||weather.season==='autumn');
      if(door&&animal.species==='capybara'&&!animal.fruitTime&&!animal.bumpCooldown&&fruitSeason&&random(animal)<.18){animal.bumpTree=tree;animal.fruit=fruit;animal.bumpPending=true;animal.path=route(animal,key(Math.floor(door.x),Math.floor(door.y)));return;}
    }
    if(!context.follow&&behavior.napChance&&!raining&&random(animal)<behavior.napChance){animal.sleeping=true;animal.pause=8+random(animal)*14;return;}
    if(context.target)animal.path=pathNear(animal,context.target)??[];
    else {
      const center=context.roamCenter??animal.home;
      // Only cells in the animal's own connected area; the rest can never be routed to.
      const here=areaAt(animal.allowed,Math.floor(animal.x),Math.floor(animal.y));
      const reachable=(p:{x:number;y:number})=>here<0||areaAt(animal.allowed,Math.floor(p.x),Math.floor(p.y))===here;
      let choices=navigationCells(animal.allowed).filter(p=>Math.hypot(p.x-center.x,p.y-center.y)<=(waterBird(animal.species)?6:4)&&reachable(p));
      // Home may lie beyond its own walled-off ring: roam the reachable cells nearest it instead.
      if(!choices.length)choices=navigationCells(animal.allowed).filter(reachable).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)).slice(0,6);
      const target=choices[Math.floor(random(animal)*choices.length)];if(!target){animal.pause=1;return;}
      animal.path=route(animal,target.key);
    }
    if(animal.species==='goose'&&!raining&&animal.path.length>=2&&animal.path.length<=5&&random(animal)<.25){animal.flying=true;animal.flightAge=0;}
    if(flyingPet(animal.species)&&!raining&&animal.path.length>=2&&random(animal)<.6){animal.flying=true;animal.flightAge=0;}
    if(departingPerch){
      if(!animal.path.length){animal.perched=true;animal.flying=false;animal.pause=1;return;}
      animal.flying=true;animal.flightAge=0;return;
    }
    if(behavior.runChance&&!context.escort&&!context.follow&&random(animal)<behavior.runChance)animal.running=true;
    if(!animal.path.length){animal.pause=context.follow?.2:1;return;}
  }
  const target=animal.path[0]!,dx=target.x-animal.x,dy=target.y-animal.y,distance=Math.hypot(dx,dy);
  const swimming=isAnimalWater(animalHabitat(animal.mapId).terrainAt(Math.floor(animal.x),Math.floor(animal.y)));
  const speed=context.escort?.42:animal.flying?2.3:swimming?.55:ANIMAL_SPEED[animal.species]*(animal.running?1.8:context.follow?1.2:context.formation?.85:1);
  face(animal,target);
  if(distance<=speed*dt){animal.x=target.x;animal.y=target.y;animal.path.shift();if(!animal.path.length){if(animal.perch){animal.flying=true;animal.pause=0;}else{animal.flying=false;if(animal.mode==='returning')rest(animal);else animal.pause=context.follow?.15:behavior.pause[0]+random(animal)*(behavior.pause[1]-behavior.pause[0]);}}}
  else {animal.x+=dx/distance*speed*dt;animal.y+=dy/distance*speed*dt;}
}

/** Find a connected legal waypoint near a companion; never cut through scenery. */
function pathNear(animal:AnimalResident,target:Point):Point[]|null {
  // The eight cells nearest the target, ties in cell order, without sorting the whole walkable set.
  const nearest:{cell:{key:string;x:number;y:number};d:number}[]=[];
  for(const cell of navigationCells(animal.allowed)){
    const d=Math.hypot(cell.x-target.x,cell.y-target.y);
    if(nearest.length===8&&d>=nearest[7]!.d)continue;
    let at=nearest.length;while(at>0&&nearest[at-1]!.d>d)at--;
    nearest.splice(at,0,{cell,d});if(nearest.length>8)nearest.pop();
  }
  for(const {cell} of nearest){
    const path=route(animal,cell.key);
    if(path.length)return path;
    if(key(Math.floor(animal.x),Math.floor(animal.y))===cell.key)return Math.hypot(cell.x-animal.x,cell.y-animal.y)>.05?[{x:cell.x,y:cell.y}]:[];
  }
  return null;
}
function formationPoint(leader:AnimalResident,rank:number):Point {
  const anchor=leader.trail[Math.max(0,leader.trail.length-2-Math.floor(rank/2))]??leader;
  const side=rank%2?.65:-.65;
  return leader.direction==='side'?{x:anchor.x+side,y:anchor.y}:{x:anchor.x,y:anchor.y+side};
}
/** Advance leaders before followers. Herd assignments are shared with authoritative garden encounter checks. */
export function stepAnimalResidents(residents:AnimalResident[],delta:number,weather:AnimalWeather,reducedMotion=false):void {
  const groups=new Map<string,AnimalResident[]>(),contexts=new Map<string,AnimalContext>();
  for(const animal of residents){const id=`${animal.hostId}:${animal.species}`;const group=groups.get(id)??[];group.push(animal);groups.set(id,group);animal.herderId=null;animal.heart=0;}
  const herdGroups=[...groups.values()];
  const reserved=new Set<string>();
  for(const dog of residents.filter(a=>a.species==='border-collie'||a.species==='australian-cattle-dog').sort((a,b)=>a.id.localeCompare(b.id))){
    const sheepGroups=herdGroups.filter(group=>group[0]!.mapId===dog.mapId&&(dog.species==='border-collie'?group[0]!.species==='sheep':['dairy-cow','highland-cow'].includes(group[0]!.species)));
    if(animalInactive(dog.species,weather)||weather.precipitation==='rain'){dog.herding=null;continue;}
    const job=dog.herding??{hosts:[],target:null,center:{x:dog.x,y:dog.y}};
    job.hosts=job.hosts.filter(host=>sheepGroups.some(group=>group[0]!.hostId===host)&&!reserved.has(host));
    const members=sheepGroups.filter(group=>job.hosts.includes(group[0]!.hostId)).flat();
    // Formation ranks trail further behind the dog, so a long flock is not lagging merely by standing in place.
    // The dog waits for its farthest straggler while it keeps closing in; one that makes no progress for
    // ten seconds is excused until it catches up, so it never freezes the herd yet the dog still waits for the others.
    const gaps=members.map((sheep,rank)=>({id:sheep.id,gap:Math.hypot(sheep.x-dog.x,sheep.y-dog.y)-(3.7+Math.floor(rank/2))}));
    job.excused=(job.excused??[]).filter(id=>gaps.some(g=>g.id===id&&g.gap>0));
    const straggler=gaps.filter(g=>g.gap>0&&!job.excused!.includes(g.id)).sort((a,b)=>b.gap-a.gap)[0];
    if(!straggler)job.waiting=null;
    else{
      if(job.waiting?.id!==straggler.id||straggler.gap<job.waiting.gap-.25)job.waiting={id:straggler.id,seconds:0,gap:straggler.gap};
      job.waiting.seconds+=Math.min(.05,Math.max(0,delta));
      if(job.waiting.seconds>=10){job.excused.push(straggler.id);job.waiting=null;}
    }
    const lagging=!!job.waiting;
    if(job.target&&!sheepGroups.some(group=>group[0]!.hostId===job.target&&!reserved.has(job.target!)))job.target=null;
    if(!job.target){
      const candidates=sheepGroups.filter(group=>!job.hosts.includes(group[0]!.hostId)&&!reserved.has(group[0]!.hostId))
        .sort((a,b)=>Math.hypot(a[0]!.x-dog.x,a[0]!.y-dog.y)-Math.hypot(b[0]!.x-dog.x,b[0]!.y-dog.y));
      const next=candidates.find(group=>pathNear(dog,group[0]!)!==null);
      job.target=next?.[0]?.hostId??null;
      if(next){dog.path=[];dog.pause=0;}
    }
    const target=sheepGroups.find(group=>group[0]!.hostId===job.target);
    // Arrive when close, or when the paths cannot bring the dog any closer (checked only as it decides, not every paused frame).
    if(target&&!lagging&&(Math.hypot(dog.x-target[0]!.x,dog.y-target[0]!.y)<1.5||!dog.path.length&&dog.pause<=0&&pathNear(dog,target[0]!)?.length===0)){
      job.hosts.push(target[0]!.hostId);job.target=null;job.center={x:dog.x,y:dog.y};dog.path=[];dog.pause=.3;
    }
    dog.herding=job.hosts.length||job.target?job:null;
    for(const host of job.hosts)reserved.add(host);if(job.target)reserved.add(job.target);
    const flock=sheepGroups.filter(group=>job.hosts.includes(group[0]!.hostId)).flat();
    if(dog.herding)contexts.set(dog.id,{...(target?{target:target[0]!}:{roamCenter:job.center}),escort:flock.length>0,wait:lagging});
    flock.forEach((sheep,rank)=>{sheep.herderId=dog.id;contexts.set(sheep.id,{target:formationPoint(dog,rank),follow:true,formation:true});
      const phase=(sheep.clock+rank*.45+8)%18;if(!reducedMotion&&Math.hypot(sheep.x-dog.x,sheep.y-dog.y)<3&&phase<2.2)sheep.heart=Math.sin(phase/2.2*Math.PI);
    });
  }
  const ordered=[...residents].sort((a,b)=>(['border-collie','australian-cattle-dog'].includes(a.species)?-1:0)-(['border-collie','australian-cattle-dog'].includes(b.species)?-1:0)||a.ordinal-b.ordinal);
  for(const animal of ordered){
    let context=contexts.get(animal.id)??{};
    const behavior=ANIMAL_BEHAVIOR[animal.species],group=groups.get(`${animal.hostId}:${animal.species}`)!;
    if(!animal.herderId&&behavior.group!=='solo'&&group.length>1){
      const leader=behavior.group==='pairs'?group[Math.floor(animal.ordinal/2)*2]!:group[0]!;
      if(leader!==animal){
        const target=behavior.group==='line'?leader.trail[Math.max(0,leader.trail.length-1-animal.ordinal)]??leader:
          {x:leader.x+Math.sin(animal.ordinal*2.4)*behavior.spacing,y:leader.y+Math.cos(animal.ordinal*2.4)*behavior.spacing};
        context={target,follow:true};
      }
    }
    if(animal.mode==='returning'||animalInactive(animal.species,weather)||weather.precipitation==='rain'&&shelterFromRain(animal.species))context={};
    stepAnimal(animal,delta,weather,reducedMotion,context);
    const point={x:Math.floor(animal.x)+.5,y:Math.floor(animal.y)+.5},last=animal.trail.at(-1)!;
    if(point.x!==last.x||point.y!==last.y){animal.trail.push(point);if(animal.trail.length>40)animal.trail.shift();}
  }
}
/** Capybara logical poses: idle 0, sleep 1, dedicated side-walk sprites 2–3. */
export function animalPoseFrame(animal:Pick<AnimalResident,'species'|'sleeping'|'flying'|'path'|'pause'|'clock'>):0|1|2|3 {
  if(animal.species==='capybara') {
    if(animal.sleeping)return 1;
    if(animal.path.length>0&&animal.pause<=0)return Math.floor(animal.clock*2)%2===1?3:2;
    return 0;
  }
  if(animal.flying)return Math.floor(animal.clock*10)%2===1?1:0;
  return animal.path.length>0&&animal.pause<=0&&Math.floor(animal.clock*5)%2===1?1:0;
}
/** The front/back sheets contain only upright standing/stepping frames. */
export function animalDirectionalFrame(animal:Pick<AnimalResident,'species'|'sleeping'|'path'|'pause'|'clock'>):0|1 {
  return !animal.sleeping&&animal.path.length>0&&animal.pause<=0&&Math.floor(animal.clock*(animal.species==='capybara'?2:5))%2===1?1:0;
}
