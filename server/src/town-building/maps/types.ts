export const MAP_IDS=['town','lake'] as const;
export type MapId=typeof MAP_IDS[number];
export type MapTerrain='grass'|'river'|'mountain'|'shallow'|'deep';
export interface MapDefinition {
    id:MapId; rows:number; columns:number;
    entry:{x:number;y:number};
    terrainAt:(x:number,y:number)=>MapTerrain;
    /** Tiles held by map fixtures (river basket, friend takeaway raft); nothing is built there. */
    reserved?:readonly {x:number;y:number;width:number;length:number}[];
}
/** Water depth for habitats: a river is shallow water on every map. */
export const waterDepth=(terrain:MapTerrain):'shallow'|'deep'|null=>terrain==='deep'?'deep':terrain==='shallow'||terrain==='river'?'shallow':null;
export interface PlacementHabitat {depths:readonly MapTerrain[];shore?:boolean}
