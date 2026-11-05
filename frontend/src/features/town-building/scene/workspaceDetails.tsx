import {Link} from 'react-router-dom';
import type {Entity,TownState} from '../../../../../server/src/town-building/game';
import {BLUEPRINTS,ANIMAL_NAMES,animalCount,animalSpecies,blueprintEventError,bridgeAnchorError,cropCostError,movementCost,movementCropCost,type Blueprint} from '../../../../../server/src/town-building/game';
import {availableFishCount} from '../../../../../server/src/town-building/storage.ts';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import {CROPS,GROW_SECONDS} from '../../../../../server/src/town-building/garden';
import {LAKE_BLUEPRINTS,LAKE_FISH,LAKE_PLANTS,fishCapacity,isInsectRaiser,lakeBlueprintUnlockError,type LakeBlueprint} from '../../../../../server/src/town-building/water/catalog';
import type {LakeRaft} from '../../../../../server/src/town-building/water/types';
import {landObstruction,blueprintMapError} from '../../../../../server/src/town-building/maps/landShared';
import {raftPlacementError} from '../../../../../server/src/town-building/water/rules';
import {uiMessage,uiText} from '../../../i18n/uiText';
import {BlueprintArt} from '../TownArt';
import {LockIcon} from '../TownActionIcons';
import {CoopDetails} from '../PoultryUi';
import {BarnDetails} from '../BarnUi';
import {LakeArt} from '../maps/lake/LakeArt';
import {buildingDescription} from '../buildingDescriptions';
import {landProgress,raftProgress} from '../buildingProgress';
import type {BuildingDetail} from '../BuildingDetailCard';
import type {Season,Direction} from '../../../../../server/src/town-building/game';
import {canRotate} from '../../../../../server/src/town-building/direction';

export type Placement={kind:'land';blueprintId:string;entityId?:string;raftId?:undefined}|{kind:'raft';blueprintId:LakeBlueprint['id'];raftId?:string;entityId?:undefined;from?:undefined};
export const isLand=(b:Blueprint)=>b.kind==='building'||b.kind==='tree'||b.kind==='garden';
export const raftArt=(id:LakeBlueprint['id'])=><LakeArt garden={id==='floating-garden'} index={LAKE_BLUEPRINTS.find(b=>b.id===id)!.art}/>;
export const landBuildingCost=(b:Blueprint,state:TownState,entity?:Entity)=>({moving:!!entity,cost:entity?movementCost(entity.paidCost):b.cost,materials:state.materials,wool:state.storage?.wool??0,yarn:state.storage?.yarn??0,fish:availableFishCount(state),cropCost:entity?movementCropCost(entity.paidCropCost):b.cropCost??{},crops:state.storage?.crops??{}});

