import {useId} from 'react';
import atlas from './atlas.json';
import type {LakePlantId} from '../../../../../../server/src/town-building/water/catalog';
import {GARDEN_FRAME,LAKE_PLANT_ART,plantCrop} from './gardenArt';
const BASE='/minigames/town-building/lake/';
export const LAKE_ATLAS=atlas;
export function LakeArt({index=0,fish=false,className='',rush=false,garden=false,plant}:{index?:number;fish?:boolean;className?:string;rush?:boolean;garden?:boolean;plant?:LakePlantId|null}) {
    const id=useId(),sheet=atlas[fish?'fish-v1':'structures-v1'],crop=sheet.rects[index]!;
    if(garden){const p=plant&&plantCrop(plant);return <svg aria-hidden="true" className={`lake-art ${className}`} viewBox={(plant==='soft-rush'?[0,-100,1516,1124]:GARDEN_FRAME.crop).join(' ')}><image href={BASE+GARDEN_FRAME.file} width={GARDEN_FRAME.width} height={GARDEN_FRAME.height}/>{p&&GARDEN_FRAME.slots.map(([x,y,width],i)=>{const h=width*p[3]/p[2];return <svg key={i} x={x-width/2} y={y+width*.08-h} width={width} height={h} viewBox={p.join(' ')}><image href={BASE+LAKE_PLANT_ART.file} width={LAKE_PLANT_ART.width} height={LAKE_PLANT_ART.height}/></svg>;})}</svg>;}
    if(rush)return <img aria-hidden="true" alt="" className={`lake-art ${className}`} src={BASE+'soft-rush-v1.png'} style={{objectFit:'contain'}}/>;
    return <svg aria-hidden="true" className={`lake-art ${className}`} viewBox={crop.join(' ')} preserveAspectRatio="xMidYMid meet"><defs><clipPath id={id}><rect x={crop[0]} y={crop[1]} width={crop[2]} height={crop[3]}/></clipPath></defs><image clipPath={`url(#${id})`} href={BASE+sheet.file} width={sheet.width} height={sheet.height}/></svg>;
}
/** One water plant, used as a progress icon. */
export function LakePlantIcon({plant}:{plant:LakePlantId}){
    if(plant==='soft-rush')return <img aria-hidden="true" alt="" className="lake-art" src={BASE+'soft-rush-v1.png'} style={{objectFit:'contain'}}/>;
    return <svg aria-hidden="true" className="lake-art" viewBox={plantCrop(plant).join(' ')}><image href={BASE+LAKE_PLANT_ART.file} width={LAKE_PLANT_ART.width} height={LAKE_PLANT_ART.height}/></svg>;
}
export function LakeStageArt({stage}:{stage:number}) {
    return stage===0?<svg className="lake-stage" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7C20 7 12 30 12 41a20 17 0 0 0 40 0C52 30 44 7 32 7Z" fill="#fff0cf" stroke="#704932" strokeWidth="4"/><circle cx="27" cy="35" r="8" fill="#efc18d"/></svg>:<span className={`lake-stage lake-stage-${stage}`}><LakeArt fish index={stage===1?2:6}/></span>;
}
