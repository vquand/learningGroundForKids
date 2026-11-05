import type {HarvestCategory,HarvestProduct,HarvestReceipt,HarvestReady} from '../../../../server/src/town-building/harvestTypes.ts';
import {CROPS} from '../../../../server/src/town-building/garden.ts';
import {LAKE_FISH,LAKE_PLANTS} from '../../../../server/src/town-building/water/catalog.ts';

export const HARVEST_LABELS:Record<HarvestCategory,string>={plants:'Harvest all plants on this map',animals:'Harvest all animal products on this map',fish:'Harvest all fish on this map'};
export function visibleHarvestCategories(ready:HarvestReady|undefined):HarvestCategory[]{return (['plants','animals','fish'] as const).filter(category=>ready?.[category]===true);}
export function harvestProductLabel(item:string):string{
    if(item==='egg')return 'Egg';
    if(item==='milk')return 'Milk';
    if(item==='wool')return 'Wool';
    if(item==='yarn')return 'Yarn';
    return CROPS.find(crop=>crop.id===item)?.name??LAKE_FISH[item as keyof typeof LAKE_FISH]?.name??LAKE_PLANTS[item as keyof typeof LAKE_PLANTS]?.name??item;
}
export function harvestReceiptShouldAnimate(receipt:Pick<HarvestReceipt,'duplicate'|'reward'>|undefined):boolean{
    return !!receipt&&!receipt.duplicate&&Object.values(receipt.reward).some(value=>typeof value==='number'&&value>0);
}
export function harvestResultRows(products:readonly HarvestProduct[]){return products.map(product=>({item:product.item,label:harvestProductLabel(product.item),amount:product.amount}));}
