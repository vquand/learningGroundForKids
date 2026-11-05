import {townArtHref} from './townArtScale';
import {useEffect,useId,useState} from 'react';
import {ApiError} from '../../api/core';
import {fetchLakeShopQuote,fetchTownShopQuote,type ShopTradeAction,type TownResponse} from '../../api/town';
import {uiMessage,uiText} from '../../i18n/uiText';
import {CROPS,type CropId} from '../../../../server/src/town-building/garden';
import {LAKE_FISH,type LakeFishId} from '../../../../server/src/town-building/water/catalog';
import type {MapId} from '../../../../server/src/town-building/maps/types';
import type {Season} from '../../../../server/src/town-building/game';
import type {ShopItem,ShopQuote,ShopReceipt} from '../../../../server/src/town-building/shopTypes';
import {LakeArt} from './maps/lake/LakeArt';
import {MilkIcon,WoolIcon,YarnIcon} from './BarnUi';
import {cropLabel,cropSeasonTag,shopErrorMessage,shopPanelAfter,shopPaymentRows,shopErrorRefreshesQuote,shopQuoteState,shopReceiptShouldAnimate,shopResultRows,type ShopPanel} from './shopTradeModel';
import {VEGETABLE_RACK_ART,VEGETABLE_CROP_RECTS,VEGETABLE_RACK_FLOORS,VEGETABLE_RACK_SIZE,VEGETABLE_RACK_SLOTS} from './vegetableShopArt';
import './vegetableShop.css';

export function VegetableCropIcon({crop,className='town-icon town-icon--lg'}:{crop:CropId;className?:string}){
    const clipId=useId();
    const rect=VEGETABLE_CROP_RECTS[CROPS.findIndex(value=>value.id===crop)]!;
    return <svg className={`town-sprite ${className}`} aria-hidden="true" viewBox={rect.join(' ')} preserveAspectRatio="xMidYMax meet"><defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]}/></clipPath></defs><g clipPath={`url(#${clipId})`}><image href={townArtHref('crop-growth')} width="1024" height="1536"/></g></svg>;
}

