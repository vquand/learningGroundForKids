import {BLUEPRINTS,type TownState} from '../../../../server/src/town-building/game.ts';
import {isDedicatedAnimalHouseBlueprint} from '../../../../server/src/town-building/animalHostRules.ts';
import type {MapId} from '../../../../server/src/town-building/maps/types.ts';
import {LAKE_BLUEPRINTS} from '../../../../server/src/town-building/water/catalog.ts';

export const MAX_VISIBLE_SUMMARY_KINDS=12;

export const SUMMARY_ICON_SIZE=32;
export const SUMMARY_ICON_GAP=4;

/**
 * Return the negative margin applied to every icon after the first one.
 * The natural gap is retained while the stack fits; otherwise the icons
 * overlap just enough for the measured cluster width.
 */
export function calculateSummaryIconOverlap(count:number,availableWidth:number):number {
    const iconCount=Math.max(0,Math.floor(count));
    if(iconCount<=1)return 0;
    const width=Math.max(0,availableWidth);
    const naturalWidth=iconCount*SUMMARY_ICON_SIZE+(iconCount-1)*SUMMARY_ICON_GAP;
    if(width>=naturalWidth)return 0;
    return -Math.min(SUMMARY_ICON_SIZE-1,(naturalWidth-width)/(iconCount-1));
}

export interface SummaryKind {
    id:string;
    count:number;
}

export interface CappedSummaryKinds {
    visible: SummaryKind[];
    hidden: SummaryKind[];
}

export function capSummaryKinds(kinds: readonly SummaryKind[],max=MAX_VISIBLE_SUMMARY_KINDS):CappedSummaryKinds {
    return {visible:kinds.slice(0,max),hidden:kinds.slice(max)};
}

export interface MapSummary {
    buildings: number;
    buildingKinds: SummaryKind[];
    plantPlots: number;
    plantKinds: SummaryKind[];
    roadTiles: number;
    roadKinds: SummaryKind[];
    bridgeTiles: number;
    bridgeKinds: SummaryKind[];
    animalHouses: number;
    animalHouseKinds: SummaryKind[];
    fishHouses: number;
    fishHouseKinds: SummaryKind[];
}
export {ANIMAL_HOUSE_BLUEPRINT_IDS,isDedicatedAnimalHouseBlueprint as isAnimalHouseBlueprint} from '../../../../server/src/town-building/animalHostRules.ts';

/** Read-only totals from the current map's saved constructions, never preview objects. */
export function mapSummary(state:TownState,mapId:MapId):MapSummary{
    const entities=mapId==='town'?state.entities:state.maps?.lake?.land.entities??[];
    const rafts=mapId==='town'?state.rafts??[]:state.maps?.lake?.rafts??[];
    const summary={
        buildings:0,buildingKinds:new Map<string,number>(),plantPlots:0,plantKinds:new Map<string,number>(),
        roadTiles:0,roadKinds:new Map<string,number>(),bridgeTiles:0,bridgeKinds:new Map<string,number>(),
        animalHouses:0,animalHouseKinds:new Map<string,number>(),fishHouses:0,fishHouseKinds:new Map<string,number>(),
    };
    const add=(kinds:Map<string,number>,id:string,count=1)=>kinds.set(id,(kinds.get(id)??0)+count);
    for(const entity of entities){
        const blueprint=BLUEPRINTS.find(b=>b.id===entity.blueprintId);
        if(blueprint?.kind==='building'){
            summary.buildings++;add(summary.buildingKinds,blueprint.id);
            if(isDedicatedAnimalHouseBlueprint(blueprint.id)){summary.animalHouses++;add(summary.animalHouseKinds,blueprint.id);}
        }else if(blueprint?.kind==='garden'){
            summary.plantPlots++;add(summary.plantKinds,blueprint.id);
        }
        else if(blueprint?.kind==='road'){
            summary.roadTiles+=blueprint.width*blueprint.length;
            add(summary.roadKinds,blueprint.id,blueprint.width*blueprint.length);
        }else if(blueprint?.kind==='bridge'){
            summary.bridgeTiles+=blueprint.width*blueprint.length;
            add(summary.bridgeKinds,blueprint.id,blueprint.width*blueprint.length);
        }
    }
    for(const raft of rafts){
        if(raft.blueprintId==='floating-garden'){summary.plantPlots++;add(summary.plantKinds,raft.blueprintId);}
        if(raft.blueprintId==='nursery'||raft.blueprintId==='friendly'){summary.fishHouses++;add(summary.fishHouseKinds,raft.blueprintId);}
    }
    const inCatalog=(counts:Map<string,number>,catalog:readonly {id:string}[])=>catalog
        .map((item,index)=>({id:item.id,count:counts.get(item.id)??0,index}))
        .filter(item=>item.count>0)
        .sort((a,b)=>b.count-a.count||a.index-b.index)
        .map(item=>({id:item.id,count:item.count}));
    return {
        buildings:summary.buildings,buildingKinds:inCatalog(summary.buildingKinds,BLUEPRINTS),
        plantPlots:summary.plantPlots,plantKinds:inCatalog(summary.plantKinds,[...BLUEPRINTS,...LAKE_BLUEPRINTS]),
        roadTiles:summary.roadTiles,roadKinds:inCatalog(summary.roadKinds,BLUEPRINTS),
        bridgeTiles:summary.bridgeTiles,bridgeKinds:inCatalog(summary.bridgeKinds,BLUEPRINTS),
        animalHouses:summary.animalHouses,animalHouseKinds:inCatalog(summary.animalHouseKinds,BLUEPRINTS),
        fishHouses:summary.fishHouses,fishHouseKinds:inCatalog(summary.fishHouseKinds,LAKE_BLUEPRINTS),
    };
}
