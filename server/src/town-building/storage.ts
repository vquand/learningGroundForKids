import {MATERIALS,type Material,type TownState} from './game.ts';
import type {CropId} from './garden.ts';
import {LAKE_FISH_IDS,type LakeFishId} from './water/catalog.ts';

/** Building materials limited by storage; stamina is energy and stays unlimited. */
export const STORED_MATERIALS=['wood','rock','sand','metal'] as const satisfies readonly Material[];
export const ITEM_LIMIT={basic:10,storage:1000} as const;
export const MATERIAL_LIMIT={basic:2000,storage:5000} as const;
/** Fish and milk spoil after three days on the wall clock. */
export const SPOIL_MS=3*24*60*60*1000;
export interface StoredBatch{count:number;at:number}
/** One store shared by every map. Fish counts stay in the water-care reserve; their dates live here. */
export interface TownStorage{
    /** Whether any map has a Town Storage, refreshed whenever the root state settles. */
    built:boolean;
    crops:Partial<Record<CropId,number>>;
    milk:StoredBatch[];
    /** Distinct non-spoiling animal products; absent in older saves. */
    wool?:number;
    yarn?:number;
    fish:Partial<Record<LakeFishId,StoredBatch[]>>;
}
export const storageBuildings=(state:TownState)=>state.storageBuildingCount??[...state.entities,...(state.maps?.lake?.land.entities??[])].filter(e=>e.blueprintId==='town-storage').length;
export function storageOf(state:TownState):TownStorage{return state.storage??={built:false,crops:{},milk:[],fish:{}};}
export const itemLimit=(state:TownState)=>storageBuildings(state)?1000+2000*(storageBuildings(state)-1):ITEM_LIMIT.basic;
export const materialLimit=(state:TownState)=>storageBuildings(state)?MATERIAL_LIMIT.storage:MATERIAL_LIMIT.basic;
export const batchTotal=(batches:readonly StoredBatch[]|undefined)=>(batches??[]).reduce((sum,b)=>sum+b.count,0);
/** Room for one more kind of item: never negative, so stock already over a lowered limit is kept but not grown. */
const room=(have:number,limit:number)=>Math.max(0,limit-have);

