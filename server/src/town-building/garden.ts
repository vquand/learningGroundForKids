import { applyTownCommand, type Entity, type Season, type TownCommand, type TownState } from './game.ts';
import { createAnimalResidents, type AnimalResident, type AnimalWeather, type AnimalWorldContext } from './animalWorld.ts';
import { eventAllowsCrop } from './events/index.ts';
import type {MapId} from './maps/types.ts';
import {harvestCoopEggs} from './poultry.ts';
import {collectBarn,feedBarnAnimals} from './barn.ts';
import {storeCrop} from './storage.ts';
import {affects,emits} from './areaOfEffect.ts';
import {pickInsectLosses} from './gardenEffects.ts';
export const CROPS = [
    {id:'carrot',name:'Carrot',season:'spring'}, {id:'peas',name:'Peas',season:'spring'},
    {id:'tomato',name:'Tomato',season:'summer'}, {id:'corn',name:'Corn',season:'summer'},
    {id:'potato',name:'Potato',season:'autumn'}, {id:'pumpkin',name:'Pumpkin',season:'autumn'},
    {id:'cabbage',name:'Cabbage',season:'winter'}, {id:'broccoli',name:'Broccoli',season:'winter'},
] as const;
export const CROP_IDS = CROPS.map(c=>c.id) as [CropId,...CropId[]];
export type CropId = typeof CROPS[number]['id'];
export const GROW_SECONDS=300;
export interface CropSlot {crop:CropId|null;growth:number;generation:number;coopBoosted?:boolean;withered?:boolean}
export interface GardenPatch {crop:CropId|null;generation:number;slots:CropSlot[];boost:number;biteCooldown:number;lastBiteSlot:number|null;poop?:{slot:number;at:number};insectChecked?:boolean}
export type AnimalSnapshot=Omit<AnimalResident,'allowed'|'trees'>;
export interface GardeningState {lastTick:number;activeSeconds:number;harvests:number;animals:AnimalSnapshot[];season:Season|null;animalPoop?:Record<string,{at?:number;check:number}>}
export interface GardenEnvironment extends AnimalWeather {season:Season;localTime?:string|null;localDate?:string;timeZone?:string;weatherSource?:string;allowPreview?:boolean}
export function cropMayGrow(crop:CropId,season:Season|null,localDate?:string):boolean {
    return season!==null&&(CROPS.find(c=>c.id===crop)?.season===season||eventAllowsCrop(crop,localDate));
}
export function freshPatch(season:Season|null):GardenPatch {
    const crop=CROPS.find(c=>c.season===season)?.id??null;
    return {crop,generation:0,slots:Array.from({length:4},()=>({crop,growth:0,generation:0})),boost:0,biteCooldown:0,lastBiteSlot:null};
}
const allLand=(state:TownState)=>[...state.entities,...(state.maps?.lake?.land.entities??[])];
/** Upgrade earlier mixed-slot turfs once on every map, preserving each plant's maturity. */
export function ensureTownGardens(state:TownState):TownState {
    const needsUpgrade=allLand(state).some(entity=>entity.blueprintId==='vegetable-patch'&&(!entity.garden||entity.garden.crop===undefined||entity.garden.generation===undefined||entity.garden.slots.some(slot=>slot.crop!==entity.garden!.crop)));
    if(!needsUpgrade)return state;
    const next=structuredClone(state);
    for(const entity of allLand(next).filter(e=>e.blueprintId==='vegetable-patch')) {
        const garden=entity.garden??freshPatch(null);
        const crop=garden.crop??garden.slots.find(slot=>slot.crop)?.crop??null;
        garden.crop=crop;garden.generation??=0;
        for(const slot of garden.slots)if(slot.crop!==crop){slot.crop=crop;slot.generation++;}
        entity.garden=garden;
    }
    next.revision++;return next;
}
export function snapshotAnimals(animals:AnimalResident[]):AnimalSnapshot[] {return animals.map(({allowed,trees,...rest})=>rest);}
export function restoreAnimals(entities:Entity[],snapshots:AnimalSnapshot[],world:AnimalWorldContext):AnimalResident[] {
    return createAnimalResidents(entities,snapshots,world);
}
export function cropStage(slot:CropSlot):number {return slot.growth>=GROW_SECONDS?3:slot.growth>=200?2:slot.growth>=75?1:0;}
/** Static area bonuses are shared by Town ticks, lake checkpoints and previews. */
export function advanceCropGrowth(patch:Entity,seconds:number,season:Season|null,localDate:string|undefined,nearChicken:boolean,nearInsects=false):void{
    const garden=patch.garden;if(!garden||seconds<=0)return;
    for(const slot of garden.slots)if(slot.crop&&!slot.withered&&cropMayGrow(slot.crop,season,localDate)){
        const bonus=nearChicken&&!slot.coopBoosted?60:0;
        slot.growth=Math.min(GROW_SECONDS,slot.growth+seconds+Math.min(seconds,garden.boost)*.25+bonus);
        if(bonus)slot.coopBoosted=true;
    }
    // Once per cycle, the first moment a covered plot has a ripe crop (even if the raiser arrived later).
    if(nearInsects&&!garden.insectChecked&&garden.slots.some(slot=>slot.crop&&!slot.withered&&slot.growth>=GROW_SECONDS)){
        garden.insectChecked=true;
        const crops=garden.slots.flatMap((slot,index)=>slot.crop&&!slot.withered?[index]:[]);
        for(const index of pickInsectLosses(patch.id,garden.generation,crops))garden.slots[index]!.withered=true;
    }
    garden.boost=Math.max(0,garden.boost-seconds);garden.biteCooldown=Math.max(0,garden.biteCooldown-seconds);
}
/** Contacts come exclusively from the shared server simulation, never from request bodies. */
export function applyGardenContacts(patch:Entity,animals:AnimalResident[]):void {
    const garden=patch.garden;if(!garden)return;
    for(const animal of animals) {
        if(animal.sleeping||animal.flying||animal.perched||animal.inactive||animal.mode!=='roaming')continue;
        const x=Math.floor(animal.x)-patch.x,y=Math.floor(animal.y)-patch.y;
        if(x<0||x>=2||y<0||y>=2)continue;
        // Water-duty ducks stay on their water; only land ducks help crops.
        if(emits('duck-crop-boost',`animal:${animal.species}`)&&affects('duck-crop-boost',patch.blueprintId)&&animal.duty!=='water'){garden.boost=30;continue;}
        if(!emits('grazing-bite',`animal:${animal.species}`)||!affects('grazing-bite',patch.blueprintId)||garden.biteCooldown>0)continue;
        const dog=animals.find(a=>a.id===animal.herderId);
        if(dog&&!dog.inactive&&dog.mode==='roaming'&&
            (animal.species==='sheep'?dog.species==='border-collie':dog.species==='australian-cattle-dog'))continue;
        const slotIndex=x*2+y,slot=garden.slots[slotIndex]!;
        if(!slot.crop||slot.withered||slot.growth<=0)continue;
        slot.growth=0;slot.generation++;slot.coopBoosted=false;garden.lastBiteSlot=slotIndex;garden.biteCooldown=60;
    }
}
/** Garden and land commands against one map's view (`state` is that map's landView). */
export function applyGardenCommand(state:TownState,mapId:MapId,command:TownCommand,id:string,now:number,season:Season|null,localDate?:string,allowPreview=false):TownState {
    if(command.type==='harvest-eggs')return harvestCoopEggs(state,command.entityId,command.generation,now);
    if(command.type==='collect-barn')return collectBarn(state,command.entityId,command.generation,now);
    if(command.type==='feed-animals')return feedBarnAnimals(state,command.entityId,now);
    if(command.type!=='plant'&&command.type!=='harvest') {
        const next=applyTownCommand(state,mapId,command,id,now,localDate,allowPreview);
        if(command.type==='build'&&command.blueprintId==='vegetable-patch'&&next!==state) {
            const patch=next.entities.find(e=>e.id===id)!;patch.garden=freshPatch(season);
        }
        return next;
    }
    const next=structuredClone(state),patch=next.entities.find(e=>e.id===command.entityId);
    if(!patch||patch.blueprintId!=='vegetable-patch'||!patch.garden)throw new Error('Select a vegetable patch.');
    const garden=patch.garden;
    if(command.generation!==garden.generation)throw new Error('This garden changed. Sync and try again.');
    if(command.type==='plant') {
        const crop=CROPS.find(c=>c.id===command.crop);
        if(!crop||!cropMayGrow(crop.id,season,localDate))throw new Error('Choose a crop for your current home season.');
        if(garden.crop===crop.id)return state;
        garden.crop=crop.id;
        for(const slot of garden.slots){slot.crop=crop.id;slot.growth=0;slot.generation++;slot.coopBoosted=false;delete slot.withered;}
        garden.insectChecked=false;
        garden.lastBiteSlot=null;
    } else {
        const ready=garden.slots.filter(slot=>slot.crop&&!slot.withered&&slot.growth>=GROW_SECONDS),withered=garden.slots.filter(slot=>slot.withered);
        if(!ready.length&&!withered.length)throw new Error('This crop is still growing.');
        const stamina=ready.length*2;
        if(!Number.isSafeInteger(next.materials.stamina+stamina))throw new Error('Storage is full.');
        next.materials.stamina+=stamina;
        // Ripe crops also go to storage, up to its limit.
        for(const slot of ready)storeCrop(next,slot.crop!,1);
        for(const slot of [...ready,...withered]){slot.growth=0;slot.generation++;slot.coopBoosted=false;delete slot.withered;}
        garden.insectChecked=false;
        next.gardening??={lastTick:0,activeSeconds:0,harvests:0,animals:[],season};
        next.gardening.harvests+=ready.length;
        if(ready.length)next.earned['town-first-harvest']??=new Date(now).toISOString();
        if(next.gardening.harvests>=20)next.earned['town-garden-basket']??=new Date(now).toISOString();
    }
    delete garden.poop;
    garden.generation++;
    next.revision++;return next;
}
