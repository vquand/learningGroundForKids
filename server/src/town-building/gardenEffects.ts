import type {Entity} from './game.ts';
import {buildingFootprint,chickenCoverage} from './poultry.ts';
import {raftArea,type AreaSource} from './water/behavior.ts';
import {affects,emits,footprintInArea} from './areaOfEffect.ts';
import type {LakeRaft} from './water/types.ts';
import type {MapId} from './maps/types.ts';
export type GardenAreaSource=AreaSource;
/** Insects reach land plots on land tiles only. */
export function gardenInsectSources(rafts:readonly LakeRaft[],mapId:MapId):GardenAreaSource[]{
 return rafts.filter(r=>emits('insect-crop-wither',r.blueprintId)).map(r=>({id:r.id,cells:raftArea(mapId,r,'land')}));
}
/** Area effects on one plot from its own map's chickens and insect sources. */
export function gardenAreaEffects(patch:Entity,entities:readonly Entity[],insects:readonly GardenAreaSource[],mapId:MapId){
 const footprint=buildingFootprint(patch),covers=(source:GardenAreaSource)=>footprintInArea(source.cells,footprint);
 return{chicken:affects('chicken-crop-boost',patch.blueprintId)&&chickenCoverage(entities,mapId).some(covers),insects:affects('insect-crop-wither',patch.blueprintId)&&insects.some(covers)};
}
/** Stable pseudorandom decision from a server-issued entity ID and cycle. A
 * discarded lease/retry/overlap can never reroll the same growing plot. */
export function insectCycleRoll(id:string,generation:number):number{
 let h=2166136261;for(const c of `${id}:insects:${generation}`)h=Math.imul(h^c.charCodeAt(0),16777619);
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
 return(h>>>0)/4294967296;
}

/** A plot or raft under an insect area loses a quarter of its crops, rounded up: always, once per cycle. */
export const INSECT_LOSS_SHARE=.25;
export const insectLossCount=(total:number)=>Math.ceil(total*INSECT_LOSS_SHARE-1e-9);
/** Which crops are lost is the only chance here. The pick is a stable function of the server-issued id and cycle, so retries and checkpoints never reroll it. */
export function pickInsectLosses(id:string,cycle:number,candidates:readonly number[]):number[]{
 const roll=(index:number)=>insectCycleRoll(`${id}:slot:${index}`,cycle);
 return [...candidates].sort((a,b)=>roll(a)-roll(b)||a-b).slice(0,insectLossCount(candidates.length)).sort((a,b)=>a-b);
}
