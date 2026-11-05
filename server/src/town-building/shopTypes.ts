/** Browser-safe trade contract. Hidden units must never be rendered as money. */
import type {CropId} from './garden.ts';
import type {MapId} from './maps/types.ts';
import type {LakeFishId} from './water/catalog.ts';
export type ShopItem='wool'|'yarn'|'milk'|LakeFishId;
export interface ShopProduct {item:ShopItem;amount:number}
export interface ShopQuoteInput {entityId:string;crop:CropId;quantity:number}
export interface ShopQuote extends ShopQuoteInput {
    revision:number;inSeason:boolean;units:number;payment:ShopProduct[];
    affordable:boolean;storageRoom:boolean;confirmation:string;
}
export interface ShopTradeCommand extends ShopQuoteInput {type:'shop-trade';confirmation:string}
export interface ShopReceipt {
    id:string;revision:number;mapId:MapId;crop:CropId;amount:number;spent:ShopProduct[];
    /** Crop ID resolves the existing crop artwork; amount drives cosmetic +N only. */
    reward:{crop:CropId;amount:number};duplicate:boolean;
}
export interface SavedShopReceipt {expectedRevision:number;confirmation:string;entityId:string;receipt:ShopReceipt}
export const shopUnitPrice=(inSeason:boolean):number=>inSeason?4:Math.ceil(4*1.5);
