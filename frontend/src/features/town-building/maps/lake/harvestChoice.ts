import type {TownState} from '../../../../../../server/src/town-building/game.ts';
import type {WaterCommandBody} from '../../../../../../server/src/town-building/water/types.ts';
import type {MapId} from '../../../../../../server/src/town-building/maps/types.ts';
import {landView} from '../../../../../../server/src/town-building/maps/view.ts';
import type {LakeFishId,LakePlantId} from '../../../../../../server/src/town-building/water/catalog.ts';
export type LakeHarvestChoice={receipt:string;raftId:string}&({kind:'fish';type:LakeFishId}|{kind:'plant';type:LakePlantId});
/** Only the successful action response can open this prompt. Reads, failed
 * requests and partial fish harvests never infer an empty raft from animation. */
export function harvestChoice(before:TownState,after:TownState,mapId:MapId,command:WaterCommandBody):LakeHarvestChoice|undefined{
 if(!['harvest-fish','harvest-plant'].includes(command.type)||!('raftId' in command)||after.revision<=before.revision)return;
 const rafts=(state:TownState)=>landView(state,mapId).rafts??[];
 const old=rafts(before).find(r=>r.id===command.raftId),next=rafts(after).find(r=>r.id===command.raftId);
 if(!old||!next||next.generation<=old.generation)return;
 const receipt=`${next.id}:${after.revision}`;
 if(command.type==='harvest-fish'&&old.blueprintId==='nursery'&&old.fish[0]&&!next.fish.length)return{receipt,raftId:next.id,kind:'fish',type:old.fish[0].species};
 if(command.type==='harvest-plant'&&old.plant&&next.plant===old.plant&&next.plantGrowth===0)return{receipt,raftId:next.id,kind:'plant',type:old.plant};
}
