import {pickInsectLosses} from '../gardenEffects.ts';
import {LAKE_GROW_SECONDS,LAKE_PLANTS} from './catalog.ts';
import {raftArea,raftFootprint} from './behavior.ts';
import {affects,emits,footprintInArea} from '../areaOfEffect.ts';
import type {LakeRaft} from './types.ts';
import type {MapId} from '../maps/types.ts';
export const RAFT_PLANT_COUNT=6;
/** Only standalone on-water raisers damage floating plants. */
export function plantRaftInsectCovered(raft:LakeRaft,rafts:readonly LakeRaft[],mapId:MapId):boolean{
 return affects('floating-plant-wither',raft.blueprintId)&&rafts.some(r=>emits('floating-plant-wither',r.blueprintId)&&footprintInArea(raftArea(mapId,r,'water'),raftFootprint(raft)));
}
export function healthyRaftPlants(raft:LakeRaft):number{return raft.plant?RAFT_PLANT_COUNT-(raft.witheredPlants?.length??0):0;}
export function plantRaftReward(raft:LakeRaft):number{return raft.plant?healthyRaftPlants(raft)*LAKE_PLANTS[raft.plant].stamina:0;}
/** Once per plant cycle, the first moment a covered raft holds ripe plants: a quarter of them (rounded up)
 * wither. Duck help, moving and retries cannot reroll which ones. */
export function advanceRaftPlants(raft:LakeRaft,seconds:number,rafts:readonly LakeRaft[],mapId:MapId):void{
 if(!raft.plant||seconds<=0)return;
 raft.plantGrowth=Math.min(LAKE_GROW_SECONDS,raft.plantGrowth+seconds);
 if(raft.plantGrowth<LAKE_GROW_SECONDS||raft.plantInsectChecked||!plantRaftInsectCovered(raft,rafts,mapId))return;
 raft.plantInsectChecked=true;
 raft.witheredPlants=pickInsectLosses(raft.id,raft.plantCycle??0,Array.from({length:RAFT_PLANT_COUNT},(_,i)=>i));
}
export function replantRaft(raft:LakeRaft):void{
 raft.plantGrowth=0;raft.duckBoosted=false;raft.plantCycle=(raft.plantCycle??0)+1;raft.plantInsectChecked=false;delete raft.witheredPlants;
}
