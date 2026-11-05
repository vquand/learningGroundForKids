import type {Material} from './game.ts';
import type {MapId} from './maps/types.ts';
import type {CropId} from './garden.ts';
import type {LakeFishId,LakePlantId} from './water/catalog.ts';

/** Shared with the browser (type-only imports from `server/src/town-building/harvestTypes`). */
export const HARVEST_CATEGORIES=['plants','animals','fish'] as const;
export type HarvestCategory=typeof HARVEST_CATEGORIES[number];
/** Server-derived booleans; never persisted and never accepted from the browser. */
export type HarvestReady=Record<HarvestCategory,boolean>;
/** The only client-supplied fields: no entity IDs, quantities, products or rewards. */
export type HarvestAllCommand={type:'harvest-all';category:HarvestCategory;mapId:MapId};
export type HarvestItem=CropId|LakeFishId|LakePlantId|'egg'|'milk'|'wool'|'yarn';
export interface HarvestProduct {item:HarvestItem;amount:number}
/** Server-credited stamina and materials, for the cosmetic TownRewardBar only. */
export type HarvestReward=Partial<Record<Material,number>>&{milk?:number;yarn?:number;wool?:number};
export interface HarvestReceipt {
    /** `harvest-all:<mapId>:<category>:<revision after the commit>`; retries return the same id. */
    id:string;
    revision:number;
    mapId:MapId;
    category:HarvestCategory;
    /** Actual items stored or counted per type (not per patch or per raft). */
    products:HarvestProduct[];
    /** Pockets/slots and fish that were replanted automatically, free or paid. */
    replanted:number;
    /** Items that could not be restocked automatically, with the amount left empty. */
    notReplanted:HarvestProduct[];
    /** Product left in the world because storage was full or a manual rule refused that target. `amount` is what
     * remained there: a skipped target keeps all of its ready product; a partly stored barn keeps its rest. */
    notCollected:HarvestProduct[];
    reward:HarvestReward;
    /** True only for a retry of an already committed receipt: nothing was awarded again. */
    duplicate:boolean;
}
/** Bounded ledger entry kept in Town JSON for retries; never sent to the browser. */
export type SavedHarvestReceipt=Omit<HarvestReceipt,'duplicate'>&{expectedRevision:number};
