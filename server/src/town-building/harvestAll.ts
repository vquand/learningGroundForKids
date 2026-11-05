import {AppError} from '../errors.ts';
import {MATERIALS,type TownState} from './game.ts';
import {CROP_IDS,GROW_SECONDS} from './garden.ts';
import {barnProduct} from './barn.ts';
import {applyMapLandCommand,type LandClock} from './maps/land.ts';
import {applyLakeCommand} from './maps/lake/game.ts';
import {landView} from './maps/view.ts';
import type {MapId} from './maps/types.ts';
import type {LakeRaft} from './water/types.ts';
import {LAKE_FISH_IDS,LAKE_GROW_SECONDS,type LakeFishId} from './water/catalog.ts';
import {healthyRaftPlants,RAFT_PLANT_COUNT} from './water/plantEffects.ts';
import {batchTotal} from './storage.ts';
import {harvestTargets,type HarvestTarget,type LandHarvest,type WaterHarvest} from './harvestReadiness.ts';
import type {HarvestAllCommand,HarvestItem,HarvestProduct,HarvestReceipt,HarvestReward} from './harvestTypes.ts';

/** Committed receipts kept per profile for retries. An older retry can no longer dedupe; it is stale. */
export const HARVEST_LEDGER_LIMIT=32;
export interface HarvestAllOutcome {state:TownState;receipt:HarvestReceipt}
type Catches=Partial<Record<LakeFishId,number>>;
type Counts=Map<HarvestItem,number>;
/** What one target actually produced. A batch merges a target's tally only once that target is kept. */
interface Tally {replanted:number;notReplanted:HarvestProduct[];products:Counts}
/** Product a target would store or count, read from the books before its command runs. */
interface Pending {item:HarvestItem;amount:number}

const emptyTally=():Tally=>({replanted:0,notReplanted:[],products:new Map()});
const gain=(before:number|undefined,after:number|undefined)=>Math.max(0,(after??0)-(before??0));
const raftIn=(state:TownState,mapId:MapId,raftId:string):LakeRaft=>{
    const raft=landView(state,mapId).rafts?.find(r=>r.id===raftId);
    if(!raft)throw new Error('This raft is no longer here.');
    return raft;
};
const addCount=(counts:Counts,item:HarvestItem,amount:number)=>{if(amount>0)counts.set(item,(counts.get(item)??0)+amount);};
const toProducts=(counts:Counts):HarvestProduct[]=>[...counts].map(([item,amount])=>({item,amount}));

/** Ready product a target would store or count. Read before its command runs, so a refusal can say what stayed. */
function pendingOf(state:TownState,mapId:MapId,target:HarvestTarget):Pending[] {
    if(target.kind==='water'){
        const raft=raftIn(state,mapId,target.command.raftId);
        if(target.command.type==='harvest-plant')return raft.plant?[{item:raft.plant,amount:healthyRaftPlants(raft)}]:[];
        const ready=raft.fish.filter(f=>f.growth>=LAKE_GROW_SECONDS),species=ready[0]?.species;
        return species?[{item:species,amount:ready.length}]:[];
    }
    const {command}=target,entity=landView(state,mapId).entities.find(e=>e.id===command.entityId);
    if(command.type==='harvest-eggs')return [{item:'egg',amount:entity?.poultry?.eggs??0}];
    if(command.type==='collect-barn'){
        const product=entity?barnProduct(entity):null;
        return product?[{item:product,amount:entity?.barn?.stock??0}]:[];
    }
    // A vegetable patch holds one crop type; withered slots yield nothing to store.
    const counts:Counts=new Map();
    for(const slot of entity?.garden?.slots??[])if(slot.crop&&!slot.withered&&slot.growth>=GROW_SECONDS)addCount(counts,slot.crop,1);
    return [...counts].map(([item,amount])=>({item,amount}));
}

