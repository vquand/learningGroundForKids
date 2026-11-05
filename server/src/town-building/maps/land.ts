import {AppError} from '../../errors.ts';
import {storageRemoval,discardStorageLoss,availableFishCount,spendFish} from '../storage.ts';
import {clearOccupiedHabits,transferHabitCooldowns} from '../animalHabits.ts';
import {BLUEPRINTS,MATERIALS,blueprintEventError,bridgeAnchorError,bridgeSupportError,isBridge,isLineBlueprint,isSnowSculpture,countInstalledSnowSculptures,refreshXmasSimultaneous,xmasStartingYear,movementCost,movementCropCost,spendCrops,requireDirection,shortages,type TownState,type TownCommand} from '../game.ts';
import {applyGardenCommand} from '../garden.ts';
import {awardCiv,helpNeighbor,type CivClock} from '../civ.ts';
import type {Season} from '../game.ts';
/** The home clock a land command needs (shops, crop seasons). */
export type LandClock=CivClock&{season?:Season|null;weatherSource?:string;allowPreview?:boolean};
import {expireMapEventBuildings,landView,mergeLand,requireLake} from './view.ts';
import type {MapId} from './types.ts';
import {landObstruction} from './landShared.ts';
export {blueprintMapError,landObstruction} from './landShared.ts';
export type LandMapCommand={type:'land-action';command:TownCommand;mapId?:MapId|undefined}|{type:'transfer-building';entityId:string;sourceMap:MapId;destinationMap:MapId;x:number;y:number};
/** Land commands for every map share one validation path. */
/** `strokeTile` defers the bridge land check to the end of a glided stroke, which may start out over the water. */
export function applyMapLandCommand(state:TownState,action:LandMapCommand,now:number,id:string,environment:LandClock,strokeTile=false):TownState {
    state=expireMapEventBuildings(state,environment);
    if(action.type==='land-action') {
        const mapId=action.mapId??'lake',view=landView(state,mapId),command=action.command;
        const removal=command.type==='remove'&&view.entities.find(e=>e.id===command.entityId)?.blueprintId==='town-storage'?storageRemoval(state):undefined;
        if(command.type==='remove'&&(command.confirmLoss!==undefined||command.lossConfirmation!==undefined)&&!removal)throw new Error('Only Town Storage removal accepts loss confirmation.');
        if(removal?.losses.length&&command.type==='remove'&&(!command.confirmLoss||command.lossConfirmation!==removal.confirmation))throw new AppError(409,'STORAGE_LOSS_CONFIRM','Removing this storage will discard goods.',removal);
        if(command.type==='rename'&&mapId!=='town')throw new Error('Rename your shared town from Town.');
        if(command.type==='build-line') {
            const line=BLUEPRINTS.find(b=>b.id===command.blueprintId);
            if(!isLineBlueprint(line)||line?.palette===false)throw new Error('Choose a road, fence or bridge.');
            // One request builds the whole stroke: every tile passes the same checks, one failure builds nothing, and the map saves once.
            let current=state;
            command.tiles.forEach((tile,index)=>{current=applyMapLandCommand(current,{type:'land-action',mapId,command:{type:'build',blueprintId:command.blueprintId,...tile}},now,`${id}:${index}`,environment,true);});
            if(current===state)return state;
            if(line?.kind==='bridge'){const error=bridgeAnchorError(landView(current,mapId).entities,mapId,command.tiles);if(error)throw new Error(error);}
            current.revision=state.revision+1;return current;
        }
        if(command.type==='build') {
            if(isSnowSculpture(command.blueprintId)&&countInstalledSnowSculptures(state)>=100) {
                throw new Error('Cap of 100 snow sculptures reached.');
            }
        }
        if(command.type==='build'||command.type==='move') {
            const entity=command.type==='move'?view.entities.find(e=>e.id===command.entityId):undefined;
            const b=BLUEPRINTS.find(b=>b.id===(command.type==='build'?command.blueprintId:entity?.blueprintId));
            if(!b)throw new Error('Choose a building.');
            // A road or fence tile may be replaced by another of its kind.
            const replaced=command.type==='build'&&isLineBlueprint(b)?view.entities.find(e=>e.x===command.x&&e.y===command.y&&BLUEPRINTS.find(v=>v.id===e.blueprintId)?.kind===b.kind):undefined;
            const direction=requireDirection(b.id,command.direction,entity?.direction??'front');
            const error=landObstruction(state,mapId,b,command.x,command.y,entity?.id??replaced?.id,direction);if(error)throw new Error(error);
        }
        const next=command.type==='help-neighbor'?helpNeighbor(view,command.entityId,command.step,environment):applyGardenCommand(view,mapId,command,id,now,environment.timeOfDay?environment.season??null:null,environment.timeOfDay?environment.localDate:undefined,environment.allowPreview);
        if(next===view)return state;
        // A single bridge tile, built or moved, must reach land on construction.
        const placed=(command.type==='build'||command.type==='move')&&!strokeTile?next.entities.find(e=>command.type==='move'?e.id===command.entityId:e.x===command.x&&e.y===command.y&&e.blueprintId===command.blueprintId):undefined;
        if(placed&&isBridge(placed)){const error=bridgeAnchorError(next.entities,mapId,[placed]);if(error)throw new Error(error);}
        clearOccupiedHabits(next);
        const merged=mergeLand(state,next,mapId);if(command.type==='build'&&isSnowSculpture(command.blueprintId))refreshXmasSimultaneous(merged,String(environment.localDate?xmasStartingYear(environment.localDate):2026),now);if(removal){discardStorageLoss(merged,removal);merged.storageRemovalReceipt=removal;}else delete merged.storageRemovalReceipt;awardCiv(merged,now);return merged;
    }
    if(action.sourceMap===action.destinationMap)throw new Error('Choose the other map.');
    const next=structuredClone(state),source=landView(next,action.sourceMap);
    const entity=source.entities.find(e=>e.id===action.entityId);if(!entity)throw new Error('This building is no longer here.');
    const supportError=bridgeSupportError(source,entity);if(supportError)throw new Error(supportError);
    const b=BLUEPRINTS.find(b=>b.id===entity.blueprintId)!;
    const eventError=blueprintEventError(b.id,environment.timeOfDay?environment.localDate:undefined,environment.allowPreview);if(eventError)throw new Error(eventError);
    const error=landObstruction(next,action.destinationMap,b,action.x,action.y,undefined,entity.direction??'front');
    if(error)throw new Error(error);
    const cost=movementCost(entity.paidCost);if(Object.keys(shortages({...next.materials,wool:next.storage?.wool??0,yarn:next.storage?.yarn??0,fish:availableFishCount(next)},cost)).length)throw new Error('Collect the missing materials first.');
    spendCrops(next,movementCropCost(entity.paidCropCost));
    if(cost.wool) {next.storage!.wool=(next.storage?.wool??0)-cost.wool;}
    if(cost.yarn) {next.storage!.yarn=(next.storage?.yarn??0)-cost.yarn;}
    if(cost.fish) {spendFish(next,cost.fish);}
    for(const material of MATERIALS)next.materials[material]-=cost[material]??0;
    const {mapId:_legacy,...rest}=entity,moved={...rest,x:action.x,y:action.y};
    // Each map keeps its own shop clock: carry the remaining rest, not the source map's deadline.
    if(moved.civ){
        const remaining=Math.max(0,moved.civ.helpAfterMs-(source.civ?.activeMs??0));
        moved.civ={...moved.civ,helpAfterMs:remaining&&(landView(next,action.destinationMap).civ?.activeMs??0)+remaining};
    }
    if(action.sourceMap==='town')next.entities=next.entities.filter(e=>e.id!==entity.id);
    else requireLake(next).land.entities=requireLake(next).land.entities.filter(e=>e.id!==entity.id);
    if(action.destinationMap==='town')next.entities.push(moved);else requireLake(next).land.entities.push(moved);
    const destination=landView(next,action.destinationMap);transferHabitCooldowns(source,destination,entity.id);clearOccupiedHabits(destination);
    const cleared=mergeLand(next,destination,action.destinationMap);
    // Same finalisation as a land action: re-check cross-map awards.
    awardCiv(cleared,now);cleared.revision++;return cleared;
}
