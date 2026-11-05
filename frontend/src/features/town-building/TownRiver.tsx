import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type ButtonHTMLAttributes} from 'react';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import {townSceneGeometry} from './forestWorld';
import {fitTiles} from './townViewport';
import {GiftArt,RiverArt,FilledBasketArt} from './riverArt';
import {LockIcon} from './TownActionIcons';
import type {TownRiverController} from './useTownRiver';
import {RiverDialog} from './riverDialogs';
import './townRiver.css';
import {useTownRelaxing} from './TownRelaxingView';
import {useTownMapHost} from './TownMapLayout';
/** The same river artwork becomes scenery while the map is in relaxing mode. */
function RiverObject(props:ButtonHTMLAttributes<HTMLButtonElement>){
 const relaxing=useTownRelaxing();
 return relaxing?<span className={props.className} style={props.style} hidden={props.hidden} aria-hidden="true">{props.children}</span>:<button {...props}/>;
}
/** Fixed river fixtures: the river basket and the friend takeaway raft (shown to children as the "Friendly raft"). Not buildable, never buffed. */
export function TownRiverObjects({river,canvas,zoom,camera,blocked}:{river:TownRiverController;canvas:RefObject<HTMLCanvasElement|null>;zoom:number;camera:{x:number;y:number};blocked:boolean}){
 useUiLanguage();const [size,setSize]=useState({left:0,top:0,width:0,height:0}),[,refresh]=useState(0),measure=useRef(()=>{});
 const relaxing=useTownRelaxing();
 const editing=useTownMapHost()?.editing;
 const data=river.basket.isError?undefined:river.basket.data,received=useRef({data,at:performance.now()});
 if(received.current.data!==data)received.current={data,at:performance.now()};
 // The fitted canvas can be narrower or shorter than its stage. Share its exact
 // bounds and local coordinates, including centering changes during edit/view.
 useLayoutEffect(()=>{
  const scene=canvas.current,parent=scene?.parentElement;if(!scene||!parent)return;
  let frame=0;
  const update=()=>{frame=0;const c=scene.getBoundingClientRect(),p=parent.getBoundingClientRect();const next={left:c.left-p.left-parent.clientLeft+parent.scrollLeft,top:c.top-p.top-parent.clientTop+parent.scrollTop,width:c.width,height:c.height};setSize(old=>old.left===next.left&&old.top===next.top&&old.width===next.width&&old.height===next.height?old:next);};
  const schedule=measure.current=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new ResizeObserver(schedule);observer.observe(scene);observer.observe(parent);schedule();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);measure.current=()=>{};};
 },[canvas]);
 useLayoutEffect(()=>{measure.current();},[zoom,camera.x,camera.y,editing,relaxing,river.target]);
 useEffect(()=>{if(!data?.decorations?.length)return;const timer=setInterval(()=>refresh(n=>n+1),1000);return()=>clearInterval(timer);},[data]);
 useEffect(()=>{if(!river.autoReport||blocked||relaxing)return;const timer=setInterval(()=>{if(!document.querySelector('dialog[open]')){river.setAutoReport(false);river.setPanel('visitors');}},300);return()=>clearInterval(timer);},[river.autoReport,blocked,relaxing]);
 const g=townSceneGeometry(size.width,size.height,zoom,camera),anchor=(row:number,col:number)=>({left:g.offsetX+col*g.tile,top:g.offsetY+row*g.tile});
 const basket=anchor(16.5,6.5),raft=anchor(17.5,26.5),inside=(p:{left:number;top:number})=>p.left>=32&&p.left<=size.width-32&&p.top>=36&&p.top<=size.height-32;
 const count=data&&'unopenedCount'in data?data.unopenedCount:0;
 const now=(data?.serverNow??0)+performance.now()-received.current.at;
 const delivered=(data?.decorations??[]).filter(d=>d.expiresAt>now);
 // Never larger than a house (3 wide × 2 tall), counting contents that rise above the basket;
 // a balloon basket may stand 2 wide × 3 tall. Spacing follows the scaled width.
 const rise={balloons:1.35,gnome:1.24,flowers:1.15} as Record<string,number>;
 const sized=(decoration?:string)=>{const up=decoration?rise[decoration]??1.15:1,box=fitTiles(68,58*up,g.tile,decoration==='balloons'?2:3,decoration==='balloons'?3:2);return {width:box.width,height:box.height/up,minHeight:box.height/up};};
 const plain=sized(),shown=delivered.slice(0,3).map(d=>sized(d.decoration));
 const offsets=shown.reduce<number[]>((list,box,i)=>[...list,(list[i]??0)+box.width-2],[0]);
 const empty={left:basket.left+offsets[shown.length]!,top:basket.top,...plain};
 return <>
  <div className="town-river-objects" style={size} aria-label={uiText('On the river')}>
   {((!river.target&&!delivered.length)||river.target&&data&&'canSend'in data&&data.canSend)&&<RiverObject type="button" className="town-river-world-button town-river-basket" style={empty} hidden={blocked||!inside(empty)} aria-label={uiText(river.target?'Leave a river surprise':'Open river basket')} onClick={()=>river.setPanel('basket')}><GiftArt index={1}/>{!relaxing&&count>0&&<b>{count}</b>}</RiverObject>}
   <RiverObject type="button" className={`town-river-world-button town-sharing-raft ${river.raft.data?.unlocked?'':'is-locked'}`} style={{...raft,...plain}} hidden={blocked||!inside(raft)} aria-label={uiText('Open river raft')} onClick={()=>river.setPanel('raft')}><RiverArt index={0}/>{!relaxing&&!river.raft.data?.unlocked&&<span className="town-raft-lock"><LockIcon/></span>}</RiverObject>
   {delivered.length>3&&<span className="town-river-basket-overflow" style={{left:basket.left+offsets[1]!,top:basket.top,transform:`translate(-50%,-86%) scale(${plain.width/68})`,transformOrigin:'0 100%'}} hidden={blocked||!inside(basket)} aria-hidden="true">{[0,1,2].map(i=><span key={i}><GiftArt index={0}/></span>)}</span>}
   {delivered.slice(0,3).map((d,i)=>{
    const p={left:basket.left+offsets[i]!,top:basket.top,...shown[i]!};
    return <RiverObject type="button" className="town-river-world-button town-river-delivered-basket" key={d.id} style={p} hidden={blocked||!inside(p)} aria-label={uiText('River surprise')} onClick={()=>{river.setPanel('basket');if(!river.target)void river.open(d.id);}}><FilledBasketArt decoration={d.decoration}/></RiverObject>;
   })}
  </div>
  {river.panel&&!relaxing&&<RiverDialog river={river}/>}
 </>;
}
export function TownRiverButtons({river,blocked=false}:{river:TownRiverController;blocked?:boolean}){
 useUiLanguage();if(blocked)return null;
 return <span className="town-river-toolbar"><button type="button" onClick={()=>river.setPanel('basket')}><GiftArt index={0}/><span>{uiText('River basket')}</span></button><button type="button" onClick={()=>river.setPanel('raft')}><RiverArt index={0}/><span>{uiText('River raft')}</span></button></span>;
}
