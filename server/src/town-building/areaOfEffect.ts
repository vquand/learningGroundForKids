import {mapDefinition} from './maps/registry.ts';
import type {MapId,MapTerrain} from './maps/types.ts';

/** Every area effect covers whole tiles of one terrain: a tile is either fully
 * in (same buff/debuff as any other covered tile) or fully out. Land effects
 * never spill onto water and water effects never spill onto land. */
export type AreaTerrain='land'|'water';
export interface TileFootprint{x:number;y:number;width:number;length:number}
export const tileKey=(x:number,y:number)=>`${x}:${y}`;
export const terrainKind=(terrain:MapTerrain):AreaTerrain|null=>terrain==='grass'?'land':terrain==='river'||terrain==='shallow'||terrain==='deep'?'water':null;

const areas=new Map<string,ReadonlySet<string>>();
/** Tiles whose centre lies within `radius` of the source footprint's centre.
 * Terrain is fixed per map, so areas are cached by source placement. */
export function radiusArea(mapId:MapId,source:TileFootprint,radius:number,terrain:AreaTerrain):ReadonlySet<string>{
    const id=`${mapId}:${source.x}:${source.y}:${source.width}:${source.length}:${radius}:${terrain}`,cached=areas.get(id);
    if(cached)return cached;
    const map=mapDefinition(mapId),cx=source.x+source.width/2,cy=source.y+source.length/2,cells=new Set<string>();
    for(let x=Math.max(0,Math.floor(cx-radius));x<Math.min(map.rows,Math.ceil(cx+radius));x++)
        for(let y=Math.max(0,Math.floor(cy-radius));y<Math.min(map.columns,Math.ceil(cy+radius));y++)
            if(Math.hypot(x+.5-cx,y+.5-cy)<=radius&&terrainKind(map.terrainAt(x,y))===terrain)cells.add(tileKey(x,y));
    areas.set(id,cells);
    return cells;
}
/** An object is affected when any tile it stands on is a covered tile. */
export function footprintInArea(cells:ReadonlySet<string>,footprint:TileFootprint):boolean{
    for(let x=footprint.x;x<footprint.x+footprint.width;x++)for(let y=footprint.y;y<footprint.y+footprint.length;y++)if(cells.has(tileKey(x,y)))return true;
    return false;
}

/** The one registry of every area buff/debuff, for all buildings, animals and
 * maps. `targets` is a strict whitelist: anything not listed (for example the
 * Fish home raft or river baskets) is never affected, wherever it stands. */
export const AREA_EFFECTS={
    'chicken-crop-boost':{kind:'buff',terrain:'land',reach:'radius 4',sources:['coop:chicken'],targets:['vegetable-patch']},
    'insect-crop-wither':{kind:'debuff',terrain:'land',reach:'radius 4',sources:['insect-raiser','floating-insect-raiser'],targets:['vegetable-patch']},
    'insect-egg-boost':{kind:'buff',terrain:'land',reach:'radius 4',sources:['insect-raiser'],targets:['coop']},
    'fish-feeding':{kind:'buff',terrain:'water',reach:'radius 4',sources:['insect-raiser','floating-insect-raiser','feeder'],targets:['nursery']},
    'floating-plant-wither':{kind:'debuff',terrain:'water',reach:'radius 4',sources:['floating-insect-raiser'],targets:['floating-garden']},
    'duck-raft-help':{kind:'buff',terrain:'water',reach:'cone of 18 tiles',sources:['coop:duck'],targets:['nursery','floating-garden']},
    // Contact effects: an animal standing on the target's tiles.
    'duck-crop-boost':{kind:'buff',terrain:'land',reach:'contact',sources:['animal:duck'],targets:['vegetable-patch']},
    'animal-poop-boost':{kind:'buff',terrain:'land',reach:'contact',sources:['animal:pig','animal:highland-cow'],targets:['vegetable-patch']},
    'grazing-bite':{kind:'debuff',terrain:'land',reach:'contact',sources:['animal:dairy-cow','animal:highland-cow','animal:sheep','animal:capybara'],targets:['vegetable-patch']},
} as const satisfies Record<string,{kind:'buff'|'debuff';terrain:AreaTerrain;reach:string;sources:readonly string[];targets:readonly string[]}>;
export type AreaEffectId=keyof typeof AREA_EFFECTS;
/** Whether `blueprintId` may receive the effect at all (before any area check). */
export const affects=(effect:AreaEffectId,blueprintId:string)=>(AREA_EFFECTS[effect].targets as readonly string[]).includes(blueprintId);
/** Whether `source` (a blueprint id, `coop:<animal>` or an attachment) emits the effect. */
export const emits=(effect:AreaEffectId,source:string)=>(AREA_EFFECTS[effect].sources as readonly string[]).includes(source);
