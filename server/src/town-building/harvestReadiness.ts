import type {Entity,TownState} from './game.ts';
import {GROW_SECONDS} from './garden.ts';
import {barnProduct} from './barn.ts';
import {landView,openMaps} from './maps/view.ts';
import type {MapId} from './maps/types.ts';
import {LAKE_GROW_SECONDS} from './water/catalog.ts';
import type {LakeRaft} from './water/types.ts';
import type {HarvestCategory,HarvestReady} from './harvestTypes.ts';

/** The exact manual commands a harvest-all reuses; the batch never builds payouts itself. */
export type LandHarvest={type:'harvest';entityId:string;generation:number}|{type:'harvest-eggs';entityId:string;generation:number}|{type:'collect-barn';entityId:string;generation:number};
export type WaterHarvest={type:'harvest-plant';mapId:MapId;raftId:string;generation:number}|{type:'harvest-fish';mapId:MapId;raftId:string;generation:number};
export type HarvestTarget={kind:'land';command:LandHarvest}|{kind:'water';command:WaterHarvest};

/** Saved/settled state only. The same signal the client's coop/barn roof stickers read (eggs or stock above zero). */
export function entityHarvestReady(entity:Entity):boolean {
    if(entity.blueprintId==='vegetable-patch')return !!entity.garden?.slots.some(s=>s.withered||!!s.crop&&s.growth>=GROW_SECONDS);
    if(entity.blueprintId==='coop')return (entity.poultry?.eggs??0)>0;
    return !!barnProduct(entity)&&(entity.barn?.stock??0)>0;
}
/** Only nursery fish are harvested; companions in the fish home raft never are. */
export function raftHarvestReady(raft:LakeRaft):boolean {
    return raft.blueprintId==='nursery'?raft.fish.some(f=>f.growth>=LAKE_GROW_SECONDS):raft.blueprintId==='floating-garden'&&!!raft.plant&&raft.plantGrowth>=LAKE_GROW_SECONDS;
}
const patchTargets=(view:TownState):HarvestTarget[]=>view.entities.flatMap(e=>e.garden&&e.blueprintId==='vegetable-patch'&&entityHarvestReady(e)?[{kind:'land' as const,command:{type:'harvest' as const,entityId:e.id,generation:e.garden.generation}}]:[]);
const coopTargets=(view:TownState):HarvestTarget[]=>view.entities.flatMap(e=>e.poultry&&e.blueprintId==='coop'&&entityHarvestReady(e)?[{kind:'land' as const,command:{type:'harvest-eggs' as const,entityId:e.id,generation:e.poultry.generation}}]:[]);
const barnTargets=(view:TownState):HarvestTarget[]=>view.entities.flatMap(e=>e.barn&&barnProduct(e)&&entityHarvestReady(e)?[{kind:'land' as const,command:{type:'collect-barn' as const,entityId:e.id,generation:e.barn.generation}}]:[]);
const raftTargets=(view:TownState,mapId:MapId,blueprintId:LakeRaft['blueprintId'],type:'harvest-plant'|'harvest-fish'):HarvestTarget[]=>(view.rafts??[]).flatMap(r=>r.blueprintId===blueprintId&&raftHarvestReady(r)?[{kind:'water' as const,command:{type,mapId,raftId:r.id,generation:r.generation} as WaterHarvest}]:[]);

/** Add future product sources here (for example Animal haven products). A source only lists
 * targets; the existing manual commands own every payout, stamina and counter. */
export interface HarvestSource {category:HarvestCategory;targets:(view:TownState,mapId:MapId)=>HarvestTarget[]}
export const HARVEST_SOURCES:readonly HarvestSource[]=[
    {category:'plants',targets:view=>patchTargets(view)},
    {category:'plants',targets:(view,mapId)=>raftTargets(view,mapId,'floating-garden','harvest-plant')},
    {category:'animals',targets:view=>coopTargets(view)},
    {category:'animals',targets:view=>barnTargets(view)},
    {category:'fish',targets:(view,mapId)=>raftTargets(view,mapId,'nursery','harvest-fish')},
];

/** Every ready target of one category on one map, in source order. Empty for an unopened map. */
export function harvestTargets(state:TownState,mapId:MapId,category:HarvestCategory):HarvestTarget[] {
    if(!openMaps(state).includes(mapId))return [];
    const view=landView(state,mapId);
    return HARVEST_SOURCES.filter(s=>s.category===category).flatMap(s=>s.targets(view,mapId));
}
/** The read-only projection flags for one map. */
export function mapHarvestReady(state:TownState,mapId:MapId):HarvestReady {
    return {
        plants:harvestTargets(state,mapId,'plants').length>0,
        animals:harvestTargets(state,mapId,'animals').length>0,
        fish:harvestTargets(state,mapId,'fish').length>0,
    };
}
