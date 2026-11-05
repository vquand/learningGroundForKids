import {lakeTerrainAt} from './lake/terrain.ts';
import {waterDepth,type MapDefinition,type MapId,type PlacementHabitat} from './types.ts';

const definitions:Record<MapId,MapDefinition>={
    town:{id:'town',rows:20,columns:40,entry:{x:7,y:0},terrainAt:(x,y)=>{
        const river=15+Math.floor(y/8)%2;
        return x>=river&&x<river+3?'river':x<5&&y<8?'mountain':'grass';
    },reserved:[{x:15,y:5,width:4,length:5},{x:15,y:25,width:4,length:4}]},
    lake:{id:'lake',rows:20,columns:40,entry:{x:7,y:0},terrainAt:lakeTerrainAt},
};
export function mapDefinition(id:MapId):MapDefinition {
    const definition=definitions[id];
    if(!definition)throw new Error('Unknown Town map.');
    return definition;
}
export function mapPlacementError(map:MapDefinition,footprint:{width:number;length:number},x:number,y:number,habitat:PlacementHabitat):string|null {
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+footprint.width>map.rows||y+footprint.length>map.columns)
        return 'Keep the whole footprint inside this map.';
    for(let xx=x;xx<x+footprint.width;xx++)for(let yy=y;yy<y+footprint.length;yy++) {
        const terrain=map.terrainAt(xx,yy),land=habitat.depths.includes('grass');
        if(terrain==='mountain'||terrain==='river'&&land)return 'The river and mountains are protected scenery.';
        if(map.reserved?.some(r=>xx>=r.x&&xx<r.x+r.width&&yy>=r.y&&yy<r.y+r.length))return 'That spot is kept for the river friends.';
        const kind=waterDepth(terrain)??terrain;
        if(!habitat.depths.includes(kind))return habitat.depths.includes('grass')?'This building needs dry land.':habitat.depths.length===1&&habitat.depths[0]==='deep'?'This habitat needs deep water.':habitat.depths.length===1?'This habitat needs shallow water.':'This habitat needs lake water.';
    }
    if(habitat.shore) {
        const nearLand=(xx:number,yy:number)=>xx>=0&&yy>=0&&xx<map.rows&&yy<map.columns&&map.terrainAt(xx,yy)==='grass';
        let shore=false;
        for(let xx=x;xx<x+footprint.width;xx++)shore||=nearLand(xx,y-1)||nearLand(xx,y+footprint.length);
        for(let yy=y;yy<y+footprint.length;yy++)shore||=nearLand(x-1,yy)||nearLand(x+footprint.width,yy);
        if(!shore)return 'Place this habitat beside the shore.';
    }
    return null;
}
