import {tickMap,LEASE_GAP_MS} from '../../src/town-building/mapTick.ts';
import type {GardenEnvironment} from '../../src/town-building/garden.ts';
import type {TownState} from '../../src/town-building/game.ts';
import type {MapId} from '../../src/town-building/maps/types.ts';

/** Continuous play: heartbeats every lease interval from the map's last tick to `now`. */
export function playMap(state:TownState,mapId:MapId,now:number,environment:GardenEnvironment,resume=false):TownState {
    const last=(mapId==='town'?state.gardening:state.maps?.lake?.land.gardening)?.lastTick??0;
    if(resume||!last)return tickMap(state,mapId,now,environment,resume);
    for(let at=last+LEASE_GAP_MS;at<now;at+=LEASE_GAP_MS)state=tickMap(state,mapId,at,environment);
    return tickMap(state,mapId,now,environment);
}
