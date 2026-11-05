import type {MapTerrain} from '../types.ts';
/** Two columns across by three rows vertically. */
export const LAKE_ISLAND={x:9,y:22,width:3,length:2} as const;

/** Stable, uneven shelves: varying run lengths keep one connected deep body.
 * Shared by placement, habitat checks and painting so water never changes on
 * reload and the visible depth boundary is also the authoritative boundary. */
const DEEP_LEFT=[11,11,10,10,10,9,9,9,10,10,11,11,11,10,10,9,9,10,10,11] as const;
const DEEP_RIGHT=[29,30,30,31,31,30,30,29,29,30,30,31,31,30,30,29,29,30,31,30] as const;
export function lakeDeepWaterSpan(row:number):readonly [number,number] {
    return [DEEP_LEFT[row]??10,DEEP_RIGHT[row]??30];
}

/** Logical rows run vertically; columns run left to right, as in Town. */
export function lakeTerrainAt(x:number,y:number):MapTerrain {
    if(x>=LAKE_ISLAND.x&&x<LAKE_ISLAND.x+LAKE_ISLAND.width&&y>=LAKE_ISLAND.y&&y<LAKE_ISLAND.y+LAKE_ISLAND.length)return 'grass';
    if(x>=15&&x<18&&(y<10||y>=37))return 'river';
    if(y<7)return 'grass';
    const [left,right]=lakeDeepWaterSpan(x);
    if(y>=left&&y<right)return 'deep';
    return 'shallow';
}