/** Root state only: refresh `built`, drop spoiled batches and date fish already in the reserve. */
export function settleStorage(state:TownState,now:number):TownState{
    const storage=storageOf(state);
    storage.built=storageBuildings(state)>0;
    const legacy=state.materials as typeof state.materials & {wool?:number};
    if(!state.woolMigrated){
        if((legacy.wool??0)>0)storage.wool=Math.min(itemLimit(state),(storage.wool??0)+Math.max(0,legacy.wool??0));
        state.woolMigrated=true;
    }
    delete legacy.wool;
    storage.milk=storage.milk.filter(b=>now-b.at<SPOIL_MS&&b.count>0);
    const reserve=state.maps?.lake?.reserve;
    if(reserve)for(const species of Object.keys(reserve) as LakeFishId[]){
        let batches=storage.fish[species]??[];
        // Fish stocked before batches existed are dated now: nothing spoils retroactively.
        const known=batchTotal(batches),have=reserve[species]??0;
        if(have>known)batches=[...batches,{count:have-known,at:now}];
        else if(have<known)batches=consume(batches,known-have);
        const fresh=batches.filter(b=>now-b.at<SPOIL_MS&&b.count>0);
        reserve[species]=batchTotal(fresh);storage.fish[species]=fresh;
    }
    return state;
}
/** Oldest first. */
function consume(batches:StoredBatch[],count:number):StoredBatch[]{
    const next=batches.map(b=>({...b})).sort((a,b)=>a.at-b.at);let left=count;
    for(const batch of next){const used=Math.min(batch.count,left);batch.count-=used;left-=used;}
    return next.filter(b=>b.count>0);
}
/** Adds up to the limit and returns how many were stored. */
export function storeCrop(state:TownState,crop:CropId,count:number):number{
    const storage=storageOf(state),stored=Math.min(count,room(storage.crops[crop]??0,itemLimit(state)));
    if(stored)storage.crops[crop]=(storage.crops[crop]??0)+stored;
    return stored;
}
export function takeCrop(state:TownState,crop:CropId):boolean{
    const storage=storageOf(state),have=storage.crops[crop]??0;
    if(have<1)return false;
    if(have===1)delete storage.crops[crop];else storage.crops[crop]=have-1;
    return true;
}
export function storeMilk(state:TownState,count:number,now:number):number{
    const storage=storageOf(state),stored=Math.min(count,room(batchTotal(storage.milk),itemLimit(state)));
    if(stored)storage.milk.push({count:stored,at:now});
    return stored;
}
/** Water-care fish gains: clamp the reserve and date the batch. Returns how many were kept. */
export function storeFish(state:TownState,species:LakeFishId,count:number,now:number):number{
    const reserve=state.maps?.lake?.reserve;if(!reserve)return 0;
    const storage=storageOf(state),stored=Math.min(count,room(reserve[species]??0,itemLimit(state)));
    if(stored){reserve[species]=(reserve[species]??0)+stored;(storage.fish[species]??=[]).push({count:stored,at:now});}
    return stored;
}
/** Building-material gains clamp to the limit; stamina is never limited. Returns what was credited. */
export function creditMaterials(state:TownState,gain:Partial<Record<Material|'wool',number>>):Partial<Record<Material|'wool',number>>{
    const credited:Partial<Record<Material|'wool',number>>={},limit=materialLimit(state);
    const wool=storeWool(state,gain.wool??0);if(wool)credited.wool=wool;
    for(const material of MATERIALS){
        const value=gain[material]??0;if(value<=0)continue;
        const amount=(STORED_MATERIALS as readonly Material[]).includes(material)?Math.min(value,room(state.materials[material],limit)):value;
        if(!Number.isSafeInteger(state.materials[material]+amount))throw new Error('Storage is full.');
        state.materials[material]+=amount;if(amount)credited[material]=amount;
    }
    return credited;
}

/** Yarn is an item, distinct from wool or a perishable batch. */
export function storeYarn(state:TownState,count:number):number{
    const storage=storageOf(state),stored=Math.min(count,room(storage.yarn??0,itemLimit(state)));
    if(stored)storage.yarn=(storage.yarn??0)+stored;
    return stored;
}

export interface StorageLoss {kind:'crop'|'milk'|'yarn'|'item'|'fish'|'material';id:string;amount:number}
export interface StorageRemovalReceipt {oldItemLimit:number;newItemLimit:number;oldMaterialLimit:number;newMaterialLimit:number;lastStorage:boolean;losses:StorageLoss[];confirmation:string}
/** Pure preview on the shared root, before removing exactly one storage. */
export function storageRemoval(state:TownState):StorageRemovalReceipt {
 const count=storageBuildings(state),newItemLimit=count>1?1000+2000*(count-2):10,newMaterialLimit=count>1?5000:2000;
 const losses:StorageLoss[]=[];
 const add=(kind:StorageLoss['kind'],id:string,have:number,limit:number)=>{if(have>limit)losses.push({kind,id,amount:have-limit});};
 for(const [id,amount] of Object.entries(state.storage?.crops??{}))add('crop',id,amount,newItemLimit);
 add('item','wool',state.storage?.wool??0,newItemLimit);
 add('milk','milk',batchTotal(state.storage?.milk),newItemLimit);add('yarn','yarn',state.storage?.yarn??0,newItemLimit);
 for(const [id,amount] of Object.entries(state.maps?.lake?.reserve??{}))add('fish',id,amount,newItemLimit);
 for(const id of STORED_MATERIALS)add('material',id,state.materials[id],newMaterialLimit);
 losses.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
 const result={oldItemLimit:itemLimit(state),newItemLimit,oldMaterialLimit:materialLimit(state),newMaterialLimit,lastStorage:count===1,losses};
 return {...result,confirmation:JSON.stringify(result)};
}
/** Only called after confirmation, in the removal transaction. */
export function discardStorageLoss(state:TownState,receipt:StorageRemovalReceipt):void {
 const storage=storageOf(state);
 for(const loss of receipt.losses){
  if(loss.kind==='material')state.materials[loss.id as typeof STORED_MATERIALS[number]]-=loss.amount;
  else if(loss.kind==='crop')storage.crops[loss.id as CropId]=(storage.crops[loss.id as CropId]??0)-loss.amount;
  else if(loss.kind==='item')storage.wool=(storage.wool??0)-loss.amount;
  else if(loss.kind==='yarn')storage.yarn=(storage.yarn??0)-loss.amount;
  else if(loss.kind==='milk')storage.milk=consume(storage.milk,loss.amount);
  else {const species=loss.id as LakeFishId;storage.fish[species]=consume(storage.fish[species]??[],loss.amount);if(state.maps?.lake)state.maps.lake.reserve[species]=(state.maps.lake.reserve[species]??0)-loss.amount;}
 }
 storage.built=storageBuildings(state)>0;
}

