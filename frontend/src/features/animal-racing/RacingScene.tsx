import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RacingState } from '../../api/roadRacing';
import { COURSE_LENGTH, TERRAIN, terrainAt } from '../../../../server/src/road-racing/course';
import { ANIMAL_NAMES } from '../../../../server/src/road-racing/questions';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText, uiMessage } from '../../i18n/uiText';
import { RacingAnimal, RacingRunnerSprite, type RacingMotion } from './RacingArt';
import { buildTerrainSections } from './terrainVisual';
import { racerPositions } from './raceOrder';
type Race=NonNullable<RacingState['race']>;
type EffectSlot='speed'|'slow'|'empty';
const MAX_EFFECT_SLOTS=3;
const terrainSections=buildTerrainSections(TERRAIN,COURSE_LENGTH*4/TERRAIN.length);
function effectSlots(boosts:number,slows:number):EffectSlot[]{
  const speedCount=Math.min(MAX_EFFECT_SLOTS,Math.max(0,Math.floor(boosts)));
  const slowCount=Math.min(MAX_EFFECT_SLOTS-speedCount,Math.max(0,Math.floor(slows)));
  return [...Array.from({length:speedCount},()=> 'speed' as const),...Array.from({length:slowCount},()=> 'slow' as const),...Array.from({length:MAX_EFFECT_SLOTS-speedCount-slowCount},()=> 'empty' as const)];
}
function effectLabel(boosts:number,slows:number){
  return [boosts>0?uiMessage('{count} boost stacks',{count:boosts}):uiMessage('{count} boost stacks',{count:0}),slows>0?uiMessage('{count} slowdown stacks',{count:slows}):''].filter(Boolean).join(', ');
}
function EffectSlots({boosts,slows,className,ariaLabel}:{boosts:number;slows:number;className:string;ariaLabel:string}){
  return <span className={className} aria-label={ariaLabel}>{effectSlots(boosts,slows).map((slot,index)=><i key={index} className={slot==='speed'?'is-active is-speed':slot==='slow'?'is-active is-slow':'is-empty'} aria-hidden="true">{slot==='slow'?'🐌':'⚡'}</i>)}</span>;
}
export function RacingScene({race,receivedAt}:{race:Race;receivedAt:number}) {
  const [frame,setFrame]=useState(performance.now()),camera=useRef(0),previous=useRef(performance.now());
  const language=useUiLanguage();
  useEffect(()=>{let id=0;const run=(now:number)=>{setFrame(now);id=requestAnimationFrame(run);};id=requestAnimationFrame(run);return()=>cancelAnimationFrame(id);},[]);
  const elapsed=race.status==='racing'?Math.max(0,(frame-receivedAt)/1000):0;
  const dt=Math.min(.9,elapsed);
  const player=race.racers.find(r=>r.player)!,distance=Math.min(COURSE_LENGTH,player.distance+player.speed*dt);
  const delta=Math.min(.1,Math.max(0,(frame-previous.current)/1000));previous.current=frame;
  const finishLag=window.innerWidth*.55/4,finishReveal=Math.max(0,(distance-COURSE_LENGTH*.88)/(COURSE_LENGTH*.12));
  const cameraTarget=Math.max(0,distance-finishLag*Math.min(1,finishReveal));
  if(race.status==='racing')camera.current+=(cameraTarget-camera.current)*(1-Math.exp(-delta/0.35));else camera.current=Math.max(0,distance-finishLag);
  const worldOffset=camera.current*4,effectNow=race.updatedAt+elapsed*1000;
  const stacks=race.status==='racing'?race.stacks.filter(expiry=>expiry>effectNow).length:0;
  const slows=race.status==='racing'?race.slows.filter(expiry=>expiry>effectNow).length:0;
  const projected=race.racers.map((r,lane)=>{const d=Math.min(COURSE_LENGTH,r.distance+r.speed*dt),terrain=terrainAt(d),jump=terrain==='fence'&&(d%150)%40>24;return {r,lane,d,terrain,jump};});
  const positions=racerPositions(projected.map(({r,d})=>({distance:d,finishedAt:r.finishedAt})));
  return <section className="racing-scene-wrap" aria-label={uiText('Race track')}>
    <div className="racing-order-pack" role="list" aria-label={uiText('Race standings')}>
      {projected.map(({r},index)=>{
        const rank=positions[index]!;
        return <div key={r.animal} role="listitem" aria-posinset={rank+1} aria-setsize={projected.length}
          className={`racing-order-friend ${r.player?'is-you':''}`} data-rank={rank+1}
          style={{'--rank':rank} as CSSProperties}
          aria-label={`${ANIMAL_NAMES[r.animal][language==='vi'?1:0]}, ${uiMessage('Place {place} of 6',{place:rank+1})}${r.player?', '+uiText('You'):''}`}>
          <RacingAnimal animal={r.animal} face/>{r.player&&<b>{uiText('You')}</b>}
        </div>;
      })}
    </div>
    <div className={`racing-track ${race.status==='racing'?'':'is-still'}`} data-stacks={stacks}>
      <div className="racing-course-world" style={{transform:`translateX(${-worldOffset}px)`}} aria-hidden="true">
        <div className="racing-terrain-extension terrain-land is-before" style={{backgroundPosition:'2400px 0px'}}/>
        {terrainSections.map(({terrain,...style},index)=><div key={index} className={`racing-terrain terrain-${terrain}`} style={style}/>)}
        <div className="racing-terrain-extension terrain-water is-after" style={{backgroundPosition:'-4782px 0px'}}/>
        <div className="racing-finish-line" style={{left:COURSE_LENGTH*4}}/>
      </div>
      <div className="racing-lanes-layer" aria-hidden="true">
        {projected.map(({r,terrain})=><div key={r.animal} className={`racing-lane ${r.player?'is-player':''}`} data-terrain={terrain}/>)}
      </div>
      <div className="racing-obstacles-world" style={{transform:`translateX(${-worldOffset}px)`}} aria-hidden="true">
        {projected.flatMap(({r,lane})=>terrainSections.flatMap(({terrain},section)=>terrain==='fence'
          ?[0,1,2].map(rock=><span key={`${r.animal}-${section}-${rock}`} className="racing-rock" style={{left:section*600+130+rock*160,top:`calc((${lane} + .72) * 100% / 6)`}}/>)
          :[]))}
      </div>
      <div className="racing-runners-layer">
        {projected.map(({r,lane,d,terrain,jump})=>{
          const live=race.status==='racing',buffs=live?(r.player?stacks:Math.max(0,Math.min(3,Math.floor((r.speed-8.6)/.5)))):0,motion:RacingMotion=buffs===3?'ultra':buffs>0?'fast':'normal';
          const runnerSlows=live&&r.player?slows:0;
          return <div key={r.animal} className={`racing-runner ${r.player?'is-player':''} ${jump?'is-jumping':''} ${terrain==='water'?'is-swimming':''} ${r.player&&stacks>=2?'is-glowing':''}`} style={{left:`calc(30% + ${(r.player?distance:d)*4-worldOffset}px)`,top:`calc((${lane} + 1) * 100% / 6.5)`,'--gait':`${Math.max(.14,.65-r.speed*.035)}s`} as CSSProperties}>
            <EffectSlots boosts={buffs} slows={runnerSlows} className="racing-buffs" ariaLabel={effectLabel(buffs,runnerSlows)} />
            <RacingRunnerSprite animal={r.animal} motion={motion} swimming={terrain==='water'}/>
          </div>
        })}
      </div>
    </div>
    <div className="racing-track-footer"><span>{uiText('Finish line')} <b>{Math.min(100,Math.floor(distance/12))}%</b></span><progress max="1200" value={distance} aria-label={uiText('Race progress')}/><EffectSlots boosts={stacks} slows={slows} className="racing-stack-meter" ariaLabel={effectLabel(stacks,slows)} /></div>
  </section>;
}
