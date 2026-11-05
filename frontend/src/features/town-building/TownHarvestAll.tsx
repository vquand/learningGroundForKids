import type {HarvestCategory,HarvestProduct,HarvestReceipt,HarvestReady} from '../../../../server/src/town-building/harvestTypes';
import {CROPS} from '../../../../server/src/town-building/garden';
import {LAKE_FISH,LAKE_PLANTS} from '../../../../server/src/town-building/water/catalog';
import {uiMessage,uiText} from '../../i18n/uiText';
import {BlueprintArt,Sprite} from './TownArt';
import {BLUEPRINTS} from '../../../../server/src/town-building/game';
import {EggIcon} from './PoultryUi';
import {MilkIcon,WoolIcon,YarnIcon} from './BarnUi';
import {HarvestIcon} from './TownActionIcons';
import {LakeArt,LakePlantIcon} from './maps/lake/LakeArt';
import {TownMapDialog} from './TownMapLayout';
import {HARVEST_LABELS,harvestProductLabel,harvestReceiptShouldAnimate,harvestResultRows,visibleHarvestCategories} from './townHarvestAllModel';
export {HARVEST_LABELS,harvestReceiptShouldAnimate,harvestResultRows,visibleHarvestCategories} from './townHarvestAllModel';
export type HarvestDialogState={phase:'loading'|'result'|'error';category:HarvestCategory;receipt?:HarvestReceipt};
export {harvestProductLabel};

function CategoryIcon({category}:{category:HarvestCategory}){
    if(category==='animals')return <EggIcon/>;
    if(category==='fish')return <LakeArt fish index={6}/>;
    return <BlueprintArt blueprint={BLUEPRINTS.find(blueprint=>blueprint.id==='vegetable-patch')!}/>;
}
function ProductArt({item}:{item:string}){
    if(item==='egg')return <EggIcon/>;
    if(item==='milk')return <MilkIcon/>;
    if(item==='wool')return <WoolIcon/>;
    if(item==='yarn')return <YarnIcon/>;
    const cropIndex=CROPS.findIndex(crop=>crop.id===item);
    if(cropIndex>=0)return <Sprite file="crop-growth" index={cropIndex*4+3} columns={4} rows={8}/>;
    const fish=LAKE_FISH[item as keyof typeof LAKE_FISH];
    if(fish)return <LakeArt fish index={fish.art*4+2}/>;
    const plant=LAKE_PLANTS[item as keyof typeof LAKE_PLANTS];
    return plant?<LakePlantIcon plant={item as keyof typeof LAKE_PLANTS}/>:<HarvestIcon/>;
}
function ProductList({products}:{products:readonly HarvestProduct[]}){
    const rows=harvestResultRows(products);
    return rows.length?<ul className="town-harvest-result-list">{rows.map((row,index)=><li key={`${row.item}-${index}`}><span className="town-harvest-product-art"><ProductArt item={row.item}/></span><span>{uiText(row.label)}</span><strong>×{row.amount}</strong></li>)}</ul>:<p className="town-harvest-empty">{uiText('No products were collected.')}</p>;
}
function productNames(products:readonly HarvestProduct[]){return products.map(product=>`${uiText(harvestProductLabel(product.item))} ×${product.amount}`).join(', ');}

export interface TownHarvestAllProps {
    ready?:HarvestReady;busy:boolean;dialog?:HarvestDialogState;error?:string;
    onHarvest:(category:HarvestCategory)=>void;onClose:()=>void;
}
export function TownHarvestAll({ready,busy,dialog,error,onHarvest,onClose}:TownHarvestAllProps){
    const categories=visibleHarvestCategories(ready),receipt=dialog?.receipt;
    return <section className="town-harvest-all" aria-label={uiText('Harvest all ready resources')}>
        {categories.length>0&&<div className="town-harvest-all-buttons">{categories.map(category=><button key={category} className="town-harvest-all-button" disabled={busy||dialog?.phase==='loading'} onClick={()=>onHarvest(category)} aria-label={uiText(HARVEST_LABELS[category])} title={uiText(HARVEST_LABELS[category])}><span className="town-harvest-category-icon"><CategoryIcon category={category}/></span><HarvestIcon/><span>{uiText(HARVEST_LABELS[category])}</span></button>)}</div>}
        {dialog&&<TownMapDialog open title={uiText(dialog.phase==='result'?'Harvest results':dialog.phase==='loading'?'Harvesting…':'Harvest could not finish')} busy={dialog.phase==='loading'} error={dialog.phase==='error'?uiText(error||'Could not harvest right now. Please try again.'):undefined} onClose={onClose} className="town-harvest-dialog" footer={dialog.phase==='loading'?undefined:<button className="town-dialog-primary" onClick={onClose}>{uiText('Close')}</button>}>
            {dialog.phase==='loading'&&<p role="status" aria-busy="true">{uiText('Harvesting…')}</p>}
            {dialog.phase==='result'&&receipt&&<><ProductList products={receipt.products}/>{receipt.notReplanted.length>0&&<p>{uiMessage('Could not replant: {items}.',{items:productNames(receipt.notReplanted)})}</p>}{receipt.notCollected.length>0&&<p>{uiMessage('Left in storage-full buildings: {items}.',{items:productNames(receipt.notCollected)})}</p>}</>}
        </TownMapDialog>}
        {dialog?.phase==='loading'&&<div className="town-harvest-flight" role="status" aria-label={uiText('Harvesting…')}><CategoryIcon category={dialog.category}/><HarvestIcon/></div>}
    </section>;
}
