import {MATERIALS,type TownState} from '../../../../server/src/town-building/game.ts';
import {barnProduct} from '../../../../server/src/town-building/barn.ts';
import {batchTotal} from '../../../../server/src/town-building/storage.ts';
import {landView} from '../../../../server/src/town-building/maps/view.ts';
import type {MapId} from '../../../../server/src/town-building/maps/types.ts';
import type {CropId} from '../../../../server/src/town-building/garden.ts';
export const REWARD_KINDS=[...MATERIALS,'milk','yarn','wool'] as const;
export type TownReward=Partial<Record<typeof REWARD_KINDS[number],number>>&{cropReward?:{crop:CropId;amount:number}};
/** Cosmetic delta from a newly committed Collect response, never a payout calculation. */
export function barnCollectionReward(previous:TownState,next:TownState,mapId:MapId,entityId:string):TownReward{
    if(next.revision<=previous.revision)return {};
    const entity=landView(previous,mapId).entities.find(e=>e.id===entityId),product=entity?barnProduct(entity):null;
    if(!product)return {};
    const count=product==='wool'?(next.storage?.wool??0)-(previous.storage?.wool??0):product==='milk'?batchTotal(next.storage?.milk)-batchTotal(previous.storage?.milk):(next.storage?.yarn??0)-(previous.storage?.yarn??0);
    return count>0?{[product]:count}:{};
}
