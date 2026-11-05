import {townArtHref} from './townArtScale';
import {useId,useImperativeHandle,useRef,type ReactNode,type Ref} from 'react';
import type {Entity} from '../../../../server/src/town-building/game';
import type {MapId} from '../../../../server/src/town-building/maps/types';
import {gardenAreaEffects,type GardenAreaSource} from '../../../../server/src/town-building/gardenEffects';
import {coopEggCount,EGG_CAPACITY} from '../../../../server/src/town-building/poultry';
import {COOP_ART,ANIMAL_HEADS} from './animalAtlas';
import {TOWN_ANIMALS} from '../../../../server/src/town-building/game';
import {EggArtwork} from './PoultryUi';
import {BARN_PRODUCTS,barnProduct} from '../../../../server/src/town-building/barn';
import {barnWaiting} from './BarnUi';
import {entityFootprint} from '../../../../server/src/town-building/game';
import {MOMENT_ATLASES} from './momentAtlas';
import {buildingView} from './buildingViews';
import {FARMHOUSE_ART} from './structureAtlas';
import {uiMessage,uiText} from '../../i18n/uiText';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import './gardenStatus.css';
export interface TownStatusHandle{paint:(g:{x:number;y:number;tile:number;width:number;height:number;left?:number;top?:number},time:number,reduced:boolean)=>void}
export interface GardenStatusPlot{id:string;x:number;y:number;length:number;chicken?:boolean;duck?:boolean;insects?:boolean;insectLabel?:string}
function Sticker({children}:{children:ReactNode}){
 const id=useId();
 return <svg viewBox="-5 -5 58 58" aria-hidden="true" stroke="#70513b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
  <defs><filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
   <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="edge"/><feFlood floodColor="#bca17e"/><feComposite in2="edge" operator="in" result="outline"/>
   <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="paper"/><feFlood floodColor="#fff9eb"/><feComposite in2="paper" operator="in" result="border"/>
   <feMerge><feMergeNode in="outline"/><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs><g filter={`url(#${id})`}>{children}</g>
 </svg>;
}
/** The helper stickers wear the same head art as the animal's own signpost, so a duck is never drawn as a chicken. */
function AnimalHeadFace({species}:{species:typeof TOWN_ANIMALS[number]}){
 const rect=ANIMAL_HEADS.rects[TOWN_ANIMALS.indexOf(species)]!;
 return <Sticker><svg x="2" y="2" width="44" height="44" viewBox={rect.join(' ')} preserveAspectRatio="xMidYMid meet" stroke="none"><image href={townArtHref('animal-heads-v1')} width={ANIMAL_HEADS.width} height={ANIMAL_HEADS.height}/></svg></Sticker>;
}
const ChickenFace=()=><AnimalHeadFace species="chicken"/>;
const DuckFace=()=><AnimalHeadFace species="duck"/>;
/** Milk bottle or wool ball from the generated animal icon sheet. */
function ProductFace({index,yarn}:{index:number;yarn:boolean}){
 const file=yarn?'highland-yarn-v1':'animal-icons-v1',atlas=MOMENT_ATLASES[file],rect=atlas.rects[index]!;
 return <Sticker><svg x="4" y="2" width="40" height="44" viewBox={rect.join(' ')} preserveAspectRatio="xMidYMid meet" stroke="none"><image href={townArtHref(file)} width={atlas.width} height={atlas.height}/></svg></Sticker>;
}
const barnLabel=(entity:Entity,count:number)=>uiMessage(barnProduct(entity)==='milk'?'Milk · {count}/{capacity}':barnProduct(entity)==='yarn'?'Yarn · {count}/{capacity}':'Wool · {count}/{capacity}',{count,capacity:BARN_PRODUCTS[barnProduct(entity)!].capacity});
function InsectFace(){return <Sticker><path d="m18 12-5-7m17 7 5-7M9 22l-6-3m7 13-6 4m34-14 6-3m-6 13 6 4" fill="none"/><path d="M8 27c-1-24 33-25 33 0 0 21-33 21-33 0Z" fill="#c3bbb2"/><path d="m14 22 7 3m6 0 7-3m-14 14q5-5 10 0" fill="none"/><circle cx="18" cy="28" r="1.5" fill="#70513b" stroke="none"/><circle cx="31" cy="28" r="1.5" fill="#70513b" stroke="none"/></Sticker>;}
/** Purely visual indicators. The existing scene frame clock supplies positions;
 * no independent timer, hit targets, simulation or reward claims. */
