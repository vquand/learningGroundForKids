import {animalSpecies,type Entity,type TownAnimal,type TownState} from './game.ts';
import type {CropId} from './garden.ts';
import {settlePoultry} from './poultry.ts';
import {creditMaterials,settleStorage,storeMilk,storeYarn,takeCrop,storageOf} from './storage.ts';

/** Farmhouse products, in real time like coop eggs. Highland cows make yarn; pigs enjoy treats. */
export type BarnProduct='milk'|'wool'|'yarn';
export const BARN_SECONDS=6*60*60;
export const BARN_CAPACITY=12;
export const BARN_PRODUCTS={milk:{seconds:BARN_SECONDS,capacity:BARN_CAPACITY},wool:{seconds:BARN_SECONDS,capacity:BARN_CAPACITY},yarn:{seconds:12*60*60,capacity:6}} as const;
/** Each feeding banks one hour of double-speed production, up to four hours. */
export const FED_MS=60*60*1000,MAX_FED_MS=4*FED_MS;
export const FAVOURITE_CROPS:Partial<Record<TownAnimal,readonly CropId[]>>={
    'dairy-cow':['corn','cabbage'],'highland-cow':['broccoli','potato'],sheep:['peas','carrot'],pig:['pumpkin','potato','tomato'],
};
export interface BarnStock{stock:number;progress:number;lastTick:number;fedUntil:number;generation:number;species:TownAnimal}
export function barnProduct(entity:Pick<Entity,'blueprintId'|'animal'>):BarnProduct|null{
    if(entity.blueprintId!=='farmhouse')return null;
    const species=animalSpecies(entity);
    return species==='dairy-cow'?'milk':species==='sheep'?'wool':species==='highland-cow'?'yarn':null;
}
const barns=(state:TownState)=>[...state.entities,...(state.maps?.lake?.land.entities??[])].filter(e=>e.blueprintId==='farmhouse');
const fresh=(entity:Entity,now:number):BarnStock=>({stock:0,progress:0,lastTick:now,fedUntil:0,generation:0,species:animalSpecies(entity)!});
/** Accrue at one unit per BARN_SECONDS, twice as fast while fed. */
function settleBarn(barn:BarnStock,now:number,product:BarnProduct|null):void{
    const from=barn.lastTick,to=Math.max(now,from),{seconds,capacity}=BARN_PRODUCTS[product??'milk'];
    if(product&&barn.stock<capacity){
        const fed=Math.max(0,Math.min(to,barn.fedUntil)-from)/1000,plain=(to-from)/1000-fed;
        const total=barn.progress+plain+fed*2,made=Math.floor(total/seconds);
        barn.stock=Math.min(capacity,barn.stock+made);
        barn.progress=barn.stock===capacity?0:total%seconds;
    }else barn.progress=0;
    barn.lastTick=to;
}
/** Root state: every farmhouse on every map. A species switch starts a fresh barn without inventing stock. */
export function settleBarns(state:TownState,now:number):TownState{
    for(const entity of barns(state)){
        const species=animalSpecies(entity)!;
        if(!entity.barn||entity.barn.species!==species){entity.barn={...fresh(entity,now),generation:(entity.barn?.generation??-1)+1};continue;}
        settleBarn(entity.barn,now,barnProduct(entity));
    }
    return state;
}
/** Everything that accrues on the wall clock: eggs, barns and spoiling storage. */
export function settleFarm(state:TownState,now:number):TownState{return settleStorage(settleBarns(settlePoultry(state,now),now),now);}
export const farmProjection=(state:TownState,now:number)=>settleFarm(structuredClone(state),now);
export const barnStock=(barn:BarnStock|undefined,now:number,product:BarnProduct|null)=>{if(!barn)return 0;const copy={...barn};settleBarn(copy,now,product);return copy.stock;};
/** Share of the next unit already banked, at the display clock; full when the basket is at capacity. */
export const barnProgress=(barn:BarnStock|undefined,now:number,product:BarnProduct|null)=>{if(!barn||!product)return 0;const copy={...barn};settleBarn(copy,now,product);return copy.stock>=BARN_PRODUCTS[product].capacity?1:copy.progress/BARN_PRODUCTS[product].seconds;};

function hostBarn(next:TownState,entityId:string,now:number):{entity:Entity;barn:BarnStock}{
    const entity=next.entities.find(e=>e.id===entityId);
    if(entity?.blueprintId!=='farmhouse')throw new Error('Choose a farmhouse.');
    if(!entity.barn||entity.barn.species!==animalSpecies(entity))entity.barn=fresh(entity,now);
    settleBarn(entity.barn,now,barnProduct(entity));
    return {entity,barn:entity.barn};
}
/** Any map's view. Uses one favourite crop from storage and banks an hour of feeding. */
export function feedBarnAnimals(state:TownState,entityId:string,now:number):TownState{
    const next=structuredClone(state),{entity,barn}=hostBarn(next,entityId,now);
    const favourites=FAVOURITE_CROPS[animalSpecies(entity)!]??[];
    const crop=favourites.find(c=>(storageOf(next).crops[c]??0)>0);
    if(!crop)throw new Error('Store one of their favourite crops first.');
    if(Math.max(barn.fedUntil,now)-now>=MAX_FED_MS)throw new Error('They are full. Feed them again later.');
    takeCrop(next,crop);
    barn.fedUntil=Math.min(now+MAX_FED_MS,Math.max(barn.fedUntil,now)+FED_MS);
    next.revision++;return next;
}
/** Milk and non-spoiling yarn go to item storage; wool goes to non-spoiling item storage. Limits apply. */
export function collectBarn(state:TownState,entityId:string,generation:number,now:number):TownState{
    const next=structuredClone(state),{entity,barn}=hostBarn(next,entityId,now),product=barnProduct(entity);
    if(barn.generation!==generation)throw new Error('This farmhouse changed. Sync and try again.');
    if(!product||!barn.stock)throw new Error('Nothing to collect yet.');
    const kept=product==='milk'?storeMilk(next,barn.stock,now):product==='yarn'?storeYarn(next,barn.stock):creditMaterials(next,{wool:barn.stock}).wool??0;
    if(!kept)throw new Error(`Your storage has no room for more ${product}.`);
    barn.stock-=kept;barn.generation++;
    next.revision++;return next;
}
