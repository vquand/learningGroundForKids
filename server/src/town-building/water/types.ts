import type {Cost} from '../game.ts';
import type {MapId} from '../maps/types.ts';
import type {LakeFishId,LakePlantId,LakeBlueprintId} from './catalog.ts';
export interface LakeFish {id:string;species:LakeFishId;growth:number;duckBoosted?:boolean}
export interface LakeRaft {
    id:string;blueprintId:LakeBlueprintId;x:number;y:number;paidCost:Cost;
    generation:number;fish:LakeFish[];plant:LakePlantId|null;plantGrowth:number;feeder:boolean;
    duckBoosted?:boolean;
    plantCycle?:number;plantInsectChecked?:boolean;witheredPlants?:number[];
    nextFish?:LakeFishId;
}
export type WaterCommandBody=
    |{type:'build-raft';blueprintId:LakeBlueprintId;x:number;y:number}
    |{type:'move-raft';raftId:string;x:number;y:number}
    |{type:'remove-raft';raftId:string}
    |{type:'stock';raftId:string;species:LakeFishId}
    |{type:'set-next-fish';raftId:string;species:LakeFishId}
    |{type:'transfer-fish';raftId:string;species:LakeFishId}
    |{type:'reserve-fish';raftId:string}
    |{type:'harvest-fish';raftId:string;generation:number}
    |{type:'harvest-plant';raftId:string;generation:number}
    |{type:'plant';raftId:string;plant:LakePlantId}
;
export type WaterCommand=WaterCommandBody&{mapId?:MapId|undefined};