export function TownStatusLayer({ref,mapId='town',entities,insects=[],extraPlots=[]}:{ref:Ref<TownStatusHandle>;mapId?:MapId;entities:readonly Entity[];insects?:readonly GardenAreaSource[];extraPlots?:readonly GardenStatusPlot[]}){
 useUiLanguage();const nodes=useRef(new Map<string,HTMLDivElement>());
 const plots:GardenStatusPlot[]=[...entities.filter(e=>e.garden).map<GardenStatusPlot>(patch=>({...patch,length:2,...gardenAreaEffects(patch,entities,insects,mapId)})),...extraPlots].filter(p=>p.chicken||p.duck||p.insects);
 const coops=entities.filter(e=>e.blueprintId==='coop');
 const barns=entities.filter(e=>barnProduct(e));
 useImperativeHandle(ref,()=>({paint(g,time,reduced){
  function position(node:HTMLDivElement,x:number,y:number,size:number){
   node.hidden=x-size/2<0||x+size/2>g.width||y+size<0||y>g.height;
   node.style.left=`${(g.left??0)+x}px`;node.style.top=`${(g.top??0)+Math.max(2,y)}px`;
   node.style.setProperty('--garden-face-size',`${size}px`);
  }
  for(const plot of plots){const node=nodes.current.get(plot.id);if(!node)continue;const size=Math.max(22,Math.min(32,g.tile*1.1)),x=g.x+(plot.y+plot.length/2)*g.tile,y=g.y+(plot.x+.1)*g.tile-size*.6-(reduced?0:Math.sin(time/800)*1.5);position(node,x,y,size);}
  const now=Date.now();
  for(const coop of coops){
   const node=nodes.current.get(`eggs:${coop.id}`);if(!node)continue;
   const count=coopEggCount(coop.poultry,now),size=Math.max(26,Math.min(36,g.tile*1.6));
   const art=buildingView('coop',coop.direction)?.crop??COOP_ART.rect,roof=coop.x+2-Math.min(2.9,2*art[3]!/art[2]!);
   position(node,g.x+(coop.y+1)*g.tile,g.y+roof*g.tile-size-2,size);
   node.hidden||=count<1;
   const phase=time%3000,angle=reduced||phase>=520?0:Math.sin(phase/520*Math.PI*6)*Math.sin(phase/520*Math.PI)*9;
   node.style.transform=`translateX(-50%) rotate(${angle}deg)`;
   if(node.dataset.eggCount!==String(count)){
    node.dataset.eggCount=String(count);
    node.setAttribute('aria-label',uiMessage('Eggs · {count}/{capacity}',{count,capacity:EGG_CAPACITY}));
   }
  }
  // Milk and wool wait above their farmhouse's roof, with the same jiggle as eggs.
  for(const barn of barns){
   const node=nodes.current.get(`barn:${barn.id}`);if(!node)continue;
   const count=barnWaiting(barn,now),size=Math.max(26,Math.min(36,g.tile*1.6)),f=entityFootprint(barn);
   const art=buildingView('farmhouse',barn.direction)?.crop??FARMHOUSE_ART.rects[0]!,roof=f.x+f.width-Math.min(f.length*art[3]!/art[2]!,f.width+.9);
   position(node,g.x+(f.y+f.length/2)*g.tile,g.y+roof*g.tile-size-2,size);
   node.hidden||=count<1;
   const phase=(time+1500)%3000,angle=reduced||phase>=520?0:Math.sin(phase/520*Math.PI*6)*Math.sin(phase/520*Math.PI)*9;
   node.style.transform=`translateX(-50%) rotate(${angle}deg)`;
   if(node.dataset.barnCount!==String(count)){node.dataset.barnCount=String(count);node.setAttribute('aria-label',barnLabel(barn,count));}
  }
 }}),[plots,coops,barns]);
 return <div className="garden-status-layer town-status-layer">{plots.map(({id,chicken,duck,insects,insectLabel})=><div className="garden-status-faces" data-garden-status={id} key={id} ref={node=>{if(node)nodes.current.set(id,node);else nodes.current.delete(id);}}>{chicken&&<span data-garden-effect="chicken" role="img" aria-label={uiText('Chicken helper · crops grow 1 minute sooner')} title={uiText('Chicken helper · crops grow 1 minute sooner')}><ChickenFace/></span>}{duck&&<span data-garden-effect="duck" role="img" aria-label={uiText('Duck helpers · 30 seconds sooner this cycle')} title={uiText('Duck helpers · 30 seconds sooner this cycle')}><DuckFace/></span>}{insects&&<span data-garden-effect="insects" role="img" aria-label={uiText(insectLabel??'Insects · a quarter of the crops (rounded up) wither each growth cycle')} title={uiText(insectLabel??'Insects · a quarter of the crops (rounded up) wither each growth cycle')}><InsectFace/></span>}</div>)}{coops.map(coop=><div className="garden-status-faces coop-egg-sticker" data-coop-eggs={coop.id} key={`eggs:${coop.id}`} hidden role="img" aria-label={uiMessage('Eggs · {count}/{capacity}',{count:coopEggCount(coop.poultry,Date.now()),capacity:EGG_CAPACITY})} ref={node=>{if(node)nodes.current.set(`eggs:${coop.id}`,node);else nodes.current.delete(`eggs:${coop.id}`);}}><span><Sticker><EggArtwork/></Sticker></span></div>)}{barns.map(barn=><div className="garden-status-faces coop-egg-sticker" data-barn-product={barnProduct(barn)!} key={`barn:${barn.id}`} hidden role="img" aria-label={barnLabel(barn,barnWaiting(barn,Date.now()))} ref={node=>{if(node)nodes.current.set(`barn:${barn.id}`,node);else nodes.current.delete(`barn:${barn.id}`);}}><span><ProductFace yarn={barnProduct(barn)==='yarn'} index={barnProduct(barn)==='wool'?2:0}/></span></div>)}</div>;
}