export function blueprintCard(b:Blueprint,state:TownState,season:Season):BuildingDetail{
    return {art:<BlueprintArt blueprint={b} season={season}/>,name:b.name,description:buildingDescription(b.id),cost:landBuildingCost(b,state),locked:b.learned>state.learnedIds.length};
}
export function raftBlueprintCard(b:LakeBlueprint,state:TownState):BuildingDetail{
    return {art:raftArt(b.id),name:b.name,description:buildingDescription(b.id),cost:{moving:false,cost:b.cost,materials:state.materials,wool:state.storage?.wool??0},locked:!!lakeBlueprintUnlockError(b.id,state.maps?.lake?.harvested??0)};
}
/** Why a placement cannot happen, in the order a child would fix it. */
export function placementProblem(state:TownState,view:Pick<TownState,'entities'|'rafts'>,mapId:MapId,placement:Placement,position:{x:number;y:number},moving?:Entity|LakeRaft,direction:Direction='front',localDate?:string,allowPreview=false):string|null{
    const lake=state.maps?.lake;
    if(placement.kind==='raft'){
        const b=LAKE_BLUEPRINTS.find(b=>b.id===placement.blueprintId)!;
        const raft=moving&&'fish' in moving?moving:{id:'preview',blueprintId:placement.blueprintId,fish:[],plant:null};
        const cost=moving?movementCost(moving.paidCost):b.cost;
        return (placement.raftId?null:lakeBlueprintUnlockError(b.id,lake?.harvested??0))??raftPlacementError(view,mapId,raft,position.x,position.y)??(Object.entries(cost).some(([m,n])=>((m==='wool'?state.storage?.wool:state.materials[m as keyof TownState['materials']])??0)<n!)?'Collect the missing materials first.':null);
    }
    const b=BLUEPRINTS.find(b=>b.id===placement.blueprintId)!;
    const cost=moving?movementCost(moving.paidCost):b.cost;
    const haveCount=(m:string)=>m==='wool'?(state.storage?.wool??0):m==='yarn'?(state.storage?.yarn??0):m==='fish'?availableFishCount(state):(state.materials[m as keyof TownState['materials']]??0);
    return blueprintEventError(b.id,localDate,allowPreview)??blueprintMapError(b.id,mapId)??(state.learnedIds.length<b.learned&&!placement.entityId?'Learn more different items to unlock this building.':null)
        ??landObstruction(state,mapId,b,position.x,position.y,moving?.id,direction)
        // A single bridge tile must reach land (directly, or through the bridge it joins).
        ??(b.kind==='bridge'?bridgeAnchorError([...view.entities.filter(e=>e.id!==moving?.id),{id:'placement-preview',blueprintId:b.id,...position,paidCost:{}}],mapId,[position]):null)??(Object.entries(cost).some(([m,n])=>haveCount(m)<n!)?'Collect the missing materials first.':null)
        ??cropCostError(state,landBuildingCost(b,state,moving as Entity|undefined).cropCost);
}
const hint=(b:Blueprint,moving:boolean)=>canRotate(b.id)&&b.id!=='snow-tree'?(moving?'Half the original cost, rounded up. Press R to turn it.':'Pick a tile, then make it yours. Press R to turn it.'):moving?'Half the original cost, rounded up.':b.kind==='fence'?'Glide across tiles to build a wooden fence. Each tile costs 1 wood.':b.kind==='road'?'Glide across tiles, then release to build. Materials limit the road length.':'Pick a tile, then make it yours.';

