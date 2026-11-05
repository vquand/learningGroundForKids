import {entityFootprint,isBridge,MATERIALS,shortages,movementCost,type Cost,type TownState} from '../game.ts';
import {mapDefinition,mapPlacementError} from '../maps/registry.ts';
import {landView,mapRafts,openMaps,requireLake} from '../maps/view.ts';
import type {MapId} from '../maps/types.ts';
import {terrainKind} from '../areaOfEffect.ts';
import {LAKE_BLUEPRINTS,LAKE_FISH,LAKE_PLANTS,LAKE_GROW_SECONDS,lakeBlueprintUnlockError,fishCapacity,type LakeFishId} from './catalog.ts';
import {advanceRaftPlants,plantRaftReward,healthyRaftPlants,replantRaft} from './plantEffects.ts';
import {DUCK_HELP_SECONDS,duckCoops,duckDuty,duckRaftInRange,duckRaftNeedsHelp,duckHelpCoverage,type WaterWorld} from './ducks.ts';
import type {LakeRaft,WaterCommand} from './types.ts';
import {storeFish} from '../storage.ts';

export const MAX_MAP_STRUCTURES=32,MAX_MAP_FISH=256;
/** One map's land and water, for rules that span both. */
export const waterWorld=(state:TownState,mapId:MapId):WaterWorld=>{const view=landView(state,mapId);return{mapId,entities:view.entities,rafts:view.rafts??[]};};
function spend(state:TownState,cost:Cost) {
    if(Object.keys(shortages({...state.materials,wool:state.storage?.wool??0},cost)).length)throw new Error('Collect the missing materials first.');
    if(cost.wool)state.storage!.wool=(state.storage?.wool??0)-cost.wool;
    for(const material of MATERIALS)state.materials[material]-=cost[material]??0;
}
function creditStamina(state:TownState,amount:number) {
    if(!Number.isSafeInteger(state.materials.stamina+amount))throw new Error('Storage is full.');
    state.materials.stamina+=amount;
}
const overlap=(a:{x:number;y:number;width:number;length:number},b:typeof a)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.length&&a.y+a.length>b.y;
/** Placement on any map's water (or shore, for the shore raiser): terrain depth,
 * reserved tiles, other structures, buildings and Fish home raft shore access. */