/** Non-spoiling animal product, independently capped like yarn. */
export function storeWool(state:TownState,count:number):number {
 const storage=storageOf(state),stored=Math.min(count,room(storage.wool??0,itemLimit(state)));
 if(stored>0)storage.wool=(storage.wool??0)+stored;
 return stored;
}

/** Shared spending path for stored animal products; perishables leave oldest first. */
export function spendStoredProduct(state:TownState,item:import('./shopTypes.ts').ShopItem,count:number):void {
 const storage=storageOf(state);
 const have=item==='milk'?batchTotal(storage.milk):item==='wool'||item==='yarn'?storage[item]??0:state.maps?.lake?.reserve[item]??0;
 if(!Number.isSafeInteger(count)||count<1||have<count)throw new Error('Not enough stored product.');
 if(item==='wool'||item==='yarn')storage[item]=have-count;
 else if(item==='milk')storage.milk=consume(storage.milk,count);
 else {
  if(batchTotal(storage.fish[item])<count)throw new Error('Fish stock must be settled before spending.');
  storage.fish[item]=consume(storage.fish[item]??[],count);
  if(state.maps?.lake)state.maps.lake.reserve[item]=have-count;
 }
}

/** Total spendable fish: only the Lake reserve pays (fish in homes and nurseries cannot), like the shop. */
export function availableFishCount(state: TownState): number {
  const reserve = state.maps?.lake?.reserve;
  let total = 0;
  if (reserve) for (const species of LAKE_FISH_IDS) total += reserve[species] ?? 0;
  return total;
}

/** Spends `count` fish of any species from the Lake reserve, oldest stored units first. */
export function spendFish(state: TownState, count = 1): void {
  if (count <= 0) return;
  const storage = storageOf(state);
  interface FishCandidate {
    species: LakeFishId;
    at: number;
  }
  const candidates: FishCandidate[] = [];
  for (const species of LAKE_FISH_IDS) {
    const reserveCount = state.maps?.lake?.reserve?.[species] ?? 0;
    if (reserveCount < 1) continue;
    // Batches only supply the age; they never add stock beyond the reserve.
    let left = reserveCount;
    for (const b of storage.fish[species] ?? []) {
      for (let i = 0; i < b.count && left > 0; i++, left--) candidates.push({ species, at: b.at ?? 0 });
    }
    for (; left > 0; left--) candidates.push({ species, at: 0 });
  }
  if (candidates.length < count) throw new Error('Not enough stored fish.');
  candidates.sort((a, b) => a.at - b.at || a.species.localeCompare(b.species));
  for (let i = 0; i < count; i++) {
    const chosen = candidates[i]!;
    if (batchTotal(storage.fish[chosen.species]) >= 1) spendStoredProduct(state, chosen.species, 1);
    else state.maps!.lake!.reserve[chosen.species] = (state.maps!.lake!.reserve[chosen.species] ?? 0) - 1;
  }
}
