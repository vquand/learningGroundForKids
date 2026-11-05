import {BLUEPRINTS,placementError,type Direction,type TownState} from '../game.ts';
import {raftPlacementError} from '../water/rules.ts';
import {landView} from './view.ts';
import type {MapId} from './types.ts';

/** Only blueprints that list their maps are restricted (Town Hall belongs to Town). */
export function blueprintMapError(blueprintId:string,mapId:MapId):string|null {
    const maps=BLUEPRINTS.find(b=>b.id===blueprintId)?.maps;
    return maps&&!maps.includes(mapId)?'This building can only be built in Town.':null;
}

/** Land placement on any map: terrain, reserved tiles, buildings, water structures
 * and the shore access a Fish home raft needs. */
export function landObstruction(state:TownState,mapId:MapId,b:typeof BLUEPRINTS[number],x:number,y:number,ignoreId?:string,direction:Direction='front') {
    const view=landView(state,mapId),rafts=view.rafts??[];
    const error=blueprintMapError(b.id,mapId)??placementError(view.entities,mapId,b,x,y,ignoreId,rafts,direction);if(error)return error;
    const draft={...view,entities:[...view.entities.filter(e=>e.id!==ignoreId),{id:'placement-preview',blueprintId:b.id,x,y,paidCost:{},...(direction==='front'?{}:{direction})}]};
    for(const raft of rafts)if(raft.blueprintId==='friendly'&&raft.fish.length) {
        const accessError=raftPlacementError(draft,mapId,raft,raft.x,raft.y);if(accessError)return accessError;
    }
    return null;
}
