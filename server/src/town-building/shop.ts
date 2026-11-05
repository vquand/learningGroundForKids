import {createHash} from 'node:crypto';
import {AppError} from '../errors.ts';
import type {TownState} from './game.ts';
import {cropMayGrow} from './garden.ts';
import {landView,openMaps} from './maps/view.ts';
import type {MapId} from './maps/types.ts';
import type {LandClock} from './maps/land.ts';
import {LAKE_FISH_IDS} from './water/catalog.ts';
import {settleStorage,itemLimit,storeCrop,spendStoredProduct} from './storage.ts';
import {selectShopPayment,type ShopStock} from './shopPayment.ts';
import {shopUnitPrice,type ShopQuoteInput,type ShopQuote,type ShopTradeCommand,type ShopReceipt} from './shopTypes.ts';
export interface ShopOutcome {state:TownState;receipt:ShopReceipt}
export const SHOP_LEDGER_LIMIT=32;
function quoteOnSettled(state:TownState,profileId:string,mapId:MapId,input:ShopQuoteInput,clock:LandClock):ShopQuote {
    if(!openMaps(state).includes(mapId)||!landView(state,mapId).entities.some(e=>e.id===input.entityId&&e.blueprintId==='vegetable-shop'))
        throw new AppError(409,'SHOP_NOT_FOUND','Choose a vegetable shop on this map.');
    const stock:ShopStock[]=[],storage=state.storage;
    if(storage){
        for(const item of ['wool','yarn'] as const)stock.push({item,amount:storage[item]??0});
        for(const b of storage.milk)stock.push({item:'milk',amount:b.count,at:b.at});
        for(const item of LAKE_FISH_IDS){
            if(!(state.maps?.lake?.reserve[item]??0))continue;
            // settleStorage reconciles these batches with the authoritative Lake reserve.
            for(const b of storage.fish[item]??[])stock.push({item,amount:b.count,at:b.at});
        }
    }
    const known=!!clock.timeOfDay&&clock.weatherSource!=='preview';
    const inSeason=cropMayGrow(input.crop,known?clock.season??null:null,known?clock.localDate:undefined);
    const units=input.quantity*shopUnitPrice(inSeason),payment=selectShopPayment(stock,units);
    const result={entityId:input.entityId,crop:input.crop,quantity:input.quantity,revision:state.revision,inSeason,units,payment:payment??[],affordable:payment!==null,storageRoom:(storage?.crops[input.crop]??0)+input.quantity<=itemLimit(state)};
    const confirmation=createHash('sha256').update(JSON.stringify({profileId,mapId,...result})).digest('hex');
    return {...result,confirmation};
}
/** Pure projection: settlement runs on a copy and never persists migration, spoilage or rewards. */
export function quoteShop(state:TownState,profileId:string,mapId:MapId,input:ShopQuoteInput,now:number,clock:LandClock):ShopQuote {
    return quoteOnSettled(settleStorage(structuredClone(state),now),profileId,mapId,input,clock);
}
/** Called only under the owned profile's durable lock. Refusals leave the input untouched. */
export function applyShopTrade(previous:TownState,profileId:string,mapId:MapId,revision:number,command:ShopTradeCommand,now:number,clock:LandClock):ShopOutcome {
    const saved=previous.shopReceipts?.find(s=>s.expectedRevision===revision&&s.confirmation===command.confirmation&&s.entityId===command.entityId&&s.receipt.mapId===mapId&&s.receipt.crop===command.crop&&s.receipt.amount===command.quantity);
    if(saved)return {state:previous,receipt:{...saved.receipt,duplicate:true}};
    if(previous.revision!==revision)throw new AppError(409,'TOWN_STALE','Your town changed. Sync and try again.');
    const state=settleStorage(structuredClone(previous),now);
    const quote=quoteOnSettled(state,profileId,mapId,{entityId:command.entityId,crop:command.crop,quantity:command.quantity},clock);
    if(quote.confirmation!==command.confirmation)throw new AppError(409,'SHOP_QUOTE_CHANGED','The trade changed. Review a new quote.');
    if(!quote.affordable)throw new AppError(409,'SHOP_NOT_AFFORDABLE','Store more animal products before trading.');
    if(!quote.storageRoom)throw new AppError(409,'SHOP_STORAGE_FULL','Make room for all these vegetables first.');
    for(const product of quote.payment)spendStoredProduct(state,product.item,product.amount);
    if(storeCrop(state,command.crop,command.quantity)!==command.quantity)throw new Error('Shop storage invariant failed.');
    state.revision=previous.revision+1;
    const receipt:ShopReceipt={id:`shop:${mapId}:${command.crop}:${state.revision}`,revision:state.revision,mapId,crop:command.crop,amount:command.quantity,spent:quote.payment,reward:{crop:command.crop,amount:command.quantity},duplicate:false};
    state.shopReceipts=[...(previous.shopReceipts??[]),{expectedRevision:revision,confirmation:command.confirmation,entityId:command.entityId,receipt}].slice(-SHOP_LEDGER_LIMIT);
    return {state,receipt};
}
