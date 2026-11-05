import {CROPS,GROW_SECONDS} from '../../../../server/src/town-building/garden';
import {BARN_PRODUCTS,barnProduct,barnProgress,barnStock} from '../../../../server/src/town-building/barn';
import {EGG_CAPACITY,EGG_SECONDS,coopEggCount} from '../../../../server/src/town-building/poultry';
import type {Entity} from '../../../../server/src/town-building/game';
import type {MapId} from '../../../../server/src/town-building/maps/types';
import {LAKE_FISH,LAKE_GROW_SECONDS} from '../../../../server/src/town-building/water/catalog';
import {feedingSources,fishGrowthMultiplier} from '../../../../server/src/town-building/water/behavior';
import {healthyRaftPlants} from '../../../../server/src/town-building/water/plantEffects';
import type {LakeRaft} from '../../../../server/src/town-building/water/types';
import type {BuildingProgress} from './BuildingDetailCard';
import {EggIcon} from './PoultryUi';
import {MilkIcon,WoolIcon,YarnIcon} from './BarnUi';
import {Sprite} from './TownArt';
import {LakeArt,LakePlantIcon} from './maps/lake/LakeArt';

const BARN_LABELS={milk:['Next milk','Milk basket full'],yarn:['Next yarn','Yarn basket full'],wool:['Next wool','Wool basket full']} as const;
/** What a land building is raising, shared by every map's detail card.
 * `extraSeconds` is display time past the last server state (never credited). */
export function landProgress(entity:Entity|undefined,now=Date.now(),extraSeconds=0):BuildingProgress|null{
    if(!entity)return null;
    const eggs=entity.poultry;
    if(eggs&&eggs.rate>0){
        const count=coopEggCount(eggs,now),full=count>=EGG_CAPACITY;
        const progress=eggs.progress+Math.max(0,(now-eggs.lastTick)/1000)*eggs.rate;
        return {icon:<EggIcon/>,count,value:full?1:(progress%EGG_SECONDS)/EGG_SECONDS,max:1,label:full?'Egg basket full':'Next egg'};
    }
    const product=barnProduct(entity);
    if(product){
        const count=barnStock(entity.barn,now,product),full=count>=BARN_PRODUCTS[product].capacity,[next,fullLabel]=BARN_LABELS[product];
        return {icon:product==='milk'?<MilkIcon/>:product==='yarn'?<YarnIcon/>:<WoolIcon/>,count,value:barnProgress(entity.barn,now,product),max:1,label:full?fullLabel:next};
    }
    const garden=entity.garden;
    if(garden?.crop){
        const growing=garden.slots.filter(slot=>slot.crop&&!slot.withered),index=CROPS.findIndex(crop=>crop.id===garden.crop);
        if(!growing.length)return null;
        const average=growing.reduce((sum,slot)=>sum+Math.min(GROW_SECONDS,slot.growth+extraSeconds),0)/growing.length;
        return {icon:<Sprite file="crop-growth" index={index*4+3} columns={4} rows={8}/>,count:growing.length,value:average,max:GROW_SECONDS,label:average>=GROW_SECONDS?'Ready to harvest':'Growing'};
    }
    return null;
}
/** Fish or water plants raised on a water structure, on any map. */
export function raftProgress(raft:LakeRaft,rafts:readonly LakeRaft[],mapId:MapId,extraSeconds=0):BuildingProgress|null{
    if(['nursery','friendly'].includes(raft.blueprintId)&&raft.fish.length){
        const multiplier=fishGrowthMultiplier(raft,feedingSources(rafts,mapId));
        const growth=raft.fish.reduce((n,f)=>n+Math.min(LAKE_GROW_SECONDS,f.growth+extraSeconds*multiplier),0)/raft.fish.length;
        return {icon:<LakeArt fish index={LAKE_FISH[raft.fish[0]!.species].art*4+2}/>,count:raft.fish.length,value:growth,max:LAKE_GROW_SECONDS,label:growth>=LAKE_GROW_SECONDS?'Ready to collect':'Fish growing'};
    }
    if(raft.blueprintId==='floating-garden'&&raft.plant){
        const growth=Math.min(LAKE_GROW_SECONDS,raft.plantGrowth+extraSeconds);
        return {icon:<LakePlantIcon plant={raft.plant}/>,count:healthyRaftPlants(raft),value:growth,max:LAKE_GROW_SECONDS,label:growth>=LAKE_GROW_SECONDS?'Ready to harvest':'Plants growing'};
    }
    return null;
}
