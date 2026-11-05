import {BLUEPRINTS,entityFootprint,animalSpecies,type Entity} from '../game.ts';
import {mapDefinition} from '../maps/registry.ts';
import {connectedHabitat} from '../maps/animalHabitat.ts';
import {affects,emits,terrainKind,tileKey,type TileFootprint} from '../areaOfEffect.ts';
import type {MapId} from '../maps/types.ts';
import {LAKE_BLUEPRINTS,LAKE_GROW_SECONDS} from './catalog.ts';
import {raftFootprint} from './behavior.ts';
import type {LakeRaft} from './types.ts';

/** One map's land and water contents; every duck rule takes it explicitly. */
export interface WaterWorld{mapId:MapId;entities:readonly Entity[];rafts:readonly LakeRaft[]}
export interface DuckPoint{x:number;y:number}
/** A raft inside a water-duty coop's area grows this much sooner, once per cycle. */
export const DUCK_HELP_SECONDS=30;
export const duckRaftNeedsHelp=(raft:LakeRaft)=>raft.fish.some(f=>f.growth<LAKE_GROW_SECONDS&&!f.duckBoosted)||!!raft.plant&&raft.plantGrowth<LAKE_GROW_SECONDS&&!raft.duckBoosted;
export const duckCoops=(entities:readonly Entity[])=>entities.filter(e=>e.blueprintId==='coop'&&animalSpecies(e)==='duck');
export const DUCK_HELP_TILES=18;
const DUCK_CONE_TAPER=1.5;
/** Open ground ducks may cross: every cell except building footprints (roads,
 * gardens and fences stay walkable) and, optionally, floating structures. */
export function duckOpenCells(mapId:MapId,entities:readonly Entity[],floating:readonly TileFootprint[]=[]):Set<string>{
    const map=mapDefinition(mapId),open=new Set<string>();
    for(let x=0;x<map.rows;x++)for(let y=0;y<map.columns;y++)open.add(tileKey(x,y));
    const block=(f:TileFootprint)=>{for(let x=f.x;x<f.x+f.width;x++)for(let y=f.y;y<f.y+f.length;y++)open.delete(tileKey(x,y));};
    for(const entity of entities){const b=BLUEPRINTS.find(b=>b.id===entity.blueprintId);if(b&&!['road','garden','fence'].includes(b.kind))block(entityFootprint(entity));}
    floating.forEach(block);
    return open;
}
/** The coop's first open doorstep, checked in a fixed order on every map. */
export function duckDoorstep(coop:Entity,open:ReadonlySet<string>):{x:number;y:number}|null{
    const points=[{x:coop.x+2.5,y:coop.y+1},{x:coop.x+1,y:coop.y+2.5},{x:coop.x-.5,y:coop.y+1},{x:coop.x+1,y:coop.y-.5}];
    return points.find(p=>open.has(tileKey(Math.floor(p.x),Math.floor(p.y))))??null;
}
/** A duck coop's growth-help area on any map: the closest reachable water tiles
 * (river, shallow or deep), grown best-first from the shore so it stays
 * connected and cone-shaped — widest against the coop, narrowing into the
 * water. Floating structures sit inside it; they never reshape it. */
