import {entityFootprint,animalSpecies,type Entity,type TownState} from './game.ts';
import {radiusArea,footprintInArea,affects,emits,type TileFootprint} from './areaOfEffect.ts';
import {raftArea} from './water/behavior.ts';
import type {MapId} from './maps/types.ts';
import {landView} from './maps/view.ts';

export const CHICKEN_RADIUS=4;
export const EGG_CAPACITY=24;
export const EGG_SECONDS=6*60*60;
export interface CoopEggs{eggs:number;progress:number;lastTick:number;rate:0|1|2;generation:number}
/** `harvested` counts every egg ever collected; each one is stocked on the friend takeaway raft. */
export interface PoultryState{harvested:number}
export function coopEggCount(eggs:CoopEggs|undefined,now:number):number{return eggs?Math.min(EGG_CAPACITY,eggs.eggs+Math.floor((eggs.progress+Math.max(0,(now-eggs.lastTick)/1000)*eggs.rate)/EGG_SECONDS)):0;}
export const chickenCoops=(entities:readonly Entity[])=>entities.filter(e=>e.blueprintId==='coop'&&animalSpecies(e)==='chicken');
export function buildingFootprint(entity:Entity):TileFootprint{return entityFootprint(entity);}
/** Chickens help land plots on land tiles only. */
export function chickenCoverage(entities:readonly Entity[],mapId:MapId){return chickenCoops(entities).filter(e=>emits('chicken-crop-boost',`coop:${animalSpecies(e)}`)).map(e=>({id:e.id,cells:radiusArea(mapId,buildingFootprint(e),CHICKEN_RADIUS,'land')}));}
export function eggRate(state:TownState,entity:Entity,map:MapId):0|1|2{
    if(animalSpecies(entity)!=='chicken')return 0;
    const footprint=buildingFootprint(entity),rafts=landView(state,map).rafts??[];
    return affects('insect-egg-boost',entity.blueprintId)&&rafts.some(r=>emits('insect-egg-boost',r.blueprintId)&&footprintInArea(raftArea(map,r,'land'),footprint))?2:1;
}
function coops(state:TownState){return [...state.entities.map(entity=>({entity,map:'town' as MapId})),...(state.maps?.lake?.land.entities??[]).map(entity=>({entity,map:'lake' as MapId}))].filter(({entity})=>entity.blueprintId==='coop');}
/** Initialize old/new coops once, without inventing eggs for time before rollout. */
export function ensurePoultry(state:TownState,now:number):TownState{
    if(!coops(state).some(({entity})=>!entity.poultry))return state;
    const next=structuredClone(state);next.poultry??={harvested:0};
    for(const {entity,map}of coops(next))entity.poultry??={eggs:0,progress:0,lastTick:now,rate:eggRate(next,entity,map),generation:0};
    next.revision++;return next;
}
/** In-place authoritative projection. Settle the previously saved rate first;
 * layout edits then call again at the same instant to capture the new rate. */
/** Accrue one coop's eggs at its saved rate. */
function settleCoop(eggs:CoopEggs,now:number):void{
    const elapsed=Math.max(0,(now-eggs.lastTick)/1000);
    if(eggs.eggs<EGG_CAPACITY){
        const total=eggs.progress+elapsed*eggs.rate,produced=Math.floor(total/EGG_SECONDS);
        eggs.eggs=Math.min(EGG_CAPACITY,eggs.eggs+produced);
        eggs.progress=eggs.eggs===EGG_CAPACITY?0:total%EGG_SECONDS;
    }else eggs.progress=0;
    eggs.lastTick=Math.max(now,eggs.lastTick);
}
/** Root state only: every map's coops, each rated by its own map's surroundings. */
export function settlePoultry(state:TownState,now:number):TownState{
    for(const {entity,map}of coops(state)){
        const eggs=entity.poultry;if(!eggs)continue;
        settleCoop(eggs,now);eggs.rate=eggRate(state,entity,map);
    }
    return state;
}
export function poultryProjection(state:TownState,now:number):TownState{return settlePoultry(structuredClone(state),now);}
/** Works on any map's view: only the chosen coop is settled. */
export function harvestCoopEggs(state:TownState,entityId:string,generation:number,now:number):TownState{
    const next=structuredClone(state),entity=next.entities.find(e=>e.id===entityId),eggs=entity?.poultry;
    if(entity?.blueprintId!=='coop'||!eggs)throw new Error('Choose a chicken coop.');
    settleCoop(eggs,now);
    if(eggs.generation!==generation)throw new Error('This coop changed. Sync and try again.');
    if(!eggs.eggs)throw new Error('No eggs yet. Your chickens are taking their time.');
    next.poultry??={harvested:0};
    const count=eggs.eggs;
    if(!Number.isSafeInteger(next.materials.stamina+count*2)||!Number.isSafeInteger(next.poultry.harvested+count))throw new Error('Storage is full.');
    next.materials.stamina+=count*2;next.poultry.harvested+=count;
    eggs.eggs=0;eggs.generation++;next.revision++;return next;
}