/** What a selected land building or water structure is doing, the same on every map. */
export function SelectedDetails({state,entity,raft,species,extraSeconds,confirmingRemoval}:{
    state:TownState;entity?:Entity;raft?:LakeRaft;species:keyof typeof LAKE_FISH;extraSeconds:number;confirmingRemoval:boolean;
}){
    const lake=state.maps?.lake;
    if(entity){
        const b=BLUEPRINTS.find(b=>b.id===entity.blueprintId)!,animal=animalSpecies(entity);
        return <>
            {entity.garden&&<p>{uiMessage('{crop} · {ready}/4 ready',{crop:uiText(CROPS.find(crop=>crop.id===entity.garden!.crop)?.name??'Choose a seed'),ready:entity.garden.slots.filter(slot=>!slot.withered&&slot.growth+extraSeconds>=GROW_SECONDS).length})}{entity.garden.boost>0&&<strong> 🌱 ↑ {uiText('Poultry boost · 25% faster')}</strong>}</p>}
            {animal&&<p>{animalCount(animal)} {uiText(ANIMAL_NAMES[animal])}</p>}
            {entity.blueprintId==='coop'&&<CoopDetails entity={entity}/>}
            {entity.blueprintId==='farmhouse'&&<BarnDetails entity={entity} now={Date.now()}/>}
            {entity.blueprintId==='town-storage'&&<p>{uiText('Every Town Storage opens the same shared storage.')}</p>}
            {b.kind==='garden'&&<p>{uiText('Choose a crop, then harvest all ripe plants together.')}</p>}
            {confirmingRemoval&&<p className="lake-remove-confirm">{uiText('No materials are returned.')}</p>}
        </>;
    }
    if(raft){
        const resident=raft.fish[0]?.species??species;
        return <>
            {['nursery','friendly'].includes(raft.blueprintId)&&<>
                <p className="lake-population">{uiMessage('{count}/{capacity} fish',{count:raft.fish.length,capacity:fishCapacity(resident)})} · <strong>{uiText(LAKE_FISH[resident].name)}</strong></p>
                {raft.nextFish&&<p className="lake-bonus">{uiMessage('After this batch: {name}',{name:uiText(LAKE_FISH[raft.nextFish].name)})}</p>}
                {raft.blueprintId==='friendly'&&<><p>{uiMessage('Raised fish waiting for a home: {count}',{count:lake?.reserve[species]??0})}</p></>}
                <p className="lake-habitat-note">{uiText((raft.blueprintId==='nursery'?LAKE_FISH[resident].nurseryDepths:LAKE_FISH[resident].homeDepths).join('/')==='deep'?'Needs deep water':(raft.blueprintId==='nursery'?LAKE_FISH[resident].nurseryDepths:LAKE_FISH[resident].homeDepths).length===1?'Needs shallow water':'Shallow or deep water')} · {uiText(LAKE_FISH[resident].size==='small'?'16 small fish':'4 big fish')}<br/>{LAKE_FISH[resident].active.map(p=>uiText(p)).join(' · ')}<br/>{uiText(LAKE_FISH[resident].food)}</p>
            </>}
            {raft.blueprintId==='floating-garden'&&<p>{uiText(raft.plant?LAKE_PLANTS[raft.plant].name:'Choose a plant')}</p>}
            {(raft.duckBoosted||raft.fish.some(f=>f.duckBoosted))&&<p>{uiText('Duck helpers · 30 seconds sooner this cycle')}</p>}
            {raft.feeder&&<p className="lake-bonus">{uiText('Insect feeding · +20% maximum')}</p>}
            {isInsectRaiser(raft.blueprintId)&&<p>{uiText('Insects reach the highlighted tiles. Overlapping areas do not add another bonus.')}</p>}
            {confirmingRemoval&&<p className="lake-remove-confirm">{uiText('No materials are returned.')}</p>}
        </>;
    }
    return null;
}
export function PlacementDetails({blueprint,moving,problem,locked,state,notice}:{blueprint:Blueprint|LakeBlueprint;moving:boolean;problem:string|null;locked?:{need:number}|null;state:TownState;notice:string}){
    const land=BLUEPRINTS.find(b=>b.id===blueprint.id);
    const guide=uiText(land?hint(land,moving):'Choose a clear place on the map. Use the nearby button to build.');
    // The same sentence is never shown twice in the card; the status keeps only news (problems, results).
    return <>
        {/* A locked blueprint cannot take a tile, so the placing hint would only crowd out how to unlock it. */}
        {!locked&&<p>{guide}</p>}
        {locked&&<div className="town-lock-footer">
            <p className="town-locked-detail"><LockIcon/>{uiText('Locked · ')}{state.learnedIds.length}/{locked.need} {uiText(' items learned')}</p>
            <Link className="town-learn-link" to="/map">{uiText('Learn ')}{locked.need-state.learnedIds.length} {uiText(' more items → Travel the World')}</Link>
        </div>}
        <p className="town-placement-status" role="status">{[problem,notice].filter(Boolean).map(text=>uiText(text!)).filter(text=>text!==guide&&!guide.startsWith(`${text} `)).join(' ')}</p>
    </>;
}
export function selectedCard(state:TownState,mapId:MapId,season:Season,entity:Entity|undefined,raft:LakeRaft|undefined,now:number,extraSeconds:number):BuildingDetail|null{
    if(raft){
        const b=LAKE_BLUEPRINTS.find(b=>b.id===raft.blueprintId)!,rafts=(mapId==='town'?state.rafts:state.maps?.lake?.rafts)??[];
        const index=raft.plant?LAKE_PLANTS[raft.plant].art:raft.blueprintId==='friendly'&&raft.fish[0]?.species==='R4'?7:b.art;
        return {art:<LakeArt garden={raft.blueprintId==='floating-garden'} plant={raft.plant} rush={raft.plant==='soft-rush'} index={index}/>,name:b.name,description:buildingDescription(b.id),cost:{moving:true,cost:movementCost(raft.paidCost),materials:state.materials,wool:state.storage?.wool??0},progress:raftProgress(raft,rafts,mapId,extraSeconds)};
    }
    if(entity){
        const b=BLUEPRINTS.find(b=>b.id===entity.blueprintId)!;
        return {...blueprintCard(b,state,season),cost:landBuildingCost(b,state,entity),progress:landProgress(entity,now,extraSeconds)};
    }
    return null;
}
