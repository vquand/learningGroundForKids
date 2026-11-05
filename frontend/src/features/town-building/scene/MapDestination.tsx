import {useEffect,useRef} from 'react';
import type {TownState} from '../../../../../server/src/town-building/game';
import type {Environment} from '../../../../../server/src/town-building/environment';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import {mapDefinition} from '../../../../../server/src/town-building/maps/registry';
import {landView} from '../../../../../server/src/town-building/maps/view';
import {terrainKind} from '../../../../../server/src/town-building/areaOfEffect';
import {LAKE_BLUEPRINTS} from '../../../../../server/src/town-building/water/catalog';
import {drawTownBuilding} from '../buildingRender';
import {TERRAIN_PALETTES} from '../terrainStyle';
import {uiMessage} from '../../../i18n/uiText';

/** A small picker of any map, for moving a building there. */
export function MapDestination({state,mapId,mapName,images,environment,position,onPick,footprint={width:2,length:3}}:{state:TownState;mapId:MapId;mapName:string;images:Map<string,HTMLImageElement>;environment:Environment;position:{x:number;y:number};onPick:(x:number,y:number)=>void;footprint?:{width:number;length:number}}) {
    const ref=useRef<HTMLCanvasElement>(null),map=mapDefinition(mapId),tile=16;
    useEffect(()=>{
        const canvas=ref.current!,ctx=canvas.getContext('2d')!,view=landView(state,mapId),palette=TERRAIN_PALETTES[environment.season];
        ctx.clearRect(0,0,canvas.width,canvas.height);
        for(let x=0;x<map.rows;x++)for(let y=0;y<map.columns;y++){const terrain=map.terrainAt(x,y),kind=terrainKind(terrain);ctx.fillStyle=kind==='land'?palette.ground:kind==='water'?palette.water:palette.mountain;ctx.fillRect(y*tile,x*tile,tile,tile);}
        ctx.fillStyle='#8a6a4a88';
        for(const raft of view.rafts??[]){const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!;ctx.fillRect(raft.y*tile,raft.x*tile,b.length*tile,b.width*tile);}
        for(const entity of view.entities)drawTownBuilding(ctx,images,entity,environment,tile,0,0,view.entities);
        ctx.strokeStyle='#7b4c33';ctx.lineWidth=3;ctx.strokeRect(position.y*tile,position.x*tile,footprint.length*tile,footprint.width*tile);
    },[state,mapId,images,environment,position,footprint.width,footprint.length]);
    return <canvas ref={ref} width={map.columns*tile} height={map.rows*tile} className="lake-destination-map" tabIndex={0} aria-label={uiMessage('Choose a destination in {map}',{map:mapName})}
      onKeyDown={e=>{const d:Record<string,number[]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};if(d[e.key]){e.preventDefault();onPick(Math.max(0,Math.min(map.rows-footprint.width,position.x+d[e.key]![0]!)),Math.max(0,Math.min(map.columns-footprint.length,position.y+d[e.key]![1]!)));}}}
      onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onPick(Math.min(map.rows-1,Math.floor((e.clientY-r.top)/r.height*map.rows)),Math.min(map.columns-1,Math.floor((e.clientX-r.left)/r.width*map.columns)));}}/>;
}
