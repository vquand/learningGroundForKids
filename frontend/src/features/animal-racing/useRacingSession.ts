import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cost } from '../../../../server/src/town-building/game';
import { actRace, leaveRace, loadRace, startRace, type RacingAction, type RacingSettings, type RacingState } from '../../api/roadRacing';
export function useRacingSession(profile:string) {
  const [rewardReceipt,setRewardReceipt]=useState<{event:string;reward:Cost}>({event:'',reward:{}});
  const [state,setState]=useState<RacingState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [receivedAt,setReceivedAt]=useState(performance.now());
  const current=useRef(state),locked=useRef(false),mounted=useRef(true),left=useRef(false),starting=useRef(false);
  const adopt=useCallback((next:RacingState)=>{if(!mounted.current)return;current.current=next;setState(next);setReceivedAt(performance.now());},[]);
  const leave=useCallback(async()=>{
    left.current=true;const race=current.current?.race;if(race?.status!=='racing')return;
    adopt({...current.current!,race:{...race,status:'forfeited',stacks:[],slows:[]}});
    try{adopt(await leaveRace(profile,race.id));}catch{setError('We could not reconnect. Try again.');}
  },[profile,adopt]);
  const sync=useCallback(async()=>{try{adopt(await loadRace(profile));setError('');}catch{setError('We could not reconnect. Try again.');}},[profile,adopt]);
  useEffect(()=>{
    mounted.current=true;void sync();
    const hidden=()=>{if(document.hidden)void leave();};
    const pagehide=()=>{void leave();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);
    return()=>{mounted.current=false;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);const r=current.current?.race;if(r?.status==='racing')void leaveRace(profile,r.id).catch(()=>{});};
  },[profile,sync,leave]);
  const send=useCallback(async(action:RacingAction)=>{
    const value=current.current;if(locked.current||left.current||value?.race?.status!=='racing')return;
    locked.current=true;if(action.type!=='tick')setBusy(true);
    try {
      const next=await actRace(profile,value.revision,value.race.id,action);
      // A reply already in flight must not revive a locally forfeited race.
      if(left.current){await leaveRace(profile,value.race.id).then(adopt);return;}
      if(mounted.current&&next.race?.status==='finished')setRewardReceipt({event:next.race.id,reward:next.race.reward});
      adopt(next);setError('');
    }catch{if(!left.current){left.current=true;await sync();setError('We could not reconnect. Try again.');}}
    finally{locked.current=false;if(mounted.current)setBusy(false);}
  },[profile,adopt,sync]);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)void send({type:'tick'});},750);return()=>clearInterval(timer);},[send]);
  async function start(settings:RacingSettings) {
    const value=current.current;if(!value||locked.current||starting.current)return;
    locked.current=true;starting.current=true;left.current=false;setBusy(true);
    try{
      const next=await startRace(profile,value.revision,settings);
      if(document.hidden||left.current){adopt(await leaveRace(profile,next.race!.id));left.current=true;}else{adopt(next);setError('');}
    }catch{await sync();setError('We could not reconnect. Try again.');}
    finally{locked.current=false;starting.current=false;if(mounted.current)setBusy(false);}
  }
  return {rewardReceipt,state,busy,error,receivedAt,send,start,leave,sync};
}
