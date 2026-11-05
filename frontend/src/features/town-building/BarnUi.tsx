import {useEffect,useRef} from 'react';
import {ANIMAL_NAMES,MATERIALS,animalSpecies,type Entity,type TownState} from '../../../../server/src/town-building/game';
import {CROPS} from '../../../../server/src/town-building/garden';
import {BARN_PRODUCTS,FAVOURITE_CROPS,barnProduct,barnStock} from '../../../../server/src/town-building/barn';
import {SPOIL_MS,STORED_MATERIALS,batchTotal,itemLimit,materialLimit,type StoredBatch} from '../../../../server/src/town-building/storage';
import {LAKE_FISH,type LakeFishId} from '../../../../server/src/town-building/water/catalog';
import {uiMessage,uiText} from '../../i18n/uiText';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {MaterialArt,Sprite} from './TownArt';
import {LakeArt} from './maps/lake/LakeArt';

export function MilkIcon({className=''}:{className?:string}){return <Sprite file="animal-icons-v1" index={0} columns={6} rows={1} className={`town-icon ${className}`}/>;}
export function WoolIcon({className=''}:{className?:string}){return <Sprite file="animal-icons-v1" index={2} columns={6} rows={1} className={`town-icon ${className}`}/>;}
export function YarnIcon({className=''}:{className?:string}){return <Sprite file="highland-yarn-v1" index={0} columns={1} rows={1} className={`town-icon ${className}`}/>;}
export function FeedIcon({className=''}:{className?:string}){return <Sprite file="animal-icons-v1" index={3} columns={6} rows={1} className={`town-icon ${className}`}/>;}
export function StorageIcon({className=''}:{className?:string}){return <Sprite file="town-storage-icon-v1" index={0} columns={1} rows={1} className={`town-icon ${className}`}/>;}
const cropIndex=(id:string)=>CROPS.findIndex(c=>c.id===id)*4+3;

/** Barn product waiting in a farmhouse, at the display clock (never credited by the browser). */
export const barnWaiting=(entity:Entity,now:number)=>barnStock(entity.barn,now,barnProduct(entity));
export function BarnDetails({entity,now}:{entity:Entity;now:number}){
    const species=animalSpecies(entity)!,product=barnProduct(entity),favourites=FAVOURITE_CROPS[species]??[];
    const fedMinutes=Math.ceil(Math.max(0,(entity.barn?.fedUntil??0)-now)/60000);
    return <div className="town-coop-details">
        {product&&<p>{uiMessage(product==='milk'?'Milk · {count}/{capacity}':product==='yarn'?'Yarn · {count}/{capacity}':'Wool · {count}/{capacity}',{count:barnWaiting(entity,now),capacity:BARN_PRODUCTS[product].capacity})}</p>}
        {product?<p>{uiText(fedMinutes?'Well fed · making twice as fast':product==='yarn'?'2 per day · feeding makes it twice as fast':'4 per day · feeding makes it twice as fast')}</p>:<p>{uiText('Pigs love treats, but make nothing yet.')}</p>}
        {fedMinutes>0&&<p>{uiMessage('Fed for {minutes} more minutes',{minutes:fedMinutes})}</p>}
        <p>{uiMessage('{animal} favourites: {crops}',{animal:uiText(ANIMAL_NAMES[species]),crops:favourites.map(c=>uiText(CROPS.find(crop=>crop.id===c)!.name)).join(', ')})}</p>
    </div>;
}
const hoursLeft=(batches:readonly StoredBatch[],now:number)=>batches.length?Math.max(0,Math.ceil((Math.min(...batches.map(b=>b.at))+SPOIL_MS-now)/3600000)):0;
/** The one storage view, opened from any Town Storage on any map. */
export function StorageDialog({state,open,now,onClose}:{state:TownState;open:boolean;now:number;onClose:()=>void}){
    useUiLanguage();
    const ref=useRef<HTMLDialogElement>(null);
    useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();else if(!open)ref.current?.close();},[open]);
    const storage=state.storage,items=itemLimit(state),materials=materialLimit(state),reserve=state.maps?.lake?.reserve??{};
    const crops=CROPS.filter(c=>(storage?.crops[c.id]??0)>0),fish=(Object.keys(reserve) as LakeFishId[]).filter(id=>(reserve[id]??0)>0&&LAKE_FISH[id]);
    const milk=batchTotal(storage?.milk);
    return <dialog className="town-garden-dialog town-storage-dialog" ref={ref} aria-labelledby="storage-title" onClose={onClose}>
        <div className="town-garden-heading"><h2 id="storage-title"><StorageIcon/>{uiText('Town Storage')}</h2><button aria-label={uiText('Close storage')} onClick={onClose}>×</button></div>
        <p className="town-garden-intro">{uiMessage('Up to {items} of each item and {materials} of each building material.',{items,materials})}</p>
        <h3>{uiText('Food and farm products')}</h3>
        <ul className="town-storage-grid">
            {crops.map(c=><li key={c.id}><Sprite file="crop-growth" index={cropIndex(c.id)} columns={4} rows={8}/><strong>{storage!.crops[c.id]}</strong><span>{uiText(c.name)}</span></li>)}
            {milk>0&&<li><MilkIcon/><strong>{milk}</strong><span>{uiMessage('Milk · fresh for {hours} h',{hours:hoursLeft(storage!.milk,now)})}</span></li>}
            {fish.map(id=><li key={id}><LakeArt fish index={LAKE_FISH[id].art*4+2}/><strong>{reserve[id]}</strong><span>{uiMessage('{fish} · fresh for {hours} h',{fish:uiText(LAKE_FISH[id].name),hours:hoursLeft(storage?.fish[id]??[],now)})}</span></li>)}
            {(storage?.wool??0)>0&&<li><WoolIcon/><strong>{storage!.wool}</strong><span>{uiText('Wool')}</span></li>}
            {(storage?.yarn??0)>0&&<li><YarnIcon/><strong>{storage!.yarn}</strong><span>{uiText('Yarn · does not spoil')}</span></li>}
            {!crops.length&&!milk&&!fish.length&&!(storage?.wool??0)&&!(storage?.yarn??0)&&<li className="town-storage-empty">{uiText('Harvest crops, milk and fish to fill your storage.')}</li>}
        </ul>
        <h3>{uiText('Building materials')}</h3>
        <ul className="town-storage-grid">{MATERIALS.filter(m=>(STORED_MATERIALS as readonly string[]).includes(m)).map(m=><li key={m}><MaterialArt material={m}/><strong>{state.materials[m]}</strong><span>{uiMessage('of {limit}',{limit:materials})}</span></li>)}</ul>
        <p className="town-garden-status">{uiText(state.storage?.built?'Milk and fish stay fresh for 3 days.':'Build a Town Storage to keep up to 1000 of each item and 5000 materials. Milk and fish stay fresh for 3 days.')}</p>
        <div className="town-garden-footer"><button onClick={onClose}>{uiText('Close')}</button></div>
    </dialog>;
}