/** What one manual harvest actually stored or counted, read from the books it touched. */
function storedProducts(before:TownState,after:TownState):[HarvestItem,number][] {
    const out:[HarvestItem,number][]=[];
    for(const crop of CROP_IDS)out.push([crop,gain(before.storage?.crops[crop],after.storage?.crops[crop])]);
    out.push(['egg',gain(before.poultry?.harvested,after.poultry?.harvested)]);
    out.push(['milk',gain(batchTotal(before.storage?.milk),batchTotal(after.storage?.milk))]);
    out.push(['wool',gain(before.storage?.wool,after.storage?.wool)]);
    out.push(['yarn',gain(before.storage?.yarn,after.storage?.yarn)]);
    for(const fish of LAKE_FISH_IDS)out.push([fish,gain(before.maps?.lake?.reserve[fish],after.maps?.lake?.reserve[fish])]);
    return out;
}
/** Stamina and material credits after storage limits, for the cosmetic reward feedback only. */
function rewardOf(before:TownState,after:TownState):HarvestReward {
    const reward:HarvestReward={};
    for(const material of MATERIALS){const amount=gain(before.materials[material],after.materials[material]);if(amount)reward[material]=amount;}
    const milk=gain(batchTotal(before.storage?.milk),batchTotal(after.storage?.milk)),yarn=gain(before.storage?.yarn,after.storage?.yarn);
    const wool=gain(before.storage?.wool,after.storage?.wool);if(wool)reward.wool=wool;
    if(milk)reward.milk=milk;
    if(yarn)reward.yarn=yarn;
    return reward;
}

/** Harvest every ready item of one category on one map in one revision-checked transaction.
 * Each target runs the existing manual command on a copy, so payouts, stamina, counters and awards
 * are exactly the manual ones. Each target is all-or-nothing on its own: a target that is refused,
 * or whose crops or fish would not all fit in storage, is skipped and its product stays in the world
 * (reported in `notCollected`). A barn keeps the manual partial collect: what fits is stored and the
 * rest stays in the barn. Only a batch where no target is kept rejects, with no revision bump. The
 * caller holds the profile's row lock; `catches` are the verified Fishing Friends counts. */
export function applyHarvestAll(previous:TownState,expectedRevision:number,command:HarvestAllCommand,now:number,environment:LandClock,catches?:Catches):HarvestAllOutcome {
    const {mapId,category}=command;
    const saved=previous.harvestReceipts?.find(r=>r.expectedRevision===expectedRevision&&r.mapId===mapId&&r.category===category);
    if(saved){const {expectedRevision:_,...receipt}=saved;return {state:previous,receipt:{...receipt,notCollected:receipt.notCollected??[],duplicate:true}};}
    if(previous.revision!==expectedRevision)throw new AppError(409,'TOWN_STALE','Your town changed. Sync and try again.');
    const targets=harvestTargets(previous,mapId,category);
    if(!targets.length)throw new AppError(409,'HARVEST_EMPTY','Nothing is ready to harvest on this map.');
    const lakeCatches:Catches=catches??previous.maps?.lake?.catches??{};
    let state=structuredClone(previous);
    const tally=emptyTally(),left:Counts=new Map();
    /** One entry per skipped target: whether storage was the reason. */
    const skipped:boolean[]=[];
    let kept=0;
    const skip=(pending:Pending[],storage:boolean)=>{for(const {item,amount} of pending)addCount(left,item,amount);skipped.push(storage);};

    for(const [index,target] of targets.entries()){
        const before=state,key=`bulk:${expectedRevision}:${index}`,local=emptyTally();
        const pending=pendingOf(before,mapId,target);
        let next:TownState;
        try {
            next=target.kind==='land'
                ? harvestLand(before,mapId,target.command,now,environment,key,local)
                : harvestWater(before,target.command,now,key,lakeCatches,local);
        } catch(error) {
            // The manual rule refused this target. A barn refuses only when storage has no room left.
            if(!(error instanceof Error))throw error;
            skip(pending,target.kind==='land'&&target.command.type==='collect-barn');
            continue;
        }
        const gains=new Map(storedProducts(before,next));
        // Crops and fish are discarded by the manual rule when they overflow storage, so the whole target waits.
        const storedBound=target.kind==='land'?target.command.type==='harvest':target.command.type==='harvest-fish';
        if(storedBound&&pending.some(p=>(gains.get(p.item)??0)<p.amount)){skip(pending,true);continue;}

        state=next;kept++;
        tally.replanted+=local.replanted;tally.notReplanted.push(...local.notReplanted);
        for(const [item,amount] of local.products)addCount(tally.products,item,amount);
        for(const [item,amount] of gains)addCount(tally.products,item,amount);
        if(target.kind==='land'&&target.command.type==='collect-barn'){
            // Partial barn collects keep the rest in the barn; the rest is reported, not lost.
            const rest=landView(next,mapId).entities.find(e=>e.id===target.command.entityId)?.barn?.stock??0;
            const item=pending[0]?.item;
            if(item&&rest>0)addCount(left,item,rest);
        }
    }

    if(!kept){
        if(skipped.length&&skipped.every(Boolean))throw new AppError(409,'HARVEST_STORAGE_FULL','Your storage is full. Make room, then harvest again.');
        throw new AppError(409,'HARVEST_EMPTY','Nothing could be harvested on this map right now.');
    }
    state.revision=previous.revision+1;
    const receipt:HarvestReceipt={
        id:`harvest-all:${mapId}:${category}:${state.revision}`,
        revision:state.revision,mapId,category,
        products:toProducts(tally.products),
        replanted:tally.replanted,notReplanted:tally.notReplanted,
        notCollected:toProducts(left),
        reward:rewardOf(previous,state),
        duplicate:false,
    };
    const {duplicate:_,...record}=receipt;
    state.harvestReceipts=[...(previous.harvestReceipts??[]),{...record,expectedRevision}].slice(-HARVEST_LEDGER_LIMIT);
    return {state,receipt};
}