export function raftPlacementError(view:Pick<TownState,'entities'|'rafts'>,mapId:MapId,raft:Pick<LakeRaft,'id'|'blueprintId'|'fish'|'plant'|'nextFish'>,x:number,y:number):string|null {
    const map=mapDefinition(mapId),b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!;
    const inside=(xx:number,yy:number)=>xx>=0&&yy>=0&&xx<map.rows&&yy<map.columns;
    const bridgeAt=(xx:number,yy:number)=>view.entities.some(e=>isBridge(e)&&e.x===xx&&e.y===yy);
    // An insect nest may stand on a bridge tile with bridge on at least 3 of its 4 sides.
    if(b.id==='insect-raiser'&&bridgeAt(x,y)){
        if(view.entities.some(e=>!isBridge(e)&&e.x===x&&e.y===y))return 'That space is occupied. Choose an open patch.';
        if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([xx,yy])=>bridgeAt(xx!,yy!)).length<3)return 'An insect nest on a bridge needs bridge on at least 3 sides.';
        for(const other of view.rafts??[])if(other.id!==raft.id&&other.x===x&&other.y===y)return 'That space is occupied. Choose an open patch.';
        return null;
    }
    // Floating structures never sit under a bridge.
    for(let xx=x;xx<x+b.width;xx++)for(let yy=y;yy<y+b.length;yy++)if(bridgeAt(xx,yy))return 'That space is occupied. Choose an open patch.';
    let error=mapPlacementError(map,b,x,y,{depths:b.id==='insect-raiser'?['grass']:['shallow','deep']});
    if(error)return error;
    if(b.id==='insect-raiser') {
        const near=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([xx,yy])=>inside(xx!,yy!)&&terrainKind(map.terrainAt(xx!,yy!))==='water');
        if(!near)return 'Place the insect raiser beside the water.';
    }
    if(raft.fish.length) {
        const fish=LAKE_FISH[raft.fish[0]!.species];
        error=mapPlacementError(map,b,x,y,{depths:b.id==='friendly'?fish.homeDepths:fish.nurseryDepths,shore:b.id==='friendly'&&fish.shore});
        if(error)return error;
    }
    if(raft.nextFish){const fish=LAKE_FISH[raft.nextFish];error=mapPlacementError(map,b,x,y,{depths:fish.nurseryDepths});if(error)return error;}
    if(raft.plant) {
        error=mapPlacementError(map,b,x,y,{depths:LAKE_PLANTS[raft.plant].depths});
        if(error)return error;
    }
    for(const other of view.rafts??[])if(other.id!==raft.id) {
        const ob=LAKE_BLUEPRINTS.find(b=>b.id===other.blueprintId)!;
        if(overlap({...b,x,y},{...ob,x:other.x,y:other.y}))return 'That space is occupied. Choose an open patch.';
    }
    const landBlocked=(xx:number,yy:number)=>view.entities.some(e=>{const f=entityFootprint(e);return xx>=f.x&&xx<f.x+f.width&&yy>=f.y&&yy<f.y+f.length;});
    if(b.id==='insect-raiser'&&landBlocked(x,y))return 'That space is occupied. Choose an open patch.';
    if(b.id==='friendly'&&raft.fish.length&&LAKE_FISH[raft.fish[0]!.species].shore) {
        const access=[];
        for(let xx=x;xx<x+b.width;xx++)access.push([xx,y-1],[xx,y+b.length]);
        for(let yy=y;yy<y+b.length;yy++)access.push([x-1,yy],[x+b.width,yy]);
        if(!access.some(([xx,yy])=>inside(xx!,yy!)&&map.terrainAt(xx!,yy!)==='grass'&&!landBlocked(xx!,yy!)))return 'Keep an open shore access tile beside this raft.';
    }
    return null;
}
/** Rafts inside a water-duty coop's area grow 30 seconds sooner, once per cycle: no visit needed, the ducks just live there. */
export function applyDuckHelp(world:WaterWorld){
    const areas=duckCoops(world.entities).filter(coop=>duckDuty(world,coop)==='water').map(coop=>duckHelpCoverage(world,coop));
    if(!areas.length)return;
    for(const raft of world.rafts) {
        if(!duckRaftNeedsHelp(raft)||!areas.some(area=>duckRaftInRange(area,raft)))continue;
        for(const fish of raft.fish)if(!fish.duckBoosted){fish.growth=Math.min(LAKE_GROW_SECONDS,fish.growth+DUCK_HELP_SECONDS);fish.duckBoosted=true;}
        if(raft.plant&&!raft.duckBoosted){advanceRaftPlants(raft,DUCK_HELP_SECONDS,world.rafts,world.mapId);raft.duckBoosted=true;}
    }
}
/** Rafts, fish and plants on any map's water; false when nothing changed. Progress (unlocks,
 * reserve, harvest counts, awards) is the shared water-care book under the Lake. */
