import type {Entity} from '../../game.ts';
import type {LakeAdjective} from './name.ts';
import type {CivState} from '../../civCatalog.ts';
import type {TownState} from '../../game.ts';
import type {GardeningState} from '../../garden.ts';
import type {LakeFishId,LakeBlueprintId} from '../../water/catalog.ts';
import type {LakeRaft,WaterCommand} from '../../water/types.ts';
export type {LakeFish,LakeRaft} from '../../water/types.ts';
export interface LakeState {
    /** Shared water-care progress for every map's rafts (unlocks, reserve, awards). */
    adjective?:LakeAdjective;
    /** Legacy clock fields; the map clock is land.gardening like every map. */
    lastTick?:number;activeSeconds?:number;
    unlockedAt:number;stage:0|1|2;
    rafts:LakeRaft[];land:{entities:Entity[];droppings?:TownState['droppings'];bushes?:TownState['bushes'];civ?:CivState;gardening?:GardeningState;
        events?:Record<string,import('../../events/runtime.ts').TimedEventRecord>;halloween?:import('../../halloween.ts').HalloweenState};
    harvested:number;collections:number;plantsHarvested:number;boostedSeconds:number;
    reserve:Partial<Record<LakeFishId,number>>;catches:Partial<Record<LakeFishId,number>>;
    settled:LakeFishId[];built:LakeBlueprintId[];earned:Record<string,string>;
}
/** Water commands target any map's water (default: the Lake). */
export type LakeCommand=WaterCommand|{type:'rename';adjective:LakeAdjective};
