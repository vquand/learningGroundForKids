import {useEffect,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {MATERIALS,shortages,type Cost,type CropCost,type Material} from '../../../../server/src/town-building/game';
import {CROPS,type CropId} from '../../../../server/src/town-building/garden';
import {uiMessage,uiText} from '../../i18n/uiText';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {useTTS} from '../../hooks/useTTS';
import {MaterialArt,Sprite} from './TownArt';
import {YarnIcon} from './BarnUi';
import {LakeArt} from './maps/lake/LakeArt';
import './buildingPanel.css';

export const EARN:Record<Material,string>={wood:'/shoo-shoo-ufo',sand:'/infinidrill',rock:'/infinidrill',metal:'/infinidrill',stamina:'/food-and-drink'};
export interface BuildingProgress {icon:ReactNode;count:number|string;value:number;max:number;label:string}
export interface BuildingCost {moving:boolean;cost:Cost;materials:Partial<Record<Material,number>>;wool?:number;yarn?:number;fish?:number;cropCost?:CropCost;crops?:CropCost}
export interface BuildingDetail {
    art:ReactNode;name:string;description:string;
    cost?:BuildingCost|null;progress?:BuildingProgress|null;locked?:boolean;
}

/** Tablets and phones get a read-aloud button for the description. */
function useTouchDevice(){
    const [touch,setTouch]=useState(()=>typeof window!=='undefined'&&(matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0));
    useEffect(()=>{const query=matchMedia('(pointer: coarse)'),update=()=>setTouch(query.matches||navigator.maxTouchPoints>0);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
    return touch;
}
function SpeakButton({text}:{text:string}){
    const language=useUiLanguage(),{speak,stop,isSpeaking,isSupported}=useTTS();
    useEffect(()=>{stop();},[text,stop]);
    if(!isSupported||!text.trim())return null;
    return <button type="button" className="building-card-speak" data-speaking={isSpeaking} aria-label={uiText(isSpeaking?'Stop reading':'Read aloud')} title={uiText(isSpeaking?'Stop reading':'Read aloud')} onClick={()=>isSpeaking?stop():speak(text,language)}>
        <svg className="town-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12h5l7-6v20l-7-6H5Z" fill="#fff1d5" stroke="#70513b" strokeWidth="2.4" strokeLinejoin="round"/>{isSpeaking?<path d="M22 11v10m5-10v10" stroke="#70513b" strokeWidth="2.6" strokeLinecap="round"/>:<path d="M21 11q4 5 0 10m4-14q7 9 0 18" fill="none" stroke="#70513b" strokeWidth="2.4" strokeLinecap="round"/>}</svg>
    </button>;
}
/** Chubby progress for whatever the building is raising (eggs, fish, plants). */
export function BuildingProgressBar({progress}:{progress:BuildingProgress}){
    const ratio=progress.max>0?Math.max(0,Math.min(1,progress.value/progress.max)):0;
    return <div className="building-progress" role="group" aria-label={uiText(progress.label)}>
        <span className="building-progress-icon">{progress.icon}<b>{progress.count}</b></span>
        <span className="building-progress-track" role="progressbar" aria-label={uiText(progress.label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio*100)}>
            <span className="building-progress-fill" style={{width:`${Math.max(ratio*100,ratio>0?12:0)}%`}}/>
            <span className="building-progress-label">{uiText(progress.label)}</span>
        </span>
    </div>;
}
export function BuildingCostList({cost:{moving,cost,materials,wool=0,yarn=0,fish=0,cropCost={},crops={}}}:{cost:BuildingCost}){
    const missing=shortages(materials as Record<Material,number>,cost),items=MATERIALS.filter(m=>(cost[m]??0)>0);
    return <div className="building-card-cost">
        <h4>{uiText(moving?'Moving cost':'Building cost')}{moving&&<small>{uiText('Half the original cost, rounded up.')}</small>}</h4>
        {items.length||cost.wool||cost.yarn||cost.fish?<div className="town-costs">
            {items.map(m=><div key={m} className={missing[m]?'is-short':''}><MaterialArt material={m}/><span>{uiText(m)}<strong>{materials[m]??0} / {cost[m]}</strong></span>{missing[m]?<Link to={EARN[m]} aria-label={uiMessage('Earn {count} missing {material}',{count:missing[m]!,material:uiText(m)})}>{uiText('Earn ')}{missing[m]}</Link>:<small>{uiText('Ready')}</small>}</div>)}
            {!!cost.wool&&<div className={wool<cost.wool?'is-short':''}><MaterialArt material="wool"/><span>{uiText('Wool')}<strong>{wool} / {cost.wool}</strong></span><small>{uiText(wool<cost.wool?'Collect wool':'Ready')}</small></div>}
            {!!cost.yarn&&<div className={yarn<cost.yarn?'is-short':''}><YarnIcon className="town-material-icon"/><span>{uiText('Yarn')}<strong>{yarn} / {cost.yarn}</strong></span><small>{uiText(yarn<cost.yarn?'Collect yarn':'Ready')}</small></div>}
            {!!cost.fish&&<div className={fish<cost.fish?'is-short':''}><LakeArt fish index={2} className="town-icon town-material-icon"/><span>{uiText('Fish')}<strong>{fish} / {cost.fish}</strong></span><small>{uiText(fish<cost.fish?'Catch fish':'Ready')}</small></div>}
        </div>:<p>{uiText(moving?'Free to move':'Free to place')}</p>}
        <div className="town-costs">{Object.entries(cropCost).map(([id,count])=>{
            const crop=id as CropId,have=crops[crop]??0,index=CROPS.findIndex(c=>c.id===crop);
            const cropName=CROPS[index]?.name??crop;
            const shortLabel=crop==='pumpkin'?'Harvest pumpkins':uiMessage('Harvest {crop}',{crop:uiText(cropName).toLowerCase()});
            const cropLabel=crop==='pumpkin'?'Harvested pumpkin':uiMessage('Harvested {crop}',{crop:uiText(cropName)});
            return <div key={id} className={have<count?'is-short':''}>
                <Sprite file="crop-growth" index={index>=0?index*4+3:0} columns={4} rows={8} className="town-material-icon"/>
                <span>{uiText(cropLabel)}<strong>{have} / {count}</strong></span>
                <small>{uiText(have<count?shortLabel:'Ready')}</small>
            </div>;
        })}</div>
    </div>;
}
/** The static bottom section of every building panel, and of the building book. */
export function BuildingDetailCard({detail,empty,children}:{detail:BuildingDetail|null;empty?:{title:string;text:string};children?:ReactNode}){
    useUiLanguage();const touch=useTouchDevice();
    if(!detail)return <section className="building-card is-empty" aria-live="polite">{empty&&<><h3 className="building-card-name">{uiText(empty.title)}</h3><p className="building-card-description">{uiText(empty.text)}</p></>}{children}</section>;
    return <section className="building-card" aria-live="polite">
        <div className="building-card-head"><span className="building-card-art">{detail.art}</span><h3 className="building-card-name">{uiText(detail.name)}</h3></div>
        {detail.description&&<p className="building-card-description">{detail.description}{touch&&<SpeakButton text={`${uiText(detail.name)}. ${detail.description}`}/>}</p>}
        {detail.progress&&<BuildingProgressBar progress={detail.progress}/>}
        {detail.cost&&<BuildingCostList cost={detail.cost}/>}
        {children&&<div className="building-card-extra">{children}</div>}
    </section>;
}