function SeasonIcon({season}:{season:Season}){
    const fill=season==='spring'?'#9fca7d':season==='summer'?'#f3c86b':season==='autumn'?'#dc9361':'#9bc9dc';
    const path=season==='summer'?'M12 5v14M5 12h14M7 7l10 10M17 7 7 17':season==='winter'?'M12 5v14M5 12h14M8 8l8 8M16 8l-8 8':season==='autumn'?'M7 6c5 0 9 3 9 8-4 1-8-1-9-5m9 5c-2 1-4 3-5 6':'M12 18V9m0 2c-4 0-6-2-6-5 4 0 6 2 6 5m0 1c4 0 6-2 6-5-4 0-6 2-6 5';
    return <svg className="town-icon town-icon--xs vegetable-shop-season-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill={fill} stroke="#624431" strokeWidth="1.7"/><path d={path} fill="none" stroke="#624431" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function OutOfSeasonArrow(){
    return <svg className="town-icon town-icon--xs vegetable-shop-out-season-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5m0 0L6 11m6-6 6 6" fill="none" stroke="#b64a38" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ProductArt({item}:{item:ShopItem}){
    if(item==='milk')return <MilkIcon className="town-icon--sm"/>;
    if(item==='wool')return <WoolIcon className="town-icon--sm"/>;
    if(item==='yarn')return <YarnIcon className="town-icon--sm"/>;
    return <LakeArt fish index={LAKE_FISH[item as LakeFishId].art*4+2} className="town-icon town-icon--sm"/>;
}

function ProductRows({rows}:{rows:readonly {item:ShopItem|string;label:string;amount:number}[]}){
    return <ul className="vegetable-shop-product-rows">{rows.map((row,index)=><li key={`${row.item}-${index}`}><span className="vegetable-shop-product-art">{row.item in LAKE_FISH||row.item==='milk'||row.item==='wool'||row.item==='yarn'?<ProductArt item={row.item as ShopItem}/>:<VegetableCropIcon crop={row.item as CropId} className="town-icon town-icon--sm"/>}</span><span>{uiText(row.label)}</span><strong>×{row.amount}</strong></li>)}</ul>;
}

function SeasonTag({crop,season,localDate,quoteInSeason}:{crop:CropId;season:Season|null;localDate?:string;quoteInSeason?:boolean}){
    const tag=cropSeasonTag(crop,season,localDate,quoteInSeason);
    const label=tag.outOfSeason?`${uiText(tag.season)} · ${uiText('Out of season: costs more')}`:uiText(tag.season);
    return <span className={`vegetable-shop-season${tag.outOfSeason?' vegetable-shop-season--out':''}`} role="img" aria-label={label} title={label}><SeasonIcon season={tag.season}/>{tag.outOfSeason&&<OutOfSeasonArrow/>}</span>;
}

/** Informational sign hung beside the selected vegetable: big season icon, plus the up arrow when it costs more. */
function SeasonSign({crop,season,localDate,quoteInSeason}:{crop:CropId;season:Season|null;localDate?:string;quoteInSeason?:boolean}){
    const tag=cropSeasonTag(crop,season,localDate,quoteInSeason);
    const label=tag.outOfSeason?`${uiText(tag.season)} · ${uiText('Out of season: costs more')}`:uiText(tag.season);
    return <span className={`vegetable-shop-season-sign${tag.outOfSeason?' vegetable-shop-season-sign--out':''}`} role="img" aria-label={label} title={label}><span className="vegetable-shop-season-sign-board"><SeasonIcon season={tag.season}/>{tag.outOfSeason&&<OutOfSeasonArrow/>}</span></span>;
}

function cropButtonLabel(crop:CropId,season:Season|null,localDate?:string,quoteInSeason?:boolean){
    const tag=cropSeasonTag(crop,season,localDate,quoteInSeason);
    return `${uiText(cropLabel(crop))} · ${uiText(tag.season)}${tag.outOfSeason?` · ${uiText('Out of season: costs more')}`:''}`;
}

/** Wooden plank floor painted over the cream floor of every crate, behind the vegetables. */
function RackFloors(){
    return <svg className="vegetable-shop-rack-floors" viewBox={`0 0 ${VEGETABLE_RACK_SIZE.width} ${VEGETABLE_RACK_SIZE.height}`} aria-hidden="true">{VEGETABLE_RACK_SLOTS.map((slot,index)=>{
        const f=VEGETABLE_RACK_FLOORS[index<4?0:1],cx=slot.x*VEGETABLE_RACK_SIZE.width,h=f.bottom-f.top;
        const at=(t:number)=>({l:cx+f.topLeft+(f.bottomLeft-f.topLeft)*t,r:cx+f.topRight+(f.bottomRight-f.topRight)*t,y:f.top+h*t});
        return <g key={index}><polygon points={`${cx+f.topLeft},${f.top} ${cx+f.topRight},${f.top} ${cx+f.bottomRight},${f.bottom} ${cx+f.bottomLeft},${f.bottom}`} fill="#e6b573"/>{[.34,.67].map(t=>{const a=at(t);return <line key={t} x1={a.l} y1={a.y} x2={a.r} y2={a.y} stroke="#b9854c" strokeWidth="3" strokeLinecap="round"/>;})}<polygon points={`${cx+f.topLeft},${f.top} ${cx+f.topRight},${f.top} ${cx+at(.18).r-cx},${at(.18).y} ${cx+at(.18).l-cx},${at(.18).y}`} fill="#c28d52" opacity=".55"/></g>;
    })}</svg>;
}

function Rack({season,localDate,selected,onPick,disabled}:{season:Season|null;localDate?:string;selected?:CropId;onPick:(crop:CropId)=>void;disabled:boolean}){
    return <div className="vegetable-shop-rack" data-rack-art={VEGETABLE_RACK_ART}><img className="vegetable-shop-rack-art" src={VEGETABLE_RACK_ART} alt=""/><RackFloors/><div className="vegetable-shop-rack-slots">{CROPS.map((crop,index)=>{const slot=VEGETABLE_RACK_SLOTS[index]!;return <button type="button" key={crop.id} className="vegetable-shop-rack-slot" style={{left:`${slot.x*100}%`,top:`${slot.y*100}%`}} aria-label={cropButtonLabel(crop.id,season,localDate)} title={cropButtonLabel(crop.id,season,localDate)} aria-pressed={selected===crop.id} disabled={disabled} onClick={()=>onPick(crop.id)}><VegetableCropIcon crop={crop.id}/></button>;})}</div><img className="vegetable-shop-rack-front vegetable-shop-rack-front--top" src={VEGETABLE_RACK_ART} alt="" aria-hidden="true"/><img className="vegetable-shop-rack-front vegetable-shop-rack-front--bottom" src={VEGETABLE_RACK_ART} alt="" aria-hidden="true"/><div className="vegetable-shop-rack-tags" aria-hidden="true">{CROPS.map((crop,index)=>{const slot=VEGETABLE_RACK_SLOTS[index]!;return <span key={crop.id} className="vegetable-shop-rack-tag" style={{left:`${(slot.x+0.052)*100}%`,top:`${(slot.y+0.08)*100}%`}}><SeasonTag crop={crop.id} season={season} localDate={localDate}/></span>;})}</div></div>;
}

function SelectedCrop({crop,season,localDate,quoteInSeason}:{crop:CropId;season:Season|null;localDate?:string;quoteInSeason?:boolean}){
    return <div className="vegetable-shop-selected-crop"><VegetableCropIcon crop={crop} className="town-icon town-icon--xl"/><strong>{uiText(cropLabel(crop))}</strong><SeasonSign crop={crop} season={season} localDate={localDate} quoteInSeason={quoteInSeason}/></div>;
}

export interface VegetableShopDialogProps {
    open:boolean;profileId:string;mapId:MapId;entityId:string;busy:boolean;season:Season|null;localDate?:string;
    onTrade:(action:ShopTradeAction)=>Promise<TownResponse|null>;onPurchase?:(receipt:ShopReceipt)=>void;
}

export function VegetableShopDialog({open,profileId,mapId,entityId,busy,season,localDate,onTrade,onPurchase}:VegetableShopDialogProps){
    const [panel,setPanel]=useState<ShopPanel>('rack');
    const [crop,setCrop]=useState<CropId>();
    const [quantity,setQuantity]=useState(1);
    const [quote,setQuote]=useState<ShopQuote>();
    const [quoteLoading,setQuoteLoading]=useState(false);
    const [pending,setPending]=useState(false);
    const [error,setError]=useState('');
    const [notice,setNotice]=useState('');
    const [receipt,setReceipt]=useState<ShopReceipt>();
    const [refresh,setRefresh]=useState(0);
    useEffect(()=>{
        if(!open){setPanel('rack');setCrop(undefined);setQuantity(1);setQuote(undefined);setReceipt(undefined);setError('');setNotice('');}
    },[open]);
    useEffect(()=>{
        if(!open||!crop)return;
        let active=true;setQuoteLoading(true);setQuote(undefined);setError('');
        const input={entityId,crop,quantity};
        void (mapId==='town'?fetchTownShopQuote(profileId,input):fetchLakeShopQuote(profileId,input)).then(next=>{if(active)setQuote(next);}).catch(reason=>{
            if(!active)return;
            const code=reason instanceof ApiError?reason.code:'';
            setError(shopErrorMessage(code)??'Could not check this vegetable trade.');
        }).finally(()=>{if(active)setQuoteLoading(false);});
        return()=>{active=false;};
    },[open,profileId,mapId,entityId,crop,quantity,refresh]);
    const state=quoteLoading?'loading':shopQuoteState(quote);
    const disabled=busy||pending;
    function pick(next:CropId){setCrop(next);setQuantity(1);setQuote(undefined);setNotice('');setError('');setPanel(shopPanelAfter(panel,'pick'));}
    function backToRack(){setPanel(shopPanelAfter(panel,'back-to-rack'));setCrop(undefined);setQuantity(1);setQuote(undefined);setError('');setNotice('');}
    async function confirm(){
        if(!quote||!crop||!quote.affordable||!quote.storageRoom||disabled||quoteLoading)return;
        setPending(true);setError('');setNotice('');
        try{
            const next=await onTrade({type:'shop-trade',mapId,revision:quote.revision,command:{type:'shop-trade',entityId,crop,quantity,confirmation:quote.confirmation}});
            const nextReceipt=next?.shopReceipt;
            if(nextReceipt){setReceipt(nextReceipt);setQuote(undefined);setPanel(shopPanelAfter(panel,'purchase-success'));if(shopReceiptShouldAnimate(nextReceipt))onPurchase?.(nextReceipt);}
            else setError('Could not finish this vegetable trade.');
        }catch(reason){
            const code=reason instanceof ApiError?reason.code:'';
            if(shopErrorRefreshesQuote(code)){setNotice(shopErrorMessage(code)!);setRefresh(value=>value+1);}
            else if(code==='SHOP_NOT_AFFORDABLE'||code==='SHOP_STORAGE_FULL'){setError(shopErrorMessage(code)!);setRefresh(value=>value+1);}
            else setError(shopErrorMessage(code)??'Could not finish this vegetable trade.');
        }finally{setPending(false);}
    }
    const resultRows=shopResultRows(receipt);
    return <section className="vegetable-shop-pane" aria-label={uiText('Vegetable shop rack')} data-shop-pane>
        <div className="vegetable-shop-pane-heading"><div><h3>{uiText('Vegetable rack')}</h3><p>{uiText(panel==='rack'?'Pick a vegetable from the rack.':panel==='buy'?'Choose how many to buy.':'Your basket is ready.')}</p></div>{panel!=='rack'&&<button type="button" className="vegetable-shop-back-rack" disabled={disabled} onClick={backToRack}>{uiText('Back to the rack')}</button>}</div>
        {panel==='rack'&&<Rack season={season} localDate={localDate} onPick={pick} disabled={disabled}/>} 
        {panel==='buy'&&crop&&<div className="vegetable-shop-buy-panel">
            <SelectedCrop crop={crop} season={season} localDate={localDate} quoteInSeason={quote?.inSeason}/>
            <div className="vegetable-shop-controls"><span>{uiText('Quantity')}</span><div className="vegetable-shop-stepper"><button type="button" aria-label={uiText('Decrease quantity')} disabled={disabled||quoteLoading||quantity<=1} onClick={()=>{setError('');setQuantity(value=>Math.max(1,value-1));}}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label={uiText('Increase quantity')} disabled={disabled||quoteLoading||quantity>=10} onClick={()=>{setError('');setQuantity(value=>Math.min(10,value+1));}}>+</button></div></div>
            {state==='loading'&&<div className="vegetable-shop-loading" role="status" aria-busy="true">{uiText('Loading…')}</div>}
            {quote&&state!=='loading'&&<section className="vegetable-shop-quote" aria-label={uiText('Your payment')}><div className="vegetable-shop-quote-heading"><h4>{uiText('You pay:')}</h4>{!quote.inSeason&&<span className="vegetable-shop-out-season-note">{uiText('Out of season: costs more')}</span>}</div>{quote.payment.length>0&&<ProductRows rows={shopPaymentRows(quote.payment)}/>} {state==='not-affordable'&&<p className="vegetable-shop-muted">{uiText('Not enough animal products yet')}<br/><small>{uiText('Collect products from barns, then try again.')}</small></p>}{state==='storage-full'&&<p className="vegetable-shop-muted">{uiText('Storage is full for this vegetable')}</p>}</section>}
            {error&&<p className="vegetable-shop-error" role="alert">{uiText(error)}</p>}{notice&&<p className="vegetable-shop-notice" role="status">{uiText(notice)}</p>}
            <button type="button" className="vegetable-shop-buy" disabled={disabled||quoteLoading||state!=='affordable'} onClick={()=>void confirm()}>{uiText('Buy')}</button>
        </div>}
        {panel==='result'&&receipt&&<div className="vegetable-shop-result"><p role="status">{uiMessage('Bought {amount} {crop}.',{amount:receipt.reward.amount,crop:uiText(cropLabel(receipt.reward.crop))})}</p><h4>{uiText('You bought:')}</h4><ProductRows rows={resultRows.slice(0,1)}/><h4>{uiText('You paid:')}</h4><ProductRows rows={resultRows.slice(1)}/><button type="button" className="vegetable-shop-back-rack vegetable-shop-result-back" disabled={disabled} onClick={backToRack}>{uiText('Back to the rack')}</button></div>}
    </section>;
}
