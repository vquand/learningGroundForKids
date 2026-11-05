import {townArtHref} from './townArtScale';
import { useId, type CSSProperties } from 'react';
import peopleManifest from './civPeopleAtlas.json';
import type { TownPerson } from './civWorld';

import {type CivAtlas} from './civAtlas.ts';
export {CIV_ART,type CivAtlas} from './civAtlas.ts';
interface PersonFrame {name:string;file?:string;crop:number[];anchor:number[];sourceScale?:number}
export interface PersonAtlas {file:string;width:number;height:number;frames:PersonFrame[]}
export const CIV_PEOPLE=peopleManifest.people as unknown as Record<string,PersonAtlas>;
export const PROSPERITY_ART={...peopleManifest.prosperity,file:'prosperity-growth-v1'};
export function CivPicture({atlas,index=0,className='town-sprite',style,preserveAspectRatio='xMidYMid meet'}:{atlas:CivAtlas;index?:number;className?:string;style?:CSSProperties;preserveAspectRatio?:string}) {
    const crop=atlas.rects[index]!,id=useId();
    return <svg className={className} aria-hidden="true" style={style} viewBox={crop.join(' ')} preserveAspectRatio={preserveAspectRatio}><defs><clipPath id={id}><rect x={crop[0]} y={crop[1]} width={crop[2]} height={crop[3]}/></clipPath></defs><image clipPath={`url(#${id})`} href={townArtHref(atlas.file.replace(/\.png$/,''))} width={atlas.width} height={atlas.height}/></svg>;
}
export function CivPortrait({art}:{art:string}) {
    const atlas=CIV_PEOPLE[art]!,frame=atlas.frames[18]!;
    return <CivPicture className="town-person-portrait" atlas={{file:`civ-people/${(frame.file??atlas.file).replace('.png','')}`,width:frame.file?2172:atlas.width,height:frame.file?724:atlas.height,rects:[frame.crop]}}/>;
}
export function drawCivPerson(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,person:TownPerson,x:number,y:number,tile:number,reduced=false):void {
    const atlas=CIV_PEOPLE[person.art];if(!atlas)return;
    const direction=['right','left','down','up'].indexOf(person.direction),step=reduced?0:Math.floor(person.clock*6)%4;
    const index=person.mode==='walk'?direction*4+step:person.mode==='carry'?20+direction:person.mode==='work'?24+step:person.mode==='call'?29:person.mode==='unpack'?30:person.mode==='rest'?31:16+direction;
    const frame=atlas.frames[index]!,img=images.get(`civ-people/${(frame.file??atlas.file).replace('.png','')}`);if(!img?.complete||!img.naturalWidth)return;
    const c=frame.crop,s=tile*1.05/(atlas.width/4)*(frame.sourceScale??1);
    ctx.drawImage(img,c[0]!,c[1]!,c[2]!,c[3]!,x-frame.anchor[0]!*s,y-frame.anchor[1]!*s,c[2]!*s,c[3]!*s);
}