export function applyWaterCommand(state:TownState,command:WaterCommand,now:number,id:string,catches:Partial<Record<LakeFishId,number>>,stockLimit=Infinity):boolean {
    const progress=requireLake(state),mapId=command.mapId??'lake';
    if(!openMaps(state).includes(mapId))throw new Error('Open this map first.');
    const rafts=mapRafts(state,mapId),view=landView(state,mapId);
    if(command.type==='build-raft') {
        if(rafts.length>=MAX_MAP_STRUCTURES)throw new Error('This map has room for 32 water structures.');
        const unlockError=lakeBlueprintUnlockError(command.blueprintId,progress.harvested);
        if(unlockError)throw new Error(unlockError);
        const b=LAKE_BLUEPRINTS.find(b=>b.id===command.blueprintId);
        if(!b)throw new Error('Choose a water blueprint.');
        const raft:LakeRaft={id,blueprintId:b.id,x:command.x,y:command.y,paidCost:{...b.cost},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false};
        const error=raftPlacementError(view,mapId,raft,raft.x,raft.y);if(error)throw new Error(error);
        spend(state,b.cost);rafts.push(raft);if(!progress.built.includes(b.id))progress.built.push(b.id);
        return true;
    }
    const raft=rafts.find(r=>r.id===command.raftId);if(!raft)throw new Error('This raft is no longer here.');
    const fishOnMap=()=>rafts.reduce((sum,r)=>sum+r.fish.length,0);
    if(command.type==='move-raft') {
        if(raft.x===command.x&&raft.y===command.y)return false;
        const error=raftPlacementError(view,mapId,raft,command.x,command.y);if(error)throw new Error(error);
        spend(state,movementCost(raft.paidCost));raft.x=command.x;raft.y=command.y;
    } else if(command.type==='remove-raft') {
        rafts.splice(rafts.indexOf(raft),1);
    } else if(command.type==='set-next-fish') {
        if(raft.blueprintId!=='nursery'||!raft.fish.length)throw new Error('Choose a stocked fish nursery.');
        if(!LAKE_FISH[command.species]||(catches[command.species]??0)<10)throw new Error('Catch 10 of this fish in Fishing Friends first.');
        if(raft.fish[0]!.species===command.species)delete raft.nextFish;else raft.nextFish=command.species;
        const error=raftPlacementError(view,mapId,raft,raft.x,raft.y);if(error)throw new Error(error);
    } else if(command.type==='stock'||command.type==='transfer-fish') {
        if(!['nursery','friendly'].includes(raft.blueprintId))throw new Error('Choose a fish raft.');
        if(!LAKE_FISH[command.species])throw new Error('Choose a lake fish.');
        if(raft.fish.length&&raft.fish[0]!.species!==command.species)throw new Error('Keep one species in each raft.');
        const room=fishCapacity(command.species)-raft.fish.length;
        if(room<=0)throw new Error('This raft has no empty space.');
        if(command.type==='stock'&&(catches[command.species]??0)<10)throw new Error('Catch 10 of this fish in Fishing Friends first.');
        const count=command.type==='transfer-fish'?Math.min(room,progress.reserve[command.species]??0):Math.min(room,stockLimit);
        if(fishOnMap()+count>MAX_MAP_FISH)throw new Error('This map has room for 256 fish.');
        if(command.type==='transfer-fish'&&(raft.blueprintId!=='friendly'||!count))throw new Error('Choose a fish home raft and fish from your reserve.');
        for(let index=0;index<count;index++)raft.fish.push({id:`${id}:${index}`,species:command.species,growth:command.type==='transfer-fish'?LAKE_GROW_SECONDS:0});
        const error=raftPlacementError(view,mapId,raft,raft.x,raft.y);if(error)throw new Error(error);
        if(command.type==='transfer-fish')progress.reserve[command.species]=(progress.reserve[command.species]??0)-count;
        if(!progress.settled.includes(command.species))progress.settled.push(command.species);
        progress.earned[raft.blueprintId==='nursery'?'lake-nursery':'lake-home']??=new Date(now).toISOString();
    } else if(command.type==='reserve-fish') {
        const ready=raft.fish.filter(f=>f.growth>=LAKE_GROW_SECONDS);
        if(raft.blueprintId!=='friendly'||!ready.length)throw new Error('No grown companion fish to move yet.');
        // Stored up to the storage limit; grown fish beyond it swim off.
        for(const fish of ready)storeFish(state,fish.species,1,now);
        raft.fish=raft.fish.filter(f=>f.growth<LAKE_GROW_SECONDS);
    } else if(command.type==='plant') {
        if(raft.blueprintId!=='floating-garden'||!LAKE_PLANTS[command.plant])throw new Error('Choose a plant for a floating garden.');
        if(raft.plant===command.plant)return false;
        raft.plant=command.plant;replantRaft(raft);
        const error=raftPlacementError(view,mapId,raft,raft.x,raft.y);if(error)throw new Error(error);
        progress.earned['lake-greens']??=new Date(now).toISOString();
    } else {
        if(command.generation!==raft.generation)throw new Error('This raft changed. Sync and try again.');
        if(command.type==='harvest-fish') {
            if(raft.blueprintId!=='nursery')throw new Error('Friendly fish are companions, not nursery harvests.');
            const ready=raft.fish.filter(f=>f.growth>=LAKE_GROW_SECONDS);
            if(!ready.length)throw new Error('No fish are ready yet.');
            let stamina=0;
            for(const fish of ready) {storeFish(state,fish.species,1,now);stamina+=LAKE_FISH[fish.species].stamina;}
            raft.fish=raft.fish.filter(f=>f.growth<LAKE_GROW_SECONDS);progress.harvested+=ready.length;
            if(!Number.isSafeInteger(progress.harvested))throw new Error('Your lake collection is full.');
            creditStamina(state,stamina);
            if(!raft.fish.length&&raft.nextFish){
                const species=raft.nextFish;
                if((catches[species]??0)<10)throw new Error('Catch 10 of this fish in Fishing Friends first.');
                const room=Math.min(fishCapacity(species),MAX_MAP_FISH-fishOnMap());
                raft.fish=Array.from({length:room},(_,index)=>({id:`${id}:next:${index}`,species,growth:0}));delete raft.nextFish;
                const error=raftPlacementError(view,mapId,raft,raft.x,raft.y);if(error)throw new Error(error);
                if(!progress.settled.includes(species))progress.settled.push(species);
            }
        } else {
            if(raft.blueprintId!=='floating-garden'||!raft.plant||raft.plantGrowth<LAKE_GROW_SECONDS)throw new Error('These plants are still growing.');
            creditStamina(state,plantRaftReward(raft));progress.plantsHarvested+=healthyRaftPlants(raft);replantRaft(raft);
        }
        progress.collections++;
    }
    raft.generation++;
    return true;
}
