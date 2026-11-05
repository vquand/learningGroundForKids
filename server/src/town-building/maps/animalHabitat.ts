import {FOREST_DEPTH,SCENERY_SIDE,FOREST_TREES,animalTerrainAt,forestTrunkAt} from '../forestWorld.ts';
import {mapDefinition} from './registry.ts';
import type {MapId,MapTerrain} from './types.ts';

export const isAnimalWater=(terrain:string)=>['river','shallow','deep'].includes(terrain);

/** Cardinally connected habitat, independent of species, maps and rewards. */
export function connectedHabitat(seeds:readonly {x:number;y:number}[],passable:(x:number,y:number)=>boolean):Set<string>{
    const cells=new Set<string>(),queue:{x:number;y:number}[]=[];
    const add=(x:number,y:number)=>{const key=`${x}:${y}`;if(passable(x,y)&&!cells.has(key)){cells.add(key);queue.push({x,y});}};
    for(const seed of seeds)add(Math.floor(seed.x),Math.floor(seed.y));
    for(let i=0;i<queue.length;i++){
        const {x,y}=queue[i]!;
        for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])add(x+dx!,y+dy!);
    }
    return cells;
}

/** Map-owned scenery is a habitat capability, never a different animal type. */
function createHabitat(mapId:MapId) {
    const map=mapDefinition(mapId),forest=mapId==='town';
    return {
        map,
        minX:forest?-FOREST_DEPTH:0,minY:forest?-SCENERY_SIDE:0,
        maxX:map.rows+(forest?FOREST_DEPTH:0),maxY:map.columns+(forest?SCENERY_SIDE:0),
        trees:forest?FOREST_TREES:[],
        blockedAt:(x:number,y:number)=>forest&&forestTrunkAt(x,y),
        terrainAt:(x:number,y:number):MapTerrain|'outside'=>{
            if(forest)return animalTerrainAt(x,y);
            return x<0||y<0||x>=map.rows||y>=map.columns?'outside':map.terrainAt(x,y);
        },
    };
}
const habitats=new Map<MapId,ReturnType<typeof createHabitat>>();
export function animalHabitat(mapId:MapId='town') {
    let habitat=habitats.get(mapId);
    if(!habitat){habitat=createHabitat(mapId);habitats.set(mapId,habitat);}
    return habitat;
}
