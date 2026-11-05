import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { businessFor } from '../../../../server/src/town-building/civCatalog';
import { workStatus, type CivClock } from '../../../../server/src/town-building/civ';
import type { Entity, TownCommand } from '../../../../server/src/town-building/game';
import type { Season } from '../../../../server/src/town-building/game';
import type { ShopReceipt } from '../../../../server/src/town-building/shopTypes';
import type { ShopTradeAction, TownResponse } from '../../api/town';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText, uiMessage } from '../../i18n/uiText';
import { CIV_ART, CIV_PEOPLE, CivPicture, CivPortrait, drawCivPerson } from './civArt';
import type { TownPerson } from './civWorld';
import { CIV_INTERIORS, INTERIOR_FIXTURE_IMAGES, INTERIOR_FLOORS, interiorActivity, type InteriorStation } from './civInteriorLayout';
import legacyInteriorAtlas from './civInteriorAtlas.json';
import interiorAtlas from './civInteriorSpecializedAtlas.json';
import { loadImage } from './useTownArtwork';
import { VegetableCropIcon, VegetableShopDialog } from './VegetableShopDialog';

function InteriorPerson({station}:{station:InteriorStation}) {
    const ref=useRef<HTMLCanvasElement>(null);
    useEffect(()=>{
        const ctx=ref.current!.getContext('2d')!,images=new Map<string,HTMLImageElement>(),atlas=CIV_PEOPLE[station.art]!,reduced=matchMedia('(prefers-reduced-motion: reduce)');
        let alive=true,frame=0;const start=performance.now();
        for(const file of new Set([atlas.file,...atlas.frames.flatMap(f=>f.file?[f.file]:[])])){
            const key=`civ-people/${file.replace('.png','')}`;
            void loadImage(key,'l').then(image=>{images.set(key,image);if(alive)draw(performance.now());},()=>{});
        }
        function draw(time:number){
            if(!alive)return;const seconds=Math.max(0,time-start)/1000;
            ctx.clearRect(0,0,150,150);
            drawCivPerson(ctx,images,{art:station.art,direction:station.direction,clock:seconds*.55+station.phase,mode:interiorActivity(station,seconds,reduced.matches)} as TownPerson,75,145,140,reduced.matches);
        }
        const animate=(time:number)=>{draw(time);if(alive&&!reduced.matches)frame=requestAnimationFrame(animate);};
        const motionChanged=()=>{cancelAnimationFrame(frame);draw(performance.now());if(!reduced.matches)frame=requestAnimationFrame(animate);};
        reduced.addEventListener('change',motionChanged);draw(performance.now());if(!reduced.matches)frame=requestAnimationFrame(animate);
        return()=>{alive=false;cancelAnimationFrame(frame);reduced.removeEventListener('change',motionChanged);};
    },[station]);
    return <canvas ref={ref} width={150} height={150} aria-hidden="true"/>;
}
function InteriorRoom({id,ready,working}:{id:string;ready:boolean;working:boolean[]}) {
    const layout=CIV_INTERIORS[id]!;
    const cell=(x:number,y:number,width=1,height=1)=>({gridColumn:`${x+1} / span ${width}`,gridRow:`${y+1} / span ${height}`});
    return <div className={`town-interior town-tiled-interior ${ready?'':'is-empty'}`} data-interior={id} data-columns={layout.columns} data-rows={layout.rows} data-floor={layout.floor} style={{'--room-columns':layout.columns,'--room-rows':layout.rows} as CSSProperties}>
        <div className="town-interior-floor" aria-hidden="true">{layout.floor!=='pastel-wood'&&Array.from({length:layout.columns*layout.rows},(_,i)=><CivPicture key={i} atlas={interiorAtlas} index={INTERIOR_FLOORS[layout.floor]} preserveAspectRatio="none"/>)}</div>
        <div className="town-interior-door" aria-hidden="true"/>
        {ready&&layout.fixtures.map((item,i)=><div key={i} className="town-interior-fixture" data-fixture={item.art} data-width={item.width} data-height={item.height} style={{...cell(item.x,item.y,item.width,item.height),zIndex:item.y*10+item.height}}>{INTERIOR_FIXTURE_IMAGES[item.art]?<img className="town-interior-fixture-image" src={INTERIOR_FIXTURE_IMAGES[item.art]} alt="" draggable={false}/>:<CivPicture atlas={item.legacy?legacyInteriorAtlas:interiorAtlas} index={item.tile} preserveAspectRatio="xMidYMax meet"/>}</div>)}
        {ready&&layout.stations.map((station,i)=>working[i]?<div className="town-interior-person" data-worker={station.art} data-station={station.fixture} key={station.art} style={{...cell(station.x,station.y),zIndex:station.y*10+1}}><InteriorPerson station={station}/></div>:null)}
    </div>;
}
export function CivInterior({entity,activeMs,clock,open,busy,error,onClose,onCommand,profileId,mapId,season,localDate,onShopTrade}:{entity:Entity|undefined;activeMs:number;clock:CivClock;open:boolean;busy:boolean;error:string;onClose:()=>void;onCommand:(command:TownCommand)=>void;profileId?:string;mapId?:'town'|'lake';season?:Season|null;localDate?:string;onShopTrade?:(action:ShopTradeAction)=>Promise<TownResponse|null>}) {
    useUiLanguage();const ref=useRef<HTMLDialogElement>(null),business=entity&&businessFor(entity.blueprintId);
    const [reactionCrop,setReactionCrop]=useState<ShopReceipt['crop']>();
    const reactionTimer=useRef<number|undefined>(undefined);
    useEffect(()=>{if(open&&business&&!ref.current?.open)ref.current?.showModal();else if(!open||!business)ref.current?.close();},[open,business]);
    useEffect(()=>()=>{if(reactionTimer.current!==undefined)window.clearTimeout(reactionTimer.current);},[]);
    useEffect(()=>{if(!open)setReactionCrop(undefined);},[open]);
    const ready=entity?.civ?.phase==='ready',statuses=business?.workers.map((_,i)=>workStatus(business,activeMs,clock,i))??[],working=statuses.some(s=>s.kind==='working');
    const cooling=activeMs<(entity?.civ?.helpAfterMs??0);
    const vegetableShop=business?.id==='vegetable-shop';
    const handlePurchase=(receipt:ShopReceipt)=>{setReactionCrop(receipt.crop);if(reactionTimer.current!==undefined)window.clearTimeout(reactionTimer.current);reactionTimer.current=window.setTimeout(()=>setReactionCrop(undefined),2200);};
    const interiorContent=business&&open&&<>
        <div className="town-civ-heading"><CivPicture atlas={CIV_ART.icons} index={business.icon}/><div><h2 id="civ-title">{uiText(business.name)}</h2><p>{String(business.opens).padStart(2,'0')}:00–{String(business.closes).padStart(2,'0')}:00 · {uiText('Home upstairs or behind the shop')}</p></div><button disabled={busy} aria-label={uiText('Close shop')} onClick={onClose}>×</button></div>
        <InteriorRoom id={business.id} ready={ready} working={statuses.map(status=>status.kind==='working')}/>
        <div className="town-neighbor-row">{business.workers.map((worker,i)=>{const statusText=uiText(!ready?'Moving in':statuses[i]?.kind==='working'?'At work':statuses[i]?.kind==='away'?'Out for a little while':statuses[i]?.kind==='closed'?'Resting at home':'Checking the home clock…');if(!vegetableShop)return <div key={worker.art}><CivPortrait art={worker.art}/><span><strong>{worker.name}</strong>{statusText}</span></div>;return <div className={`town-civ-worker${i===0&&reactionCrop?' is-reacting':''}`} key={worker.art}><span className="town-civ-worker-portrait"><CivPortrait art={worker.art}/>{i===0&&reactionCrop&&<span className="town-civ-reaction" aria-hidden="true"><VegetableCropIcon crop={reactionCrop} className="town-icon town-icon--sm"/></span>}</span><span><strong>{worker.name}</strong>{statusText}</span></div>;})}</div>
        <div className="town-civ-task"><p aria-live="polite">{uiText(!ready?'Your neighbor is bringing their things.':!working?'Come back when your neighbor is working.':cooling?'Thank you! Everything is put away.':business.help)}</p>
        <div>{[0,1,2].map(step=><button key={step} aria-label={uiMessage('Put away item {number}',{number:step+1})} disabled={busy||!ready||!working||cooling||step!==(entity?.civ?.helpStep??0)} onClick={()=>entity&&onCommand({type:'help-neighbor',entityId:entity.id,step})}><CivPicture atlas={CIV_ART.icons} index={business.icon}/><span>{step<(entity?.civ?.helpStep??0)?'✓':step+1}</span></button>)}</div></div>
        {error&&<p className="town-civ-error" role="alert">{uiText(error)}</p>}<button className="town-civ-leave" disabled={busy} onClick={onClose}>{uiText('Back to town')}</button>
    </>;
    return <dialog ref={ref} className={`town-civ-dialog${vegetableShop?' town-civ-dialog--vegetable-shop':''}`} aria-labelledby="civ-title" onClose={onClose} onCancel={event=>{if(busy)event.preventDefault();}}>
        {vegetableShop?<div className="town-civ-shop-layout"><div className="town-civ-main">{interiorContent}</div>{profileId&&mapId&&onShopTrade&&<VegetableShopDialog open={open} profileId={profileId} mapId={mapId} entityId={entity!.id} busy={busy} season={season??null} localDate={localDate} onTrade={onShopTrade} onPurchase={handlePurchase}/>}</div>:interiorContent}
    </dialog>;
}
