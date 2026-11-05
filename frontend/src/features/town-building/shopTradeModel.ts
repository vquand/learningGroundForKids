import {CROPS,cropMayGrow,type CropId} from '../../../../server/src/town-building/garden.ts';
import type {Season} from '../../../../server/src/town-building/game.ts';
import {LAKE_FISH,type LakeFishId} from '../../../../server/src/town-building/water/catalog.ts';
import type {ShopItem,ShopProduct,ShopQuote,ShopReceipt} from '../../../../server/src/town-building/shopTypes.ts';
import {VEGETABLE_RACK_SLOTS} from './vegetableShopArt.ts';

export interface ShopPaymentRow {item:ShopItem;label:string;amount:number}

export type ShopPanel='rack'|'buy'|'result';
export type ShopPanelAction='pick'|'back-to-rack'|'purchase-success';

export function shopPanelAfter(panel:ShopPanel,action:ShopPanelAction):ShopPanel {
    if(action==='pick'&&panel==='rack')return 'buy';
    if(action==='back-to-rack')return 'rack';
    if(action==='purchase-success'&&panel==='buy')return 'result';
    return panel;
}

export function rackSlotForCrop(index:number):{x:number;y:number} {
    const slot=VEGETABLE_RACK_SLOTS[index];
    if(!slot)throw new RangeError(`No vegetable rack slot for crop ${index}.`);
    return slot;
}

export function cropSeasonTag(crop:CropId,season:Season|null,localDate?:string,quoteInSeason?:boolean):{season:Season;outOfSeason:boolean} {
    const definition=CROPS.find(value=>value.id===crop)!;
    return {season:definition.season,outOfSeason:quoteInSeason===undefined?!cropMayGrow(crop,season,localDate):!quoteInSeason};
}

export function shopProductLabel(item:ShopItem):string {
    if(item==='wool')return 'Wool';
    if(item==='yarn')return 'Yarn';
    if(item==='milk')return 'Milk';
    return LAKE_FISH[item as LakeFishId]?.name??item;
}

export function shopPaymentRows(payment:readonly ShopProduct[]):ShopPaymentRow[] {
    return payment.map(product=>({item:product.item,label:shopProductLabel(product.item),amount:product.amount}));
}

export function shopQuoteState(quote:ShopQuote|undefined):'none'|'loading'|'affordable'|'not-affordable'|'storage-full' {
    if(!quote)return 'none';
    if(!quote.storageRoom)return 'storage-full';
    return quote.affordable?'affordable':'not-affordable';
}

export function shopErrorMessage(code:string):string|null {
    if(code==='SHOP_NOT_AFFORDABLE')return 'Not enough animal products yet';
    if(code==='SHOP_STORAGE_FULL')return 'Storage is full for this vegetable';
    if(code==='SHOP_QUOTE_CHANGED')return 'The shop updated its offer. Please check the new payment.';
    if(code==='SHOP_NOT_FOUND')return 'This vegetable shop is not ready right now.';
    if(code==='TOWN_STALE')return 'Your town changed. Sync and try again.';
    return null;
}

/** Refusals after which the shown quote is out of date and must be fetched again (another tab or the shop changed the town). */
export const shopErrorRefreshesQuote=(code:string)=>code==='SHOP_QUOTE_CHANGED'||code==='TOWN_STALE';

export function shopReceiptShouldAnimate(receipt:Pick<ShopReceipt,'duplicate'|'reward'>|undefined):boolean {
    return !!receipt&&!receipt.duplicate&&receipt.reward.amount>0;
}

export function shopResultRows(receipt:ShopReceipt|undefined):Array<{item:string;label:string;amount:number}> {
    if(!receipt)return [];
    const crop=CROPS.find(value=>value.id===receipt.reward.crop);
    return [
        {item:receipt.reward.crop,label:crop?.name??receipt.reward.crop,amount:receipt.reward.amount},
        ...shopPaymentRows(receipt.spent).map(row=>({item:row.item,label:row.label,amount:row.amount})),
    ];
}

export const cropLabel=(crop:CropId):string=>CROPS.find(value=>value.id===crop)?.name??crop;