/** Vegetable patches, coops and barns use their manual commands unchanged. A patch harvest resets
 * every ripe and withered slot and bumps its generation, so replanting is counted from those bumps. */
function harvestLand(state:TownState,mapId:MapId,command:LandHarvest,now:number,environment:LandClock,key:string,tally:Tally):TownState {
    const slotsOf=(s:TownState)=>landView(s,mapId).entities.find(e=>e.id===command.entityId)?.garden?.slots??[];
    const slotsBefore=command.type==='harvest'?slotsOf(state):[];
    const next=applyMapLandCommand(state,{type:'land-action',mapId,command},now,key,environment);
    if(command.type==='harvest')tally.replanted+=slotsOf(next).filter((slot,i)=>slot.generation!==slotsBefore[i]?.generation).length;
    return next;
}

/** Nursery fish and floating gardens. Manual rules still apply: a queued species restocks only when
 * the raft empties; otherwise the harvested count is restocked free once the child has caught 10. */
function harvestWater(state:TownState,command:WaterHarvest,now:number,key:string,catches:Catches,tally:Tally):TownState {
    const raft=raftIn(state,command.mapId,command.raftId);
    let next=applyLakeCommand(state,command,now,key,catches);
    if(command.type==='harvest-plant'){
        // The manual harvest replants all six pockets itself (withered ones too, for free).
        if(raft.plant){addCount(tally.products,raft.plant,healthyRaftPlants(raft));tally.replanted+=RAFT_PLANT_COUNT;}
        return next;
    }
    const ready=raft.fish.filter(f=>f.growth>=LAKE_GROW_SECONDS),species=ready[0]?.species;
    if(!species)throw new Error('No fish are ready yet.');
    const remaining=raft.fish.length-ready.length;
    if(raft.nextFish&&remaining===0){
        // The queued species was restocked in full by the manual harvest.
        tally.replanted+=raftIn(next,command.mapId,command.raftId).fish.length;
    }else if(raft.nextFish||(catches[species]??0)<10){
        // A queued switch waits for the raft to empty; an uncaught species cannot be restocked free.
        tally.notReplanted.push({item:species,amount:ready.length});
    }else{
        const before=raftIn(next,command.mapId,command.raftId).fish.length;
        // Restock no more than was harvested, under the manual stocking rules.
        next=applyLakeCommand(next,{type:'stock',mapId:command.mapId,raftId:command.raftId,species},now,`${key}:regrow`,catches,ready.length);
        tally.replanted+=raftIn(next,command.mapId,command.raftId).fish.length-before;
    }
    return next;
}
