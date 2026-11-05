import {LAKE_BLUEPRINTS,LAKE_FISH,FEEDING_RADIUS,type LakeFishId} from './catalog.ts';
import type {LakeRaft} from './types.ts';
import type {MapId} from '../maps/types.ts';
import {radiusArea,footprintInArea,affects,emits,type AreaTerrain,type TileFootprint} from '../areaOfEffect.ts';
export interface FishEnvironment {timeOfDay?:string|null;precipitation?:string;snowCover?:boolean}
export function fishBehavior(species:LakeFishId,environment:FishEnvironment) {
    const active=!!environment.timeOfDay&&LAKE_FISH[species].active.includes(environment.timeOfDay);
    return {active,sheltered:!active||environment.precipitation!=='none'||environment.snowCover,
        surface:active&&environment.precipitation==='none'&&!environment.snowCover};
}
export const raftFootprint=(raft:Pick<LakeRaft,'blueprintId'|'x'|'y'>):TileFootprint=>{const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!;return{x:raft.x,y:raft.y,width:b.width,length:b.length};};
/** Whole-tile area of one terrain around a water structure, on whichever map it stands. */
export const raftArea=(mapId:MapId,raft:Pick<LakeRaft,'blueprintId'|'x'|'y'>,terrain:AreaTerrain)=>radiusArea(mapId,raftFootprint(raft),FEEDING_RADIUS,terrain);
export interface AreaSource{id:string;cells:ReadonlySet<string>}
/** Fish feeding reaches water tiles only. */
export function feedingSources(rafts:readonly LakeRaft[],mapId:MapId):AreaSource[] {
    return rafts.filter(r=>r.feeder&&emits('fish-feeding','feeder')||emits('fish-feeding',r.blueprintId)).map(r=>({id:r.id,cells:raftArea(mapId,r,'water')}));
}
export function fishGrowthMultiplier(raft:Pick<LakeRaft,'blueprintId'|'x'|'y'>,sources:readonly AreaSource[]):1|1.2 {
    return affects('fish-feeding',raft.blueprintId)&&sources.some(s=>footprintInArea(s.cells,raftFootprint(raft)))?1.2:1;
}
