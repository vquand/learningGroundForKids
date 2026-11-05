import {WOMENS_DAY_BLOB_ART} from './womensDayArt';
import {WOMENS_DAY_2026_POLICY as POLICY,WOMENS_DAY_VISITORS} from '../../../../server/src/town-building/events/womensDay2026Model';
import {useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import type {Entity} from '../../../../server/src/town-building/game';
import {FloatingHeart} from '../../components/emotes/HeartEmote';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import {townSceneGeometry} from './forestWorld';
import {createFlowerWorld,stepFlowerWorld} from './womensDayWorld';
import {WOMENS_DAY_PHRASES} from './womensDayPhrases';
import './womensDay.css';
import {useTownRelaxing} from './TownRelaxingView';
const CROPS=[[33,85,439,396],[546,83,440,397],[1063,83,440,398],[54,669,374,250],[570,557,321,416],[945,685,569,231]] as const;
export interface WomensDayVisualProps{canvas:RefObject<HTMLCanvasElement|null>;entities:Entity[];images:Map<string,HTMLImageElement>;occurrence:string;zoom:number;camera:{x:number;y:number};blocked:boolean;onGreet?:(visitorId:string)=>void}
/** A decorative client world. No commands, inventory, awards or persistence. */
export function WomensDayCelebration(props:WomensDayVisualProps){
 const language=useUiLanguage();
 const relaxing=useTownRelaxing(),Friend=relaxing?'span':'button';
 const world=useMemo(()=>createFlowerWorld(props.entities),[props.entities,props.occurrence]);
 const host=useRef<HTMLDivElement>(null),paint=useRef<HTMLCanvasElement>(null),buttons=useRef(new Map<number,HTMLElement>()),bubble=useRef<HTMLDivElement>(null);
 const current=useRef(props);current.current=props;
 const [greeting,setGreeting]=useState<{blob:number;phrase:number;id:number}|null>(null);
 const greetingRef=useRef(greeting);greetingRef.current=greeting;
 const nextPhrase=useRef(0),repaint=useRef<(()=>void)|null>(null);
 useEffect(()=>{setGreeting(null);},[world,props.blocked]);
 useEffect(()=>{if(!greeting)return;const timer=setTimeout(()=>setGreeting(null),8000);return()=>clearTimeout(timer);},[greeting]);
 useEffect(()=>{
  if(!host.current||!paint.current)return;
  const container=host.current,surface=paint.current,ctx=surface.getContext('2d')!,reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,last=0;
  function draw(now:number){
   const p=current.current,scene=p.canvas.current;if(!scene)return;
   const width=scene.clientWidth,height=scene.clientHeight,ratio=Math.min(devicePixelRatio||1,2);
   container.style.left=`${scene.offsetLeft}px`;container.style.top=`${scene.offsetTop}px`;container.style.width=`${width}px`;container.style.height=`${height}px`;
   if(surface.width!==Math.round(width*ratio)||surface.height!==Math.round(height*ratio)){surface.width=Math.round(width*ratio);surface.height=Math.round(height*ratio);}
   ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   const visible=document.visibilityState==='visible',dt=last&&visible?(now-last)/1000:0;last=now;
   if(!p.blocked)stepFlowerWorld(world,dt,reduced.matches);
   const {tile,offsetX,offsetY}=townSceneGeometry(width,height,p.zoom,p.camera),sheet=p.images.get('womensDay');
   const sprite=(index:number,x:number,y:number,w:number)=>{if(!sheet?.complete||!sheet.naturalWidth)return;const c=CROPS[index]!,h=w*c[3]/c[2];ctx.drawImage(sheet,c[0],c[1],c[2],c[3],x-w/2,y-h,w,h);};
   // Fixed tree hooks do not occupy or block construction cells.
   for(const [i,h]of world.plan.hanging.entries()){
    const x=offsetX+h.y*tile,y=offsetY+(h.x-.45)*tile;
    sprite(i%2?4:5,x,y,tile*(i%2?1.05:2.1));
   }
   for(const [i,f]of world.plan.flowers.entries())if(world.planted.has(i)||reduced.matches)
    sprite(3,offsetX+(f.y+.5)*tile,offsetY+(f.x+.85)*tile,tile*.7);
   for(const b of world.blobs){
    const x=offsetX+b.y*tile,y=offsetY+b.x*tile,size=tile*POLICY.bodySize,target=Math.max(44,size),button=buttons.current.get(b.id);
    if(button){button.style.left=`${x-target/2}px`;button.style.top=`${y-target}px`;button.style.width=`${target}px`;button.style.height=`${target}px`;button.hidden=p.blocked||x<target/2||x>width-target/2||y<target||y>height;
     const body=button.firstElementChild as HTMLElement,crop=WOMENS_DAY_BLOB_ART.crops[b.id]!;const bodyHeight=size*crop[3]/crop[2];body.style.width=`${size}px`;body.style.height=`${bodyHeight}px`;body.style.left=`${(target-size)/2}px`;const heart=button.lastElementChild as HTMLElement,heartSize=Math.max(5,size*.36);heart.style.width=heart.style.height=`${heartSize}px`;heart.style.left=`${(target-heartSize)/2}px`;heart.style.top=`${target-bodyHeight-heartSize*1.2}px`;const bounce=reduced.matches||p.blocked?0:Math.sin(world.seconds*4+b.id)*.035;const planting=b.target!==null&&!b.path.length;body.style.transform=`scale(${1+bounce+(planting ? .08 : 0)},${1-bounce-(planting ? .08 : 0)}) rotate(${bounce*50+(planting?8:0)}deg)`;}
    // A brief burst every eleven seconds, staggered per blob.
    const phase=(world.seconds+b.id*1.8)%POLICY.petalPeriod;
    if(!reduced.matches&&phase<1.7&&!p.blocked){for(let j=0;j<5;j++){const t=phase/1.7,a=j*1.25+b.id,reach=tile*t*1.2;ctx.save();ctx.translate(x+Math.cos(a)*reach,y-size*.5-Math.sin(t*Math.PI)*tile*.8+Math.sin(a)*reach*.3);ctx.rotate(a+t*3);ctx.globalAlpha=1-t;ctx.fillStyle=['#efb2c2','#fff0ad','#cdb5df'][j%3]!;ctx.strokeStyle='#977456';ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(0,0,3+tile*.035,2+tile*.02,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}}
   }
   const selected=greetingRef.current&&world.blobs.find(b=>b.id===greetingRef.current!.blob);
   if(bubble.current&&selected){const w=bubble.current.offsetWidth,h=bubble.current.offsetHeight,x=offsetX+selected.y*tile,y=offsetY+selected.x*tile;const top=y-tile*POLICY.bodySize-h-8;bubble.current.style.left=`${Math.max(6,Math.min(width-w-6,x-w/2))}px`;bubble.current.style.top=`${Math.max(6,Math.min(height-h-6,top<6?y+15:top))}px`;}
  }
  const animate=(now:number)=>{draw(now);if(!reduced.matches)frame=requestAnimationFrame(animate);};
  const refresh=()=>{cancelAnimationFrame(frame);last=0;draw(performance.now());if(!reduced.matches)frame=requestAnimationFrame(animate);};
  const resize=new ResizeObserver(refresh);if(props.canvas.current)resize.observe(props.canvas.current);
  reduced.addEventListener('change',refresh);refresh();
  // A React update may move the camera or open a bubble while motion is reduced.
  repaint.current=refresh;
  return()=>{cancelAnimationFrame(frame);resize.disconnect();reduced.removeEventListener('change',refresh);repaint.current=null;};
 },[world]);
 useEffect(()=>{repaint.current?.();},[props.zoom,props.camera,props.blocked,props.images,greeting,language,relaxing]);
 return <div ref={host} className="town-celebration" role="group" aria-label={uiText('Vietnamese Women’s Day')}>
  <canvas ref={paint} className="town-celebration-art" aria-hidden="true"/>
  {world.blobs.map(b=><Friend key={b.id} ref={node=>{if(node)buttons.current.set(b.id,node);else buttons.current.delete(b.id);}} className="town-flower-friend" hidden={props.blocked} aria-hidden={relaxing} aria-label={`${uiText('Flower friend')} ${b.id+1} · ${uiText(WOMENS_DAY_BLOB_ART.accessories[b.id]!)}`} title={relaxing?undefined:uiText('Tap a flower friend for a little wish.')} onClick={relaxing?undefined:()=>{props.onGreet?.(WOMENS_DAY_VISITORS[b.id]!.id);b.greeting=8;setGreeting({blob:b.id,phrase:nextPhrase.current++%WOMENS_DAY_PHRASES.length,id:Date.now()});}}>
   <svg viewBox={WOMENS_DAY_BLOB_ART.crops[b.id]!.join(' ')} aria-hidden="true"><image href={WOMENS_DAY_BLOB_ART.source} width={WOMENS_DAY_BLOB_ART.width} height={WOMENS_DAY_BLOB_ART.height}/></svg>
   <span className="town-blob-heart"><FloatingHeart key={greeting?.blob===b.id?greeting.id:0}/></span>
  </Friend>)}
  {greeting&&!props.blocked&&!relaxing&&<div ref={bubble} className="town-flower-wish" role="status"><p>{uiText(WOMENS_DAY_PHRASES[greeting.phrase]!)}</p><button type="button" aria-label={uiText('Close')} onClick={()=>setGreeting(null)}>×</button></div>}
 </div>;
}