export function duckHelpArea(mapId:MapId,coop:Entity,entities:readonly Entity[],floating:readonly TileFootprint[]=[]):Set<string>{
    // A command or tick asks for the same coop several times with unchanged surroundings.
    const key=[mapId,coop.x,coop.y,coop.blueprintId,animalSpecies(coop),entities.some(e=>e.id===coop.id),entities.filter(e=>e!==coop&&e.id!==coop.id).map(e=>`${e.blueprintId}@${e.x},${e.y}`).join(';'),floating.map(f=>`${f.x},${f.y},${f.width},${f.length}`).join(';')].join('|');
    const known=areaCache.get(key);
    if(known){areaCache.delete(key);areaCache.set(key,known);return known;}
    const area=computeDuckHelpArea(mapId,coop,entities,floating);
    areaCache.set(key,area);if(areaCache.size>AREA_CACHE_SIZE)areaCache.delete(areaCache.keys().next().value!);
    return area;
}
const areaCache=new Map<string,Set<string>>(),AREA_CACHE_SIZE=64;
function computeDuckHelpArea(mapId:MapId,coop:Entity,entities:readonly Entity[],floating:readonly TileFootprint[]):Set<string>{
    const coverage=new Set<string>();
    if(coop.blueprintId!=='coop'||!emits('duck-raft-help',`coop:${animalSpecies(coop)}`))return coverage;
    const map=mapDefinition(mapId);
    const water=(x:number,y:number)=>x>=0&&y>=0&&x<map.rows&&y<map.columns&&terrainKind(map.terrainAt(x,y))==='water';
    const seeds:{x:number;y:number}[]=[];
    for(let x=coop.x;x<coop.x+2;x++)for(const y of [coop.y-1,coop.y+2])if(water(x,y))seeds.push({x,y});
    for(let y=coop.y;y<coop.y+2;y++)for(const x of [coop.x-1,coop.x+2])if(water(x,y))seeds.push({x,y});
    if(!seeds.length)return coverage;
    const door=duckDoorstep(coop,duckOpenCells(mapId,entities,floating));if(!door)return coverage;
    const open=duckOpenCells(mapId,entities),reachable=connectedHabitat([door],(x,y)=>open.has(tileKey(x,y)));
    const passable=(x:number,y:number)=>water(x,y)&&reachable.has(tileKey(x,y));
    const cx=coop.x+1,cy=coop.y+1;let ax=0,ay=0;
    for(const seed of seeds){ax+=seed.x+.5-cx;ay+=seed.y+.5-cy;}
    if(!Math.hypot(ax,ay)){ax=seeds[0]!.x+.5-cx;ay=seeds[0]!.y+.5-cy;}
    const length=Math.hypot(ax,ay);ax/=length;ay/=length;
    const along=(x:number,y:number)=>(x+.5-cx)*ax+(y+.5-cy)*ay;
    // The cone's base spans the 2-tile coop; each tile sideways costs more than a tile outward.
    const score=(x:number,y:number)=>along(x,y)+DUCK_CONE_TAPER*Math.max(0,Math.abs((x+.5-cx)*ay-(y+.5-cy)*ax)-1);
    type Cell={x:number;y:number;score:number;distance:number};
    const frontier=new Map<string,Cell>();
    const offer=(x:number,y:number)=>{const k=tileKey(x,y);if(coverage.has(k)||frontier.has(k)||!passable(x,y)||along(x,y)<=0)return;frontier.set(k,{x,y,score:score(x,y),distance:Math.hypot(x+.5-cx,y+.5-cy)});};
    for(const seed of seeds)offer(seed.x,seed.y);
    while(coverage.size<DUCK_HELP_TILES&&frontier.size){
        let best:[string,Cell]|null=null;
        for(const entry of frontier){const [k,c]=entry;if(!best||c.score<best[1].score-1e-9||Math.abs(c.score-best[1].score)<1e-9&&(c.distance<best[1].distance||c.distance===best[1].distance&&k<best[0]))best=entry;}
        const [k,{x,y}]=best!;frontier.delete(k);coverage.add(k);
        for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])offer(x+dx!,y+dy!);
    }
    return coverage;
}

/** Ducks only help whitelisted rafts floating inside their coop's area. */
export function duckRaftInRange(coverage:ReadonlySet<string>,raft:LakeRaft){
    if(!affects('duck-raft-help',raft.blueprintId))return false;
    const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!;
    for(let x=raft.x;x<raft.x+b.width;x++)for(let y=raft.y;y<raft.y+b.length;y++)if(coverage.has(tileKey(x,y)))return true;
    return false;
}
export const duckHelpCoverage=(world:WaterWorld,coop:Entity)=>duckHelpArea(world.mapId,coop,world.entities,world.rafts.map(raftFootprint));
/** Water duty when the coop's area holds something ducks can help; otherwise the
 * flock roams the land and helps crops instead. */
export function duckDuty(world:WaterWorld,coop:Entity):'water'|'land'{
    const area=duckHelpCoverage(world,coop);
    return area.size&&world.rafts.some(raft=>duckRaftInRange(area,raft))?'water':'land';
}
/** Where a water-duty flock may swim: its area plus the coop's open doorstep,
 * so it shelters at home and otherwise stays on its water. */
export function duckWaterRange(world:WaterWorld,coop:Entity,blockRafts=true):Set<string>{
    const open=duckOpenCells(world.mapId,world.entities,blockRafts?world.rafts.map(raftFootprint):[]),range=new Set<string>();
    for(const cell of duckHelpCoverage(world,coop))if(open.has(cell))range.add(cell);
    for(let x=coop.x-1;x<=coop.x+2;x++)for(let y=coop.y-1;y<=coop.y+2;y++)if(open.has(tileKey(x,y)))range.add(tileKey(x,y));
    return range;
}
export function duckPath(allowed:ReadonlySet<string>,from:DuckPoint,to:DuckPoint):DuckPoint[]|null{
    const start=tileKey(Math.floor(from.x),Math.floor(from.y)),target=tileKey(Math.floor(to.x),Math.floor(to.y));
    if(!allowed.has(start)||!allowed.has(target))return null;
    const queue=[start],parents=new Map<string,string|null>([[start,null]]);
    for(let i=0;i<queue.length&&!parents.has(target);i++){
        const [x,y]=queue[i]!.split(':').map(Number);
        for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const next=tileKey(x!+dx!,y!+dy!);if(allowed.has(next)&&!parents.has(next)){parents.set(next,queue[i]!);queue.push(next);}}
    }
    if(!parents.has(target))return null;
    const route:DuckPoint[]=[];let cell:string|null=target;
    while(cell){const [x,y]=cell.split(':').map(Number);route.unshift({x:x!+.5,y:y!+.5});cell=parents.get(cell)!;}
    return route;
}
