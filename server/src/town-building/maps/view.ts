import {storageBuildings} from '../storage.ts';
import {eventBuildingExpired,expireEventBuildings,type TownState} from '../game.ts';
import type {LakeState} from './lake/types.ts';
import type {MapId} from './types.ts';

export function requireLake(state:TownState):LakeState {
    if(!state.maps?.lake)throw new Error('Reach Flower prosperity to unlock the lake.');
    return state.maps.lake;
}
/** One map's contents as a TownState-shaped view, so every land and water rule
 * runs unchanged on any map. Town contents live at the root; other maps keep
 * theirs under `maps`. Shared roots (materials, earned, history) stay shared. */
export function landView(state:TownState,mapId:MapId):TownState {
    if(mapId==='town')return state;
    const lake=requireLake(state),land=lake.land;
    const view:TownState={...state,storageBuildingCount:storageBuildings(state),entities:land.entities,rafts:lake.rafts};
    delete view.droppings;delete view.bushes;
    if(land.droppings)view.droppings=land.droppings;
    if(land.bushes)view.bushes=land.bushes;
    delete view.civ;delete view.gardening;delete view.halloween;delete view.events;
    if(land.civ)view.civ=land.civ;
    if(land.gardening)view.gardening=land.gardening;
    if(land.events)view.events=land.events;
    if(land.halloween)view.halloween=land.halloween;
    return view;
}
/** Write a view back: its map contents return to their map, shared roots to the root. */
export function mergeLand(state:TownState,view:TownState,mapId:MapId='lake'):TownState {
    if(mapId==='town')return view;
    const lake=requireLake(view);
    const next:TownState={...view,maps:{...view.maps,lake:{...lake,rafts:view.rafts??[],land:{entities:view.entities,...(view.droppings?{droppings:view.droppings}:{}),...(view.bushes?{bushes:view.bushes}:{}),
        ...(view.civ?{civ:view.civ}:{}),...(view.gardening?{gardening:view.gardening}:{}),
        ...(view.events?{events:view.events}:{}),...(view.halloween?{halloween:view.halloween}:{})}}}};
    next.entities=state.entities;
    delete next.storageBuildingCount;
    for(const key of ['droppings','bushes','rafts','civ','gardening','events','halloween'] as const){if(state[key])(next as unknown as Record<string,unknown>)[key]=state[key];else delete next[key];}
    return next;
}
/** The map's water structures, creating the Town list on first use. */
export function mapRafts(state:TownState,mapId:MapId){
    if(mapId==='town')return state.rafts??=[];
    return requireLake(state).rafts;
}
/** Every map shares one clock shape: active seconds and the lease's last tick. */
export function mapClock(state:TownState,mapId:MapId){
    const fresh=()=>({lastTick:0,activeSeconds:0,harvests:0,animals:[],season:null});
    if(mapId==='town')return state.gardening??=fresh();
    const lake=requireLake(state);
    // Legacy Lake saves kept their clock beside the progress book.
    return lake.land.gardening??={...fresh(),activeSeconds:lake.activeSeconds??0};
}
/** Maps this profile has opened, for rules that span every map. */
export function openMaps(state:TownState):MapId[]{return state.maps?.lake?['town','lake']:['town'];}

/** Cleanup on reads/actions shares the tick's rule, even for a map never opened this year. */
export function expireMapEventBuildings(state:TownState,clock:{localDate?:string;timeOfDay?:string|null;weatherSource?:string}):TownState {
    const date=clock.localDate;
    if(!clock.timeOfDay||!date||clock.weatherSource==='preview'||!openMaps(state).some(id=>landView(state,id).entities.some(e=>eventBuildingExpired(e,date))))return state;
    let next=structuredClone(state);
    for(const id of openMaps(next)){const view=landView(next,id);expireEventBuildings(view,date);next=mergeLand(next,view,id);}
    return next;
}
